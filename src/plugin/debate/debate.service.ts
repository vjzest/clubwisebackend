import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Connection, PipelineStage } from 'mongoose';

import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ClubMembers } from '../../shared/entities/clubmembers.entity';
import { Debate } from '../../shared/entities/debate/debate.entity';
import { NodeMembers } from '../../shared/entities/node-members.entity';
import { UploadService } from '../../shared/upload/upload.service';
import { DebateArgument } from '../../shared/entities/debate/debate-argument.entity';
import { DebatesResponse, TForum } from 'typings';
import { DebateAdoption } from '../../shared/entities/debate/debate-adoption-entity';
import { ChapterDebates } from '../../shared/entities/chapters/modules/chapter-debates.entity';
import { ChapterMember } from '../../shared/entities/chapters/chapter-member.entity';
import { Chapter } from '../../shared/entities/chapters/chapter.entity';
import { CommonService } from '../common/common.service';
import { error } from 'console';
import { Club } from '../../shared/entities/club.entity';
import { AssetsService } from '../../assets/assets.service';
import { Node_ } from '../../shared/entities/node.entity';
@Injectable()
export class DebateService {
  constructor(
    @InjectModel(Debate.name) private debateModel: Model<Debate>,
    @InjectModel(ClubMembers.name) private clubMembersModel: Model<ClubMembers>,
    @InjectModel(NodeMembers.name) private nodeMembersModel: Model<NodeMembers>,
    @InjectModel(ChapterMember.name) private chapterMembersModel: Model<ChapterMember>,
    @InjectModel(ChapterDebates.name) private chapterDebatesModel: Model<ChapterDebates>,
    @InjectModel(Club.name) private clubModel: Model<Club>,
    @InjectModel(Node_.name)
    private nodeModel: Model<Node_>,
    @InjectModel(DebateArgument.name)
    private debateArgumentModel: Model<DebateArgument>,
    @InjectModel(DebateAdoption.name) private debateAdoptionModel: Model<DebateAdoption>,
    private readonly s3FileUpload: UploadService,
    @InjectModel(Chapter.name) private readonly chapterModel: Model<Chapter>,
    @InjectConnection() private connection: Connection,
    private readonly assetsService: AssetsService,
    private readonly commonService: CommonService,
  ) { }

