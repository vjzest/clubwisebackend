import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { ClientSession, Model, Types } from 'mongoose';

import { UserResponseDto } from './dto/user.dto';
import { plainToClass, Type } from 'class-transformer';
import { User } from '../shared/entities/user.entity';
import { UserWithoutPassword } from './dto/user.type';
import { AccessDto } from './dto/access.dto';
import { NodeMembers } from '../shared/entities/node-members.entity';
import { ClubMembers } from '../shared/entities/clubmembers.entity';
import { NodeJoinRequest } from '../shared/entities/node-join-requests.entity';
import { ClubJoinRequests } from '../shared/entities/club-join-requests.entity';
import { ChapterMember } from '../shared/entities/chapters/chapter-member.entity';
import { GroupChat } from '../shared/entities/chat/group-chat.entity';
import { error } from 'node:console';
import { UploadService } from '../shared/upload/upload.service';
import { RulesRegulations } from '../shared/entities/rules/rules-regulations.entity';
import { Debate } from '../shared/entities/debate/debate.entity';
import { Issues } from '../shared/entities/issues/issues.entity';
import { Projects } from '../shared/entities/projects/project.entity';
import { Club } from '../shared/entities/club.entity';
import { Node_ } from '../shared/entities/node.entity';
import { StdPlugin } from '../shared/entities/standard-plugin/std-plugin.entity';
import { StdPluginAsset } from '../shared/entities/standard-plugin/std-plugin-asset.entity';
import e from 'express';
import { GenericPost } from '../shared/entities/generic-post.entity';

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(NodeMembers.name)
    private readonly nodeMembersModel: Model<NodeMembers>,
    @InjectModel(ClubMembers.name)
    private readonly clubMembersModel: Model<ClubMembers>,
    @InjectModel(RulesRegulations.name)
    private readonly RulesRegulationModel: Model<RulesRegulations>,
    @InjectModel(Debate.name) private readonly DebateModel: Model<Debate>,
    @InjectModel(Issues.name) private readonly IssuesModel: Model<Issues>,
    @InjectModel(Projects.name) private readonly ProjectModel: Model<Projects>,
    @InjectModel(ChapterMember.name)
    private readonly chapterMemberModel: Model<ChapterMember>,
    @InjectModel(NodeJoinRequest.name)
    private readonly nodeJoinRequestModel: Model<NodeJoinRequest>,
    @InjectModel(ClubJoinRequests.name)
    private readonly clubJoinRequestsModel: Model<ClubJoinRequests>,
    @InjectModel(GroupChat.name)
    private readonly groupChatModel: Model<GroupChat>,
    @InjectModel(Club.name) private readonly clubModel: Model<Club>,
    @InjectModel(Node_.name) private readonly nodeModel: Model<Node_>,
    @InjectModel(StdPlugin.name)
    private readonly stdPluginModel: Model<StdPlugin>,
    @InjectModel(StdPluginAsset.name)
    private readonly stdPluginAssetModel: Model<StdPluginAsset>,
    @InjectModel(GenericPost.name)
    private readonly genericModel: Model<GenericPost>,
    private readonly s3FileUpload: UploadService,
  ) { }

  async getUsersNotInClubOrNode(
    search: string,
    type: 'node' | 'club',
    id: Types.ObjectId,
  ): Promise<UserWithoutPassword[]> {
    try {
      const searchRegex = new RegExp(search, 'i'); // Case-insensitive search

      const aggregationPipeline: any[] = [
        // Stage 1: Initial match for search criteria
        {
          $match: {
            $and: [
              {
                $or: [
                  { userName: searchRegex },
                  { firstName: searchRegex },
                  { lastName: searchRegex },
                  { email: searchRegex },
                ],
              },
              { emailVerified: true },
              { registered: true },
              { isOnBoarded: true },
              { isBlocked: false },
            ],
          },
        },
        // Stage 2: Look up membership based on type
        {
          $lookup: {
            from: type === 'node' ? 'nodemembers' : 'clubmembers',
            let: { userId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      {
                        $eq: [
                          type === 'node' ? '$node' : '$club',
                          new mongoose.Types.ObjectId(id),
                        ],
                      },
                      { $eq: ['$user', '$$userId'] },
                    ],
                  },
                },
              },
            ],
            as: 'membership',
          },
        },
        // Stage 3: Look up invitations based on type
        {
          $lookup: {
            from: 'invitations',
            let: { userId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      {
                        $eq: [
                          type === 'node' ? '$node' : '$club',
                          new mongoose.Types.ObjectId(id),
                        ],
                      },
                      { $eq: ['$user', '$$userId'] },
                      // { $eq: ['$isUsed', false] },
                      // { $eq: ['$isRevoked', false] },
                      { $gt: ['$expiresAt', new Date()] }, // Check if invitation is not expired
                    ],
                  },
                },
              },
            ],
            as: 'invitations',
          },
        },
        // Stage 4: Filter out users already in the node/club and with active invitations
        {
          $match: {
            membership: { $eq: [] },
            invitations: { $eq: [] },
          },
        },
        // Stage 5: Project to remove sensitive information
        {
          $project: {
            password: 0,
            membership: 0,
            invitations: 0,
          },
        },
      ];

      return await this.userModel.aggregate(aggregationPipeline);
    } catch (error) {
      console.error('Error fetching users:', error);
      throw new InternalServerErrorException('Error fetching users');
    }
  }

  /**
   * Find user by ID
   * @param userId - MongoDB ObjectId of the user
   * @returns User data without password
   * @throws NotFoundException when user is not found
   * @throws InternalServerErrorException on database errors
   */
  async findUserById(userId: Types.ObjectId): Promise<UserResponseDto> {
    try {
      const user = await this.userModel
        .findById(userId)
        .select('-password')
        .lean()
        .exec();

      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Transform mongoose document to DTO
      const userResponse = plainToClass(UserResponseDto, {
        _id: user._id.toString(),
        email: user.email,
        interests: user.interests || [],
        isBlocked: user.isBlocked || false,
        emailVerified: user.emailVerified || false,
        registered: user.registered || false,
        signupThrough: user.signupThrough,
        isOnBoarded: user.isOnBoarded || false,
        onBoardingStage: user.onBoardingStage,
        firstName: user.firstName,
        lastName: user.lastName,
        gender: user.gender,
        phoneNumber: user.phoneNumber,
        coverImage: user.coverImage,
        profileImage: user.profileImage,
      });

      return userResponse;
    } catch (error) {
      error;
      if (error instanceof NotFoundException) {
        throw error;
      }

      throw new InternalServerErrorException('Error fetching user profile');
    }
  }

  /**
   * Fetches a user by their username. If the user is not found, a success: false
   * response is returned with a message indicating that the user was not found.
   * If an error occurs, an InternalServerErrorException is thrown.
   *
   * @param term - The username of the user to search for.
   * @returns A Promise that resolves to a ServiceResponse containing the user
   *          details if found, or a success: false response if the user is not
   *          found.
   */
  async getUserByUserName(term: string) {
    if (!term) {
      throw new BadRequestException('Term not found');
    }
    try {
      const user = await this.userModel
        .findOne({ userName: term })
        .select(
          'userName firstName lastName  profileImage coverImage interests',
        );
      if (!user) {
        return {
          data: null,
          message: 'User not found.',
          success: false,
        };
      }

      return {
        data: user,
        message: 'User found successfully',
        success: true,
      };
    } catch (error) {
      error;
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Error fetching user profile');
    }
  }

  async getUsersByNameCriteria(term: string) {
    if (!term) {
      throw new BadRequestException('Term not found');
    }
    try {
      const caseInsensitive = { $regex: term, $options: 'i' };
      const users = await this.userModel
        .find(
          {
            $or: [
              { userName: caseInsensitive },
              { firstName: caseInsensitive },
              { lastName: caseInsensitive },
            ],
          },
          { password: 0 },
        )
        .lean()
        .exec();

      if (!users || users.length === 0) {
        return [];
      }

      const userNameUsers = [];
      const otherUsers = [];

      for (const user of users) {
        if (
          user.userName &&
          user.userName.toLowerCase().includes(term.toLowerCase())
        ) {
          userNameUsers.push(user);
        } else {
          otherUsers.push(user);
        }
      }

      return [...userNameUsers, ...otherUsers];
    } catch (error) {
      console.error('Error fetching users by name criteria:', error);
      throw new InternalServerErrorException('Error fetching user profile');
    }
  }

  async isUserLoggedIn(userId: Types.ObjectId) {
    try {
      const user = await this.userModel.findById(userId).select('-password');
      if (!user) {
        return {
          isLogged: false,
        };
      }
      return { isLogged: true, user };
    } catch (error) { }
  }

  /**
   * Assigns admin role to a user in a specified entity (node or club).
   *
   * @param accessDto - Data transfer object containing entity details and user ID:
   *   - entity: The type of entity ('node' or 'club').
   *   - entityId: The ID of the entity where the role is to be assigned.
   *   - accessToUserId: The ID of the user to be granted the admin role.
   *
   * @returns The updated node or club member document with the new admin role.
   *
   * @throws NotFoundException - If the node or club member, or the user is not found.
   * @throws InternalServerErrorException - If an error occurs while updating admin access.
   */
  async makeAdmin(accessDto: AccessDto) {
    try {
      const { entity, entityId, accessToUserId } = accessDto;

      if (entity === 'node') {
        const nodeMember = await this.nodeMembersModel.findOne({
          node: new Types.ObjectId(entityId),
          user: new Types.ObjectId(accessToUserId),
        });
        if (!nodeMember) {
          throw new NotFoundException('Node member not found');
        }

        const user = await this.userModel.findById(
          new Types.ObjectId(accessToUserId),
        );
        if (!user) {
          throw new NotFoundException('User not found');
        }

        return await this.nodeMembersModel.findOneAndUpdate(
          { node: nodeMember.node, user: user._id },
          { $set: { role: 'admin' } },
          { new: true },
        );
      } else if (entity === 'club') {
        const clubMember = await this.clubMembersModel.findOne({
          club: new Types.ObjectId(entityId),
          user: new Types.ObjectId(accessToUserId),
        });
        if (!clubMember) {
          throw new NotFoundException('Club member not found');
        }

        const user = await this.userModel.findById(
          new Types.ObjectId(accessToUserId),
        );
        if (!user) {
          throw new NotFoundException('User not found');
        }

        return await this.clubMembersModel.findOneAndUpdate(
          { club: clubMember.club, user: user._id },
          { $set: { role: 'admin' } },
          { new: true },
        );
      }
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Error updating admin access');
    }
  }

  /**
   * Assigns moderator role to a user in a specified entity (node or club).
   *
   * @param accessDto - Data transfer object containing entity details and user ID:
   *   - entity: The type of entity ('node' or 'club').
   *   - entityId: The ID of the entity where the role is to be assigned.
   *   - accessToUserId: The ID of the user to be granted the moderator role.
   *
   * @returns The updated node or club member document with the new moderator role.
   *
   * @throws NotFoundException - If the node or club member, or the user is not found.
   * @throws InternalServerErrorException - If an error occurs while updating moderator access.
   */
  async makeModerator(accessDto: AccessDto) {
    try {
      const { entity, entityId, accessToUserId } = accessDto;

      if (entity === 'node') {
        const nodeMember = await this.nodeMembersModel.findOne({
          node: new Types.ObjectId(entityId),
          user: new Types.ObjectId(accessToUserId),
        });
        if (!nodeMember) {
          throw new NotFoundException('Node member not found');
        }

        const user = await this.userModel.findById(
          new Types.ObjectId(accessToUserId),
        );
        if (!user) {
          throw new NotFoundException('User not found');
        }

        return await this.nodeMembersModel.findOneAndUpdate(
          { node: nodeMember.node, user: user._id },
          { $set: { role: 'moderator' } },
          { new: true },
        );
      } else if (entity === 'club') {
        const clubMember = await this.clubMembersModel.findOne({
          club: new Types.ObjectId(entityId),
          user: new Types.ObjectId(accessToUserId),
        });
        if (!clubMember) {
          throw new NotFoundException('Club member not found');
        }

        const user = await this.userModel.findById(
          new Types.ObjectId(accessToUserId),
        );
        if (!user) {
          throw new NotFoundException('User not found');
        }

        return await this.clubMembersModel.findOneAndUpdate(
          { club: clubMember.club, user: user._id },
          { $set: { role: 'moderator' } },
          { new: true },
        );
      }
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Error updating admin access');
    }
  }

  /**
   * Assigns member role to a user in a specified entity (node or club).
   *
   * @param accessDto - Data transfer object containing entity details and user ID:
   *   - entity: The type of entity ('node' or 'club').
   *   - entityId: The ID of the entity where the role is to be assigned.
   *   - accessToUserId: The ID of the user to be granted the member role.
   *
   * @returns The updated node or club member document with the new member role.
   *
   * @throws NotFoundException - If the node or club member, or the user is not found.
   * @throws InternalServerErrorException - If an error occurs while updating admin access.
   */
  async makeMember(accessDto: AccessDto) {
    try {
      const { entity, entityId, accessToUserId } = accessDto;

      if (entity === 'node') {
        const nodeMember = await this.nodeMembersModel.findOne({
          node: new Types.ObjectId(entityId),
          user: new Types.ObjectId(accessToUserId),
        });
        if (!nodeMember) {
          throw new NotFoundException('Node member not found');
        }

        const user = await this.userModel.findById(
          new Types.ObjectId(accessToUserId),
        );
        if (!user) {
          throw new NotFoundException('User not found');
        }

        return await this.nodeMembersModel.findOneAndUpdate(
          { node: nodeMember.node, user: user._id },
          { $set: { role: 'member' } },
          { new: true },
        );
      } else if (entity === 'club') {
        const clubMember = await this.clubMembersModel.findOne({
          club: new Types.ObjectId(entityId),
          user: new Types.ObjectId(accessToUserId),
        });
        if (!clubMember) {
          throw new NotFoundException('Club member not found');
        }

        const user = await this.userModel.findById(
          new Types.ObjectId(accessToUserId),
        );
        if (!user) {
          throw new NotFoundException('User not found');
        }

        return await this.clubMembersModel.findOneAndUpdate(
          { club: clubMember.club, user: user._id },
          { $set: { role: 'member' } },
          { new: true },
        );
      }
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Error updating admin access');
    }
  }

  /**
   * Removes a user from a node or club.
   *
   * @param accessDto - The data transfer object containing the entity type,
   *                    entity ID, and user ID of the user to be removed.
   *
   * @returns The deleted node or club member document.
   *
   * @throws NotFoundException - If the node or club member, or the user is not found.
   * @throws InternalServerErrorException - If an error occurs while updating admin access.
   */
  async removeMember(accessDto: AccessDto) {
    const session = await this.userModel.startSession();
    session.startTransaction();

    try {
      const { entity, entityId, accessToUserId } = accessDto;

      if (entity === 'node') {
        const nodeMember = await this.nodeMembersModel
          .findOne({
            node: new Types.ObjectId(entityId),
          })
          .session(session);

        if (!nodeMember) {
          throw new NotFoundException('Node member not found');
        }

        const user = await this.userModel
          .findById(new Types.ObjectId(accessToUserId))
          .session(session);

        if (!user) {
          throw new NotFoundException('User not found');
        }

        const deletedMember = await this.nodeMembersModel
          .findOneAndDelete(
            { node: nodeMember.node, user: user._id },
            { new: true },
          )
          .session(session);

        await this.nodeJoinRequestModel
          .findOneAndDelete({
            node: nodeMember.node,
            user: user._id,
          })
          .session(session);

        await session.commitTransaction();
        return deletedMember;
      } else {
        const clubMember = await this.clubMembersModel
          .findOne({
            club: new Types.ObjectId(entityId),
          })
          .session(session);

        if (!clubMember) {
          throw new NotFoundException('Club member not found');
        }

        const user = await this.userModel
          .findById(new Types.ObjectId(accessToUserId))
          .session(session);

        if (!user) {
          throw new NotFoundException('User not found');
        }

        const deletedMember = await this.clubMembersModel
          .findOneAndDelete(
            { club: clubMember.club, user: user._id },
            { new: true },
          )
          .session(session);

        await this.clubJoinRequestsModel
          .findOneAndDelete({
            club: new Types.ObjectId(entityId),
            user: new Types.ObjectId(accessToUserId),
          })
          .session(session);

        await session.commitTransaction();
        return deletedMember;
      }
    } catch (error) {
      await session.abortTransaction();
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Error updating admin access');
    } finally {
      await session.endSession();
    }
  }

  private async addToAllGroupChatsWithClubStatus(
    clubId: Types.ObjectId,
    userId: string,
    session: ClientSession,
  ) {
    const groupChats = await this.groupChatModel
      .find({ chapter: clubId })
      .session(session);

    for (const groupChat of groupChats) {
      const userExists = groupChat.members.some(
        (member) => member.user.toString() === userId && member.isChapter,
      );

      if (userExists) {
        await this.groupChatModel
          .updateOne(
            {
              _id: groupChat._id,
              'members.user': new Types.ObjectId(userId),
            },
            {
              $set: { 'members.$.isClub': true },
            },
          )
          .session(session);
      } else {
        await this.groupChatModel
          .updateOne(
            { _id: groupChat._id },
            {
              $push: {
                members: {
                  user: new Types.ObjectId(userId),
                  isClub: true,
                  isChapter: false,
                },
              },
            },
          )
          .session(session);
      }
    }
  }

  private async removeFromGroupChatsWithClubStatus(
    clubId: Types.ObjectId,
    userId: Types.ObjectId,
    session: ClientSession,
  ) {
    const groupChats = await this.groupChatModel
      .find({ club: clubId })
      .session(session);

    for (const groupChat of groupChats) {
      const existingMember = groupChat.members.find(
        (m) => m.user.equals(userId) && m.isChapter === true,
      );

      if (existingMember) {
        await this.groupChatModel
          .updateOne(
            {
              _id: groupChat._id,
              'members.user': userId,
            },
            {
              $set: { 'members.$.isClub': false },
            },
          )
          .session(session);
      } else {
        await this.groupChatModel
          .updateOne(
            { _id: groupChat._id },
            {
              $pull: {
                members: {
                  user: userId,
                  isClub: true,
                },
              },
            },
          )
          .session(session);
      }
    }
  }

  async updateDesignation(
    userId: string,
    memberId: string,
    nodeId: string,
    designation: string,
  ) {
    try {
      console.log({
        userId,
        memberId,
        nodeId,
      });
      // Check if the requesting user is an owner or admin of the specific node
      const userMembership = await this.nodeMembersModel.findOne({
        node: new Types.ObjectId(nodeId),
        user: new Types.ObjectId(userId),
        role: { $in: ['owner', 'admin'] },
        status: 'MEMBER',
      });

      // Check if the member being updated exists in the same node
      const memberToUpdate = await this.nodeMembersModel.findOne({
        node: new Types.ObjectId(nodeId),
        user: new Types.ObjectId(memberId),
        status: 'MEMBER',
      });

      if (!memberToUpdate) {
        throw new NotFoundException('Member not found in the node');
      }

      // Perform the update
      const result = await this.nodeMembersModel.updateOne(
        {
          _id: memberToUpdate._id,
        },
        {
          $set: {
            designation,
          },
        },
      );

      if (result.modifiedCount === 0) {
        throw new InternalServerErrorException('Failed to update designation');
      }

      return result;
    } catch (error) {
      console.log({ error });
      throw error;
    }
  }

  async updatePosition(
    userId: string,
    memberId: string,
    nodeId: string,
    position: string,
  ) {
    try {
      // Validate input parameters
      if (!userId || !memberId || !nodeId || !position) {
        throw new Error('Missing required parameters');
      }

      // Check if the requesting user is an owner or admin of the specific node
      const userMembership = await this.nodeMembersModel.findOne({
        node: new Types.ObjectId(nodeId),
        user: new Types.ObjectId(userId),
        role: { $in: ['owner', 'admin'] },
        status: 'MEMBER',
      });

      // If user is not an owner or admin of the node, throw unauthorized exception
      if (!userMembership) {
        throw new ForbiddenException(
          'Only owners and admins can update positions',
        );
      }

      // Check if the member being updated exists in the same node
      const memberToUpdate = await this.nodeMembersModel.findOne({
        node: new Types.ObjectId(nodeId),
        user: new Types.ObjectId(memberId),
        status: 'MEMBER',
      });

      if (!memberToUpdate) {
        throw new NotFoundException('Member not found in the node');
      }

      // Perform the position update
      const result = await this.nodeMembersModel.updateOne(
        {
          _id: memberToUpdate._id,
        },
        {
          $set: {
            position: position,
          },
        },
      );

      if (result.modifiedCount === 0) {
        throw new InternalServerErrorException('Failed to update position');
      }

      return {
        success: true,
        message: 'Position updated successfully',
        result,
      };
    } catch (error) {
      console.error('Error updating position:', error);
      throw error;
    }
  }

  async fetchProfile(username: string) {
    try {
      return await this.userModel
        .findOne({
          userName: username,
        })
        .select('-password');
    } catch (error) {
      console.log({ error });
      throw error;
    }
  }

  async updateProfile(
    firstName: string,
    lastName: string,
    profileImage: Express.Multer.File,
    coverImage: Express.Multer.File,
    interests: string,
    userId: string,
    phoneNumber: string,
    visibility: { email: boolean; phoneNumber: boolean },
  ) {
    console.log({ interests });
    try {
      // Check if user exists
      const user = await this.userModel.findById(userId);
      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Prepare update object
      const updateData: Partial<User> = {};

      // Add basic fields if provided
      if (firstName) updateData.firstName = firstName.trim();
      if (lastName) updateData.lastName = lastName.trim();
      if (interests) {
        updateData.interests = JSON.parse(interests);
      }
      if (visibility) {
        updateData.visibility = visibility;
      }
      // Handle file uploads if files are provided
      const uploadPromises = [];

      if (profileImage) {
        uploadPromises.push(
          this.uploadFile(profileImage).then(
            (url) => (updateData.profileImage = url.url),
          ),
        );
      }

      if (coverImage) {
        uploadPromises.push(
          this.uploadFile(coverImage).then(
            (url) => (updateData.coverImage = url.url),
          ),
        );
      }

      // Wait for all file uploads to complete
      if (uploadPromises.length > 0) {
        await Promise.all(uploadPromises);
      }

      // Update user profile
      const updatedUser = await this.userModel
        .findByIdAndUpdate(
          userId,
          { $set: { ...updateData, phoneNumber } },
          { new: true, runValidators: true },
        )
        .select('-password');

      if (!updatedUser) {
        throw new NotFoundException('Failed to update user profile');
      }

      return {
        success: true,
        message: 'Profile updated successfully',
        data: updatedUser,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      if (error.name === 'ValidationError') {
        throw new BadRequestException(error.message);
      }

      throw new BadRequestException(
        'Failed to update profile: ' + error.message,
      );
    }
  }
  async getMyAllIssues(userId: string, targetUserId: string) {
    try {
      const isSameUser = userId.toString() === targetUserId.toString();
      return await this.IssuesModel.aggregate([
        // Match relevant issues
        {
          $match: {
            createdBy: new mongoose.Types.ObjectId(targetUserId),
            isDeleted: false,
            // publishedStatus: { $in: ['published', 'draft', 'proposed'] },
            ...(isSameUser ? {} : { isPublic: true }),
            ...(isSameUser ? { publishedStatus: { $in: ['published', 'draft', 'proposed'] } } : { publishedStatus: { $in: ['published'] } }),
          },
        },
        // Lookup publisher details
        {
          $lookup: {
            from: 'users',
            localField: 'publishedBy',
            foreignField: '_id',
            as: 'publisherDetails',
          },
        },
        {
          $unwind: {
            path: '$publisherDetails',
            preserveNullAndEmptyArrays: true,
          },
        },
        // Lookup club details
        {
          $lookup: {
            from: 'clubs',
            localField: 'club',
            foreignField: '_id',
            as: 'clubDetails',
          },
        },
        {
          $unwind: {
            path: '$clubDetails',
            preserveNullAndEmptyArrays: true,
          },
        },
        // Lookup node details
        {
          $lookup: {
            from: 'node_',
            localField: 'node',
            foreignField: '_id',
            as: 'nodeDetails',
          },
        },
        {
          $unwind: {
            path: '$nodeDetails',
            preserveNullAndEmptyArrays: true,
          },
        },
        // Project final fields
        {
          $project: {
            _id: 1,
            title: 1,
            publishedStatus: 1,
            createdAt: 1,
            isArchived: 1,
            relevant: 1,
            views: 1,
            timeSpent: 1,
            publishedBy: {
              name: '$publisherDetails.name',
              _id: '$publisherDetails._id',
            },
            type: {
              $cond: {
                if: { $ne: ['$club', null] },
                then: 'club',
                else: 'node',
              },
            },
            entityName: {
              $cond: {
                if: { $ne: ['$club', null] },
                then: '$clubDetails.name',
                else: '$nodeDetails.name',
              },
            },
            forumProfile: {
              $cond: {
                if: { $ne: ['$club', null] },
                then: '$clubDetails.profileImage.url',
                else: '$nodeDetails.profileImage.url',
              },
            },
            entityId: {
              $cond: {
                if: { $ne: ['$club', null] },
                then: '$clubDetails._id',
                else: '$nodeDetails._id',
              },
            },
          },
        },
        // Sort by latest first
        {
          $sort: { createdAt: -1 },
        },
      ]);
    } catch (error) {
      throw new InternalServerErrorException('Error fetching issues', error);
    }
  }

  async getMyAllDebates(userId: string, targetUserId: string) {
    const isSameUser = userId.toString() === targetUserId.toString();

    try {
      return await this.DebateModel.aggregate([
        // Match debates for user
        {
          $match: {
            createdBy: new mongoose.Types.ObjectId(targetUserId),
            // publishedStatus: { $in: ['published', 'draft', 'proposed'] },
            ...(isSameUser ? {} : { isPublic: true }),
            ...(isSameUser ? { publishedStatus: { $in: ['published', 'draft', 'proposed'] } } : { publishedStatus: { $in: ['published'] } }),
          },
        },
        // Lookup publisher details
        {
          $lookup: {
            from: 'users',
            localField: 'publishedBy',
            foreignField: '_id',
            as: 'publisherDetails',
          },
        },
        {
          $unwind: {
            path: '$publisherDetails',
            preserveNullAndEmptyArrays: true,
          },
        },
        // Lookup club details
        {
          $lookup: {
            from: 'clubs',
            localField: 'club',
            foreignField: '_id',
            as: 'clubDetails',
          },
        },
        {
          $unwind: {
            path: '$clubDetails',
            preserveNullAndEmptyArrays: true,
          },
        },
        // Lookup node details
        {
          $lookup: {
            from: 'node_',
            localField: 'node',
            foreignField: '_id',
            as: 'nodeDetails',
          },
        },
        {
          $unwind: {
            path: '$nodeDetails',
            preserveNullAndEmptyArrays: true,
          },
        },
        // Project final fields
        {
          $project: {
            _id: 1,
            topic: 1, // Using topic instead of title for debates
            publishedStatus: 1,
            isArchived: 1,
            relevant: 1,
            views: 1,
            timeSpent: 1,
            publishedBy: {
              name: '$publisherDetails.name',
              _id: '$publisherDetails._id',
            },
            createdAt: 1,
            type: {
              $cond: {
                if: { $ne: ['$club', null] },
                then: 'club',
                else: 'node',
              },
            },
            entityName: {
              $cond: {
                if: { $ne: ['$club', null] },
                then: '$clubDetails.name',
                else: '$nodeDetails.name',
              },
            },
            entityId: {
              $cond: {
                if: { $ne: ['$club', null] },
                then: '$clubDetails._id',
                else: '$nodeDetails._id',
              },
            },
          },
        },
        // Sort by latest first
        {
          $sort: { createdAt: -1 },
        },
      ]);
    } catch (error) {
      throw new InternalServerErrorException('Error fetching debates', error);
    }
  }

  async getMyAllRules(userId: string, targetUserId: string) {
    try {
      const isSameUser = userId.toString() === targetUserId.toString();
      return await this.RulesRegulationModel.aggregate([
        {
          $match: {
            createdBy: new mongoose.Types.ObjectId(targetUserId),
            // publishedStatus: { $in: ['published', 'draft', 'proposed'] },
            isDeleted: false,
            rootParent: { $exists: false },
            ...(isSameUser ? {} : { isPublic: true }),
            ...(isSameUser ? { publishedStatus: { $in: ['draft', 'proposed', 'published'] } } : { publishedStatus: { $in: ['published'] } }),
          },
        },
        // Lookup publisher details
        {
          $lookup: {
            from: 'users',
            localField: 'publishedBy',
            foreignField: '_id',
            as: 'publisherDetails',
          },
        },
        {
          $unwind: {
            path: '$publisherDetails',
            preserveNullAndEmptyArrays: true,
          },
        },
        // Lookup club details
        {
          $lookup: {
            from: 'clubs',
            localField: 'club',
            foreignField: '_id',
            as: 'clubDetails',
          },
        },
        {
          $unwind: {
            path: '$clubDetails',
            preserveNullAndEmptyArrays: true,
          },
        },
        // Lookup node details
        {
          $lookup: {
            from: 'node_',
            localField: 'node',
            foreignField: '_id',
            as: 'nodeDetails',
          },
        },
        {
          $unwind: {
            path: '$nodeDetails',
            preserveNullAndEmptyArrays: true,
          },
        },
        // Lookup chapter details
        {
          $lookup: {
            from: 'chapters',
            localField: 'chapter',
            foreignField: '_id',
            as: 'chapterDetails',
          },
        },
        {
          $unwind: {
            path: '$chapterDetails',
            preserveNullAndEmptyArrays: true,
          },
        },
        // Project final fields
        {
          $project: {
            _id: 1,
            title: 1,
            publishedStatus: 1,
            publishedBy: {
              name: '$publisherDetails.name',
              _id: '$publisherDetails._id',
            },
            isArchived: 1,
            createdAt: 1,
            relevant: 1,
            views: 1,
            timeSpent: 1,
            type: {
              $switch: {
                branches: [
                  { case: { $ne: ['$club', null] }, then: 'club' },
                  { case: { $ne: ['$node', null] }, then: 'node' },
                  { case: { $ne: ['$chapter', null] }, then: 'chapter' },
                ],
                default: null,
              },
            },
            entityName: {
              $switch: {
                branches: [
                  { case: { $ne: ['$club', null] }, then: '$clubDetails.name' },
                  { case: { $ne: ['$node', null] }, then: '$nodeDetails.name' },
                  {
                    case: { $ne: ['$chapter', null] },
                    then: '$chapterDetails.name',
                  },
                ],
                default: null,
              },
            },
            entityId: {
              $switch: {
                branches: [
                  { case: { $ne: ['$club', null] }, then: '$clubDetails._id' },
                  { case: { $ne: ['$node', null] }, then: '$nodeDetails._id' },
                  {
                    case: { $ne: ['$chapter', null] },
                    then: '$chapterDetails._id',
                  },
                ],
                default: null,
              },
            },
          },
        },
        // Sort by latest first
        {
          $sort: { createdAt: -1 },
        },
      ]);
    } catch (error) {
      throw new InternalServerErrorException('Error fetching rules', error);
    }
  }
  async getMyAllProjects(userId: string, targetUserId: string) {
    try {

      const isSameUser = userId.toString() === targetUserId.toString();

      return await this.ProjectModel.aggregate([
        // Match projects for user
        {
          $match: {
            createdBy: new mongoose.Types.ObjectId(targetUserId),
            ...(isSameUser ? {} : { isPublic: true }),
            ...(isSameUser ? { publishedStatus: { $in: ['draft', 'published', 'proposed', 'rejected', 'inactive'] } } : { publishedStatus: { $in: ['published'] } }),
          },
        },
        // Lookup publisher
        {
          $lookup: {
            from: 'users',
            localField: 'publishedBy',
            foreignField: '_id',
            as: 'publisherDetails',
          },
        },
        {
          $unwind: {
            path: '$publisherDetails',
            preserveNullAndEmptyArrays: true,
          },
        },
        // Lookup club
        {
          $lookup: {
            from: 'clubs',
            localField: 'club',
            foreignField: '_id',
            as: 'clubDetails',
          },
        },
        {
          $unwind: {
            path: '$clubDetails',
            preserveNullAndEmptyArrays: true,
          },
        },
        // Lookup node
        {
          $lookup: {
            from: 'node_',
            localField: 'node',
            foreignField: '_id',
            as: 'nodeDetails',
          },
        },
        {
          $unwind: {
            path: '$nodeDetails',
            preserveNullAndEmptyArrays: true,
          },
        },
        // Lookup chapter
        {
          $lookup: {
            from: 'chapters',
            localField: 'chapter',
            foreignField: '_id',
            as: 'chapterDetails',
          },
        },
        {
          $unwind: {
            path: '$chapterDetails',
            preserveNullAndEmptyArrays: true,
          },
        },
        // Project fields
        {
          $project: {
            _id: 1,
            title: 1,
            publishedStatus: 1,
            publishedBy: {
              name: '$publisherDetails.name',
              _id: '$publisherDetails._id',
            },
            createdAt: 1,
            isArchived: 1,
            relevant: 1,
            views: 1,
            timeSpent: 1,
            type: {
              $switch: {
                branches: [
                  { case: { $ifNull: ['$clubDetails', false] }, then: 'club' },
                  { case: { $ifNull: ['$nodeDetails', false] }, then: 'node' },
                  {
                    case: { $ifNull: ['$chapterDetails', false] },
                    then: 'chapter',
                  },
                ],
                default: null,
              },
            },
            entityName: {
              $switch: {
                branches: [
                  {
                    case: { $ifNull: ['$clubDetails', false] },
                    then: '$clubDetails.name',
                  },
                  {
                    case: { $ifNull: ['$nodeDetails', false] },
                    then: '$nodeDetails.name',
                  },
                  {
                    case: { $ifNull: ['$chapterDetails', false] },
                    then: '$chapterDetails.name',
                  },
                ],
                default: null,
              },
            },
            entityId: {
              $switch: {
                branches: [
                  {
                    case: { $ifNull: ['$clubDetails', false] },
                    then: '$clubDetails._id',
                  },
                  {
                    case: { $ifNull: ['$nodeDetails', false] },
                    then: '$nodeDetails._id',
                  },
                  {
                    case: { $ifNull: ['$chapterDetails', false] },
                    then: '$chapterDetails._id',
                  },
                ],
                default: null,
              },
            },
          },
        },
        // Sort by latest
        {
          $sort: {
            createdAt: -1,
          },
        },
      ]);
    } catch (error) {
      throw new InternalServerErrorException('Error fetching projects', error);
    }
  }

  async getMyAllStandardAssets(userId: string, pluginId: string, targetUserId: string) {
    try {
      const isSameUser = userId.toString() === targetUserId.toString();
      return await this.stdPluginAssetModel.aggregate([
        {
          $match: {
            createdBy: new mongoose.Types.ObjectId(targetUserId),
            plugin: new mongoose.Types.ObjectId(pluginId),
            // publishedStatus: { $in: ['published', 'draft', 'proposed'] },
            rootParent: { $exists: false },
            ...(isSameUser ? {} : { isPublic: true }),
            ...(isSameUser ? { publishedStatus: { $in: ['published', 'draft', 'proposed'] } } : { publishedStatus: { $in: ['published'] } }),
          },
        },
        // Lookup publisher details
        {
          $lookup: {
            from: 'users',
            localField: 'publishedBy',
            foreignField: '_id',
            as: 'publisherDetails',
          },
        },
        {
          $unwind: {
            path: '$publisherDetails',
            preserveNullAndEmptyArrays: true,
          },
        },
        // Lookup club details
        {
          $lookup: {
            from: 'clubs',
            localField: 'club',
            foreignField: '_id',
            as: 'clubDetails',
          },
        },
        {
          $unwind: {
            path: '$clubDetails',
            preserveNullAndEmptyArrays: true,
          },
        },
        // Lookup node details
        {
          $lookup: {
            from: 'node_',
            localField: 'node',
            foreignField: '_id',
            as: 'nodeDetails',
          },
        },
        {
          $unwind: {
            path: '$nodeDetails',
            preserveNullAndEmptyArrays: true,
          },
        },
        // Lookup chapter details
        {
          $lookup: {
            from: 'chapters',
            localField: 'chapter',
            foreignField: '_id',
            as: 'chapterDetails',
          },
        },
        {
          $unwind: {
            path: '$chapterDetails',
            preserveNullAndEmptyArrays: true,
          },
        },
        // Project final fields
        {
          $project: {
            _id: 1,
            title: 1,
            publishedStatus: 1,
            publishedBy: {
              name: '$publisherDetails.name',
              _id: '$publisherDetails._id',
            },
            data: 1,
            createdAt: 1,
            slug: 1,
            relevant: 1,
            views: 1,
            timeSpent: 1,
            // Auto-pick type based on whichever field exists
            type: {
              $ifNull: [
                {
                  $cond: [{ $ifNull: ['$node', false] }, 'node', null],
                },
                {
                  $ifNull: [
                    {
                      $cond: [{ $ifNull: ['$club', false] }, 'club', null],
                    },
                    {
                      $cond: [
                        { $ifNull: ['$chapter', false] },
                        'chapter',
                        null,
                      ],
                    },
                  ],
                },
              ],
            },

            // Auto-pick entityName (node > club > chapter)
            entityName: {
              $ifNull: [
                '$nodeDetails.name',
                { $ifNull: ['$clubDetails.name', '$chapterDetails.name'] },
              ],
            },

            // Auto-pick entityId (node > club > chapter)
            entityId: {
              $ifNull: [
                '$nodeDetails._id',
                { $ifNull: ['$clubDetails._id', '$chapterDetails._id'] },
              ],
            },
          },
        },
        // Sort by latest first
        {
          $sort: { createdAt: -1 },
        },
      ]);
    } catch (error) {
      throw new InternalServerErrorException('Error fetching rules', error);
    }
  }

  async getAssetsCount(userId: string, targetUserId: string) {
    const isSameUser = userId.toString() === targetUserId.toString();
    // Get projects count by status for specific user
    const projectsCount = await this.ProjectModel.aggregate([
      {
        $match: {
          createdBy: new Types.ObjectId(targetUserId), // Add user filter
          // publishedStatus: { $in: ['draft', 'proposed', 'published'] },
          isDeleted: { $ne: true },
          ...(isSameUser ? {} : { isPublic: true }),
          ...(isSameUser ? { publishedStatus: { $in: ['draft', 'proposed', 'published'] } } : { publishedStatus: { $in: ['published'] } }),
        },
      },
      {
        $group: {
          _id: '$publishedStatus',
          count: { $sum: 1 },
        },
      },
    ]);

    // Get debates count by status for specific user
    const debatesCount = await this.DebateModel.aggregate([
      {
        $match: {
          createdBy: new Types.ObjectId(targetUserId), // Add user filter
          // publishedStatus: { $in: ['draft', 'proposed', 'published'] },
          isDeleted: { $ne: true },
          ...(isSameUser ? {} : { isPublic: true }),
          ...(isSameUser ? { publishedStatus: { $in: ['draft', 'proposed', 'published'] } } : { publishedStatus: { $in: ['published'] } }),
        },
      },
      {
        $group: {
          _id: '$publishedStatus',
          count: { $sum: 1 },
        },
      },
    ]);

    // Get rules and regulations count by status for specific user
    const rulesCount = await this.RulesRegulationModel.aggregate([
      {
        $match: {
          createdBy: new Types.ObjectId(targetUserId), // Add user filter
          // publishedStatus: { $in: ['draft', 'proposed', 'published'] },
          isDeleted: { $ne: true },
          rootParent: { $exists: false },
          ...(isSameUser ? {} : { isPublic: true }),
          ...(isSameUser ? { publishedStatus: { $in: ['draft', 'proposed', 'published'] } } : { publishedStatus: { $in: ['published'] } }),
        },
      },
      {
        $group: {
          _id: '$publishedStatus',
          count: { $sum: 1 },
        },
      },
    ]);

    // Get issues count by status for specific user
    const issuesCount = await this.IssuesModel.aggregate([
      {
        $match: {
          createdBy: new Types.ObjectId(targetUserId), // Add user filter
          // publishedStatus: { $in: ['draft', 'proposed', 'published'] },
          isDeleted: { $ne: true },
          ...(isSameUser ? {} : { isPublic: true }),
          ...(isSameUser ? { publishedStatus: { $in: ['draft', 'proposed', 'published'] } } : { publishedStatus: { $in: ['published'] } }),
        },
      },
      {
        $group: {
          _id: '$publishedStatus',
          count: { $sum: 1 },
        },
      },
    ]);

    //Get Generic count for specific user
    const genericCount = await this.genericModel.aggregate([
      {
        $match: {
          createdBy: new Types.ObjectId(targetUserId), // Add user filter
        },
      },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
        },
      },
    ]);

    const standardCount = await this.stdPluginAssetModel.aggregate([
      {
        $match: {
          createdBy: new Types.ObjectId(targetUserId), // Add user filter
          publishedStatus: { $in: ['draft', 'proposed', 'published'] },
        },
      },
      {
        $group: {
          _id: '$publishedStatus',
          count: { $sum: 1 },
        },
      },
    ]);

    const standardCountV1 = await this.stdPluginAssetModel.aggregate([
      {
        $match: {
          createdBy: new Types.ObjectId(targetUserId),
          // publishedStatus: { $in: ['draft', 'proposed', 'published'] },
          ...(isSameUser ? {} : { isPublic: true }),
          ...(isSameUser ? { publishedStatus: { $in: ['draft', 'proposed', 'published'] } } : { publishedStatus: { $in: ['published'] } }),
        },
      },
      // Join with StdPlugin collection to get name & logo
      {
        $lookup: {
          from: 'stdplugins', // ⚠️ ensure actual MongoDB collection name (likely "stdplugins")
          localField: 'plugin',
          foreignField: '_id',
          as: 'pluginData',
        },
      },
      { $unwind: '$pluginData' },
      {
        $group: {
          _id: {
            moduleName: '$pluginData.name',
            moduleLogo: '$pluginData.logo',
            _id: '$pluginData._id',
            status: '$publishedStatus',
          },
          count: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: {
            moduleName: '$_id.moduleName',
            moduleLogo: '$_id.moduleLogo',
            _id: '$_id._id',
          },
          counts: {
            $push: {
              k: '$_id.status',
              v: '$count',
            },
          },
        },
      },
      {
        $project: {
          // _id: 0,
          moduleName: '$_id.moduleName',
          logo: '$_id.moduleLogo',
          _id: '$_id._id',
          counts: {
            $mergeObjects: [
              { draft: 0, proposed: 0, published: 0 }, // default values
              { $arrayToObject: '$counts' }, // merge actual values
            ],
          },
        },
      },
    ]);

    // Helper function to format counts
    const formatCounts = (aggregateResult: any[]) => ({
      draft: aggregateResult.find((item) => item._id === 'draft')?.count || 0,
      proposed:
        aggregateResult.find((item) => item._id === 'proposed')?.count || 0,
      published:
        aggregateResult.find((item) => item._id === 'published')?.count || 0,
    });

    // Format the results
    const projects = formatCounts(projectsCount);
    const debates = formatCounts(debatesCount);
    const rulesRegulations = formatCounts(rulesCount);
    const issues = formatCounts(issuesCount);
    const generic = genericCount[0]?.count || 0;
    const standard = formatCounts(standardCount);

    return {
      projects,
      debates,
      rulesRegulations,
      issues,
      generic,
      standard: standardCountV1,
    };
  }
  private async uploadFile(file: Express.Multer.File) {
    try {
      //uploading file
      const response = await this.s3FileUpload.uploadFile(
        file.buffer,
        file.originalname,
        file.mimetype,
        'club',
      );
      return response;
    } catch (error) {
      throw new BadRequestException(
        'Failed to upload file. Please try again later.',
      );
    }
  }

  async getDashboard(userId: string) {
    try {
      const nodeCounts = await this.nodeMembersModel.countDocuments({
        user: new Types.ObjectId(userId),
        status: 'MEMBER',
      });
      const clubCounts = await this.clubMembersModel.countDocuments({
        user: new Types.ObjectId(userId),
        status: 'MEMBER',
      });

      const userNodes = await this.nodeMembersModel
        .find({
          user: new Types.ObjectId(userId),
        })
        .select('node')
        .lean();

      const userClubs = await this.clubMembersModel
        .find({
          user: new Types.ObjectId(userId),
        })
        .select('club')
        .lean();

      const nodeRequests = await this.nodeJoinRequestModel
        .find({
          user: new Types.ObjectId(userId),
          status: 'REQUESTED',
        })
        .select('node')
        .lean();

      const clubRequests = await this.clubJoinRequestsModel
        .find({
          user: new Types.ObjectId(userId),
          status: 'REQUESTED',
        })
        .select('club')
        .lean();

      const excludedNodeIds = [
        ...userNodes.map((n) => n.node.toString()),
        ...nodeRequests.map((r) => r.node.toString()),
      ];

      const excludedClubIds = [
        ...userClubs.map((c) => c.club.toString()),
        ...clubRequests.map((r) => r.club.toString()),
      ];

      const nodesToJoin = await this.nodeModel
        .find({
          _id: { $nin: excludedNodeIds.map((id) => new Types.ObjectId(id)) },
        })
        .select(
          'name profileImage coverImage about domain location slug memberCount',
        )
        .sort({ createdAt: -1 })
        .limit(6)
        .lean();

      const clubsToJoin = await this.clubModel
        .find({
          _id: { $nin: excludedClubIds.map((id) => new Types.ObjectId(id)) },
        })
        .select(
          'name profileImage coverImage about domain location slug memberCount isPublic',
        )
        .sort({ createdAt: -1 })
        .limit(9)
        .lean();

      // Get member counts for each node
      const nodeMemberCounts = await this.nodeMembersModel.aggregate([
        {
          $match: {
            node: { $in: nodesToJoin.map((n) => n._id) },
            status: 'MEMBER',
          },
        },
        {
          $group: {
            _id: '$node',
            count: { $sum: 1 },
          },
        },
      ]);

      // Get member counts for each club
      const clubMemberCounts = await this.clubMembersModel.aggregate([
        {
          $match: {
            club: { $in: clubsToJoin.map((c) => c._id) },
            status: 'MEMBER',
          },
        },
        {
          $group: {
            _id: '$club',
            count: { $sum: 1 },
          },
        },
      ]);

      // Map member counts to nodes
      const nodesWithMembers = nodesToJoin.map((node) => {
        const memberCount = nodeMemberCounts.find((mc) =>
          mc._id.equals(node._id),
        );
        return {
          ...node,
          memberCount: memberCount ? memberCount.count : 0,
        };
      });

      // Map member counts to clubs
      const clubsWithMembers = clubsToJoin.map((club) => {
        const memberCount = clubMemberCounts.find((mc) =>
          mc._id.equals(club._id),
        );
        return {
          ...club,
          memberCount: memberCount ? memberCount.count : 0,
        };
      });

      return {
        nodeCounts,
        clubCounts,
        nodes: nodesWithMembers,
        clubs: clubsWithMembers,
      };
    } catch (error) {
      throw error;
    }
  }

  async getTreasureModules(searchTerm: string) {
    try {

      const staticModules = [
        {
          _id: 'rules', name: 'Rules', type: 'rule', description:
            "All members are required to follow rules that foster respect, inclusivity, and safety. Harassment, offensive behavior, and spam are not tolerated, ensuring a positive and welcoming community for everyone.",
        },
        {
          _id: 'issues', name: 'Issues', type: 'issue', description:
            "Issues serve as a space for discussion, collaboration, and problem-solving. Use them to share concerns, propose ideas, and work together on solutions that improve and address community needs.",
        },
        {
          _id: 'debates', name: 'Debates', type: 'debate', description:
            "Join discussions and engage in debates with the community. Explore ongoing, all, and global debates to share your views, learn from others, and contribute to meaningful conversations.",
        },
        {
          _id: 'projects', name: 'Projects', type: 'project', description:
            "Projects are a forum to create, manage, and share work. Collaborate with others, track progress, set goals, and showcase ideas to build meaningful outcomes and inspire the community.",
        },
      ]
        // .filter((m) => new RegExp(searchTerm, 'i').test(m.name));
        .filter(
          (m) =>
            new RegExp(searchTerm, 'i').test(m.name) ||
            new RegExp(searchTerm, 'i').test(m.description)
        );

      const [rulesCount, issuesCount, debatesCount, projectsCount] = await Promise.all([
        this.RulesRegulationModel.countDocuments({ isPublic: true, publishedStatus: 'published' }),
        this.IssuesModel.countDocuments({ isPublic: true, publishedStatus: 'published' }),
        this.DebateModel.countDocuments({ isPublic: true, publishedStatus: 'published' }),
        this.ProjectModel.countDocuments({ isPublic: true, publishedStatus: 'published' }),
      ])

      const counts: Record<string, number> = {
        rule: rulesCount,
        issue: issuesCount,
        debate: debatesCount,
        project: projectsCount,
      };

      const updatedStaticModules = staticModules.map((m) => {
        return {
          ...m,
          assetCount: counts[m?.type] || 0
        }
      })

      const stdPlugins = await this.stdPluginModel
        .find({
          $or: [
            { name: { $regex: searchTerm, $options: 'i' } },
            { description: { $regex: searchTerm, $options: 'i' } }
          ]
        })
        .lean();

      const stdPluginSlugs = stdPlugins.map((p) => p.slug);

      const stdPluginCount = await this.stdPluginAssetModel.aggregate([
        {
          $match: {
            "data.plugin": { $in: stdPluginSlugs },
            isPublic: true,
            publishedStatus: 'published'
          },
        },
        {
          $group: {
            _id: "$data.plugin",
            count: { $sum: 1 },
          },
        },
        {
          $project: {
            _id: 0,
            slug: "$_id",
            count: 1,
          },
        },
      ]);

      const updatedStdPlugins = stdPlugins.map((p) => {
        const count = stdPluginCount.find((c) => c.slug === p.slug);
        return {
          ...p,
          assetCount: count ? count.count : 0
        }
      })

      const allModules = [...updatedStaticModules, ...updatedStdPlugins];

      const totalCount = allModules.length;

      return {
        data: allModules,
        pagination: {
          totalItems: totalCount,
        },
      };
    } catch (error) {
      throw error;
    }
  }

  async fetchTreasureAssets(
    searchTerm: string,
    limitValue: number,
    pageValue: number,
    moduleType: 'rule' | 'debate' | 'issue' | 'project' | 'stdPlugin',
    moduleId?: string,
    forumId?: string,
    forumType?: 'node' | 'club',
  ) {
    try {
      console.log({ moduleType });
      const skip = (pageValue - 1) * limitValue;
      const model = await this.getModuleModel(moduleType);

      const requiredQuery = <Record<string, any>>{}
      if (forumId && forumType) {
        if (forumType === 'node') {
          requiredQuery.node = new Types.ObjectId(forumId)
        }
        if (forumType === 'club') {
          requiredQuery.club = new Types.ObjectId(forumId)
        }
      }

      const searchFilter = {
        $or: [
          { title: { $regex: searchTerm, $options: 'i' } },
          { topic: { $regex: searchTerm, $options: 'i' } },
          { 'data.title': { $regex: searchTerm, $options: 'i' } },
        ],
      };

      if (moduleType === 'stdPlugin') {
        if (!moduleId) {
          throw new BadRequestException('Module id is required');
        }

        const assets = await model
          .find({ plugin: moduleId, isPublic: true, publishedStatus: 'published', ...searchFilter, ...requiredQuery })
          .sort({ createdAt: -1 })
          .limit(limitValue)
          .skip(skip)
          .populate({
            path: 'createdBy',
            select: 'userName profileImage firstName lastName',
            options: { lean: true },
          })
          .lean();

        const totalCount = await model.countDocuments({
          plugin: moduleId,
          isPublic: true,
          publishedStatus: 'published',
          ...searchFilter,
          ...requiredQuery
        });

        const totalPages = Math.ceil(totalCount / limitValue);

        return {
          data: assets,
          pagination: {
            currentPage: pageValue,
            totalPages: totalPages,
            totalItems: totalCount,
            itemsPerPage: limitValue,
            hasNextPage: pageValue < totalPages,
            hasPrevPage: pageValue > 1,
          },
        };
      }
      console.log({ ...requiredQuery })

      const assets = await model
        .find({ isPublic: true, publishedStatus: 'published', ...searchFilter, ...requiredQuery })
        .sort({ createdAt: -1 })
        .limit(limitValue)
        .skip(skip)
        .populate({
          path: 'createdBy',
          select: 'userName profileImage firstName lastName',
          options: { lean: true },
        })
        .lean();

      const totalCount = await model.countDocuments({
        isPublic: true,
        publishedStatus: 'published',
        ...searchFilter,
        ...requiredQuery
      });

      const totalPages = Math.ceil(totalCount / limitValue);

      return {
        data: assets,
        pagination: {
          currentPage: pageValue,
          totalPages: totalPages,
          totalItems: totalCount,
          itemsPerPage: limitValue,
          hasNextPage: pageValue < totalPages,
          hasPrevPage: pageValue > 1,
        },
      };
    } catch (error) {
      throw error;
    }
  }

  async postTimeSpent(
    postId: string,
    postType: 'rule' | 'debate' | 'issue' | 'project' | 'stdPlugin',
    seconds: number,
    userId: string,
  ) {
    try {
      const model = await this.getModuleModel(postType);
      const inputDate = new Date();

      const targetUserObjectId = new Types.ObjectId(userId);
      const startOfDay = this.getStartOfDay(inputDate);
      const endOfDay = this.getEndOfDay(inputDate);

      if (postType === 'stdPlugin') {
        // Try to update existing entry for the same date
        const updateResult = await model.updateOne(
          {
            slug: postId,
            'timeSpent.user': targetUserObjectId,
            'timeSpent.date': { $gte: startOfDay, $lte: endOfDay },
          },
          {
            $inc: { 'timeSpent.$.seconds': seconds },
          },
        );

        // If no existing entry was found, add a new one
        if (updateResult.modifiedCount === 0) {
          await model.findOneAndUpdate(
            { slug: postId },
            {
              $push: {
                timeSpent: {
                  user: targetUserObjectId,
                  seconds,
                  date: inputDate, // Store the actual datetime
                },
              },
            },
          );
        }

        return model.findOne({ slug: postId });
      } else {
        // Try to update existing entry for the same date
        const updateResult = await model.updateOne(
          {
            _id: postId,
            'timeSpent.user': targetUserObjectId,
            'timeSpent.date': { $gte: startOfDay, $lte: endOfDay },
          },
          {
            $inc: { 'timeSpent.$.seconds': seconds },
          },
        );

        // If no existing entry was found, add a new one
        if (updateResult.modifiedCount === 0) {
          await model.findByIdAndUpdate(postId, {
            $push: {
              timeSpent: {
                user: targetUserObjectId,
                seconds,
                date: inputDate, // Store the actual datetime
              },
            },
          });
        }

        return model.findById(postId);
      }
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  async getStandardModules() {
    try {
      const stdPlugins = await this.stdPluginModel
        .find({ isActive: true })
        .lean();

      return {
        success: true,
        data: stdPlugins,
        message: "Standard modules fetched successfully"
      };
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  async getTreasureForums(searchTerm?: string) {
    try {

      if (!searchTerm.trim()) {
        return {
          success: true,
          data: [],
          message: "Treasure forums fetched successfully"
        };
      }

      const nodes = await this.nodeModel.find({ name: { $regex: searchTerm, $options: 'i' } }).select('name _id profileImage').lean();
      const clubs = await this.clubModel.find({ name: { $regex: searchTerm, $options: 'i' } }).select('name _id profileImage').lean();

      const formattedNodes = nodes.map((node) => ({
        name: node.name,
        _id: node._id,
        profileImage: node?.profileImage,
        forumType: 'node'
      }));

      const formattedClubs = clubs.map((club) => ({
        name: club.name,
        _id: club._id,
        profileImage: club?.profileImage,
        forumType: 'club'
      }));


      const treasureForums = [...formattedNodes, ...formattedClubs];

      return {
        success: true,
        data: treasureForums,
        message: "Treasure forums fetched successfully"
      };
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  async getModuleModel(
    moduleType: 'rule' | 'debate' | 'issue' | 'project' | 'stdPlugin',
  ): Promise<Model<any>> {
    try {
      switch (moduleType) {
        case 'stdPlugin':
          return this.stdPluginAssetModel;
        case 'rule':
          return this.RulesRegulationModel;
        case 'debate':
          return this.DebateModel;
        case 'issue':
          return this.IssuesModel;
        case 'project':
          return this.ProjectModel;
        default:
          throw new Error('Invalid module type');
      }
    } catch (error) {
      throw error;
    }
  }

  // Helper function to get start of day for querying
  private getStartOfDay(date: Date): Date {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  // Helper function to get end of day for querying
  private getEndOfDay(date: Date): Date {
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    return end;
  }
}
