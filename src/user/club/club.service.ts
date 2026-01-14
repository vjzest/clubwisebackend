import {
  Injectable,
  ConflictException,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import mongoose, { Connection, Model, Types } from 'mongoose';
import { CreateClubDto, UpdateClubDto } from './dto/club.dto';
import { Club } from 'src/shared/entities/club.entity';
import { UploadService } from 'src/shared/upload/upload.service';
import { ClubMembers } from 'src/shared/entities/clubmembers.entity';
import { ClubJoinRequests } from 'src/shared/entities/club-join-requests.entity';
import { randomUUID } from 'node:crypto';
import { Chapter } from 'src/shared/entities/chapters/chapter.entity';
import { GroupChat } from 'src/shared/entities/chat/group-chat.entity';
import { ChapterMember } from 'src/shared/entities/chapters/chapter-member.entity';
import { Debate } from 'src/shared/entities/debate/debate.entity';
import { Issues } from 'src/shared/entities/issues/issues.entity';
import { Projects } from 'src/shared/entities/projects/project.entity';
import { RulesRegulations } from 'src/shared/entities/rules/rules-regulations.entity';
import { generateSlug } from 'src/utils/slug.util';
import { TPlugins } from 'typings';
import {
  EmitUserJoinApprovedProps,
  EmitUserJoinRejectedProps,
  EmitUserJoinRequestProps,
  NotificationEventsService,
} from 'src/notification/notification-events.service';
import { IssuesAdoption } from 'src/shared/entities/issues/issues-adoption.entity';
import { DebateAdoption } from 'src/shared/entities/debate/debate-adoption-entity';
import { ProjectAdoption } from 'src/shared/entities/projects/project-adoption.entity';
import { StdPlugin } from 'src/shared/entities/standard-plugin/std-plugin.entity';
import {
  CreateGuidingPrinciples,
  UpdateGuidingPrinciples,
} from './dto/guiding-principle.dto';
import { GuidingPrinciples } from 'src/shared/entities/guiding-principles.entity';
import { StdPluginAsset } from 'src/shared/entities/standard-plugin/std-plugin-asset.entity';
import { ForumFaqs } from 'src/shared/entities/forum-faqs.entity';
import { ForumAchievements } from 'src/shared/entities/forum-achievements.entity';
import { ForumProfile } from 'src/shared/entities/forum-profile.entity';

@Injectable()
export class ClubService {
  //injecting club schema
  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(Club.name) private readonly clubModel: Model<Club>,
    @InjectModel(Issues.name) private readonly issuesModel: Model<Issues>,
    @InjectModel(Debate.name) private readonly debatesModel: Model<Debate>,
    @InjectModel(Projects.name) private readonly projectModel: Model<Projects>,
    @InjectModel(RulesRegulations.name)
    private readonly rulesModel: Model<RulesRegulations>,
    @InjectModel(IssuesAdoption.name)
    private readonly issuesAdoptionModel: Model<IssuesAdoption>,
    @InjectModel(DebateAdoption.name)
    private readonly debateAdoptionModel: Model<DebateAdoption>,
    @InjectModel(ProjectAdoption.name)
    private readonly projectAdoptionModel: Model<ProjectAdoption>,
    private notificationEventsService: NotificationEventsService,

    @InjectModel(ClubMembers.name)
    private readonly clubMembersModel: Model<ClubMembers>,
    @InjectModel(ClubJoinRequests.name)
    private readonly clubJoinRequestsModel: Model<ClubJoinRequests>,
    private readonly s3FileUpload: UploadService,
    @InjectModel(Chapter.name)
    private readonly chapterModel: Model<Chapter>,
    @InjectModel(GroupChat.name)
    private readonly groupChatModel: Model<GroupChat>,
    @InjectModel(ChapterMember.name)
    private readonly chapterMemberModel: Model<ChapterMember>,

    @InjectModel(StdPlugin.name)
    private readonly stdPluginModel: Model<StdPlugin>,
    @InjectModel(GuidingPrinciples.name)
    private readonly guidingPrinciplesModel: Model<GuidingPrinciples>,
    @InjectModel(StdPluginAsset.name)
    private readonly stdPluginAssetModel: Model<StdPluginAsset>,
    @InjectModel(ForumFaqs.name)
    private readonly forumFaqsModel: Model<ForumFaqs>,
    @InjectModel(ForumAchievements.name)
    private readonly forumAchievementsModel: Model<ForumAchievements>,
    @InjectModel(ForumProfile.name)
    private readonly forumProfileModel: Model<ForumProfile>,
  ) { }

  /*
  --------------------CREATING A CLUB----------------------------
  parameter {CreateClubDto} createClubDto - The data to create a new club
  @Returns {Promise<Club>} - The created club
  */
  async createClub(createClubDto: CreateClubDto): Promise<Club> {
    // Start a session for the transaction
    const session = await this.clubModel.db.startSession();

    try {
      session.startTransaction();

      if (createClubDto.plugins.length < 1) {
        throw new BadRequestException('At least one plugin is required');
      }

      const sanitizedPlugins = createClubDto.plugins.map((plugin) => ({
        ...plugin,
        addedDate: new Date(),
      }));

      const slug = generateSlug(createClubDto.name);
      const existingClub = await this.clubModel.findOne({ slug });
      if (existingClub) {
        throw new ConflictException('A club with the same name already exists');
      }

      const uniqueUsername = await this.generateUniqueUsername(createClubDto.name);

      const uploadPromises = [this.uploadFile(createClubDto.profileImage)];

      if (createClubDto.coverImage) {
        uploadPromises.push(this.uploadFile(createClubDto.coverImage));
      }

      // Upload images first - outside transaction since it's  a separate service
      const [profileImageUrl, coverImageUrl] =
        await Promise.all(uploadPromises);

      const link = randomUUID();

      const clubData: any = {
        ...createClubDto,
        profileImage: profileImageUrl,
        link,
        plugins: sanitizedPlugins,
        username: uniqueUsername,
      };

      if (coverImageUrl) {
        clubData.coverImage = coverImageUrl;
      }

      // Create the club document
      const createdClub = new this.clubModel(clubData);

      // Save the club within the transaction
      const clubResponse = await createdClub.save({ session });
      ({ clubResponse });
      // Create the club member document for admin
      const createClubMember = new this.clubMembersModel({
        club: clubResponse._id,
        user: clubResponse.createdBy,
        role: 'owner',
        status: 'MEMBER',
      });

      // Save the club member within the transaction
      await createClubMember.save({ session });

      // If both operations succeed, commit the transaction
      await session.commitTransaction();
      return clubResponse;
    } catch (error) {
      // If any operation fails, abort the transaction
      await session.abortTransaction();

      console.error('Error creating club:', error);

      if (error instanceof ConflictException) {
        throw error;
      }

      throw new BadRequestException(
        'Failed to create club. Please try again later.',
      );
    } finally {
      // End the session
      await session.endSession();
    }
  }

  /*
  --------------------GETTING ALL CLUBS----------------------------

  @Returns {Promise<Club>} - All clubs
  */
  async getAllClubs(): Promise<Club[]> {
    try {
      return await this.clubModel.find().exec();
    } catch (error) {
      throw new BadRequestException(
        'Failed to fetch clubs. Please try again later.',
      );
    }
  }

  async getClubById(id: Types.ObjectId, isOnBoarded: boolean) {
    try {
      if (!isOnBoarded) {
        throw new ForbiddenException('User is not onboarded');
      }

      let club = await this.clubModel
        .aggregate([
          {
            $match: { _id: new mongoose.Types.ObjectId(id) },
          },
          {
            $lookup: {
              from: 'stdplugins', // Collection name for standard plugins
              let: { plugins: '$plugins' },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $in: [
                        '$_id',
                        {
                          $map: {
                            input: {
                              $filter: {
                                input: '$$plugins',
                                cond: { $eq: ['$$this.type', 'standard'] },
                              },
                            },
                            in: { $toObjectId: '$$this.plugin' },
                          },
                        },
                      ],
                    },
                  },
                },
                {
                  $project: {
                    _id: 1,
                    name: 1,
                    slug: 1,
                    logo: 1,
                    description: 1,
                  },
                },
              ],
              as: 'stdPluginDetails',
            },
          },
          {
            $addFields: {
              plugins: {
                $filter: {
                  input: '$plugins',
                  as: 'plugin',
                  cond: {
                    $or: [
                      { $eq: ['$$plugin.isArchived', false] },
                      { $not: ['$$plugin.isArchived'] } // keep if field doesn't exist
                    ]
                  }
                }
              }
            }
          },
          {
            $addFields: {
              plugins: {
                $map: {
                  input: '$plugins',
                  as: 'plugin',
                  in: {
                    $mergeObjects: [
                      '$$plugin',
                      {
                        $cond: [
                          { $eq: ['$$plugin.type', 'standard'] },
                          {
                            $arrayElemAt: [
                              {
                                $filter: {
                                  input: '$stdPluginDetails',
                                  cond: {
                                    $eq: [
                                      '$$this._id',
                                      { $toObjectId: '$$plugin.plugin' },
                                    ],
                                  },
                                },
                              },
                              0,
                            ],
                          },
                          {},
                        ],
                      },
                    ],
                  },
                },
              },
            },
          },
          {
            $project: {
              stdPluginDetails: 0, // Remove the temporary field
            },
          },
        ])
        .exec();

      club = club[0];

      if (!club) {
        throw new NotFoundException('Club not found');
      }

      const members = await this.clubMembersModel
        .find({ club: new Types.ObjectId(id) })
        .populate({
          path: 'user',
          select: '-password',
        })
        .lean()
        .exec();

      const chapters = await this.chapterModel.find({
        club: new Types.ObjectId(id),
      });

      // Extract member IDs for contribution counting
      const memberIds = members.map((member) => member.user._id);

      // Get contribution counts for all content types
      const [
        ruleCounts,
        issueCounts,
        debateCounts,
        projectCounts,
        issuesAdoptionCounts,
        debateAdoptionCounts,
        projectAdoptionCounts,
      ] = await Promise.all([
        this.rulesModel.aggregate([
          {
            $match: {
              club: new Types.ObjectId(id),
              createdBy: { $in: memberIds },
              publishedStatus: 'published',
            },
          },
          {
            $group: {
              _id: '$createdBy',
              count: { $sum: 1 },
            },
          },
        ]),
        this.issuesModel.aggregate([
          {
            $match: {
              club: new Types.ObjectId(id),
              createdBy: { $in: memberIds },
              publishedStatus: 'published',
            },
          },
          {
            $group: {
              _id: '$createdBy',
              count: { $sum: 1 },
            },
          },
        ]),
        this.debatesModel.aggregate([
          {
            $match: {
              club: new Types.ObjectId(id),
              createdBy: { $in: memberIds },
              publishedStatus: 'published',
            },
          },
          {
            $group: {
              _id: '$createdBy',
              count: { $sum: 1 },
            },
          },
        ]),
        this.projectModel.aggregate([
          {
            $match: {
              club: new Types.ObjectId(id),
              createdBy: { $in: memberIds },
              publishedStatus: 'published',
            },
          },
          {
            $group: {
              _id: '$createdBy',
              count: { $sum: 1 },
            },
          },
        ]),
        this.issuesAdoptionModel.aggregate([
          {
            $match: {
              club: new Types.ObjectId(id),
              proposedBy: { $in: memberIds },
              publishedStatus: 'published',
            },
          },
          {
            $group: {
              _id: '$proposedBy',
              count: { $sum: 1 },
            },
          },
        ]),
        this.debateAdoptionModel.aggregate([
          {
            $match: {
              club: new Types.ObjectId(id),
              proposedBy: { $in: memberIds },
              publishedStatus: 'published',
            },
          },
          {
            $group: {
              _id: '$proposedBy',
              count: { $sum: 1 },
            },
          },
        ]),
        this.projectAdoptionModel.aggregate([
          {
            $match: {
              club: new Types.ObjectId(id),
              proposedBy: { $in: memberIds },
              publishedStatus: 'published',
            },
          },
          {
            $group: {
              _id: '$proposedBy',
              count: { $sum: 1 },
            },
          },
        ]),
      ]);

      // Create a map of counts for easy lookup
      const countsMap = {
        rules: Object.fromEntries(
          ruleCounts.map((r) => [r?._id?.toString(), r?.count]),
        ),
        issues: Object.fromEntries(
          issueCounts.map((i) => [i?._id?.toString(), i?.count]),
        ),
        debates: Object.fromEntries(
          debateCounts.map((d) => [d?._id?.toString(), d?.count]),
        ),
        projects: Object.fromEntries(
          projectCounts.map((p) => [p?._id?.toString(), p?.count]),
        ),
        issuesAdoption: Object.fromEntries(
          issuesAdoptionCounts.map((a) => [a?._id?.toString(), a?.count]),
        ),
        debateAdoption: Object.fromEntries(
          debateAdoptionCounts.map((a) => [a?._id?.toString(), a?.count]),
        ),
        projectAdoption: Object.fromEntries(
          projectAdoptionCounts.map((a) => [a?._id?.toString(), a?.count]),
        ),
      };

      // Add contribution counts to each member
      const membersWithContributions = members.map((member) => {
        const userId = member?.user?._id?.toString();
        const contributions = {
          rules: countsMap?.rules[userId] || 0,
          issues: countsMap?.issues[userId] || 0,
          debates: countsMap?.debates[userId] || 0,
          projects: countsMap?.projects[userId] || 0,
          issuesAdoption: countsMap?.issuesAdoption[userId] || 0,
          debateAdoption: countsMap?.debateAdoption[userId] || 0,
          projectAdoption: countsMap?.projectAdoption[userId] || 0,
        };

        return {
          ...member,
          // contributions,
          totalContributions: Object.values(contributions).reduce(
            (a, b) => a + b,
            0,
          ),
        };
      });

      return {
        club,
        members: membersWithContributions,
        chapters,
      };
    } catch (error) {
      console.log({ error });
      if (error instanceof ForbiddenException) throw error;

      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(
        'Failed to fetch club. Please try again later.',
      );
    }
  }
  /*
  --------------------UPDATING ONE CLUB----------------------------

  @Param {string} id - The id of the club to update  @ID to create a new club
  @Returns {Promise<Club>} - The updated  club
  */
  async updateClub(id: string, updateClubDto: UpdateClubDto): Promise<Club> {
    console.log({ updateClubDto });

    try {
      const club = await this.clubModel.findById(id).exec();
      if (!club) {
        throw new NotFoundException('Club not found');
      }
      console.log({ parsed: JSON.parse(updateClubDto.domain) });

      const updateData: any = {
        ...updateClubDto,
        domain: JSON.parse(updateClubDto.domain),
      };
      console.log({ updateData });
      // Upload and update images if new files are provided
      if (updateClubDto.profileImage) {
        updateData.profileImage = await this.uploadFile(
          updateClubDto.profileImage,
        );
      }
      if (updateClubDto.coverImage) {
        updateData.coverImage = await this.uploadFile(updateClubDto.coverImage);
      } else if (updateClubDto.removeCoverImage === 'true') {
        updateData.coverImage = { url: '', filename: '' };
      }

      // Remove undefined values
      Object.keys(updateData).forEach(
        (key) => updateData[key] === undefined && delete updateData[key],
      );

      // Use findByIdAndUpdate to update the document
      const updatedClub = await this.clubModel
        .findByIdAndUpdate(id, updateData, { new: true })
        .exec();

      return updatedClub;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(
        'Failed to update club. Please try again later.',
      );
    }
  }

  /*
  --------------------DELETE A CLUB----------------------------

  @Returns {Promise<Club>} - The deleted club
  */

  async deleteClub(id: string) {
    try {
      const club = await this.clubModel.findById(id).exec();

      if (!club) {
        throw new NotFoundException('Club not found');
      }

      // Delete associated files first
      await this.cleanupFiles(club.profileImage.url, club.coverImage.url);

      // Then delete the club document
      const responce = await this.clubModel.findByIdAndDelete(id).exec();
      return responce;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(
        'Failed to delete club. Please try again later.',
      );
    }
  }

  /*
  --------------------GETTING  CLUBS OF THE SPECIFIED USER----------------------------
  @Param {string} id - The id of the user

  @Returns {Promise<Club>} - The deleted club
  */

  async getAllClubsOfUser(userId: Types.ObjectId) {
    try {
      const clubs = await this.clubMembersModel
        .find({ user: userId })
        .populate({
          path: 'club',
          select: 'name about domain profileImage coverImage isPublic ',
        })
        .populate({
          path: 'user',
          select:
            'userName firstName middleName lastName profileImage interests',
        })
        .exec();

      // Sort: pinned ascending (1, 2, 3...), then nulls at the end
      const sortedClubs = clubs.sort((a, b) => {
        if (a.pinned == null && b.pinned == null) return 0;
        if (a.pinned == null) return 1;  // a is null → push to end
        if (b.pinned == null) return -1; // b is null → a comes first
        return a.pinned - b.pinned;      // both non-null → numeric sort
      });

      return sortedClubs;
    } catch (error) {
      error;
    }
  }

  /*
  --------------------REQUEST  CLUB TO JOIN----------------------------
  @Param USERDATA AND CLUBID

  @Returns {Promise<Club>} - REQUESTED OR JOINED CLUB
  */

  async requestOrJoinClub(
    clubId: Types.ObjectId,
    userId: Types.ObjectId,
    user: any,
    requestNote?: string,
  ) {
    try {
      // Check if the club exists
      const existingClub = await this.clubModel.findOne({
        _id: clubId,
      });

      if (!existingClub) {
        throw new NotFoundException('Club not found');
      }

      // Check if the user is already a member or has a pending request
      const existingMember = await this.clubMembersModel.findOne({
        club: clubId,
        user: userId,
      });

      // Handle existing member status checks
      if (existingMember) {
        switch (existingMember.status) {
          case 'MEMBER':
            throw new BadRequestException(
              'You are already a member of this club',
            );
          case 'BLOCKED':
            throw new BadRequestException(
              'You have been blocked from this club',
            );
          // Add other status cases if needed
        }
      }

      // Handle join process based on club privacy
      if (existingClub.isPublic) {
        // Direct join for public clubs
        const response = await this.clubMembersModel.create({
          club: existingClub._id,
          user: userId,
          role: 'member',
          status: 'MEMBER',
        });
        return response;
      } else {
        // Check if there's already a pending request
        const existingRequest = await this.clubJoinRequestsModel.findOne({
          club: clubId,
          user: userId,
          status: 'REQUESTED',
        });

        if (existingRequest) {
          throw new BadRequestException(
            'You already have a pending request for this club',
          );
        }

        const sanitizedRequestNote =
          requestNote?.trim() !== '' ? requestNote?.trim() : undefined;

        // Create join request for private clubs
        const response = await this.clubJoinRequestsModel.create({
          club: existingClub._id,
          user: userId,
          status: 'REQUESTED',
          role: 'member',
          ...(sanitizedRequestNote && { requestNote: sanitizedRequestNote }),
        });

        const ownerAndAdmins = await this.clubMembersModel.find({
          role: { $in: ['owner', 'admin'] },
          club: existingClub._id,
        });

        const notificationMessage = `${user.firstName} ${user.lastName} sent request to join ${existingClub.name} `;
        const emitUserJoinRequest: EmitUserJoinRequestProps = {
          forum: {
            type: 'club',
            id: existingClub._id.toString(),
          },
          from: userId.toString(),
          message: notificationMessage,
          memberIds: ownerAndAdmins.map((member) => member.user.toString()),
        };

        await this.notificationEventsService.emitUserJoinRequest(
          emitUserJoinRequest,
        );

        return response;
      }
    } catch (error) {
      // Properly handle and propagate errors
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      console.error('Club join error:', error);
      throw new BadRequestException(
        'Failed to process club join request. Please try again later.',
      );
    }
  }

  /**
   * Cancel a pending join request for a club.
   * @param clubId - The id of the club to cancel the join request for
   * @param userId - The id of the user making the request
   * @returns The deleted join request document
   * @throws `BadRequestException` if the clubId is invalid
   * @throws `NotFoundException` if the user has not requested to join the club
   */
  async cancelJoinRequest(clubId: Types.ObjectId, userId: Types.ObjectId) {
    try {
      if (!clubId) {
        throw new BadRequestException('Invalid club id');
      }

      const response = await this.clubJoinRequestsModel.findOneAndDelete({
        club: clubId,
        user: userId,
        status: 'REQUESTED',
      });

      if (!response) {
        throw new NotFoundException('You have not requested to join this club');
      }

      return response;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      console.error('Error while canceling join request:', error);
      throw new BadRequestException(
        'Failed to cancel join request. Please try again later.',
      );
    }
  }

  /* -------------------------REQUEST FOR SINGLE CLUBS --------------------------- */
  // async getAllRequestsOfClub(clubId: Types.ObjectId) {
  //   try {
  //     const requests = await this.clubJoinRequestsModel
  //       .find({ club: clubId })

  //       .populate('club')
  //       .populate('user')
  //       .exec();
  //     return requests;
  //   } catch (error) {
  //     (error);
  //     throw new BadRequestException(
  //       'Failed to fetch club join requests. Please try again later.',
  //     );
  //   }
  // }

  /*-------------------------CECKING THE STATUS OF THE USER OF A CLUB ---------------------------*/

  async checkStatus(clubId: Types.ObjectId, userId: Types.ObjectId) {
    try {
      let status = 'VISITOR';

      const isMember = await this.clubMembersModel
        .findOne({ club: clubId, user: userId })
        .populate({
          path: 'club',
          select: 'name about domain profileImage coverImage isPublic ',
        })
        .populate({
          path: 'user',
          select:
            'userName firstName middleName lastName profileImage interests',
        })
        .exec();

      if (isMember) {
        status = isMember.status;
        return {
          status,
        };
      }
      const isRequested = await this.clubJoinRequestsModel.findOne({
        club: clubId,
        user: userId,
      });
      if (isRequested) {
        status = isRequested.status;
        return {
          status,
        };
      }
      return { status };
    } catch (error) {
      error;
      throw new BadRequestException(
        'Failed to fetch club join requests. Please try again later.',
      );
    }
  }

  /* ------------------GETTING ALL THE MEMBERS OF THE SINGLE CLUB------------------------- */
  async getAllMembersOfClub(clubId: Types.ObjectId) {
    try {
      const members = await this.clubMembersModel
        .find({ club: clubId })
        .populate({
          path: 'user',
          select: '-password',
        })
        .exec();
      return members;
    } catch (error) {
      error;
      throw new BadRequestException(
        'Failed to fetch club members. Please try again later.',
      );
    }
  }
  /*----------------SEARCHING FOR MEMBER OF THE SINGLE CLUB ------------------------*/
  async searchMemberOfClub(clubId: Types.ObjectId, search: string) {
    // Create a case-insensitive search regex
    const searchRegex = new RegExp(search, 'i');

    // Aggregate pipeline to search club members and their user information
    const members = await this.clubMembersModel.aggregate([
      // Match documents with the specified clubId
      {
        $match: {
          club: clubId,
        },
      },
      // Lookup to join with memmbers collection
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'userDetails',
        },
      },
      // Unwind the userDetails array (converts array to object)
      {
        $unwind: '$userDetails',
      },
      // Match documents where any of the specified user fields match the search string
      {
        $match: {
          $or: [
            { 'userDetails.userName': { $regex: searchRegex } },
            { 'userDetails.email': { $regex: searchRegex } },
            { 'userDetails.firstName': { $regex: searchRegex } },
            { 'userDetails.lastName': { $regex: searchRegex } },
          ],
        },
      },
      // Project only the needed fields
      {
        $project: {
          _id: 1,
          role: 1,
          status: 1,
          pinned: 1,
          user: {
            _id: '$userDetails._id',
            userName: '$userDetails.userName',
            email: '$userDetails.email',
            firstName: '$userDetails.firstName',
            lastName: '$userDetails.lastName',
            profileImage: '$userDetails.profileImage',
            isBlocked: '$userDetails.isBlocked',
          },
        },
      },
    ]);

    return members;
  }

  /*----------------------ACCEPTING OR REJECTING THE REQUEST---------------

  @PARAM groupId @user :userId*/
  async acceptOrRejectRequest(
    requestId: Types.ObjectId,
    userId: Types.ObjectId,
    clubId: Types.ObjectId,
    status: 'ACCEPTED' | 'REJECTED',
  ) {
    try {
      //in here i need to check the user is a admin of this club

      const isAdminOrModerator = await this.clubMembersModel.findOne({
        club: clubId,
        user: userId,
        $or: [{ role: 'admin' }, { role: 'moderator' }, { role: 'owner' }],
      });

      if (!isAdminOrModerator) {
        throw new BadRequestException(
          'You are not authorized to perform this action',
        );
      }

      // object based on status to query
      const updateData: any = { status };
      if (status === 'REJECTED') {
        // const response = await this.clubJoinRequestsModel.findOneAndDelete({
        //   _id: requestId,
        // });

        // return response;

        const response = await this.clubJoinRequestsModel
          .findOne({ _id: requestId })
          .populate('user') // Populate the 'user' field
          .populate('club'); // Populate the 'node' field

        if (!response) return null; // Handle case where request is not found

        await this.clubJoinRequestsModel.deleteOne({ _id: requestId });

        // Extract node details safely
        const club = response.club as any;
        const rejectedUser = response.user as any;

        const notificationMessage = `Admin has rejected your request to join ${club.name}`;

        const emitUserJoinRejected: EmitUserJoinRejectedProps = {
          forum: {
            type: 'club',
            id: club._id.toString(),
          },
          approver: userId.toString(),
          message: notificationMessage,
          memberIds: [rejectedUser._id.toString()],
        };

        await this.notificationEventsService.emitUserJoinRejected(
          emitUserJoinRejected,
        );

        return response;
      }

      const response = await this.clubJoinRequestsModel
        .findOneAndUpdate({ _id: requestId }, updateData, { new: true })
        .populate('club', 'name profileImage');

      const club = response.club as any;

      // If accepted, create club member
      if (response.status === 'ACCEPTED') {
        const createClubMember = new this.clubMembersModel({
          club: response.club,
          user: response.user,
          role: 'member',
          status: 'MEMBER',
        });
        await createClubMember.save();
      }

      const notificationMessage = `Admin has accepted your request to join ${club.name}`;

      const emitUserJoinApproved: EmitUserJoinApprovedProps = {
        forum: {
          type: 'club',
          id: club._id.toString(),
        },
        approver: userId.toString(),
        message: notificationMessage,
        memberIds: [response.user.toString()],
      };

      await this.notificationEventsService.emitUserJoinApproved(
        emitUserJoinApproved,
      );

      return response;
    } catch (error) {
      error;
      throw new BadRequestException(
        'Failed to process club join request. Please try again later.',
      );
    }
  }

  async pinClub(clubId: Types.ObjectId, userId: Types.ObjectId) {
    try {
      // Step 1: Find all pinned clubs sorted by priority (1 → 3)
      const pinnedClubs = await this.clubMembersModel
        .find({ user: userId, pinned: { $ne: null } })
        .sort({ pinned: 1 });

      // Step 2: Check if this club is already pinned
      const existing = pinnedClubs.find(
        (c) => c.club.toString() === clubId.toString(),
      );

      // ✅ If already pinned, do nothing
      if (existing) {
        return existing;
      }

      // Step 3: If there are already 3 pinned, unpin the oldest (pinned = 3)
      if (pinnedClubs.length >= 3) {
        const oldestPinned = pinnedClubs.pop();
        if (oldestPinned) {
          oldestPinned.pinned = null;
          await oldestPinned.save();
        }
      }

      // Step 4: Shift remaining pins down by 1 (1→2, 2→3)
      for (const club of pinnedClubs) {
        club.pinned = (club.pinned! + 1) as 1 | 2 | 3;
        await club.save();
      }

      // Step 5: Pin the selected club as #1 (most recent)
      const clubTopin = await this.clubMembersModel.findOneAndUpdate(
        { club: clubId, user: userId },
        { pinned: 1 },
        { new: true },
      );

      if (!clubTopin) {
        throw new Error('Club member not found.');
      }

      return clubTopin;
    } catch (error) {
      console.error(error);
      throw new BadRequestException('Failed to pin club. Please try again later.');
    }
  }

  async unpinClub(clubId: Types.ObjectId, userId: Types.ObjectId) {
    try {
      // Step 1: Find the club to unpin
      const clubToUnpin = await this.clubMembersModel.findOne({
        club: clubId,
        user: userId,
      });

      if (!clubToUnpin) {
        throw new Error('Club member not found');
      }

      // If it's not pinned, nothing to do
      if (clubToUnpin.pinned === null) {
        return clubToUnpin;
      }

      const unpinnedPosition = clubToUnpin.pinned; // 1, 2, or 3

      // Step 2: Unpin it
      clubToUnpin.pinned = null;
      await clubToUnpin.save();

      // Step 3: Get all remaining pinned clubs sorted by current position
      const pinnedClubs = await this.clubMembersModel
        .find({ user: userId, pinned: { $ne: null } })
        .sort({ pinned: 1 });

      // Step 4: Shift positions only for clubs after the one we removed
      for (const club of pinnedClubs) {
        if (club.pinned > unpinnedPosition) {
          club.pinned = (club.pinned - 1) as 1 | 2 | 3;
          await club.save();
        }
      }

      return clubToUnpin;
    } catch (error) {
      console.error(error);
      throw new BadRequestException(
        'Failed to unpin club. Please try again later.',
      );
    }
  }


  /*--------------------LEAVING CLUB API ----------------------------*/
  async leaveClub(clubId: Types.ObjectId, userId: Types.ObjectId) {
    // Starting a session for transaction
    const session = await this.connection.startSession();

    try {
      // Starting transaction
      session.startTransaction();

      // Performing both operations within the transaction
      const membershipResponse = await this.clubMembersModel.findOneAndDelete(
        {
          club: clubId,
          user: userId,
        },
        { session },
      );

      const joinRequestResponse =
        await this.clubJoinRequestsModel.findOneAndDelete(
          {
            club: clubId,
            user: userId,
          },
          { session },
        );

      // If user was neither a member nor had a join request
      if (!membershipResponse && !joinRequestResponse) {
        await session.abortTransaction();
        throw new BadRequestException('You are not a member of this club');
      }

      // commiting transaction
      await session.commitTransaction();

      return {
        membershipResponse,
        joinRequestResponse,
        message: 'You have left the club',
      };
    } catch (error) {
      // If any error occurs, transaction is aborted
      await session.abortTransaction();

      console.error('Leave club error:', error);

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException(
        'Failed to process club leave request. Please try again later.',
      );
    } finally {
      // session ended
      await session.endSession();
    }
  }
  // --------------------------UTIL FUNCTIONS------------------------------
  //handling file uploads
  private async uploadFile(file: Express.Multer.File) {
    try {
      //uploading file
      const response = await this.s3FileUpload.uploadFile(
        file.buffer,
        file.originalname,
        file.mimetype,
        'club',
      );
      return {
        url: response.url,
        filename: response.filename,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
      };
    } catch (error) {
      throw new BadRequestException(
        'Failed to upload file. Please try again later.',
      );
    }
  }

  //handling file delete

  private async cleanupFiles(...urls: string[]) {
    try {
      const deletePromises = urls
        .filter((url) => url) // Filter out null/undefined values
        .map((url) => this.s3FileUpload.deleteFile(url));

      await Promise.all(deletePromises);
    } catch (error) {
      console.error('Error cleaning up files:', error);
    }
  }
  /* -------------------------REQUEST FOR SINGLE CLUBS --------------------------- */
  async getAllRequestsOfClub(clubId: Types.ObjectId) {
    try {
      const requests = await this.clubJoinRequestsModel
        .find({ club: clubId })
        .populate({
          path: 'club',
          select: 'name about domain profileImage coverImage isPublic ',
        })
        .populate({
          path: 'user',
          select:
            'userName firstName middleName lastName profileImage interests',
        })
        .exec();
      return requests;
    } catch (error) {
      error;
      throw new BadRequestException(
        'Failed to fetch club join requests. Please try again later.',
      );
    }
  }

  /**
   * Retrieves all join requests made by a user.
   * @param userId - The id of the user to retrieve join requests for.
   * @returns A promise that resolves to an array of join requests, populated with club and user details.
   * @throws `BadRequestException` if there is an error while trying to get join requests.
   */
  async getAllRequestsOfUser(userId: Types.ObjectId) {
    try {
      const requests = await this.clubJoinRequestsModel
        .find({ user: userId, status: 'REQUESTED' })
        .populate({
          path: 'club',
          select: 'name about domain profileImage coverImage isPublic ',
        })
        .populate({
          path: 'user',
          select:
            'userName firstName middleName lastName profileImage interests',
        })
        .exec();
      return requests;
    } catch (error) {
      error;
      throw new BadRequestException(
        'Failed to fetch user join requests. Please try again later.',
      );
    }
  }

  async getChapterChats(clubId: string) {
    try {
      if (!clubId) {
        throw new BadRequestException('Please provide a valid club id');
      }
      const club = await this.clubModel.findById(new Types.ObjectId(clubId));
      if (!club) {
        throw new BadRequestException('Club not found');
      }

      const groupChats = await this.groupChatModel.aggregate([
        {
          $match: {
            club: new Types.ObjectId(clubId),
          },
        },
        {
          $lookup: {
            from: 'chaptermembers',
            localField: 'chapter',
            foreignField: 'chapter',
            as: 'chapterMembers',
          },
        },
      ]);

      return groupChats;
    } catch (error) {
      console.error('Error getting chapter chats:', error);
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException(
        'Failed to get chapter chats. Please try again later.',
      );
    }
  }

  async getClubStatistics(clubId: string) {
    try {
      const membersCount = await this.clubMembersModel
        .find({ club: new Types.ObjectId(clubId) })
        .countDocuments();
      const approvalCount = await this.clubJoinRequestsModel
        .find({ club: new Types.ObjectId(clubId), status: 'REQUESTED' })
        .countDocuments();
      return {
        membersCount,
        approvalCount,
      };
    } catch (error) {
      throw error;
    }
  }

  async addPlugin(
    clubId: string,
    plugin: { plugin: TPlugins; createdAt: Date; type: 'standard' | 'custom' },
  ): Promise<Club> {
    try {
      const clubExists = await this.clubModel.exists({ _id: clubId });

      if (!clubExists) throw new NotFoundException(`Club  ${clubId} not found`);

      let stdPlugin;
      if (plugin.type === 'standard') {
        stdPlugin = await this.stdPluginModel.findOne({ slug: plugin.plugin });
        if (!stdPlugin)
          throw new NotFoundException(`Module  ${plugin.plugin} not found`);
      }

      const existingPlugin = await this.clubModel.findOne({
        _id: clubId,
        'plugins.plugin': stdPlugin ? stdPlugin._id : plugin.plugin,
      });

      if (existingPlugin) {
        throw new BadRequestException(
          `Module '${plugin.plugin}' already exists for this club`,
        );
      }

      plugin.plugin = stdPlugin ? stdPlugin._id : plugin.plugin;

      const result = await this.clubModel.updateOne(
        { _id: clubId },
        {
          $addToSet: {
            plugins: plugin,
          },
        },
      );

      if (result.modifiedCount === 0 && result.matchedCount > 0) {
        console.log('Plugin was not added to the club');
      }

      const updatedClub = await this.clubModel.findById(clubId);
      return updatedClub;
    } catch (error) {
      console.error('Error adding plugin:', error);
      throw error;
    }
  }

  /**
   * Adds new guiding principles to the database
   * @param userId - ID of the user creating the principles
   * @param createGuidingPrinciples - Object containing guiding principles data
   * @returns Promise<{success: boolean, message: string}>
   * @throws {Error} If saving to database fails
   */
  async addGuidingPrinciples(
    userId: string,
    createGuidingPrinciples: CreateGuidingPrinciples,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const newGuidingPrinciple = new this.guidingPrinciplesModel({
        ...createGuidingPrinciples,
        club: new Types.ObjectId(createGuidingPrinciples.club),
        createdBy: new Types.ObjectId(userId),
      });

      await newGuidingPrinciple.save();

      return {
        success: true,
        message: 'Guiding principles added successfully',
      };
    } catch (error: unknown) {
      console.log(error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to save guiding principles: ${errorMessage}`);
    }
  }

  async updateGuidingPrinciples(
    userId: string,
    guidingPrincipleId: string,
    updateGuidingPrinciples: UpdateGuidingPrinciples,
  ) {
    try {
      const { title, content, visibility } = updateGuidingPrinciples;

      if (!title && !content && visibility === undefined) {
        throw new BadRequestException('At least one field is required');
      }

      const updatedGuidingPrinciple =
        await this.guidingPrinciplesModel.findByIdAndUpdate(
          new Types.ObjectId(guidingPrincipleId),
          {
            ...(title && { title }),
            ...(content && { content }),
            visibility,
            updatedBy: new Types.ObjectId(userId),
          },
          { new: true },
        );

      if (!updatedGuidingPrinciple) {
        throw new BadRequestException('Guiding principle not found');
      }

      return {
        success: true,
        message: 'Guiding principles updated successfully',
      };
    } catch (error) {
      console.log(error);
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Failed to update guiding principle',
      );
    }
  }

  async getGuidingPrinciples(clubId: string) {
    try {
      if (!clubId) {
        throw new BadRequestException('Please provide club id');
      }

      return await this.guidingPrinciplesModel
        .find({ club: new Types.ObjectId(clubId) })
        .sort({ createdAt: 1 });
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw error;
    }
  }

  async getAssetsByClubWithDeadline(clubId: string) {
    try {
      const issues = await this.issuesModel
        .find({
          club: new Types.ObjectId(clubId),
          publishedStatus: 'published',
        })
        .populate('createdBy', 'userName firstName lastName profileImage')
        .lean();
      const debates = await this.debatesModel
        .find({
          club: new Types.ObjectId(clubId),
          publishedStatus: 'published',
        })
        .populate('createdBy', 'userName firstName lastName profileImage')
        .lean();
      const projects = await this.projectModel
        .find({
          club: new Types.ObjectId(clubId),
          publishedStatus: 'published',
          deadline: { $exists: true, $ne: null },
        })
        .populate('createdBy', 'userName firstName lastName profileImage')
        .lean();
      const stdAssets = await this.stdPluginAssetModel
        .find({
          club: new Types.ObjectId(clubId),
          publishedStatus: 'published',
          'data.deadline': { $exists: true, $ne: null },
        })
        .populate('createdBy', 'userName firstName lastName profileImage')
        .lean();

      const issueEvents = issues.map((issue) => {
        return {
          ...issue,
          start: issue?.createdAt,
          end: issue?.deadline,
          eventType: 'issue',
        };
      });

      const debateEvents = debates.map((debate) => {
        return {
          ...debate,
          start: debate?.createdAt,
          end: debate?.closingDate,
          title: debate?.topic,
          eventType: 'debate',
        };
      });

      const projectEvents = projects.map((project: any) => {
        return {
          ...project,
          start: project?.createdAt,
          end: project?.deadline,
          eventType: 'project',
        };
      });

      const stdEvents = stdAssets.map((stdAsset: any) => {
        return {
          ...stdAsset,
          start: stdAsset?.createdAt,
          end: stdAsset?.data?.deadline,
          title: stdAsset?.data?.title,
          eventType: 'std',
        };
      });

      const events = [
        ...issueEvents,
        ...debateEvents,
        ...projectEvents,
        ...stdEvents,
      ];

      return {
        events,
      };
    } catch (error) {
      throw error;
    }
  }

  async getArchivedPlugins(clubId: string) {
    try {
      const club = await this.clubModel.findById(clubId).lean();
      const plugins = await Promise.all(
        club.plugins.map(async (p) => {
          if (p.type === "standard") {
            const std = await this.stdPluginModel.findOne({ _id: new Types.ObjectId(p.plugin) }).lean();
            return { ...p, plugin: std ?? p.plugin };
          }
          return p;
        })
      );

      return plugins.filter((plugin: any) => plugin.isArchived);
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  async manageArchive(clubId: string, body: { plugin: string, pluginType: 'standard' | 'custom', action: "archive" | "unarchive" }) {
    try {

      const { plugin, pluginType, action } = body;
      const isArchived = action === "archive";

      const updatedNode = await this.clubModel.findOneAndUpdate(
        { _id: clubId, "plugins.plugin": plugin },
        { $set: { "plugins.$.isArchived": isArchived } },
        { new: true }
      );

      if (!updatedNode) {
        throw new NotFoundException("Plugin not found or club does not exist");
      }

      return {
        success: true,
        message: 'Club archived status updated successfully',
      };
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  async getExistingPlugins(clubId: string) {
    try {
      const club = await this.clubModel.findById(clubId).lean();
      const plugins = await Promise.all(
        club.plugins.map(async (p) => {
          if (p.type === "standard") {
            const std = await this.stdPluginModel.findOne({ _id: new Types.ObjectId(p.plugin) }).lean();
            return { ...p, plugin: std ?? p.plugin };
          }
          return p;
        })
      );

      const existingPlugins = plugins.map((plugin: any) => {
        if (plugin.type === "standard") {
          return plugin.plugin.slug
        }
        return plugin.plugin;
      })

      return existingPlugins;
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  async manageFaqs(clubId: string, body: { question: string, answer: string, faqId?: string }) {
    try {
      const { question, answer, faqId } = body;

      if (faqId) {
        const faqUpdateData: Record<string, any> = {};
        if (question?.trim()) faqUpdateData.question = question;
        if (answer?.trim()) faqUpdateData.answer = answer;

        const updatedFaq = await this.forumFaqsModel.findByIdAndUpdate(
          {
            _id: faqId
          },
          faqUpdateData,
          { new: true }
        )

        return {
          data: updatedFaq,
          success: true,
          message: 'FAQ updated successfully',
        };
      }

      if (!question?.trim()) {
        throw new BadRequestException("Question is required");
      }

      if (!answer?.trim()) {
        throw new BadRequestException("Answer is required");
      }

      const faqData = {
        club: new Types.ObjectId(clubId),
        question,
        answer,
      }

      const createdFaq = await this.forumFaqsModel.create(faqData)

      return {
        data: createdFaq,
        success: true,
        message: 'FAQ created successfully',
      };
    } catch (error) {
      console.log(error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw error;
    }
  }

  async getFaqs(clubId: string) {
    try {
      const faqs = await this.forumFaqsModel.find({ club: new Types.ObjectId(clubId) }).lean();
      return {
        data: faqs,
        success: true,
        message: 'FAQs fetched successfully',
      };
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  async getShowcases(clubId: string, type?: string) {
    try {
      const forumProfile = await this.forumProfileModel.findOne({ club: new Types.ObjectId(clubId) }).lean();
      let showcases = forumProfile?.about?.showcase || [];
      
      // Filter by type if provided
      if (type) {
        showcases = showcases.filter((item: any) => item.type === type);
      }
      
      return {
        data: showcases,
        success: true,
        message: 'Showcases fetched successfully',
      };
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  async manageShowcase(clubId: string, body: {
    title: string,
    description: string,
    showcaseId?: string,
    existingImages?: string,
    deletedImageUrls?: string,
    showcaseImages?: Express.Multer.File[],
    type?: string,
  }) {
    try {
      const { title, description, showcaseId, existingImages, deletedImageUrls, showcaseImages, type } = body;

      if (!title?.trim()) {
        throw new BadRequestException("Title is required");
      }

      if (!description?.trim()) {
        throw new BadRequestException("Description is required");
      }

      // Get or create forum profile
      let forumProfile = await this.forumProfileModel.findOne({ club: new Types.ObjectId(clubId) });
      
      if (!forumProfile) {
        forumProfile = new this.forumProfileModel({
          club: new Types.ObjectId(clubId),
          about: {
            headerImages: [],
            usp: '',
            website: '',
            specialization: '',
            challenges: '',
            testimonials: [],
            targetDomains: [],
            attachments: [],
            showcase: [],
            ourClients: [],
          }
        });
      }

      // Parse existing images
      const existingImageUrls = existingImages ? JSON.parse(existingImages) : [];

      // Upload new images
      let newImageUrls: string[] = [];
      if (showcaseImages && showcaseImages.length > 0) {
        const uploadPromises = showcaseImages.map((file: any) =>
          this.uploadFile({
            buffer: file.buffer,
            originalname: file.originalname,
            mimetype: file.mimetype,
          } as Express.Multer.File),
        );
        const uploadedFiles = await Promise.all(uploadPromises);
        newImageUrls = uploadedFiles.map(f => f.url);
      }

      // Combine existing and new images
      const allImages = [...existingImageUrls, ...newImageUrls];

      // Delete removed images
      if (deletedImageUrls) {
        const urlsToDelete = JSON.parse(deletedImageUrls);
        if (urlsToDelete.length > 0) {
          await this.deleteFiles(urlsToDelete);
        }
      }

      const showcaseData = {
        title: title.trim(),
        description: description.trim(),
        images: allImages,
        type: (type || 'others') as 'attachment' | 'works' | 'csr' | 'sustainability' | 'others',
      };

      // Update or create showcase item
      if (showcaseId) {
        // Find and update existing showcase item
        const showcaseIndex = forumProfile.about.showcase?.findIndex(
          (item: any) => item._id?.toString() === showcaseId
        );

        if (showcaseIndex === -1 || showcaseIndex === undefined) {
          throw new NotFoundException('Showcase item not found');
        }

        forumProfile.about.showcase[showcaseIndex] = {
          ...forumProfile.about.showcase[showcaseIndex],
          ...showcaseData,
        };
      } else {
        // Add new showcase item
        if (!forumProfile.about.showcase) {
          forumProfile.about.showcase = [];
        }
        forumProfile.about.showcase.push(showcaseData);
      }

      await forumProfile.save();

      const createdShowcase = showcaseId 
        ? forumProfile.about.showcase.find((item: any) => item._id?.toString() === showcaseId)
        : forumProfile.about.showcase[forumProfile.about.showcase.length - 1];

      return {
        data: createdShowcase,
        success: true,
        message: showcaseId ? 'Showcase updated successfully' : 'Showcase created successfully',
      };
    } catch (error) {
      console.log(error);
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw error;
    }
  }

  async deleteShowcase(clubId: string, showcaseId: string) {
    try {
      const forumProfile = await this.forumProfileModel.findOne({ club: new Types.ObjectId(clubId) });

      if (!forumProfile) {
        throw new NotFoundException('Forum profile not found');
      }

      const showcaseIndex = forumProfile.about.showcase?.findIndex(
        (item: any) => item._id?.toString() === showcaseId
      );

      if (showcaseIndex === -1 || showcaseIndex === undefined) {
        throw new NotFoundException('Showcase item not found');
      }

      // Get the showcase item to delete its images
      const showcaseItem = forumProfile.about.showcase[showcaseIndex];
      if (showcaseItem.images && showcaseItem.images.length > 0) {
        await this.deleteFiles(showcaseItem.images);
      }

      // Remove the showcase item
      forumProfile.about.showcase.splice(showcaseIndex, 1);
      await forumProfile.save();

      return {
        success: true,
        message: 'Showcase deleted successfully',
      };
    } catch (error) {
      console.log(error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw error;
    }
  }



  async manageForumBranch(
    clubId: string,
    body: {
      name: string;
      email: string;
      address: string;
      phoneNumber?: string;
      customerNumber?: string;
      complaintNumber?: string;
      isMainBranch?: boolean;
      branchId?: string;
    }
  ) {
    try {
      const existingProfile = await this.forumProfileModel.findOne({
        club: new Types.ObjectId(clubId),
      });

      const branchData = {
        name: body.name,
        email: body.email,
        address: body.address,
        phoneNumber: body.phoneNumber,
        customerNumber: body.customerNumber,
        complaintNumber: body.complaintNumber,
        isMainBranch: body.isMainBranch || false,
      };

      let updatedBranch: any;

      // ---------------------------
      // CASE 1: Profile already exists
      // ---------------------------
      if (existingProfile) {
        let existingBranch: any;

        // Try to find branch if ID provided
        if (body?.branchId) {
          existingBranch = existingProfile.branches.find(
            (branch: any) => branch._id.toString() === body.branchId
          );
        }

        // ✅ If main branch toggled ON, unset all others
        if (body.isMainBranch) {
          existingProfile.branches.forEach((branch: any) => {
            branch.isMainBranch = false;
          });
        }

        if (existingBranch) {
          // ---------------------------
          // CASE 1A: Branch exists → update it
          // ---------------------------
          Object.assign(existingBranch, branchData);
          updatedBranch = existingBranch;
        } else {
          // ---------------------------
          // CASE 1B: Branch not found → create new
          // ---------------------------
          existingProfile.branches.push(branchData);
          updatedBranch = existingProfile.branches[existingProfile.branches.length - 1];
        }

        await existingProfile.save();

        return {
          success: true,
          message: existingBranch
            ? "Branch updated successfully"
            : "Branch created successfully",
          data: updatedBranch,
        };
      }

      // ---------------------------
      // CASE 2: No profile yet → create new profile
      // ---------------------------
      const createdProfile = await this.forumProfileModel.create({
        club: new Types.ObjectId(clubId),
        branches: [branchData],
      });

      updatedBranch = createdProfile.branches[0];

      return {
        success: true,
        message: "Branch created successfully",
        data: updatedBranch,
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async getForumBranches(clubId: string) {
    try {
      const forumProfile = await this.forumProfileModel.findOne({ club: new Types.ObjectId(clubId) }).lean();

      let branches = forumProfile?.branches || [];

      const sortedBranches = branches.sort((a: any, b: any) => {
        return b?.createdAt - a?.createdAt;
      });

      return {
        data: sortedBranches,
        success: true,
        message: "Branches fetched successfully",
      };

    } catch (error) {
      console.log(error)
      throw error;
    }
  }

  async manageForumSocialLink(
    clubId: string,
    body: { links: { name: string; link: string; title?: string }[] },
  ) {
    try {
      const clubObjectId = new Types.ObjectId(clubId);

      // ✅ Normalize input (replace null/undefined/empty with "")
      const cleanedLinks = body.links.map(link => ({
        name: link?.name?.trim() || '',
        link: link?.link?.trim() || '',
        title: link?.title?.trim() || '',
      }));

      // ✅ Find existing profile
      let forumProfile = await this.forumProfileModel.findOne({ club: clubObjectId });

      // ✅ If profile not found, create a new one
      if (!forumProfile) {
        const newProfile = await this.forumProfileModel.create({
          club: clubObjectId,
          socialLinks: cleanedLinks,
        });

        return {
          data: newProfile.socialLinks,
          success: true,
          message: 'Forum profile created and social links added successfully',
        };
      }

      // ✅ Save and return only `socialLinks`
      const updatedProfile = await this.forumProfileModel.findOneAndUpdate(
        { club: clubObjectId },
        { $set: { socialLinks: cleanedLinks } },
        { new: true, projection: { socialLinks: 1, _id: 0 } }, // 🔥 return only `socialLinks`
      );

      return {
        data: updatedProfile?.socialLinks || [],
        success: true,
        message: 'Social links updated successfully',
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async getForumSocialLinks(clubId: string) {
    try {
      const forumProfile = await this.forumProfileModel.findOne({ club: new Types.ObjectId(clubId) }).lean();

      const updatedSocialLinks = forumProfile?.socialLinks || [];

      return {
        data: updatedSocialLinks,
        success: true,
        message: "Social links fetched successfully",
      };
    } catch (error) {
      console.log(error)
      throw error;
    }
  }

  async manageCommittee(
    clubId: string,
    body: {
      committeeId?: string;
      title: string;
      description: string;
      members: any;
      files?: any[];
      deletedFileUrls?: any;
    },
  ) {

    try {
      const parsedMembers = JSON.parse(body.members || '[]');

      if (parsedMembers.length === 0) {
        throw new BadRequestException('Members are required');
      }

      let forumProfile = await this.forumProfileModel.findOne({
        club: new Types.ObjectId(clubId),
      });

      if (body?.committeeId) {
        const committeeIndex = forumProfile.committee.findIndex(
          (c: any) => c._id?.toString() === body.committeeId,
        );

        if (committeeIndex === -1) {
          throw new NotFoundException('Committee not found');
        }

        const existingFiles = forumProfile?.committee[committeeIndex]?.files || [];
        const deletedFileUrls = body?.deletedFileUrls || [];
        const filteredExistingFilesWithDeletedUrls = existingFiles.filter((file: any) => !deletedFileUrls.includes(file.url));
        const combineFileLength = filteredExistingFilesWithDeletedUrls.length + (body?.files?.length || 0);
        if (combineFileLength > 10) throw new BadRequestException('You can upload maximum 10 files');
      }


      let fileObjects = [];
      if (body.files && body.files.length > 0) {
        const uploadPromises = body.files.map((file: any) =>
          this.uploadFile({
            buffer: file.buffer,
            originalname: file.originalname,
            mimetype: file.mimetype,
          } as Express.Multer.File),
        );
        const uploadedFiles = await Promise.all(uploadPromises);
        fileObjects = uploadedFiles.map((uploadedFile, index) => ({
          url: uploadedFile.url,
          originalname: body.files[index].originalname,
          mimetype: body.files[index].mimetype,
          size: body.files[index].size,
        }));
      }

      // If no forum profile found, create one and attach the committee
      if (!forumProfile) {
        forumProfile = new this.forumProfileModel({
          club: new Types.ObjectId(clubId),
          committee: [
            {
              title: body.title,
              description: body.description,
              members: parsedMembers,
              files: fileObjects || [],
            },
          ],
        });

        await forumProfile.save();
        return {
          message: 'Forum profile created and committee added successfully',
          data: forumProfile.committee,
        };
      }

      // Update existing committee if committeeId exists
      if (body.committeeId) {
        const committeeIndex = forumProfile.committee.findIndex(
          (c: any) => c._id?.toString() === body?.committeeId,
        );

        if (committeeIndex === -1) {
          throw new NotFoundException('Committee not found');
        }

        const existingFiles = forumProfile?.committee[committeeIndex]?.files || [];
        const deletedFileUrls = body?.deletedFileUrls || [];
        const filteredExistingFilesWithDeletedUrls = existingFiles.filter((file: any) => !deletedFileUrls.includes(file.url));
        const updatedFiles = [...filteredExistingFilesWithDeletedUrls, ...fileObjects];

        // Update only specific fields to preserve other fields like events
        forumProfile.committee[committeeIndex].title = body.title;
        forumProfile.committee[committeeIndex].description = body.description;
        forumProfile.committee[committeeIndex].members = parsedMembers;
        forumProfile.committee[committeeIndex].files = updatedFiles || [];
      } else {
        // Otherwise, add a new committee
        forumProfile.committee.push({
          title: body.title,
          description: body.description,
          members: parsedMembers,
          files: fileObjects || [],
        });
      }

      await forumProfile.save();

      if (body?.deletedFileUrls?.length > 0) {
        await this.deleteFiles(JSON.parse(body?.deletedFileUrls || '[]'));
      }

      return {
        message: body?.committeeId
          ? 'Committee updated successfully'
          : 'Committee added successfully',
        data: forumProfile?.committee,
      };
    } catch (error) {
      console.log(error)
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw error;
    }
  }

  // Get all committees for a node
  async getCommittees(clubId: string) {
    try {
      const forumProfile = await this.forumProfileModel
        .findOne({ club: new Types.ObjectId(clubId) })
        .select('committee')
        .lean();

      if (!forumProfile || !forumProfile?.committee?.length) {
        return { message: 'No committees found', data: [] };
      }

      return { message: 'Committees fetched successfully', data: forumProfile?.committee };
    } catch (error) {
      console.log(error)
      throw error;
    }
  }

  async manageCommitteeEvent(
    clubId: string,
    body: {
      committeeId: string;
      eventId?: string;
      title: string;
      date: string;
      images?: any[];
      deletedImageUrls?: any;
    },
  ) {
    try {
      if (!body.committeeId) {
        throw new BadRequestException('Committee ID is required');
      }

      if (!body.title || body.title.trim().length === 0) {
        throw new BadRequestException('Event title is required');
      }

      if (!body.date) {
        throw new BadRequestException('Event date is required');
      }

      const forumProfile = await this.forumProfileModel.findOne({
        club: new Types.ObjectId(clubId),
      });

      if (!forumProfile) {
        throw new NotFoundException('Forum profile not found');
      }

      const committeeIndex = forumProfile.committee.findIndex(
        (c: any) => c._id?.toString() === body.committeeId,
      );

      if (committeeIndex === -1) {
        throw new NotFoundException('Committee not found');
      }

      // Handle image uploads
      let imageObjects = [];
      if (body.images && body.images.length > 0) {
        if (body.images.length > 25) {
          throw new BadRequestException('Maximum 25 images allowed per event');
        }

        const uploadPromises = body.images.map((image: any) =>
          this.uploadFile({
            buffer: image.buffer,
            originalname: image.originalname,
            mimetype: image.mimetype,
            size: image.size,
          } as Express.Multer.File)
        );
        const uploadedImages = await Promise.all(uploadPromises);
        imageObjects = uploadedImages.map((uploadedImage, index) => ({
          url: uploadedImage.url,
          originalname: body.images[index].originalname,
          mimetype: body.images[index].mimetype,
          size: body.images[index].size,
        }));
      }

      // Handle deleted images
      if (body.deletedImageUrls) {
        const parsedDeletedUrls = JSON.parse(body.deletedImageUrls || '[]');
        if (parsedDeletedUrls.length > 0) {
          await this.deleteFiles(parsedDeletedUrls);
        }
      }

      const committee = forumProfile.committee[committeeIndex] as any;

      if (!committee.events) {
        committee.events = [];
      }

      if (body.eventId) {
        // Update existing event
        const eventIndex = committee.events.findIndex(
          (e: any) => e._id?.toString() === body.eventId,
        );

        if (eventIndex === -1) {
          throw new NotFoundException('Event not found');
        }

        const existingImages = committee.events[eventIndex].images || [];
        committee.events[eventIndex] = {
          ...committee.events[eventIndex],
          title: body.title,
          date: new Date(body.date),
          images: [...existingImages, ...imageObjects],
        };

        await forumProfile.save();

        return {
          message: 'Event updated successfully',
          data: committee.events[eventIndex],
        };
      } else {
        // Create new event
        const newEvent = {
          title: body.title,
          date: new Date(body.date),
          images: imageObjects,
        };

        committee.events.push(newEvent);
        await forumProfile.save();

        return {
          message: 'Event created successfully',
          data: committee.events[committee.events.length - 1],
        };
      }
    } catch (error) {
      console.log(error);
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new BadRequestException(
        'Failed to manage committee event. Please try again later.',
      );
    }
  }

  async getCommitteeEvents(clubId: string, committeeId: string) {
    try {
      const forumProfile = await this.forumProfileModel.findOne({
        club: new Types.ObjectId(clubId),
      });

      if (!forumProfile) {
        return { message: 'No events found', data: [] };
      }

      const committee = forumProfile.committee.find(
        (c: any) => c._id?.toString() === committeeId,
      );

      if (!committee) {
        return { message: 'Committee not found', data: [] };
      }

      return {
        message: 'Events fetched successfully',
        data: (committee as any).events || [],
      };
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  async manageForumAbout(
    clubId: string,
    body: {
      usp?: string;
      website?: string;
      specialization?: string;
      challenges?: string;
      headerImages?: Express.Multer.File[];
      testimonialImages?: Express.Multer.File[];
      attachments?: Express.Multer.File[];
      showcaseImages?: Express.Multer.File[];
      clientLogos?: Express.Multer.File[];
      deletedImageUrls?: string;
      deletedAttachmentUrls?: string;
      deletedShowcaseImageUrls?: string;
      newAttachmentTitles?: string;
      showcase?: string;
      updatedAttachments?: string;
      testimonials?: string;
      targetDomains?: string;
      ourClients?: string;
      // New fields for folder structure
      deletedResourceIds?: string;
      newFolders?: string;
      updatedResources?: string;
      newAttachmentMeta?: string;
    },
  ) {
    try {
      const club = await this.clubModel.findById(clubId);
      if (!club) {
        throw new BadRequestException('Club not found');
      }

      let forumProfile = await this.forumProfileModel.findOne({
        club: new Types.ObjectId(clubId),
      });

      if (!forumProfile) {
        forumProfile = await this.forumProfileModel.create({
          club: new Types.ObjectId(clubId),
          about: {
            headerImages: [],
            usp: '',
            website: '',
            specialization: '',
            challenges: '',
            testimonials: [],
            targetDomains: [],
            attachments: [],
            showcase: [],
            ourClients: [],
          },
        });
      }

      // Initialize about object if it doesn't exist
      if (!forumProfile.about) {
        forumProfile.about = {
          headerImages: [],
          usp: '',
          website: '',
          specialization: '',
          challenges: '',
          testimonials: [],
          targetDomains: [],
          attachments: [],
          showcase: [],
          ourClients: [],
        };
      }

      // Handle deleted header images
      if (body.deletedImageUrls) {
        const urlsToDelete = JSON.parse(body.deletedImageUrls);
        if (urlsToDelete.length > 0) {
          await this.deleteFiles(urlsToDelete);
          forumProfile.about.headerImages = forumProfile.about.headerImages.filter(
            (img: any) => !urlsToDelete.includes(img.url),
          );
        }
      }

      // Handle new header image uploads
      if (body.headerImages && body.headerImages.length > 0) {
        const uploadedImages = await Promise.all(
          body.headerImages.map(async (file) => {
            const uploadResult = await this.uploadFile(file);
            return {
              url: uploadResult.url,
              originalname: file.originalname,
              mimetype: file.mimetype,
              size: file.size,
            };
          }),
        );
        forumProfile.about.headerImages.push(...uploadedImages);
      }

      // Handle Testimonials
      if (body.testimonials) {
        const testimonials = JSON.parse(body.testimonials);
        let imageIndex = 0;
        const processedTestimonials = [];

        // Process sequentially to avoid race condition with imageIndex
        for (const t of testimonials) {
          if (t.hasNewImage && body.testimonialImages && body.testimonialImages[imageIndex]) {
            const file = body.testimonialImages[imageIndex];
            const uploadResult = await this.uploadFile(file);
            imageIndex++;
            processedTestimonials.push({
              ...t,
              image: uploadResult.url,
              hasNewImage: undefined, // Remove internal flag
              imageIndex: undefined, // Remove internal flag
            });
          } else {
            // If it's an existing testimonial without a new image, keep it as is
            // If it's a new testimonial without an image, it will just have no image
            const { hasNewImage, imageIndex: idx, ...rest } = t;
            processedTestimonials.push(rest);
          }
        }

        forumProfile.about.testimonials = processedTestimonials;
      }

      // Handle Support for Our Clients
      if (body.ourClients) {
        const ourClients = JSON.parse(body.ourClients);
        let logoIndex = 0;
        const processedClients = [];

        // Process sequentially to avoid race condition with logoIndex
        for (const client of ourClients) {
          if (client.hasNewLogo && body.clientLogos && body.clientLogos[logoIndex]) {
            const file = body.clientLogos[logoIndex];
            const uploadResult = await this.uploadFile(file);
            logoIndex++;
            processedClients.push({
              ...client,
              logo: uploadResult.url,
              hasNewLogo: undefined,
              logoIndex: undefined,
            });
          } else {
            const { hasNewLogo, logoIndex: idx, ...rest } = client;
            processedClients.push(rest);
          }
        }

        forumProfile.about.ourClients = processedClients;
      }

      // Handle Target Domains
      if (body.targetDomains) {
        forumProfile.about.targetDomains = JSON.parse(body.targetDomains);
      }

      // Handle Attachments
      // 1. Delete removed attachments (by ID or URL)
      if (body.deletedAttachmentUrls || body.deletedResourceIds) {
        const deletedIds: string[] = body.deletedResourceIds ? JSON.parse(body.deletedResourceIds) : [];
        const deletedUrls: string[] = body.deletedAttachmentUrls ? JSON.parse(body.deletedAttachmentUrls) : [];

        // Combine deletions
        const allDeletedIds = new Set(deletedIds);

        if (forumProfile.about.attachments && (allDeletedIds.size > 0 || deletedUrls.length > 0)) {
          // Helper function to recursively get all descendant IDs of a folder
          const getDescendantIds = (parentId: string): string[] => {
            const children = forumProfile.about.attachments.filter(
              (att: any) => att.parentId === parentId
            );
            let ids: string[] = [];
            for (const child of children) {
              ids.push(child.uuid);
              if (child.type === 'folder') {
                ids = [...ids, ...getDescendantIds(child.uuid)];
              }
            }
            return ids;
          };

          // For each deleted folder, also add all its descendants to deletion set
          for (const id of deletedIds) {
            const item = forumProfile.about.attachments.find((att: any) => att.uuid === id);
            if (item?.type === 'folder') {
              const descendantIds = getDescendantIds(id);
              descendantIds.forEach((dId: string) => allDeletedIds.add(dId));
            }
          }

          // Find attachments to delete (for file storage cleanup)
          const attachmentsToDelete = forumProfile.about.attachments.filter(
            (att: any) => allDeletedIds.has(att.uuid) || (att.url && deletedUrls.includes(att.url))
          );

          const urlsToDeleteFromStorage = attachmentsToDelete
            .filter((att: any) => att.type !== 'folder' && att.url)
            .map((att: any) => att.url);

          if (urlsToDeleteFromStorage.length > 0) {
            await this.deleteFiles(urlsToDeleteFromStorage);
          }

          // Remove from attachments array
          forumProfile.about.attachments = forumProfile.about.attachments.filter(
            (att: any) => !allDeletedIds.has(att.uuid) && (!att.url || !deletedUrls.includes(att.url))
          );
        }
      }

      // 2. Handle New Folders
      if (body.newFolders) {
        const folders = JSON.parse(body.newFolders);
        // folders: { uuid, title/name, parentId }[]
        const folderObjects = folders.map((f: any) => {
          const folderName = f.title || f.name;
          return {
            uuid: f.uuid,
            name: folderName,
            title: folderName,
            type: 'folder',
            parentId: f.parentId || null,
            url: '', // Folders don't have URLs
            originalname: folderName,
            mimetype: 'application/vnd.google-apps.folder',
            size: 0
          };
        });

        if (!forumProfile.about.attachments) {
          forumProfile.about.attachments = [];
        }
        forumProfile.about.attachments.push(...folderObjects);
      }

      // 3. Update existing resources (rename / move)
      if (body.updatedResources) {
        const updates = JSON.parse(body.updatedResources);
        // updates: { uuid, title/name, parentId }[]
        if (forumProfile.about.attachments) {
          forumProfile.about.attachments = forumProfile.about.attachments.map((att: any) => {
            const update = updates.find((u: any) => u.uuid === att.uuid);
            if (update) {
              // Support both 'title' and 'name' fields for flexibility
              const newTitle = update.title ?? update.name ?? att.title;
              return {
                ...att,
                title: newTitle,
                parentId: update.parentId !== undefined ? update.parentId : att.parentId
              };
            }
            return att;
          });
        }
      }
      // Backward compatibility for `updatedAttachments` (title only)
      if (body.updatedAttachments) {
        const updatedAttachments = JSON.parse(body.updatedAttachments);
        if (forumProfile.about.attachments) {
          forumProfile.about.attachments = forumProfile.about.attachments.map((att: any) => {
            const update = updatedAttachments.find((u: any) => u.url === att.url);
            if (update) {
              return { ...att, title: update.title };
            }
            return att;
          });
        }
      }

      // 4. Upload new attachments
      if (body.attachments && body.attachments.length > 0) {
        const newAttachmentTitles = body.newAttachmentTitles ? JSON.parse(body.newAttachmentTitles) : [];
        const newAttachmentMeta = body.newAttachmentMeta ? JSON.parse(body.newAttachmentMeta) : [];
        // newAttachmentMeta: { parentId, uuid }[] corresponding to index

        const uploadedAttachments = await Promise.all(
          body.attachments.map(async (file, index) => {
            const uploadResult = await this.uploadFile(file);
            const meta = newAttachmentMeta[index] || {};
            // Generate UUID if not provided
            const uuid = meta.uuid || new Types.ObjectId().toString();

            return {
              uuid: uuid,
              url: uploadResult.url,
              originalname: file.originalname,
              mimetype: file.mimetype,
              size: file.size,
              title: newAttachmentTitles[index] || file.originalname,
              type: 'file' as const,
              parentId: meta.parentId || null
            };
          }),
        );
        if (!forumProfile.about.attachments) {
          forumProfile.about.attachments = [];
        }
        forumProfile.about.attachments.push(...uploadedAttachments);
      }

      // Handle deleted showcase images
      if (body.deletedShowcaseImageUrls) {
        const deletedShowcaseImageUrls = JSON.parse(body.deletedShowcaseImageUrls);
        if (deletedShowcaseImageUrls.length > 0) {
          await this.deleteFiles(deletedShowcaseImageUrls);
        }
      }

      // Handle Showcase
      if (body.showcase) {
        const showcaseItems = JSON.parse(body.showcase);
        let imageIndex = 0;

        const processedShowcase = await Promise.all(
          showcaseItems.map(async (item: any) => {
            const newImages = [];
            if (item.newImageCount && item.newImageCount > 0) {
              for (let i = 0; i < item.newImageCount; i++) {
                if (body.showcaseImages && body.showcaseImages[imageIndex]) {
                  const file = body.showcaseImages[imageIndex];
                  const uploadResult = await this.uploadFile(file);
                  newImages.push(uploadResult.url);
                  imageIndex++;
                }
              }
            }

            const existingImages = item.images || [];
            // Filter out blob URLs if any slipped through (though frontend should handle this)
            const validExistingImages = existingImages.filter((url: string) => !url.startsWith('blob:'));

            return {
              title: item.title,
              description: item.description,
              images: [...validExistingImages, ...newImages],
            };
          }),
        );
        forumProfile.about.showcase = processedShowcase;
      }

      // Update text fields
      if (body.usp !== undefined) {
        forumProfile.about.usp = body.usp;
      }
      if (body.website !== undefined) {
        forumProfile.about.website = body.website;
      }
      if (body.specialization !== undefined) {
        forumProfile.about.specialization = body.specialization;
      }
      if (body.challenges !== undefined) {
        forumProfile.about.challenges = body.challenges;
      }

      forumProfile.markModified('about');
      await forumProfile.save();

      return {
        message: 'Forum about section updated successfully',
        data: forumProfile.about,
      };
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  async getForumAbout(clubId: string) {
    try {
      const forumProfile = await this.forumProfileModel.findOne({
        club: new Types.ObjectId(clubId),
      });

      if (!forumProfile || !forumProfile.about) {
        return {
          message: 'No about section found',
          data: {
            headerImages: [],
            usp: '',
            website: '',
            specialization: '',
            challenges: '',
            testimonials: [],
            targetDomains: [],
            attachments: [],
            ourClients: [],
          },
        };
      }

      return {
        message: 'About section fetched successfully',
        data: forumProfile.about,
      };
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  async getBrandStories(clubId: string) {
    try {
      const forumProfile = await this.forumProfileModel.findOne({
        club: new Types.ObjectId(clubId),
      });
      return forumProfile?.brandStories || [];
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  async getHierarchy(clubId: string) {
    try {
      const forumProfile = await this.forumProfileModel.findOne({
        club: new Types.ObjectId(clubId),
      });
      return forumProfile?.hierarchy || null;
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  async manageHierarchy(clubId: string, body: any) {
    try {
      const { file, deletedFileUrl } = body;

      let forumProfile = await this.forumProfileModel.findOne({
        club: new Types.ObjectId(clubId),
      });

      if (!forumProfile) {
        forumProfile = await this.forumProfileModel.create({
          club: new Types.ObjectId(clubId),
        });
      }

      if (deletedFileUrl) {
        if (
          forumProfile.hierarchy &&
          forumProfile.hierarchy.url === deletedFileUrl
        ) {
          await this.deleteFiles([deletedFileUrl]);
          forumProfile.hierarchy = undefined;
        }
      }

      if (file) {
        if (forumProfile.hierarchy && forumProfile.hierarchy.url) {
          await this.deleteFiles([forumProfile.hierarchy.url]);
        }
        const uploadResult = await this.uploadFile(file);
        forumProfile.hierarchy = {
          url: uploadResult.url,
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
        };
      }

      await forumProfile.save();
      return forumProfile.hierarchy;
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  async manageBrandStories(clubId: string, body: any) {
    try {
      const { title, description, images, brandStoryId } = body;
      let { deletedFileUrl } = body;

      if (deletedFileUrl && !Array.isArray(deletedFileUrl)) {
        deletedFileUrl = [deletedFileUrl];
      }

      if (deletedFileUrl && deletedFileUrl.length > 0) {
        await this.deleteFiles(deletedFileUrl);
      }

      let uploadedImages = [];
      if (images && images.length > 0) {
        const uploadPromises = images.map((file) => this.uploadFile(file));
        uploadedImages = await Promise.all(uploadPromises);
      }

      let forumProfile = await this.forumProfileModel.findOne({
        club: new Types.ObjectId(clubId),
      });

      if (!forumProfile) {
        forumProfile = await this.forumProfileModel.create({
          club: new Types.ObjectId(clubId)
        });
      }

      if (brandStoryId) {
        // Update existing brand story
        const storyIndex = forumProfile.brandStories.findIndex(s => s._id.toString() === brandStoryId);

        if (storyIndex === -1) {
          throw new NotFoundException('Brand story not found');
        }

        const existingStory = forumProfile.brandStories[storyIndex];
        let updatedImages = existingStory.images || [];

        // Remove deleted images
        if (deletedFileUrl && deletedFileUrl.length > 0) {
          updatedImages = updatedImages.filter(img => !deletedFileUrl.includes(img.url));
        }

        // Add new images
        if (uploadedImages.length > 0) {
          updatedImages = [...updatedImages, ...uploadedImages];
        }

        // Check max 10 images
        if (updatedImages.length > 10) {
          throw new BadRequestException('Maximum 10 images allowed');
        }

        forumProfile.brandStories[storyIndex].title = title;
        forumProfile.brandStories[storyIndex].description = description;
        forumProfile.brandStories[storyIndex].images = updatedImages;

        await forumProfile.save();
        return forumProfile.brandStories[storyIndex];

      } else {
        // Create new brand story
        const newStory = {
          title,
          description,
          images: uploadedImages,
        };
        forumProfile.brandStories.push(newStory as any);
        await forumProfile.save();
        return forumProfile.brandStories[forumProfile.brandStories.length - 1];
      }
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  async getManagementTeam(clubId: string) {
    try {
      const forumProfile = await this.forumProfileModel.findOne({
        club: new Types.ObjectId(clubId),
      });

      if (!forumProfile) {
        return [];
      }

      return forumProfile.managementTeam || [];
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  async manageManagementTeam(clubId: string, body: any) {
    try {
      const { name, title, description, socialLinks, memberId } = body;
      let { deletedFileUrl, image } = body;

      if (deletedFileUrl && !Array.isArray(deletedFileUrl)) {
        deletedFileUrl = [deletedFileUrl];
      }

      if (deletedFileUrl && deletedFileUrl.length > 0) {
        await this.deleteFiles(deletedFileUrl);
      }

      let uploadedImage = null;
      if (image) {
        uploadedImage = await this.uploadFile(image);
      }

      let forumProfile = await this.forumProfileModel.findOne({
        club: new Types.ObjectId(clubId),
      });

      if (!forumProfile) {
        forumProfile = await this.forumProfileModel.create({
          club: new Types.ObjectId(clubId)
        });
      }

      // Parse socialLinks if it's a string
      let parsedSocialLinks = [];
      if (socialLinks) {
        parsedSocialLinks = typeof socialLinks === 'string' ? JSON.parse(socialLinks) : socialLinks;
      }

      if (memberId) {
        // Update existing team member
        const memberIndex = forumProfile.managementTeam.findIndex(m => m._id.toString() === memberId);

        if (memberIndex === -1) {
          throw new NotFoundException('Team member not found');
        }

        forumProfile.managementTeam[memberIndex].name = name;
        forumProfile.managementTeam[memberIndex].title = title;
        forumProfile.managementTeam[memberIndex].description = description;
        forumProfile.managementTeam[memberIndex].socialLinks = parsedSocialLinks;

        // Update image if new one is provided
        if (uploadedImage) {
          forumProfile.managementTeam[memberIndex].image = uploadedImage;
        } else if (deletedFileUrl && deletedFileUrl.length > 0) {
          // If image was deleted but no new one provided, clear the image
          forumProfile.managementTeam[memberIndex].image = null;
        }

        await forumProfile.save();
        return forumProfile.managementTeam[memberIndex];

      } else {
        // Create new team member
        const newMember = {
          name,
          title,
          description,
          image: uploadedImage,
          socialLinks: parsedSocialLinks,
        };
        forumProfile.managementTeam.push(newMember as any);
        await forumProfile.save();
        return forumProfile.managementTeam[forumProfile.managementTeam.length - 1];
      }
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  async deleteManagementTeamMember(clubId: string, memberId: string) {
    try {
      const forumProfile = await this.forumProfileModel.findOne({
        club: new Types.ObjectId(clubId),
      });

      if (!forumProfile) {
        throw new NotFoundException('Forum profile not found');
      }

      const memberIndex = forumProfile.managementTeam.findIndex(m => m._id.toString() === memberId);

      if (memberIndex === -1) {
        throw new NotFoundException('Team member not found');
      }

      // Delete the image if exists
      const member = forumProfile.managementTeam[memberIndex];
      if (member.image?.url) {
        await this.deleteFiles([member.image.url]);
      }

      forumProfile.managementTeam.splice(memberIndex, 1);
      await forumProfile.save();

      return { message: 'Team member deleted successfully' };
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  private async deleteFiles(urls: string[]) {
    try {
      //uploading file
      const deletePromises = urls?.map((url: string) =>
        this.s3FileUpload.deleteFile(url)
      );
      const response = await Promise.all(deletePromises);
      return response;
    } catch (error) {
      console.log(error)
      throw new BadRequestException(
        'Failed to delete file. Please try again later.',
      );
    }
  }

  private async generateUniqueUsername(baseUsername: string): Promise<string> {
    // 1️⃣ Normalize and sanitize
    let username = baseUsername
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_")        // replace spaces with underscores
      .replace(/[^a-z0-9_]/g, ""); // remove non-alphanumeric chars except underscore

    // Prevent empty username edge case
    if (!username) {
      username = "user";
    }

    // 2️⃣ Check if username already exists
    const existing = await this.clubModel.exists({ username });

    if (!existing) {
      return username;
    }

    // 3️⃣ Append random 4-digit suffix until unique
    let uniqueUsername = username;
    let isTaken = true;

    while (isTaken) {
      const randomSuffix = Math.floor(1000 + Math.random() * 9000); // random 4 digits
      uniqueUsername = `${username}_${randomSuffix}`;
      isTaken = !!(await this.clubModel.exists({ username: uniqueUsername }));
    }

    return uniqueUsername;
  }

  async getProductComparisons(clubId: string) {
    try {
      const forumProfile = await this.forumProfileModel.findOne({
        club: new Types.ObjectId(clubId),
      });
      return forumProfile?.productComparisons || [];
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  async manageProductComparisons(clubId: string, body: any) {
    try {
      const { title, description, comparisonId } = body;
      let { deletedFileUrl, file } = body;

      if (deletedFileUrl && !Array.isArray(deletedFileUrl)) {
        deletedFileUrl = [deletedFileUrl];
      }

      if (deletedFileUrl && deletedFileUrl.length > 0) {
        await this.deleteFiles(deletedFileUrl);
      }

      let uploadedFile = null;
      if (file) {
        uploadedFile = await this.uploadFile(file);
      }

      let forumProfile = await this.forumProfileModel.findOne({
        club: new Types.ObjectId(clubId),
      });

      if (!forumProfile) {
        forumProfile = await this.forumProfileModel.create({
          club: new Types.ObjectId(clubId),
        });
      }

      if (comparisonId) {
        // Update existing comparison
        const compIndex = forumProfile.productComparisons.findIndex(
          (c) => c._id.toString() === comparisonId,
        );

        if (compIndex === -1) {
          throw new NotFoundException('Product comparison not found');
        }

        forumProfile.productComparisons[compIndex].title = title;
        forumProfile.productComparisons[compIndex].description = description;

        if (uploadedFile) {
          forumProfile.productComparisons[compIndex].file = uploadedFile;
        } else if (deletedFileUrl && deletedFileUrl.length > 0) {
          // check if the deleted URL matches the current file
          if (forumProfile.productComparisons[compIndex].file?.url === deletedFileUrl[0]) {
            forumProfile.productComparisons[compIndex].file = undefined;
          }
        }

        await forumProfile.save();
        return forumProfile.productComparisons[compIndex];
      } else {
        // Create new
        const newComp = {
          title,
          description,
          file: uploadedFile,
        };
        forumProfile.productComparisons.push(newComp as any);
        await forumProfile.save();
        return forumProfile.productComparisons[forumProfile.productComparisons.length - 1];
      }
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  // -------------------------------- MAKE IT BETTER --------------------------------

  async submitMakeItBetter(
    clubId: string,
    body: {
      type: string;
      contactDetails?: string;
      description: string;
    },
  ) {
    try {
      const clubObjectId = new Types.ObjectId(clubId);

      let forumProfile = await this.forumProfileModel.findOne({
        club: clubObjectId,
      });

      if (!forumProfile) {
        forumProfile = await this.forumProfileModel.create({
          club: clubObjectId,
          makeItBetter: [],
        });
      }

      if (!forumProfile.makeItBetter) {
        forumProfile.makeItBetter = [];
      }

      const newFeedback = {
        type: body.type,
        contactDetails: body.contactDetails,
        description: body.description,
        createdAt: new Date(),
      };

      forumProfile.makeItBetter.push(newFeedback as any);
      await forumProfile.save();

      return {
        message: 'Feedback submitted successfully',
        data: forumProfile.makeItBetter[forumProfile.makeItBetter.length - 1],
      };
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  async getMakeItBetter(clubId: string) {
    try {
      const forumProfile = await this.forumProfileModel.findOne({
        club: new Types.ObjectId(clubId),
      });

      if (!forumProfile) {
        return { message: 'No feedback found', data: [] };
      }

      // Sort by createdAt descending (latest first)
      const sortedFeedback = [...(forumProfile.makeItBetter || [])].sort(
        (a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        },
      );

      return { message: 'Feedback fetched successfully', data: sortedFeedback };
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  async deleteMakeItBetter(clubId: string, feedbackId: string) {
    try {
      const forumProfile = await this.forumProfileModel.findOne({
        club: new Types.ObjectId(clubId),
      });

      if (!forumProfile) {
        throw new NotFoundException('Forum profile not found');
      }

      const feedbackIndex = forumProfile.makeItBetter.findIndex(
        (f) => f._id.toString() === feedbackId,
      );

      if (feedbackIndex === -1) {
        throw new NotFoundException('Feedback not found');
      }

      forumProfile.makeItBetter.splice(feedbackIndex, 1);
      await forumProfile.save();

      return { message: 'Feedback deleted successfully' };
    } catch (error) {
      console.log(error);
      throw error;
    }
  }
}