  async getDebates({
    page = 1,
    limit = 10,
    search,
    forum,
    forumId,
    type = 'all',
    userId,
  }: {
    page?: number;
    limit?: number;
    search?: string;
    forum?: 'club' | 'node' | 'chapter';
    forumId?: string;
    type?: 'all' | 'active' | 'proposed' | 'global';
    userId: string;
  }) {
    try {
      let isPublic = false;
      let isPluginArchived = false;
      if (forum === 'club') {
        const forumData = await this.clubModel.findOne({ _id: new Types.ObjectId(forumId) }).lean().exec();
        isPublic = forumData.isPublic;
        const issuePlugin = forumData?.plugins?.find((plugin: any) => plugin.plugin === 'debate');
        isPluginArchived = issuePlugin?.isArchived || false;
      } else if (forum === 'node') {
        const forumData = await this.nodeModel.findOne({ _id: new Types.ObjectId(forumId) }).lean().exec();
        const issuePlugin = forumData?.plugins?.find((plugin: any) => plugin.plugin === 'debate');
        isPluginArchived = issuePlugin?.isArchived || false;
      }

      if (isPluginArchived) {
        throw new ForbiddenException('You are not authorized to access this resource');
      }

      let { isMember, role } = await this.commonService.getUserDetailsInForum({ forum, forumId, userId });
      if (!isMember && !isPublic && type !== 'global') throw new ForbiddenException('You are not authorized to access this resource');

      // let { isMember } = await this.commonService.getUserDetailsInForum({ forum, forumId, userId });
      // if (!isMember && type !== "global") throw new BadRequestException('You are not authorized to access this resource');

      const validPage = Math.max(1, page);
      const validLimit = Math.max(1, limit);
      const skip = (validPage - 1) * validLimit;

      // Base match conditions for debates
      const baseMatch: any = { isDeleted: { $ne: true }, isArchived: { $ne: true } };
      // Set current date to start of day for comparison
      const currentDate = new Date();
      currentDate.setHours(0, 0, 0, 0);

      // Add forum filter if provided
      if (forum && forumId) baseMatch[forum] = new Types.ObjectId(forumId);

      // Add type-based filters
      switch (type) {
        case 'all':
          // baseMatch.publishedStatus = { $in: ['published', 'inactive'] };
          if (['admin', 'owner']?.includes(role)) {
            baseMatch.publishedStatus = { $in: ['published', 'inactive', 'draft'] };
            delete baseMatch.isArchived;
          } else {
            baseMatch.$or = [
              { publishedStatus: { $in: ['published', 'inactive'] } },
              { $and: [{ publishedStatus: 'draft' }, { createdBy: userId }] },
            ];
          }
          break;
        case 'active':
          baseMatch.publishedStatus = 'published';
          baseMatch.$or = [
            { closingDate: { $gte: currentDate } },
            { closingDate: null }
          ];
          break;
        case 'proposed':
          baseMatch.publishedStatus = 'proposed';
          baseMatch.$or = [
            { closingDate: { $gte: currentDate } },
            { closingDate: null }
          ];
          break;
        case 'global':
          baseMatch.publishedStatus = 'published';
          baseMatch.$or = [
            { closingDate: { $gte: currentDate } },
            { closingDate: null }
          ];
          baseMatch.isPublic = true;
          delete baseMatch[forum];
          break;
      }

      // Add search conditions if provided
      if (search?.trim()) {
        baseMatch.$or = [
          { topic: new RegExp(search, 'i') },
          { significance: new RegExp(search, 'i') },
          { targetAudience: new RegExp(search, 'i') },
        ];
      }

      // Query direct debates
      const debatesQuery = this.debateModel.find(baseMatch)
        .sort({ createdAt: -1 })
        .populate({
          path: 'createdBy',
          select: 'userName firstName middleName lastName profileImage interests',
          strictPopulate: false,
        })
        .populate({
          path: 'publishedBy',
          select: 'userName firstName middleName lastName profileImage interests',
          strictPopulate: false,
        })
        .populate({
          path: 'node',
          select: 'name about domain profileImage coverImage ',
          strictPopulate: false,
        })
        .populate({
          path: 'club',
          select: 'name about domain profileImage coverImage isPublic ',
          strictPopulate: false,
        })
        .populate({
          path: 'chapter',
          select: 'name about domain profileImage coverImage  ',
          strictPopulate: false,
        })

      // Query debate adoptions with modified conditions
      const { closingDate, ...restBaseMatch } = baseMatch;
      const adoptionMatch = {
        ...restBaseMatch,
        type: 'adopted'
      };

      if (type === 'active' || type === 'proposed') adoptionMatch.publishedStatus = type === 'active' ? 'published' : 'proposed';

      if (forum && forumId) adoptionMatch[forum] = new Types.ObjectId(forumId);


      // Update the adoptionMatch to include debate's closingDate check
      // if (type !== 'all') {
      //   adoptionMatch['debate.closingDate'] = {
      //     $gte: currentDate
      //   };
      // }


      const debateAdoptionsQuery = this.debateAdoptionModel.find({ ...adoptionMatch })
        // .skip(skip)
        // .limit(validLimit)
        .sort({ createdAt: -1 })
        .populate({
          path: 'debate',
          // match: type !== 'all' ? { $or: [{ closingDate: { $gte: currentDate } }, { closingDate: null }] } : {},
          match: {
            isArchived: { $ne: true },
            ...(type !== 'all' ? { $or: [{ closingDate: { $gte: currentDate } }, { closingDate: null }] } : {}),
          },
          populate: [
            { path: 'createdBy', select: 'userName firstName middleName lastName profileImage interests', strictPopulate: false },
            { path: 'publishedBy', select: 'userName firstName middleName lastName profileImage interests', strictPopulate: false },
            { path: 'node', select: 'name about domain profileImage coverImage ', strictPopulate: false },
            { path: 'club', select: 'name about domain profileImage coverImage isPublic ', strictPopulate: false },
            { path: 'chapter', select: 'name about domain profileImage coverImage ', strictPopulate: false }
          ]
        });

      // Execute queries
      const [debates, debateAdoptions] = await Promise.all([
        debatesQuery,
        debateAdoptionsQuery
      ]);


      const getArgumentCounts = async (debate: Types.ObjectId) => {
        const [forCount, againstCount] = await Promise.all([
          this.debateArgumentModel.countDocuments({
            debate,
            'participant.side': 'support'
          }),
          this.debateArgumentModel.countDocuments({
            debate,
            'participant.side': 'against'
          })
        ]);

        return {
          for: forCount,
          against: againstCount
        };
      };

      // Process direct debates
      const directDebatesWithArgs = await Promise.all(
        debates.map(async (debate) => {
          const args = await getArgumentCounts(debate._id as Types.ObjectId);
          return {
            ...debate.toObject(),
            type: 'direct',
            args
          };
        })
      );

      // Process adopted debates
      const adoptedDebatesWithArgs = await Promise.all(
        debateAdoptions.map(async (adoption) => {
          const debate = adoption.debate;
          if (!debate) return null;

          // const args = await getArgumentCounts(debate._id, adoption._id);
          const args = await getArgumentCounts(adoption._id);
          return {
            ...(debate as any).toObject(),
            type: 'adopted',
            isAdopted: true,
            adoptionId: adoption._id,
            adoptionStatus: adoption.publishedStatus,
            adoptedDate: adoption.createdAt,
            args
          };
        })
      );

      // Filter out null values and merge results
      const mergedDebates = [
        ...directDebatesWithArgs,
        ...adoptedDebatesWithArgs.filter(Boolean)
      ];

      // if (type === 'proposed') {
      //   console.log({ mergedDebates, adoptedDebatesWithArgs })
      // }

      // Sort by createdAt
      mergedDebates.sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      // manage the skiping here on the mergedDebates
      const paginatedDebates = mergedDebates.slice(skip, skip + validLimit);


      // Calculate total counts for pagination
      const totalDirectCount = await this.debateModel.countDocuments(baseMatch);
      const totalAdoptedCount = await this.debateAdoptionModel.countDocuments({ ...adoptionMatch, isArchived: false });
      const totalCount = totalDirectCount + totalAdoptedCount;
      const totalPages = Math.ceil(totalCount / validLimit);

      return {
        message: 'Debates fetched successfully.',
        data: paginatedDebates,
        pagination: {
          currentPage: validPage.toString(),
          totalPages,
          totalItems: totalCount
        }
      };
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof ForbiddenException) throw error;
      throw new InternalServerErrorException(
        'Error while fetching debates and adoptions',
        error
      );
    }
  }

  //------------------------------------------------------------------

  async createDebateV0(createDebateDto, userId: string) {
    const session = await this.connection.startSession();
    session.startTransaction();
    try {
      const {
        publishedStatus: requestedStatus,
        files,
        club,
        node,
        chapter,
        closingDate,
        tags,
        startingComment,
        ...rest
      } = createDebateDto;
      const forumId = node || club || chapter;
      const forum = node ? 'node' : club ? 'club' : 'chapter';
      const parsedTags = JSON.parse(tags);

      // Ensure either club or node is provided, not both
      if (!club && !node && !chapter) throw new BadRequestException('Either club, node or chapter must be provided.');

      if ((club && node) || (node && chapter) || (club && chapter)) throw new BadRequestException('Bad Request');


      let { isMember, role } = await this.commonService.getUserDetailsInForum({ forum, forumId, userId });
      if (!isMember) throw new BadRequestException('You are not authorized to perform this action.');

      const uploadPromises = files?.map((file: any) =>
        this.uploadFile(
          {
            buffer: file.buffer,
            originalname: file.originalname,
            mimetype: file.mimetype,
          } as Express.Multer.File,
          forum,
        ),
      );

      const uploadedFiles = await Promise.all(uploadPromises);

      const fileObjects = uploadedFiles.map((uploadedFile, index) => ({
        url: uploadedFile.url,
        originalname: files[index].originalName,
        mimetype: files[index].mimetype,
        size: files[index].size,
      }));

      let publishedStatus: 'draft' | 'published' | 'proposed' = 'proposed';
      let publishedBy: string | null = null;

      if (['admin', 'moderator', 'owner'].includes(role)) {
        publishedStatus = requestedStatus === 'draft' ? 'draft' : 'published';
        if (publishedStatus === 'published') publishedBy = userId;
      }

      if (!['draft', 'published', 'proposed'].includes(publishedStatus)) throw new BadRequestException('Invalid published status');


      const debate = new this.debateModel({
        ...rest,
        startingComment,
        isPublic: false,
        node: forum === 'node' ? new Types.ObjectId(forumId) : null,
        club: forum === 'club' ? new Types.ObjectId(forumId) : null,
        chapter: forum === 'chapter' ? new Types.ObjectId(chapter) : null,
        closingDate,
        tags: parsedTags,
        createdBy: userId,
        publishedStatus,
        publishedBy,
        files: fileObjects,
        createdAt: new Date(),
      });

      const savedDebate = await debate.save({ session });

      // copy the debate to chapters
      if (club && publishedStatus === 'published') {
        await this.commonService.copyAnAssetToAllClubChapters({
          clubId: club,
          assetId: savedDebate._id as string,
          config: {
            sourceModel: this.debateModel,
            targetModel: this.chapterDebatesModel,
            referenceKey: 'debate'
          },
          session
        });
      }


      if (savedDebate?.publishedStatus === 'published') {
        this.assetsService.createFeed(
          savedDebate.club || savedDebate.node || savedDebate.chapter,
          savedDebate.club ? 'Club' : savedDebate.node ? 'Node' : 'Chapter',
          'Debate',
          savedDebate._id as any,
        )
      }

      await session.commitTransaction();

      const statusMessages = {
        draft: 'Debate saved as draft successfully.',
        proposed: 'Debate proposed successfully.',
        published: 'Debate published successfully.',
      } as const;

      return {
        message: statusMessages[publishedStatus],
      };
    } catch (error) {
      await session.abortTransaction();
      console.error('Debate creation error:', error);
      throw error;
    } finally {
      session.endSession();
    }
  }


  async createDebate(dto: any, userId: Types.ObjectId) {
    const session = await this.connection.startSession();
    session.startTransaction();
    try {
      // Ensure either club or node is provided, not both
      if (!dto?.club && !dto?.node && !dto?.chapter) throw new BadRequestException('Either club, node or chapter must be provided.');
      if ((dto?.club && dto?.node) || (dto?.node && dto?.chapter) || (dto?.club && dto?.chapter)) throw new BadRequestException('Bad Request');

      const { forum, forumId } = this.getForum(dto);

      const { isMember, userDetails } =
        await this.commonService.getUserDetailsInForum({
          forum,
          forumId,
          userId: String(userId),
        });

      if (!isMember) throw new BadRequestException("Unauthorized");

      const publishedStatus = this.determinePublishedStatus(
        userDetails.role,
        dto.publishedStatus,
      );

      if (publishedStatus === "published") {
        await this.assetsService.checkAndIncrement(userId, session);
      }

      console.log({ dto })

      if (dto.debateId) {
        const draftDebate = await this.updateDraft(dto, publishedStatus, forum, session);
        await session.commitTransaction();
        return {
          data: draftDebate,
          success: true,
          message: "Debate draft saved successfully",
        };
      }

      const files = await this.processFiles(forum, dto.files);

      const savedDebate = await this.createNewDebate(
        dto,
        userId,
        userDetails,
        publishedStatus,
        files,
        session,
      );

      // copy the debate to chapters
      if (savedDebate?.club && publishedStatus === 'published') {
        await this.commonService.copyAnAssetToAllClubChapters({
          clubId: savedDebate.club,
          assetId: savedDebate._id as string,
          config: {
            sourceModel: this.debateModel,
            targetModel: this.chapterDebatesModel,
            referenceKey: 'debate'
          },
          session
        });
      }

      if (savedDebate?.publishedStatus === 'published') {
        this.assetsService.createFeed(
          savedDebate?.club || savedDebate?.node || savedDebate?.chapter,
          savedDebate?.club ? 'Club' : savedDebate?.node ? 'Node' : 'Chapter',
          'Debate',
          savedDebate._id as any,
        )
      }

      await session.commitTransaction();
      return {
        data: savedDebate,
        success: true,
        message: userDetails.role === "member"
          ? "Debate proposed successfully"
          : "Debate created successfully",
      };

    } catch (error) {
      await session.abortTransaction();
      console.error('Debate creation error:', error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  private getForum(dto: any): { forum: TForum, forumId: string } {
    if (dto.node) return { forum: "node", forumId: dto.node };
    if (dto.club) return { forum: "club", forumId: dto.club };
    return { forum: "chapter", forumId: dto.chapter };
  }

  private determinePublishedStatus(userRole: string, requestedStatus?: string) {
    if (requestedStatus === "draft") return "draft";
    if (userRole === "member") return "proposed";
    return "published";
  }

  private async processFiles(forum: TForum, files: any[] = [], deletedUrls: string[] = []) {
    let fileObjects: any[] = [];

    if (files.length > 0) {
      const uploadedFiles = await Promise.all(
        files.map((file) =>
          this.uploadFile({
            buffer: file.buffer,
            originalname: file.originalname,
            mimetype: file.mimetype,
          } as Express.Multer.File, forum),
        ),
      );

      fileObjects = uploadedFiles.map((uploadedFile, index) => ({
        url: uploadedFile.url,
        originalname: files[index].originalname,
        mimetype: files[index].mimetype,
        size: files[index].size,
      }));
    }

    if (deletedUrls.length > 0) {
      await this.deleteFiles(deletedUrls);
    }

    return fileObjects;
  }

  private async deleteFiles(urls: string[]) {
    try {
      //uploading file
      const deletePromises = urls.map((url: string) =>
        this.s3FileUpload.deleteFile(url)
      );
      const response = await Promise.all(deletePromises);
      return response;
    } catch (error) {
      throw new BadRequestException(
        'Failed to delete file. Please try again later.',
      );
    }
  }

  private async updateDraft(dto: any, publishedStatus: string, forum: TForum, session: any) {
    const existingDraft = await this.debateModel.findOne({
      _id: dto.debateId,
      publishedStatus: "draft",
    });

    if (!existingDraft) throw new BadRequestException("Draft debate not found");

    const sanitizedDeletedUrls = JSON.parse(dto?.deletedImageUrls || "[]");

    if (sanitizedDeletedUrls.length > 0) {
      const existingFiles = existingDraft?.files || []
      const filteredFiles = existingFiles.filter((file: any) => !sanitizedDeletedUrls?.includes(file.url))
      const combineLength = filteredFiles?.length || 0 + dto?.files?.length || 0
      if (combineLength > 5) throw new BadRequestException("You can upload maximum 5 files")
    }

    console.log({ files: dto.files, sanitizedDeletedUrls })

    const newFiles = await this.processFiles(forum, dto.files, sanitizedDeletedUrls);

    // Max 5 file check
    const combinedFiles = [
      ...(existingDraft.files || []).filter(
        (f: any) => !sanitizedDeletedUrls?.includes(f.url),
      ),
      ...newFiles,
    ];

    console.log({ newFiles })
    console.log({ combinedFiles })
    // if (combinedFiles.length > 5)
    //   throw new BadRequestException("You can upload maximum 5 files");

    if (dto.node) delete dto.node;
    if (dto.club) delete dto.club;
    if (dto.chapter) delete dto.chapter;

    return await this.debateModel.findByIdAndUpdate(
      dto.debateId,
      { ...dto, files: combinedFiles, publishedStatus, tags: JSON.parse(dto.tags || "[]") },
      { new: true, session },
    );
  }

  private async createNewDebate(
    dto: any,
    userId: Types.ObjectId,
    userDetails: any,
    publishedStatus: string,
    files: any[],
    session: any,
  ) {
    const dataToSave = {
      ...dto,
      createdBy: userId,
      publishedStatus,
      node: dto.node ? new Types.ObjectId(dto.node) : null,
      club: dto.club ? new Types.ObjectId(dto.club) : null,
      chapter: dto.chapter ? new Types.ObjectId(dto.chapter) : null,
      tags: JSON.parse(dto.tags || "[]"),
      isActive: userDetails.role !== "member",
      files,
      publishedDate: publishedStatus === "published" ? new Date() : null,
    };

    const newDebate = new this.debateModel(dataToSave);
    return await newDebate.save({ session });
  }

  //----------------------------------------------------------------------------------

  async adoptDebate(dataToSave: {
    type: 'club' | 'node';
    debateId: Types.ObjectId;
    clubId?: Types.ObjectId;
    nodeId?: Types.ObjectId;
    userId: Types.ObjectId;
  }) {
    try {

      const { isMember, role } = await this.commonService.getUserDetailsInForum({
        userId: dataToSave.userId.toString(),
        forumId: dataToSave.type === 'club' ? dataToSave.clubId?.toString() : dataToSave.nodeId?.toString(),
        forum: dataToSave.type === 'club' ? 'club' : 'node',
      });
      if (!isMember) throw new ForbiddenException('You are not a member of this forum');
      const isAuthorized = ['admin', 'moderator', 'owner'].includes(role);

      // Fetch the existing debate
      const existingDebate = await this.debateModel.findById(
        new Types.ObjectId(dataToSave.debateId),
      );

      if (!existingDebate) throw new NotFoundException('Debate not found');

      // Check if an adoption already exists
      const existingAdoption = await this.debateAdoptionModel.findOne({
        debate: new Types.ObjectId(dataToSave.debateId),
        ...(dataToSave.type === 'club'
          ? { club: new Types.ObjectId(dataToSave.clubId) }
          : { node: new Types.ObjectId(dataToSave.nodeId) }),
      });

      if (existingAdoption) throw new BadRequestException('This Debate is already Adopted or Proposed to Adopt');

      // Create new adoption record
      const adoptionData = {
        proposedBy: new Types.ObjectId(dataToSave.userId),
        debate: new Types.ObjectId(dataToSave.debateId),
        club: dataToSave.type === 'club' ? new Types.ObjectId(dataToSave.clubId) : undefined,
        node: dataToSave.type === 'node' ? new Types.ObjectId(dataToSave.nodeId) : undefined,

        publishedStatus: isAuthorized ? 'published' : 'proposed',
        type: 'adopted',
      };

      if (isAuthorized) adoptionData['acceptedBy'] = new Types.ObjectId(dataToSave.userId);


      const newAdoption = new this.debateAdoptionModel(adoptionData);
      const savedAdoption = await newAdoption.save();

      if (savedAdoption.publishedStatus === 'published') {
        this.assetsService.createFeed(
          savedAdoption.club || savedAdoption.node || savedAdoption.chapter,
          savedAdoption.club ? 'Club' : savedAdoption.node ? 'Node' : 'Chapter',
          'Debate',
          savedAdoption.debate,
          'DebateAdoption',
          savedAdoption._id,
        )
      }

      if (isAuthorized) {
        // Update the debate's adoption information
        await this.debateModel.findByIdAndUpdate(
          dataToSave.debateId,
          {
            $addToSet: {
              [dataToSave.type === 'club' ? 'adoptedClubs' : 'adoptedNodes']: {
                [dataToSave.type]: dataToSave.type === 'club' ? dataToSave.clubId : dataToSave.nodeId,
                date: new Date(),
              },
            },
          },
          { new: true },
        );
      }

      return {
        message: isAuthorized
          ? 'Debate Adopted and Published Successfully'
          : 'Debate Proposed for Review',
        data: savedAdoption,
      };
    } catch (error) {
      console.error('Adoption error:', error);
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Error while adopting debate',
        error.message,
      );
    }
  }

  async myDebates({
    entity,
    userId,
    entityId,
    page = 1,
    limit = 10,
  }: {
    entity: 'club' | 'node';
    userId: string;
    entityId: string;
    page?: number;
    limit?: number;
  }): Promise<DebatesResponse> {
    try {
      const skip = (page - 1) * limit;

      const pipeline: PipelineStage[] = [
        // Match stage for initial filtering
        {
          $match: {
            $and: [
              { createdBy: new Types.ObjectId(userId) },
              { [entity]: new Types.ObjectId(entityId) },
              { publishedStatus: { $in: ['published', 'draft', 'proposed'] } }
            ]
          }
        },
        // Add type field for direct debates
        {
          $addFields: {
            type: 'direct'
          }
        },

        // Lookup adopted debates
        {
          $unionWith: {
            coll: 'debateadoptions',
            pipeline: [
              {
                $match: {
                  proposedBy: new Types.ObjectId(userId),
                  [entity]: new Types.ObjectId(entityId),
                  publishedStatus: { $in: ['published', 'draft', 'proposed'] }
                }
              },
              {
                $lookup: {
                  from: 'debates',
                  localField: 'debate',
                  foreignField: '_id',
                  as: 'debateDetails'
                }
              },
              { $unwind: '$debateDetails' },
              {
                $replaceRoot: {
                  newRoot: {
                    $mergeObjects: [
                      '$debateDetails',
                      {
                        type: 'adopted',
                        isAdopted: true,
                        adoptionStatus: '$publishedStatus',
                        adoptedDate: '$createdAt',
                        adoptionId: '$_id'  // Include the adoption document ID
                      }
                    ]
                  }
                }
              }
            ]
          }
        },

        // Lookup creator details
        {
          $lookup: {
            from: 'users',
            localField: 'createdBy',
            foreignField: '_id',
            as: 'creator'
          }
        },
        { $unwind: '$creator' },

        {
          "$lookup": {
            "from": "node_",
            "localField": "node",
            "foreignField": "_id",
            "as": "nodeDetails"
          }
        },
        {
          "$lookup": {
            "from": "clubs",
            "localField": "club",
            "foreignField": "_id",
            "as": "clubDetails"
          }
        },
        {
          "$lookup": {
            "from": "chapters",
            "localField": "chapter",
            "foreignField": "_id",
            "as": "chapterDetails"
          }
        },
        {
          "$addFields": {
            "details": {
              "$cond": {
                "if": { "$gt": [{ "$size": "$clubDetails" }, 0] },
                "then": {
                  "$mergeObjects": [{ "type": "club" }, { "$arrayElemAt": ["$clubDetails", 0] }]
                },
                "else": {
                  "$cond": {
                    "if": { "$gt": [{ "$size": "$nodeDetails" }, 0] },
                    "then": {
                      "$mergeObjects": [{ "type": "node" }, { "$arrayElemAt": ["$nodeDetails", 0] }]
                    },
                    "else": {
                      "$mergeObjects": [{ "type": "chapters" }, { "$arrayElemAt": ["$chapterDetails", 0] }]
                    }
                  }
                }
              }
            }
          }
        },
        {
          "$unwind": {
            "path": "$details",
            "preserveNullAndEmptyArrays": true
          }
        },

        // Lookup arguments
        {
          $lookup: {
            from: 'debatearguments',
            let: { debateId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ['$debate', '$$debateId'] }
                }
              },
              {
                $lookup: {
                  from: 'users',
                  localField: 'participant.user',
                  foreignField: '_id',
                  as: 'participant.userDetails'
                }
              },
              { $unwind: '$participant.userDetails' }
            ],
            as: 'allArguments'
          }
        },

        // Facet for pagination and total count
        {
          $facet: {
            data: [
              {
                $addFields: {
                  args: {
                    for: {
                      $filter: {
                        input: '$allArguments',
                        as: 'arg',
                        cond: { $eq: ['$$arg.participant.side', 'support'] }
                      }
                    },
                    against: {
                      $filter: {
                        input: '$allArguments',
                        as: 'arg',
                        cond: { $eq: ['$$arg.participant.side', 'against'] }
                      }
                    }
                  }
                }
              },
              { $unset: 'allArguments' },
              { $sort: { createdAt: -1 } },
              { $skip: skip },
              { $limit: limit }
            ],
            totalCount: [{ $count: 'count' }]
          }
        }
      ];

      const [result] = await this.debateModel.aggregate(pipeline);
      if (!result.data || result.data.length === 0) {
        throw new NotFoundException('No debates found for the given criteria.');
      }

      const totalCount = result.totalCount[0]?.count || 0;
      const totalPages = Math.ceil(totalCount / limit);

      return {
        message: 'Debates fetched successfully.',
        data: result.data,
        pagination: {
          currentPage: page,
          totalPages,
          totalItems: totalCount,
        },
      };
    } catch (error) {
      console.error('Error fetching debates:', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Error while fetching debates.',
        error.message,
      );
    }
  }

  async getAllClubDebatesWithChapterId(
    page: number,
    limit: number,
    isActive: boolean,
    search: string,
    chapter: Types.ObjectId,
    userId: string,
  ): Promise<any> {
    try {

      let { isMember } = await this.commonService.getUserDetailsInForum({ forum: "chapter", forumId: String(chapter), userId });
      if (!isMember) throw new BadRequestException('You are not authorized to access this resource');

      const validPage = Math.max(1, page);
      const validLimit = Math.max(1, limit);
      const skip = (validPage - 1) * validLimit;

      // Set current date to start of day for comparison
      const currentDate = new Date();
      currentDate.setHours(0, 0, 0, 0);

      // Base query for chapter debates
      let query: any = {
        chapter: new Types.ObjectId(chapter)
      };

      // Add search conditions if provided
      if (search?.trim()) {
        query.$or = [
          { 'debate.topic': new RegExp(search, 'i') },
          { 'debate.significance': new RegExp(search, 'i') },
          { 'debate.targetAudience': new RegExp(search, 'i') },
        ];
      }

      // Populate options with conditions for the original debate
      const populateOptions = {
        path: 'debate',
        match: {
          publishedStatus: 'published',
          closingDate: { $gte: currentDate },
          isArchived: false,
          isPublic: true
        },
        populate: [
          { path: 'node', select: 'name profileImage' },
          { path: 'club', select: 'name profileImage' },
          { path: 'createdBy', select: 'userName profileImage firstName lastName' }
        ]
      };

      // Get total count with the same conditions
      const total = await this.chapterDebatesModel
        .find(query)
        .populate(populateOptions)
        .countDocuments();

      // Get chapter debates
      const chapterDebates = await this.chapterDebatesModel
        .find(query)
        .populate(populateOptions)
        .populate('chapter', 'name profileImage')
        .skip(skip)
        .limit(validLimit)
        .sort({ createdAt: -1 })
        .lean();

      // Get argument counts for each chapter debate
      const getChapterDebateArgumentCounts = async (debateId: Types.ObjectId, chapterDebateId: Types.ObjectId) => {
        const matchConditions = {
          debate: debateId,
          chapterDebate: chapterDebateId  // This ensures we only count arguments specific to this chapter debate
        };

        const [forCount, againstCount] = await Promise.all([
          this.debateArgumentModel.countDocuments({
            ...matchConditions,
            'participant.side': 'support'
          }),
          this.debateArgumentModel.countDocuments({
            ...matchConditions,
            'participant.side': 'against'
          })
        ]);

        return {
          for: forCount,
          against: againstCount
        };
      };

      // Transform chapter debates and add argument counts
      const transformedChapterDebates = await Promise.all(
        chapterDebates
          .filter(cp => cp.debate) // Filter out any null debates
          .map(async (cp: any) => {
            const args = await getChapterDebateArgumentCounts(cp.debate._id, cp._id);
            return {
              ...cp.debate,
              chapter: cp.chapter,
              chapterDebateId: cp._id,
              createdAt: cp.createdAt,
              args
            };
          })
      );

      return {
        debates: transformedChapterDebates,
        page: validPage,
        limit: validLimit,
        total,
        totalPages: Math.ceil(total / validLimit),
        hasNextPage: validPage < Math.ceil(total / validLimit),
        hasPrevPage: validPage > 1
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException)
        throw error;

      throw new BadRequestException(
        'Failed to get all Club Debates. Please try again later.',
      );
    }
  }
  // Fetch ongoing public global debates (not expired)
  async getOngoingPublicGlobalDebates(
    page: number = 1,
    limit: number = 10
  ): Promise<DebatesResponse> {
    try {
      if (page < 1 || limit < 1) {
        throw new BadRequestException('Page and limit must be positive numbers.');
      }

      const currentTime = new Date();
      const skip = (page - 1) * limit;

      const pipeline: PipelineStage[] = [
        // Match stage for direct debates
        {
          $match: {
            publishedStatus: 'published',
            isPublic: true,
            createdAt: { $lte: currentTime },
            closingDate: { $gte: currentTime }
          }
        },
        // Add type field for direct debates
        {
          $addFields: {
            type: 'direct'
          }
        },

        // Combine with adopted debates
        {
          $unionWith: {
            coll: 'debateadoptions',
            pipeline: [
              {
                $match: {
                  publishedStatus: 'published'
                }
              },
              {
                $lookup: {
                  from: 'debates',
                  localField: 'debate',
                  foreignField: '_id',
                  as: 'debateDetails'
                }
              },
              { $unwind: '$debateDetails' },
              {
                $match: {
                  'debateDetails.publishedStatus': 'published',
                  'debateDetails.isPublic': true,
                  'debateDetails.createdAt': { $lte: currentTime },
                  'debateDetails.closingDate': { $gte: currentTime }
                }
              },
              {
                $replaceRoot: {
                  newRoot: {
                    $mergeObjects: [
                      '$debateDetails',
                      {
                        type: 'adopted',
                        isAdopted: true,
                        adoptionStatus: '$publishedStatus',
                        adoptedDate: '$createdAt',
                        adoptionId: '$_id'
                      }
                    ]
                  }
                }
              }
            ]
          }
        },

        // Lookup creator details
        {
          $lookup: {
            from: 'users',
            localField: 'createdBy',
            foreignField: '_id',
            as: 'creator'
          }
        },
        { $unwind: '$creator' },

        {
          "$lookup": {
            "from": "node_",
            "localField": "node",
            "foreignField": "_id",
            "as": "nodeDetails"
          }
        },
        {
          "$lookup": {
            "from": "clubs",
            "localField": "club",
            "foreignField": "_id",
            "as": "clubDetails"
          }
        },
        {
          "$lookup": {
            "from": "chapters",
            "localField": "chapter",
            "foreignField": "_id",
            "as": "chapterDetails"
          }
        },
        {
          "$addFields": {
            "details": {
              "$cond": {
                "if": { "$gt": [{ "$size": "$clubDetails" }, 0] },
                "then": {
                  "$mergeObjects": [{ "type": "club" }, { "$arrayElemAt": ["$clubDetails", 0] }]
                },
                "else": {
                  "$cond": {
                    "if": { "$gt": [{ "$size": "$nodeDetails" }, 0] },
                    "then": {
                      "$mergeObjects": [{ "type": "node" }, { "$arrayElemAt": ["$nodeDetails", 0] }]
                    },
                    "else": {
                      "$mergeObjects": [{ "type": "chapters" }, { "$arrayElemAt": ["$chapterDetails", 0] }]
                    }
                  }
                }
              }
            }
          }
        },
        {
          "$unwind": {
            "path": "$details",
            "preserveNullAndEmptyArrays": true
          }
        },


        // Lookup debate arguments
        {
          $lookup: {
            from: 'debatearguments',
            let: { debateId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ['$debate', '$$debateId'] }
                }
              },
              {
                $lookup: {
                  from: 'users',
                  localField: 'participant.user',
                  foreignField: '_id',
                  as: 'participant.userDetails'
                }
              },
              { $unwind: '$participant.userDetails' }
            ],
            as: 'allArguments'
          }
        },

        // Use facet for pagination and counts
        {
          $facet: {
            data: [
              {
                $addFields: {
                  args: {
                    for: {
                      $filter: {
                        input: '$allArguments',
                        as: 'arg',
                        cond: { $eq: ['$$arg.participant.side', 'support'] }
                      }
                    },
                    against: {
                      $filter: {
                        input: '$allArguments',
                        as: 'arg',
                        cond: { $eq: ['$$arg.participant.side', 'against'] }
                      }
                    }
                  }
                }
              },
              { $unset: 'allArguments' },
              { $sort: { createdAt: -1 } },
              { $skip: skip },
              { $limit: limit }
            ],
            totalCount: [{ $count: 'count' }]
          }
        }
      ];

      const [result] = await this.debateModel.aggregate(pipeline);
      console.log({ result })
      if (!result.data || result.data.length === 0) {
        throw new NotFoundException('No ongoing public debates found.');
      }

      const totalCount = result.totalCount[0]?.count || 0;
      const totalPages = Math.ceil(totalCount / limit);

      return {
        message: 'Ongoing public debates fetched successfully.',
        data: result.data,
        pagination: {
          currentPage: page,
          totalPages,
          totalItems: totalCount,
        },
      };
    } catch (error) {
      console.error('Error fetching ongoing public debates:', error);
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Error while fetching ongoing public debates: ${error.message}`
      );
    }
  }
  async myDebatesByStatus({
    entity,
    entityId,
    page = 1,
    limit = 10,
  }: {
    entity: 'club' | 'node';
    entityId?: string;
    page?: number;
    limit?: number;
  }): Promise<DebatesResponse> {
    try {
      const skip = (page - 1) * limit;

      const matchStage: PipelineStage.Match = {
        $match: {
          publishedStatus: 'published',
          ...(entityId && { [entity]: new Types.ObjectId(entityId) })
        }
      };

      const pipeline: PipelineStage[] = [
        // Initial match for direct debates
        matchStage,
        // Add type field for direct debates
        {
          $addFields: {
            type: 'direct'
          }
        },

        // Combine with adopted debates
        {
          $unionWith: {
            coll: 'debateadoptions',
            pipeline: [
              {
                $match: {
                  publishedStatus: 'published',
                  ...(entityId && { [entity]: new Types.ObjectId(entityId) })
                }
              },
              {
                $lookup: {
                  from: 'debates',
                  localField: 'debate',
                  foreignField: '_id',
                  as: 'debateDetails'
                }
              },
              { $unwind: '$debateDetails' },
              {
                $match: {
                  'debateDetails.publishedStatus': 'published'
                }
              },
              {
                $replaceRoot: {
                  newRoot: {
                    $mergeObjects: [
                      '$debateDetails',
                      {
                        type: 'adopted',
                        isAdopted: true,
                        adoptionStatus: '$publishedStatus',
                        adoptedDate: '$createdAt',
                        adoptionId: '$_id'
                      }
                    ]
                  }
                }
              }
            ]
          }
        },

        // Lookup creator details
        {
          $lookup: {
            from: 'users',
            localField: 'createdBy',
            foreignField: '_id',
            as: 'creator'
          }
        },
        { $unwind: '$creator' },

        //look up for forum details

        {
          "$lookup": {
            "from": "node_",
            "localField": "node",
            "foreignField": "_id",
            "as": "nodeDetails"
          }
        },
        {
          "$lookup": {
            "from": "clubs",
            "localField": "club",
            "foreignField": "_id",
            "as": "clubDetails"
          }
        },
        {
          "$lookup": {
            "from": "chapters",
            "localField": "chapter",
            "foreignField": "_id",
            "as": "chapterDetails"
          }
        },
        {
          "$addFields": {
            "details": {
              "$cond": {
                "if": { "$gt": [{ "$size": "$clubDetails" }, 0] },
                "then": {
                  "$mergeObjects": [{ "type": "club" }, { "$arrayElemAt": ["$clubDetails", 0] }]
                },
                "else": {
                  "$cond": {
                    "if": { "$gt": [{ "$size": "$nodeDetails" }, 0] },
                    "then": {
                      "$mergeObjects": [{ "type": "node" }, { "$arrayElemAt": ["$nodeDetails", 0] }]
                    },
                    "else": {
                      "$mergeObjects": [{ "type": "chapters" }, { "$arrayElemAt": ["$chapterDetails", 0] }]
                    }
                  }
                }
              }
            }
          }
        },
        {
          "$unwind": {
            "path": "$details",
            "preserveNullAndEmptyArrays": true
          }
        },
        // Lookup debate arguments
        {
          $lookup: {
            from: 'debatearguments',
            let: { debateId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ['$debate', '$$debateId'] }
                }
              },
              {
                $lookup: {
                  from: 'users',
                  localField: 'participant.user',
                  foreignField: '_id',
                  as: 'participant.userDetails'
                }
              },
              { $unwind: '$participant.userDetails' }
            ],
            as: 'allArguments'
          }
        },

        // Use facet for pagination and counts
        {
          $facet: {
            data: [
              {
                $addFields: {
                  args: {
                    for: {
                      $filter: {
                        input: '$allArguments',
                        as: 'arg',
                        cond: { $eq: ['$$arg.participant.side', 'support'] }
                      }
                    },
                    against: {
                      $filter: {
                        input: '$allArguments',
                        as: 'arg',
                        cond: { $eq: ['$$arg.participant.side', 'against'] }
                      }
                    }
                  }
                }
              },
              { $unset: 'allArguments' },
              { $sort: { createdAt: -1 } },
              { $skip: skip },
              { $limit: limit }
            ],
            totalCount: [{ $count: 'count' }]
          }
        }
      ];

      const [result] = await this.debateModel.aggregate(pipeline);

      if (!result.data || result.data.length === 0) {
        throw new NotFoundException('No debates found for the given criteria.');
      }

      const totalCount = result.totalCount[0]?.count || 0;
      const totalPages = Math.ceil(totalCount / limit);
      console.log({ result })
      return {
        message: 'Debates fetched successfully.',
        data: result.data,
        pagination: {
          currentPage: page,
          totalPages,
          totalItems: totalCount,
        },
      };
    } catch (error) {
      console.error('Error fetching debates:', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Error while fetching debates.',
        error.message,
      );
    }
  }

  async getOngoingDebatesForEntity({
    entityId,
    entityType,
    page = 1,
    limit = 10,
  }: {
    entityId: string;
    entityType: TForum;
    page?: number;
    limit?: number;
  }): Promise<DebatesResponse> {
    try {
      // Input validation
      if (!entityId || !entityType) {
        throw new BadRequestException('Both entityId and entityType are required.');
      }
      if (page < 1 || limit < 1) {
        throw new BadRequestException('Page and limit must be positive numbers.');
      }
      if (!['club', 'node', 'chapter'].includes(entityType)) {
        throw new BadRequestException('Invalid entity type. Use "club", "node" or "chapter".');
      }

      const currentTime = new Date();
      const skip = (page - 1) * limit;

      const pipeline: PipelineStage[] = [
        // Match stage for regular debates
        {
          $match: {
            publishedStatus: 'published',
            [entityType]: new Types.ObjectId(entityId),
            createdAt: { $lte: currentTime },
            closingDate: { $gte: currentTime }
          }
        },
        // Add type field for direct debates
        {
          $addFields: {
            type: 'direct'
          }
        },

        // Combine with adopted debates
        {
          $unionWith: {
            coll: 'debateadoptions',
            pipeline: [
              {
                $match: {
                  publishedStatus: 'published',
                  [entityType]: new Types.ObjectId(entityId)
                }
              },
              {
                $lookup: {
                  from: 'debates',
                  localField: 'debate',
                  foreignField: '_id',
                  as: 'debateDetails'
                }
              },
              { $unwind: '$debateDetails' },
              {
                $match: {
                  'debateDetails.publishedStatus': 'published',
                  'debateDetails.createdAt': { $lte: currentTime },
                  'debateDetails.closingDate': { $gte: currentTime }
                }
              },
              {
                $replaceRoot: {
                  newRoot: {
                    $mergeObjects: [
                      '$debateDetails',
                      {
                        type: 'adopted',
                        isAdopted: true,
                        adoptionStatus: '$publishedStatus',
                        adoptedDate: '$createdAt',
                        adoptionId: '$_id'
                      }
                    ]
                  }
                }
              }
            ]
          }
        },

        {
          "$lookup": {
            "from": "node_",
            "localField": "node",
            "foreignField": "_id",
            "as": "nodeDetails"
          }
        },
        {
          "$lookup": {
            "from": "clubs",
            "localField": "club",
            "foreignField": "_id",
            "as": "clubDetails"
          }
        },
        {
          "$lookup": {
            "from": "chapters",
            "localField": "chapter",
            "foreignField": "_id",
            "as": "chapterDetails"
          }
        },
        {
          "$addFields": {
            "details": {
              "$cond": {
                "if": { "$gt": [{ "$size": "$clubDetails" }, 0] },
                "then": {
                  "$mergeObjects": [{ "type": "club" }, { "$arrayElemAt": ["$clubDetails", 0] }]
                },
                "else": {
                  "$cond": {
                    "if": { "$gt": [{ "$size": "$nodeDetails" }, 0] },
                    "then": {
                      "$mergeObjects": [{ "type": "node" }, { "$arrayElemAt": ["$nodeDetails", 0] }]
                    },
                    "else": {
                      "$mergeObjects": [{ "type": "chapters" }, { "$arrayElemAt": ["$chapterDetails", 0] }]
                    }
                  }
                }
              }
            }
          }
        },
        {
          "$unwind": {
            "path": "$details",
            "preserveNullAndEmptyArrays": true
          }
        },




        // Lookup creator details
        {
          $lookup: {
            from: 'users',
            localField: 'createdBy',
            foreignField: '_id',
            as: 'creator'
          }
        },
        { $unwind: '$creator' },

        // Lookup arguments
        {
          $lookup: {
            from: 'debatearguments',
            let: { debateId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ['$debate', '$$debateId'] }
                }
              },
              {
                $lookup: {
                  from: 'users',
                  localField: 'participant.user',
                  foreignField: '_id',
                  as: 'participant.userDetails'
                }
              },
              { $unwind: '$participant.userDetails' }
            ],
            as: 'allArguments'
          }
        },

        // Facet for pagination and total count
        {
          $facet: {
            data: [
              {
                $addFields: {
                  args: {
                    for: {
                      $filter: {
                        input: '$allArguments',
                        as: 'arg',
                        cond: { $eq: ['$$arg.participant.side', 'support'] }
                      }
                    },
                    against: {
                      $filter: {
                        input: '$allArguments',
                        as: 'arg',
                        cond: { $eq: ['$$arg.participant.side', 'against'] }
                      }
                    }
                  }
                }
              },
              { $unset: 'allArguments' },
              { $sort: { createdAt: -1 } },
              { $skip: skip },
              { $limit: limit }
            ],
            totalCount: [{ $count: 'count' }]
          }
        }
      ];

      const [result] = await this.debateModel.aggregate(pipeline);

      if (!result.data || result.data.length === 0) {
        throw new NotFoundException(
          `No ongoing debates found for the ${entityType}.`
        );
      }

      const totalCount = result.totalCount[0]?.count || 0;
      const totalPages = Math.ceil(totalCount / limit);

      return {
        message: `Ongoing debates fetched successfully for the ${entityType}.`,
        data: result.data,
        pagination: {
          currentPage: page,
          totalPages,
          totalItems: totalCount,
        },
      };
    } catch (error) {
      console.error('Error fetching ongoing debates:', error);
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Error while fetching ongoing debates: ${error.message}`
      );
    }
  }




  async publishDebate(
    debateId: string,
    userId: string,
    entityId: string,
    entityType: 'node' | 'club',
  ): Promise<Debate> {
    try {
      // Find the debate by ID
      const debate = await this.debateModel.findById(debateId);
      if (!debate) {
        throw new NotFoundException('Debate not found.');
      }

      // Check if the entity type and ID match the debate's club or node
      if (
        (entityType === 'node' && !debate.node?.equals(entityId)) ||
        (entityType === 'club' && !debate.club?.equals(entityId))
      ) {
        throw new ForbiddenException(
          'This debate does not belong to the specified entity.',
        );
      }

      // Check if the user is authorized to publish the debate
      const membershipModel: any =
        entityType === 'node' ? this.nodeMembersModel : this.clubMembersModel;

      const membership = await membershipModel.findOne({
        [entityType]: new Types.ObjectId(entityId),
        user: new Types.ObjectId(userId),
        role: 'admin', // Only admins can publish debates
        status: 'MEMBER',
      });

      if (!membership) {
        throw new ForbiddenException(
          'You are not authorized to publish this debate.',
        );
      }

      // Update the debate's publishedStatus and publishedBy
      debate.publishedStatus = 'published';
      debate.publishedBy = new Types.ObjectId(userId);
      await debate.save();

      return debate;
    } catch (error) {
      throw error; // Let the caller handle errors
    }
  }

  async createViewsForDebate(
    userId: Types.ObjectId,
    debateId: Types.ObjectId,
  ) {
    try {
      // Check if the user has already viewed
      const existingDebate = await this.debateModel.findOne({
        _id: debateId,
        views: userId, // Direct match as `views` is an array of IDs
      });

      if (existingDebate) {
        return {
          message: 'User has already viewed this Debate',
          debate: existingDebate, // Return the existing debate data
        };
      }

      // Add userId to the views array if not already present
      const updatedDebate = await this.debateModel.findByIdAndUpdate(
        debateId,
        { $addToSet: { views: userId } }, // Ensures no duplicates
        { new: true }, // Return the updated document
      );

      if (!updatedDebate) {
        throw new NotFoundException('Debate not found');
      }

      return { message: 'Viewed successfully', debate: updatedDebate };
    } catch (error) {
      console.error('Error while updating views:', error.message);

      throw new InternalServerErrorException(
        'Error while viewing Debate',
      );
    }
  }


  async getNonAdoptedClubsAndNodes(userId: string, debateId: Types.ObjectId) {
    try {
      // Fetch the debate
      const sourceDebate = await this.debateModel
        .findById(debateId)
        .select('club node')
        .lean();

      if (!sourceDebate) {
        throw new NotFoundException('Debate not found');
      }

      // Fetch all clubs the user is part of
      const userClubs = await this.clubMembersModel
        .find({ user: new Types.ObjectId(userId), status: 'MEMBER' })
        .populate({
          path: 'club',
          select: 'name about domain profileImage coverImage isPublic '
        })
        .select('club role')
        .lean();

      const userClubIds = userClubs?.map((club) => club?.club?._id.toString());

      const userClubDetails = userClubs?.reduce((acc, club: any) => {
        acc[club?.club?._id.toString()] = {
          role: club.role,
          name: club.club.name,
          profileImage: club.club.profileImage,
          description: club.club.description
        };
        return acc;
      }, {});

      // Fetch all nodes the user is part of
      const userNodes = await this.nodeMembersModel
        .find({ user: new Types.ObjectId(userId), status: 'MEMBER' })
        .populate({
          path: 'node',
          select: 'name about domain profileImage coverImage '
        })
        .select('node role')
        .lean();

      const userNodeIds = userNodes?.map((node) => node?.node?._id.toString());
      const userNodeDetails = userNodes?.reduce((acc, node: any) => {
        acc[node?.node?._id.toString()] = {
          role: node?.role,
          name: node?.node?.name,
          profileImage: node?.node?.profileImage,
          description: node?.node?.description
        };
        return acc;
      }, {});

      // Find clubs that already have adoption requests for this debate
      const clubAdoptions = await this.debateAdoptionModel
        .find({
          debate: new Types.ObjectId(debateId),
          club: { $in: userClubIds.map((id) => new Types.ObjectId(id)) },
          publishedStatus: { $in: ['published', 'proposed'] }, // Only consider active adoptions
        })
        .select('club')
        .lean();

      const clubIdsWithAdoption = clubAdoptions.map((d) => d?.club?.toString());

      // Find nodes that already have adoption requests for this debate
      const nodeAdoptions = await this.debateAdoptionModel
        .find({
          debate: new Types.ObjectId(debateId),
          node: { $in: userNodeIds.map((id) => new Types.ObjectId(id)) },
          publishedStatus: { $in: ['published', 'proposed'] }, // Only consider active adoptions
        })
        .select('node')
        .lean();

      const nodeIdsWithAdoption = nodeAdoptions.map((d) => d?.node?.toString());

      // Filter out clubs that already have adoption requests
      // and the creator club
      const nonAdoptedClubs = userClubIds
        .filter(
          (clubId) =>
            !clubIdsWithAdoption.includes(clubId) &&
            clubId !== sourceDebate.club?.toString(),
        )
        .map((clubId) => ({
          _id: clubId,
          role: userClubDetails[clubId].role,
          name: userClubDetails[clubId].name,
          profileImage: userClubDetails[clubId].profileImage,
          description: userClubDetails[clubId].description,
        }));

      // Filter out nodes that already have adoption requests
      // and the creator node
      const nonAdoptedNodes = userNodeIds
        .filter(
          (nodeId) =>
            !nodeIdsWithAdoption.includes(nodeId) &&
            nodeId !== sourceDebate.node?.toString(),
        )
        .map((nodeId) => ({
          _id: nodeId,
          role: userNodeDetails[nodeId].role,
          name: userNodeDetails[nodeId].name,
          profileImage: userNodeDetails[nodeId].profileImage,
          description: userNodeDetails[nodeId].description,
        }));

      return {
        clubs: nonAdoptedClubs,
        nodes: nonAdoptedNodes,
      };
    } catch (error) {
      console.error('Error fetching non-adopted clubs and nodes:', error);
      throw new InternalServerErrorException('Failed to fetch data');
    }
  }

  async getDebateById(id: string, userId: string, requestFromForumId: Types.ObjectId, chapterAlyId: string, adoptionId: string): Promise<Debate> {
    try {

      let alyDebate;
      if (adoptionId) alyDebate = await this.debateAdoptionModel.findById(adoptionId).populate({
        path: 'proposedBy',
        select: 'userName firstName middleName lastName profileImage interests',
        strictPopulate: false,
      }).lean();
      else if (chapterAlyId) alyDebate = await this.chapterDebatesModel.findById(chapterAlyId);

      if (alyDebate && String(alyDebate?.node || alyDebate?.club || alyDebate?.chapter) !== String(requestFromForumId)) {
        throw new ForbiddenException('You are not authorized to view this debate');
      }

      const debate = await this.debateModel
        .findById(id)
        .populate({
          path: 'createdBy',
          select: 'userName firstName middleName lastName profileImage interests'
        })
        .lean()
        .exec();



      const { forumId, forumType } = this.getForumDetails(alyDebate, debate);
      const { isMember, role } = await this.commonService.getUserDetailsInForum({
        userId: String(userId),
        forumId: String(forumId),
        forum: forumType
      });

      console.log({ role, publishedStatus: debate.publishedStatus, userId })
      const publishedStatus = alyDebate?.publishedStatus || debate.publishedStatus;
      if (publishedStatus !== 'published' && !['admin', 'owner'].includes(role) && String(debate?.createdBy?._id) !== String(userId)) {
        throw new ForbiddenException('You are not authorized to view this debate');
      }

      // Check if the debate is archived and restrict access
      if (debate.isArchived) {
        if (adoptionId || chapterAlyId) {
          throw new ForbiddenException('You cannot access archived adopted debates');
        }
        if (!['admin', 'owner'].includes(role) && String(debate?.createdBy?._id) !== String(userId)) {
          throw new ForbiddenException('You are not authorized to view this archived debate');
        }
      }


      // if (!isMember && !debate?.isPublic) throw new ForbiddenException('You are not authorized to access this debate')

      if (isMember) (debate as any).currentUserRole = role;
      let _debate: any = { ...debate, currentUserRole: role, isOwnerOfAsset: String(debate.createdBy._id) === String(userId) };

      if (adoptionId) { _debate.adoptedBy = alyDebate.proposedBy; _debate.adoptedAt = alyDebate.createdAt, _debate.publishedStatus = alyDebate.publishedStatus }

      if (String(forumId) !== String(requestFromForumId) && !debate.isPublic) {
        throw new ForbiddenException('You are not authorized to view this rule');
      }

      if (!debate) {
        throw new NotFoundException('Debate not found');
      }
      return _debate;
    } catch (error) {
      if (error instanceof ForbiddenException)
        throw error
      throw error
    }
  }

  private getForumDetails(alyDebate: any, debate: any) {
    const forumId = (
      alyDebate?.chapter ||
      alyDebate?.node ||
      alyDebate?.club ||
      debate?.chapter?._id ||
      debate?.node?._id ||
      debate?.club?._id
    )?.toString();

    const forumType: TForum =
      alyDebate?.node ? 'node' :
        alyDebate?.club ? 'club' :
          alyDebate?.chapter ? 'chapter' :
            debate?.node ? 'node' :
              debate?.club ? 'club' :
                'chapter';

    return { forumId, forumType };
  }


  async createArgument(
    createDebateArgumentDto,
    file?: Express.Multer.File,
  ): Promise<DebateArgument> {
    const { userId, debateId, side, content } = createDebateArgumentDto;
    try {
      let image: { url?: string; mimetype?: string }[] = [];
      if (Array.isArray(file) && file.length > 0) {
        const uploadedFile = await this.s3FileUpload.uploadFile(
          file[0].buffer,
          file[0].originalname,
          file[0].mimetype,
          'comment',
        );
        if (uploadedFile) {
          image.push({
            url: uploadedFile.url,
            mimetype: file[0].mimetype,
          })
        }
      }

      const newArgument = new this.debateArgumentModel({
        debate: new Types.ObjectId(debateId),
        image,
        participant: {
          user: new Types.ObjectId(userId),
          side: side,
        },
        content,
      });

      const savedArgument = await newArgument.save();
      return savedArgument.populate({
        path: 'participant.user',
        select: 'userName profileImage firstName lastName',
        strictPopulate: false
      });
    } catch (error) {
      throw error;
    }
  }
  async getArgumentsByDebate(debateId: string) {
    try {
      const debateArguments = await this.debateArgumentModel
        .find({
          debate: new Types.ObjectId(debateId),
        })
        .sort({ startingPoint: -1, isPinned: -1, pinnedAt: -1 })
        .populate({
          path: 'participant.user',
          select: 'userName firstName middleName lastName profileImage interests'
        })
        .exec();

      if (!debateArguments || debateArguments.length === 0) {
        throw new NotFoundException(
          `No args found for debate with ID ${debateId}`,
        );
      }

      return debateArguments;
    } catch (error) {
      throw new InternalServerErrorException(
        'Failed to fetch debate args',
        error.message,
      );
    }
  }

  async toggleVote(
    argumentId: string,
    userId: string,
    voteType: 'relevant' | 'irrelevant',
  ) {
    const userObjectId = new Types.ObjectId(userId);
    const opposite = voteType === 'relevant' ? 'irrelevant' : 'relevant';

    // First, ensure document exists and arrays are initialized
    const existingArgument = await this.debateArgumentModel.findByIdAndUpdate(
      argumentId,
      {
        $setOnInsert: {
          relevant: [],
          irrelevant: []
        }
      },
      {
        new: true,
        upsert: true
      }
    );

    if (!existingArgument) {
      throw new NotFoundException('Argument not found');
    }

    // Remove from opposite array in a separate operation
    await this.debateArgumentModel.findByIdAndUpdate(
      argumentId,
      {
        $pull: {
          [opposite]: { user: userObjectId }
        }
      }
    );

    // Check current state
    const argument = await this.debateArgumentModel.findById(argumentId);
    if (!argument) {
      throw new NotFoundException('Argument not found');
    }

    const isInTarget = argument[voteType]?.some(entry =>
      entry.user.equals(userObjectId)
    ) || false;

    // Toggle the vote in a separate operation
    let updateOperation;
    if (isInTarget) {
      updateOperation = {
        $pull: {
          [voteType]: { user: userObjectId }
        }
      };
    } else {
      updateOperation = {
        $addToSet: {
          [voteType]: {
            user: userObjectId,
            date: new Date()
          }
        }
      };
    }

    // Perform the final update
    const updatedArgument = await this.debateArgumentModel.findByIdAndUpdate(
      argumentId,
      updateOperation,
      { new: true }
    );

    return updatedArgument;
  }
  async getProposedDebatesByEntityWithAuthorization(
    entity: 'club' | 'node',
    entityId: string,
    userId: string,
    page: number = 1,
    limit: number = 10,
  ) {
    try {
      // Validate entity ID
      if (!Types.ObjectId.isValid(entityId)) {
        throw new NotFoundException(`Invalid ${entity} ID`);
      }

      // Validate pagination parameters
      if (page < 1 || limit < 1) {
        throw new BadRequestException('Invalid pagination parameters');
      }

      // Calculate skip value for pagination
      const skip = (page - 1) * limit;

      // Determine which model to use based on entity
      const membershipModel: any = entity === 'club' ? this.clubMembersModel : this.nodeMembersModel;

      // Check if the user is an admin of the entity
      const query = {
        [entity]: new Types.ObjectId(entityId),
        user: new Types.ObjectId(userId),
      };

      const member = await membershipModel.findOne(query).exec();
      if (!member || !['admin', 'moderator', 'owner'].includes(member.role)) {
        throw new ForbiddenException(
          `You do not have permission to access proposed debates for this ${entity}`,
        );
      }

      // Prepare base filters for both models
      const debateFilter = {
        [entity]: new Types.ObjectId(entityId),
        publishedStatus: 'proposed',
      };

      const adoptionFilter = {
        [entity]: new Types.ObjectId(entityId),
        publishedStatus: 'proposed',
      };

      // Get all debates and adoptions first (we'll handle pagination after sorting)
      const [directDebates, adoptedDebates]: any = await Promise.all([
        this.debateModel
          .find(debateFilter)
          .populate({
            path: 'node',
            select: 'name about domain profileImage coverImage isPublic '
          }).populate({
            path: 'club',
            select: 'name about domain profileImage coverImage isPublic '
          })
          .populate({
            path: 'createdBy',
            select: 'userName firstName middleName lastName profileImage interests'
          })
          .sort({ createdAt: -1 })  // Sort by creation date descending
          .exec(),
        this.debateAdoptionModel
          .find(adoptionFilter)
          .populate({
            path: 'proposedBy',
            select: 'userName firstName middleName lastName profileImage interests'
          })
          .populate({
            path: 'node',
            select: 'name about domain profileImage coverImage isPublic '
          }).populate({
            path: 'club',
            select: 'name about domain profileImage coverImage isPublic '
          })
          .populate('debate')
          .sort({ createdAt: -1 })  // Sort by creation date descending
          .exec(),
      ]);

      // Combine and format the results
      const allDebates = [
        ...directDebates.map(debate => ({
          ...debate.toObject(),
          type: 'direct',
          sortDate: debate.createdAt, // Use creation date for sorting
          details: {
            id: debate.chapter?._id || debate.node?._id || debate.club?._id,
            name: debate.chapter?.name || debate.node?.name || debate.club?.name,
            type: debate.chapter ? "chapters" : debate.node ? "node" : "club",
            profileImage: debate.chapter?.profileImage || debate.node?.profileImage || debate.club?.profileImage,
          }
        })),
        ...adoptedDebates.map(adoption => ({
          ...adoption.debate.toObject(),
          adoptionInfo: {
            proposedBy: adoption.proposedBy,
            message: adoption.message,
            type: adoption.type,
            publishedStatus: adoption.publishedStatus,
            proposedAt: adoption.createdAt,
          },
          type: 'adopted',
          sortDate: adoption.createdAt, // Use adoption date for sorting
          details: {
            id: adoption.chapter?._id || adoption.node?._id || adoption.club?._id,
            name: adoption.chapter?.name || adoption.node?.name || adoption.club?.name,
            type: adoption.chapter ? "chapters" : adoption.node ? "node" : "club",
            profileImage: adoption.debate.chapter?.profileImage || adoption.node?.profileImage || adoption.club?.profileImage,
          }
        })),
      ];
      // Sort combined results by date
      const sortedDebates = allDebates.sort((a, b) =>
        b.sortDate.getTime() - a.sortDate.getTime()
      );

      const totalCount = sortedDebates.length;
      const totalPages = Math.ceil(totalCount / limit);

      // If no debates found, throw NotFoundException
      if (totalCount === 0) {
        throw new NotFoundException(
          `No proposed debates found for this ${entity}`,
        );
      }

      // If requested page exceeds total pages, throw BadRequestException
      if (page > totalPages) {
        throw new BadRequestException(
          `Page ${page} exceeds total number of pages (${totalPages})`,
        );
      }

      // Apply pagination to sorted results
      const paginatedDebates = sortedDebates.slice(skip, skip + limit);

      // Clean up by removing the temporary sortDate field
      const cleanedDebates = paginatedDebates.map(({ sortDate, ...debate }) => debate);
      // Return paginated response
      return {
        data: cleanedDebates,
        metadata: {
          currentPage: page,
          totalPages,
          totalItems: totalCount,
          itemsPerPage: limit,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      };
    } catch (error) {
      console.error(`Error fetching proposed debates for ${entity}:`, error);
      throw error;
    }
  }


  async acceptDebate(
    debateId: string,
    type: string,
    userId: Types.ObjectId
  ): Promise<Debate | DebateAdoption> {
    try {
      if (type === 'adopted') {
        // Find the adoption request first to check permissions
        const adoptionRequest = await this.debateAdoptionModel.findOne({
          _id: new Types.ObjectId(debateId),
          publishedStatus: 'proposed'
        })
          // .populate('club')
          // .populate('node')
          .lean();

        if (!adoptionRequest) throw new BadRequestException('Adoption request not found');

        const forum = adoptionRequest?.club || adoptionRequest?.node
        const forumType = adoptionRequest?.club ? 'club' : 'node'


        // Check if the user has permission to accept
        const { isMember, role } = await this.commonService.getUserDetailsInForum({
          userId: userId.toString(),
          forumId: forum.toString(),
          forum: forumType as TForum
        })

        if (!isMember || !['admin', 'owner'].includes(role)) throw new ForbiddenException('You are not authorized to accept this adoption request');


        // Update adoption publishedStatus
        const updatedAdoption = await this.debateAdoptionModel.findByIdAndUpdate(
          adoptionRequest._id,
          {
            publishedStatus: 'published',
            acceptedBy: new Types.ObjectId(userId)
          },
          { new: true }
        );

        // Update the debate's adoption information
        const updatedDebate = await this.debateModel.findByIdAndUpdate(
          adoptionRequest.debate,
          {
            $push: {
              [updatedAdoption.club ? 'adoptedClubs' : 'adoptedNodes']: {
                [updatedAdoption.club ? 'club' : 'node']:
                  updatedAdoption.club || updatedAdoption.node,
                date: new Date()
              }
            }
          }
        );
        console.log({ updatedDebate, updatedAdoption })

        return updatedAdoption;
      } else {
        // For regular debate, first find the debate to check permissions
        const debate = await this.debateModel.findById(debateId);

        if (!debate) {
          throw new NotFoundException('Debate not found');
        }

        // Check member role for regular debate


        // Update debate publishedStatus
        const updatedDebate = await this.debateModel.findByIdAndUpdate(
          new Types.ObjectId(debateId),
          {
            publishedStatus: 'published',
            publishedBy: userId
          },
          { new: true }
        );

        if (!updatedDebate) {
          throw new NotFoundException('Debate not found');
        }

        return updatedDebate;
      }
    } catch (error) {
      console.error({ error })
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException(
        error.message || 'An error occurred while accepting the debate'
      );
    }
  }



  async rejectDebate(
    debateId: string,
    type: string,
    userId: Types.ObjectId
  ): Promise<Debate | DebateAdoption> {
    try {
      if (type === 'adopted') {
        // Find the adoption request first to check permissions
        const adoptionRequest = await this.debateAdoptionModel.findOne({
          debate: new Types.ObjectId(debateId),
          publishedStatus: 'proposed',

        });

        if (!adoptionRequest) {
          throw new NotFoundException('Adoption request not found');
        }

        // Update adoption publishedStatus
        const updatedAdoption = await this.debateAdoptionModel.findByIdAndUpdate(
          adoptionRequest._id,
          {
            publishedStatus: 'rejected',
            acceptedBy: userId  // Using acceptedBy to track who rejected it
          },
          { new: true }
        );

        if (!updatedAdoption) {
          throw new NotFoundException('Adoption request not found');
        }

        return updatedAdoption;
      } else {
        // For regular debate, first find the debate to check permissions
        const debate = await this.debateModel.findById(debateId);

        if (!debate) {
          throw new NotFoundException('Debate not found');
        }

        // Update debate publishedStatus
        const updatedDebate = await this.debateModel.findByIdAndUpdate(
          debateId,
          {
            publishedStatus: 'rejected',
            publishedBy: userId  // Using publishedBy to track who rejected it
          },
          { new: true }
        );

        if (!updatedDebate) {
          throw new NotFoundException('Debate not found');
        }

        return updatedDebate;
      }
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException(
        error.message || 'An error occurred while rejecting the debate'
      );
    }
  }
  async validateParticipation(
    userId: string,
    debateId: string,
    entityType: 'club' | 'node' | 'chapter',
    entity: string,
  ): Promise<{ isAllowed: boolean; reason?: string }> {
    try {
      // Fetch debate from both collections
      const [debate, debateAdoption] = await Promise.all([
        this.debateModel.findById(debateId).lean(),
        this.debateAdoptionModel.findById(debateId).lean()
      ]);

      if (!debate && !debateAdoption) return { isAllowed: false, reason: 'Debate not found' };


      // Get the active debate
      const activeDebate = debate || debateAdoption;

      // Validate if debate is associated with the provided entity
      const isDebateAssociated =
        (entityType === 'club' && activeDebate.club?.toString() === entity) ||
        (entityType === 'node' && activeDebate.node?.toString() === entity);

      if (!isDebateAssociated) {
        return {
          isAllowed: false,
          reason: `Debate is not associated with the provided ${entityType}`,
        };
      }

      // Check membership in the corresponding entity
      let isMember = false;
      if (entityType === 'club') {
        const membership = await this.clubMembersModel.findOne({
          club: new Types.ObjectId(entity),
          user: new Types.ObjectId(userId),
          status: 'MEMBER',
        });
        isMember = !!membership;
      } else if (entityType === 'node') {
        const membership = await this.nodeMembersModel.findOne({
          node: new Types.ObjectId(entity),
          user: new Types.ObjectId(userId),
          status: 'MEMBER',
        });
        isMember = !!membership;
      }

      if (!isMember) {
        return {
          isAllowed: false,
          reason: `User is not a member of the provided ${entityType}`,
        };
      }

      // All checks passed
      return { isAllowed: true };
    } catch (error) {
      console.error('Error in validateParticipation:', error);
      return {
        isAllowed: false,
        reason: 'An error occurred while validating participation',
      };
    }
  }
  async replyToDebateArgument(
    parentId: string,
    content: string,
    userId: string,
  ): Promise<DebateArgument> {
    // Check if the parent debate argument exists
    const parentArgument = await this.debateArgumentModel.findById(parentId);
    if (!parentArgument) {
      throw new NotFoundException(
        `DebateArgument with ID ${parentId} not found`,
      );
    }

    // Create a reply with the author set in the participant
    const reply = new this.debateArgumentModel({
      debate: parentArgument.debate, // Ensure the reply is part of the same debate
      content, // Set the reply content
      participant: {
        user: userId, // Only set the user (author)
      },
      parentId: new Types.ObjectId(parentId), // Associate the reply with its parent
    });

    return (await reply.save()).populate({
      path: 'participant.user',
      select: 'userName firstName middleName lastName profileImage interests'
    });
  }
  async getRepliesForParent(parentId: string): Promise<DebateArgument[]> {
    // Fetch all replies by matching parentId
    return this.debateArgumentModel
      .find({ parentId: new Types.ObjectId(parentId) })
      .populate({
        path: 'participant.user',
        select: 'userName firstName middleName lastName profileImage interests'
      });
  }

  private async uploadFile(
    file: Express.Multer.File,
    section: TForum,
  ) {
    try {
      console.log(file);
      // Uploading file to S3 or other cloud storage service
      const response = await this.s3FileUpload.uploadFile(
        file.buffer,
        file.originalname,
        file.mimetype,
        section,
      );
      return response;
    } catch (error) {
      console.error('Error uploading file:', error);
      throw new BadRequestException(
        'Failed to upload file. Please try again later.',
      );
    }
  }
  async pin(id: string, debateType: string): Promise<DebateArgument> {
    try {
      // First check if the argument exists
      const argument = await this.debateArgumentModel.findById(id);
      if (!argument) {
        throw new NotFoundException(`Debate argument #${id} not found`);
      }

      // Check if already pinned
      if (argument.isPinned) {
        throw new BadRequestException('Argument is already pinned');
      }

      // Fetch the debate to determine the type of the argument
      // const debate = await this.debateModel.findById(argument.debate);

      // Fetch the debate to determine the type of the argument
      let debate;
      if (debateType === 'adopted') {
        debate = await this.debateAdoptionModel.findById(argument.debate);
      } else {
        debate = await this.debateModel.findById(argument.debate);
      }


      if (!debate) {
        throw new NotFoundException('Debate not found');
      }

      // Check if the argument matches the type of debate (support or against)
      let type: 'support' | 'against' = argument.participant.side; // Default to 'support' (or based on debate logic)
      // Assuming debate object has a logic to distinguish whether this is for 'support' or 'against'
      if (argument.participant.side !== type) {
        throw new BadRequestException(
          `Argument type mismatch. Expected ${type}`,
        );
      }

      // Check if pinning exceeds the limit (5 for support/against)
      if (type === 'support' && debate.pinnedSupportCount >= 5) {
        throw new BadRequestException('Support arguments pin limit reached');
      }

      if (type === 'against' && debate.pinnedAgainstCount >= 5) {
        throw new BadRequestException('Against arguments pin limit reached');
      }

      // Update the argument by setting it as pinned
      const updatedArgument = await this.debateArgumentModel.findByIdAndUpdate(
        id,
        {
          $set: {
            isPinned: true,
            pinnedAt: new Date(),
          },
        },
        { new: true },
      );

      // If successfully pinned, increment the respective pinned count in the Debate model
      if (updatedArgument.isPinned) {
        if (type === 'support') {
          debate.pinnedSupportCount += 1; // Increment support pinned count
        } else {
          debate.pinnedAgainstCount += 1; // Increment against pinned count
        }
        await debate.save(); // Save the updated debate document
      }

      return updatedArgument;
    } catch (error) {
      // Handle specific known errors
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      // Log the error for debugging
      console.error('Error while pinning argument:', error);

      // Throw a generic error for unknown issues
      throw new InternalServerErrorException('Failed to pin the argument');
    }
  }

  async unpin(id: string, debateType: string): Promise<DebateArgument> {
    try {
      // First check if the argument exists
      const argument = await this.debateArgumentModel.findById(id);
      if (!argument) {
        throw new NotFoundException(`Debate argument #${id} not found`);
      }

      // Check if the argument is pinned
      if (!argument.isPinned) {
        throw new BadRequestException('Argument is not pinned');
      }

      // Fetch the debate document to update the pinned counts
      // const debate = await this.debateModel.findById(argument.debate);

      let debate;
      if (debateType === 'adopted') {
        debate = await this.debateAdoptionModel.findById(argument.debate);
      } else {
        debate = await this.debateModel.findById(argument.debate);
      }

      if (!debate) {
        throw new NotFoundException('Debate not found');
      }

      // Determine the type of the argument (either 'support' or 'against')
      const type: 'support' | 'against' = argument.participant.side;

      // Unpin the argument by updating the 'isPinned' field to false
      const updatedArgument = await this.debateArgumentModel.findByIdAndUpdate(
        id,
        {
          $set: {
            isPinned: false,
            pinnedAt: null,
          },
        },
        { new: true }, // Return the updated document
      );

      // If the argument was successfully unpinned, decrement the respective pinned count in the Debate model
      if (!updatedArgument.isPinned) {
        if (type === 'support') {
          debate.pinnedSupportCount = Math.max(
            debate.pinnedSupportCount - 1,
            0,
          ); // Decrement pinned support count
        } else if (type === 'against') {
          debate.pinnedAgainstCount = Math.max(
            debate.pinnedAgainstCount - 1,
            0,
          ); // Decrement pinned against count
        }
        await debate.save(); // Save the updated debate document
      }

      return updatedArgument;
    } catch (error) {
      // Handle specific known errors
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      // Log the error for debugging
      console.error('Error while unpinning argument:', error);

      // Throw a generic error for unknown issues
      throw new InternalServerErrorException('Failed to unpin the argument');
    }
  }

  async deleteArgument(id: string) {
    try {
      const argument = await this.debateArgumentModel.findByIdAndDelete(id);
      if (!argument) {
        throw new NotFoundException('Argument not found');
      }
      return { message: 'Argument deleted successfully' };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to delete argument');
    }
  }


  async toggleReaction(
    debateId: string,
    userId: string,
    type: 'relevant' | 'irrelevant'
  ) {
    const debate = await this.debateModel.findById(debateId);
    if (!debate) {
      throw new NotFoundException('Debate not found');
    }

    const userIdObj = new Types.ObjectId(userId);
    const oppositeType = type === 'relevant' ? 'irrelevant' : 'relevant';

    // Check if user already reacted in the same type
    const hasReaction = debate[type].some((item) =>
      item.user.equals(userIdObj)
    );

    if (hasReaction) {
      // Remove reaction if already exists
      await this.debateModel.updateOne(
        { _id: debateId },
        { $pull: { [type]: { user: userIdObj } } }
      );
    } else {
      // Ensure the user doesn't exist in the opposite array before adding
      await this.debateModel.updateOne(
        { _id: debateId },
        {
          $pull: { [oppositeType]: { user: userIdObj } }, // Remove from opposite array
          $addToSet: {
            [type]: {
              user: userIdObj,
              date: new Date(),
            },
          }, // Prevent duplicates in the same array
        }
      );
    }

    // Fetch updated debate
    const updatedDebate = await this.debateModel.findById(debateId);
    return {
      relevantCount: updatedDebate.relevant.length,
      irrelevantCount: updatedDebate.irrelevant.length,
    };
  }

  async togglePublicPrivate(
    debateId: string,
    userId: string,
    isPublic: boolean
  ) {
    try {
      const existingDebate = await this.debateModel.findOne({
        _id: debateId,
      });
      if (!existingDebate) throw new NotFoundException('Debate not found');

      const updatedDebate = await this.commonService.togglePublicPrivate({
        assetId: debateId,
        userId,
        isPublic,
        forumType: existingDebate?.club ? 'club' : existingDebate?.node ? 'node' : 'chapter',
        model: this.debateModel,
        existingItem: existingDebate
      });

      return updatedDebate;
    } catch (error) {
      console.log('error', error);
      if (error instanceof ForbiddenException) throw error;
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        'Error while updating Debate',
        error,
      );
    }
  }
  // GET /api/debates/:debateId/all-arguments
  async getAllDebateArguments(debateId, userId) {

    const originalDebate = await this.debateModel.findById(debateId);
    if (!originalDebate) throw new Error('Debate not found');

    // Find all adoptions related to this debate
    const adoptions = await this.debateAdoptionModel.find({
      debate: new Types.ObjectId(debateId),
      type: "adopted"
    });

    // Extract all relevant debate IDs (original + all adoptions)
    const allRelatedDebateIds = [
      new Types.ObjectId(debateId),
      ...adoptions.map(adoption => new Types.ObjectId(adoption.debate)) // Using the debate field from adoption
    ];

    // Fetch all arguments from all related debates
    const allArguments = await this.debateArgumentModel.find({
      'debate': { $in: allRelatedDebateIds }
    }).sort({ createdAt: 1 });

    return allArguments;
  }


  // Archive debate
  async archiveDebate(debateId: string, userId: Types.ObjectId, action: 'archive' | 'unarchive') {
    try {
      const debate = await this.debateModel.findByIdAndUpdate(
        new Types.ObjectId(debateId),
        { isArchived: action === 'archive' },
        { new: true }
      );

      const debateAdoption = await this.debateAdoptionModel.updateMany(
        { debate: new Types.ObjectId(debateId) },
        { isArchived: action === 'archive' }
      );

      if (debate) {
        await this.assetsService.updateFeed(debate?._id.toString(), debate?.isArchived ? "archived" : "published")
      }

      return { status: true, message: 'Debate archived successfully', data: debate };
    } catch (error) {
      throw new BadRequestException('Error while archiving debate', error);
    }
  }

  async toggleRemoveAdoptionAndReadopt(
    debateId: string,
    userId: string,
    action: 're-adopt' | 'removeadoption'
  ) {
    try {
      const existingDebate = await this.debateAdoptionModel.findOne({
        _id: debateId,
      });
      if (!existingDebate) throw new NotFoundException('Debate not found');

      const { forumId, forumType } = this.getForumDetails(existingDebate, null)
      const { role, isMember } = await this.commonService.getUserDetailsInForum({
        userId,
        // forum: existingDebate?.chapter ? 'chapter' : existingDebate?.node ? 'node' : 'club',
        // forumId: String(existingDebate?.chapter || existingDebate?.node || existingDebate?.club)
        forumId,
        forum: forumType
      });
      console.log({ role, isMember, forumId, forumType })


      if (!isMember || !['admin', 'owner']?.includes(role)) throw new ForbiddenException('You are not authorized to perform this action');

      const updatedDebate = await this.debateAdoptionModel.findByIdAndUpdate(debateId, {
        publishedStatus: action === 're-adopt' ? 'published' : 'rejected'
      }, { new: true });

      return { message: 'Debate adoption status updated successfully', data: updatedDebate };
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        'Error while updating Debate',
        error,
      );
    }
  }

  async getPublicMarqueePoints(debateId: string) {

    const debate = await this.debateModel.findOne({ _id: debateId, isPublic: true });
    if (!debate) throw new NotFoundException('Debate not found');

    // Fetch adopted debates with club/node populated
    const adoptedDebates = await this.debateAdoptionModel.find({
      debate: debate._id,
      type: 'adopted',
      publishedStatus: 'published'
    })
      .populate('club', '_id name')
      .populate('node', '_id name');

    const debateIds = adoptedDebates.map(adopted => adopted._id);

    // Map debateId → forum ({ _id, name, type })
    const forumMap = {};
    adoptedDebates.forEach(adopted => {
      const debateIdStr = adopted._id.toString();
      if (adopted.club) {
        forumMap[debateIdStr] = {
          _id: adopted.club._id,
          name: (adopted.club as any).name,
          type: 'club',
        };
      } else if (adopted.node) {
        forumMap[debateIdStr] = {
          _id: adopted.node._id,
          name: (adopted.node as any).name,
          type: 'node',
        };
      } else {
        forumMap[debateIdStr] = null; // Fallback
      }
    });

    // Get pinned arguments
    const debateArguments = await this.debateArgumentModel.find({
      debate: { $in: debateIds },
      isPinned: true,
    }).populate('participant.user', '_id userName profileImage');

    // Enrich with forum
    const enrichedArguments = debateArguments.map(argument => {
      const debateIdStr = argument.debate.toString();
      return {
        ...argument.toObject(),
        forum: forumMap[debateIdStr] || null,
      };
    });

    // Split by side
    const supportArguments = enrichedArguments.filter(arg => arg.participant.side === 'support');
    const againstArguments = enrichedArguments.filter(arg => arg.participant.side === 'against');

    return {
      supportPoints: supportArguments,
      againstPoints: againstArguments,
    };
  }

  async deleteDebate(debateId: string, userId: string) {
    try {
      const existingDebate = await this.debateModel.findById(debateId);
      if (!existingDebate) throw new NotFoundException('Debate not found');

      if (existingDebate?.isPublic) {
        throw new BadRequestException('Public Debate is cannot be deleted');
      }

      const { forumId, forumType } = this.getForumDetails(existingDebate, null)
      const { role, isMember } = await this.commonService.getUserDetailsInForum({
        userId,
        forumId,
        forum: forumType
      });

      if (!isMember || (['member', 'moderator'].includes(role) && existingDebate?.createdBy.toString() !== userId.toString())) {
        throw new ForbiddenException('You are not authorized to delete this debate');
      }

      // soft delete debate
      await this.debateModel.findByIdAndUpdate(debateId, { $set: { isDeleted: true } });

      // update feed status to deleted
      await this.assetsService.updateFeed(debateId, 'deleted');

      return { message: 'Debate deleted successfully' };
    } catch (error) {
      console.error("Debate DELETE Error :: ", error);
      if (error instanceof ForbiddenException) throw error;
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        'Error while deleting Debate',
        error,
      );
    }
  }

  async getDraftDebates(debateId: string, userId: string) {
    try {
      const debate = await this.debateModel.findOne({ _id: debateId, publishedStatus: "draft", createdBy: userId });
      if (!debate) throw new NotFoundException('Debate not found');
      return {
        success: true,
        message: 'Debate fetched successfully',
        data: debate,
      }

    } catch (error) {
      console.error("Debate GET Error :: ", error);
      throw error
    }
  }
}
