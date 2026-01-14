import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateNodeDto } from './dto/create-node.dto';
import { UpdateNodeDto } from './dto/update-node.dto';
import { Node_, NodeSchema } from '../../shared/entities/node.entity';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import mongoose, { Connection, Model, MongooseError, Types } from 'mongoose';
import { UploadService } from '../../shared/upload/upload.service';
import { SkipAuth } from '../../decorators/skip-auth.decorator';
import { NodeJoinRequest } from '../../shared/entities/node-join-requests.entity';
import { NodeMembers } from '../../shared/entities/node-members.entity';
import { Issues } from '../../shared/entities/issues/issues.entity';
import { Debate } from '../../shared/entities/debate/debate.entity';
import { Projects } from '../../shared/entities/projects/project.entity';
import { RulesRegulations } from '../../shared/entities/rules/rules-regulations.entity';
import {
  CreateGuidingPrinciples,
  UpdateGuidingPrinciples,
} from './dto/guiding-principle.dto';
import { GuidingPrinciples } from '../../shared/entities/guiding-principles.entity';
import { generateSlug } from '../../utils/slug.util';
import { TPlugins } from 'typings';
import {
  EmitUserJoinApprovedProps,
  EmitUserJoinRejectedProps,
  EmitUserJoinRequestProps,
  NotificationEventsService,
} from '../../notification/notification-events.service';
import { from } from 'rxjs';
import { User } from '../../shared/entities/user.entity';
import { StdPlugin } from '../../shared/entities/standard-plugin/std-plugin.entity';
import { StdPluginAsset } from '../../shared/entities/standard-plugin/std-plugin-asset.entity';
import { GenericPost } from '../../shared/entities/generic-post.entity';
import { AssetsService } from '../../assets/assets.service';
import { ForumFaqs } from '../../shared/entities/forum-faqs.entity';
import { ForumAchievements } from '../../shared/entities/forum-achievements.entity';
import { ForumProfile } from '../../shared/entities/forum-profile.entity';

@Injectable()
export class NodeService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(Node_.name) private readonly nodeModel: Model<Node_>,
    @InjectModel(Issues.name) private readonly issuesModel: Model<Issues>,
    @InjectModel(Debate.name) private readonly debatesModel: Model<Debate>,
    @InjectModel(Projects.name) private readonly projectModel: Model<Projects>,
    @InjectModel(RulesRegulations.name)
    private readonly rulesModel: Model<RulesRegulations>,
    @InjectModel(NodeJoinRequest.name)
    private readonly nodeJoinRequestModel: Model<NodeJoinRequest>,
    @InjectModel(NodeMembers.name) private nodeMembersModel: Model<NodeMembers>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(GuidingPrinciples.name)
    private readonly guidingPrinciplesModel: Model<GuidingPrinciples>,
    @InjectModel(StdPlugin.name)
    private readonly stdPluginModel: Model<StdPlugin>,
    @InjectModel(StdPluginAsset.name)
    private readonly stdPluginAssetModel: Model<StdPluginAsset>,
    @InjectModel(GenericPost.name)
    private readonly genericPostModel: Model<GenericPost>,
    @InjectModel(ForumFaqs.name)
    private readonly forumFaqsModel: Model<ForumFaqs>,
    @InjectModel(ForumAchievements.name)
    private readonly forumAchievementsModel: Model<ForumAchievements>,
    @InjectModel(ForumProfile.name)
    private readonly forumProfileModel: Model<ForumProfile>,
    private readonly uploadService: UploadService,
    private notificationEventsService: NotificationEventsService,
    private assetService: AssetsService,
  ) { }

  /**
   * Creates a new node in the database.
   * @param createNodeDto Node data to be created.
   * @param userId The id of the user who is creating the node.
   * @returns The created node object.
   * @throws BadRequestException if there is an error while creating the node.
   * @throws ConflictException if there is an error with the database.
   */
  async createNode(createNodeDto: CreateNodeDto, userId: Types.ObjectId) {
    const session = await this.nodeModel.db.startSession();
    try {
      session.startTransaction();
      const {
        name,
        about,
        description,
        location,
        profileImage,
        plugins,
        domain,
      } = createNodeDto;

      if (plugins.length < 1) {
        throw new BadRequestException('At least one plugin is required');
      }

      const sanitizedPlugins = plugins.map((plugin) => ({
        ...plugin,
        addedDate: new Date(),
      }));

      const slug = generateSlug(name);
      const existingNode = await this.nodeModel.findOne({ slug });
      if (existingNode) {
        throw new ConflictException('A node with the same name already exists');
      }

      const uniqueUsername = await this.generateUniqueUsername(name);

      const profileImageUpload = this.uploadService.uploadFile(
        profileImage.buffer,
        profileImage.originalname,
        profileImage.mimetype,
        'node',
      );

      let coverImageUpload;

      if (createNodeDto.coverImage) {
        coverImageUpload = this.uploadService.uploadFile(
          createNodeDto.coverImage.buffer,
          createNodeDto.coverImage.originalname,
          createNodeDto.coverImage.mimetype,
          'node',
        );
      }

      const uploadPromises = [profileImageUpload];

      if (coverImageUpload) {
        uploadPromises.push(coverImageUpload);
      }

      const [profileImageResult, coverImageResult] =
        await Promise.all(uploadPromises);

      const nodeData: any = {
        name,
        about,
        description,
        domain,
        location,
        profileImage: profileImageResult,
        createdBy: userId,
        plugins: sanitizedPlugins,
        username: uniqueUsername,
      };

      if (coverImageResult) {
        nodeData.coverImage = coverImageResult;
      }

      const createdNode = new this.nodeModel(nodeData);

      const nodeResponse = await createdNode.save({ session });

      const createNodeMember = new this.nodeMembersModel({
        node: nodeResponse._id,
        user: nodeResponse.createdBy,
        role: 'owner',
        status: 'MEMBER',
      });

      await createNodeMember.save({ session });

      await session.commitTransaction();
      return nodeResponse;
    } catch (error) {
      console.error(error);
      await session.abortTransaction();

      if (error instanceof ConflictException) {
        throw error;
      }

      throw new BadRequestException(
        'Error while trying to add node. Please try again later.',
      );
    } finally {
      await session.endSession();
    }
  }

  async findAllNode() {
    try {
      return await this.nodeModel.find().exec();
    } catch (error) {
      throw new BadRequestException(
        'Error while trying to get nodes. Please try again later.',
      );
    }
  }

  /**
   * Retrieves a single node by its id
   * @param nodeId The id of the node to retrieve
   * @returns The retrieved node
   * @throws `BadRequestException` if the node is not found
   */
  async findOne(nodeId: string, isOnBoarded: boolean) {
    try {
      if (!isOnBoarded) {
        throw new HttpException(
          {
            statusCode: HttpStatus.FORBIDDEN,
            onboarded: false, // Boolean flag
          },
          HttpStatus.FORBIDDEN,
        );
      }

      // const node = await this.nodeModel.findById(nodeId);
      let node = await this.nodeModel
        .aggregate([
          {
            $match: { _id: new mongoose.Types.ObjectId(nodeId) },
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

      node = node[0];

      if (!node) {
        throw new BadRequestException(
          'Failed to get node. Please try again later.',
        );
      }
      let members = await this.getMembers(nodeId);

      return {
        success: true,
        message: 'Successfully fetched node',
        data: { node, members },
      };
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      throw new BadRequestException(
        'Error while trying to get node. Please try again later.',
      );
    }
  }

  async getMembers(nodeId: string) {
    const members = await this.nodeMembersModel
      .find({ node: new Types.ObjectId(nodeId) })
      .populate({
        path: 'user',
        select: 'userName firstName middleName lastName profileImage interests',
      })
      .lean()
      .exec();

    const memberIds = members.map((member) => member.user._id);

    const [ruleCounts, issueCounts, debateCounts, projectCounts] =
      await Promise.all([
        this.rulesModel.aggregate([
          {
            $match: {
              node: new Types.ObjectId(nodeId),
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
              node: new Types.ObjectId(nodeId),
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
              node: new Types.ObjectId(nodeId),
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
              node: new Types.ObjectId(nodeId),
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
      ]);

    // Create a map of counts for easy lookup
    const countsMap = {
      rules: Object.fromEntries(
        ruleCounts.map((r) => [r._id.toString(), r.count]),
      ),
      issues: Object.fromEntries(
        issueCounts.map((i) => [i._id.toString(), i.count]),
      ),
      debates: Object.fromEntries(
        debateCounts.map((d) => [d._id.toString(), d.count]),
      ),
      projects: Object.fromEntries(
        projectCounts.map((p) => [p._id.toString(), p.count]),
      ),
    };

    // Combine the data
    return members.map((member) => {
      const userId = member.user._id.toString();
      const contributions = {
        rules: countsMap.rules[userId] || 0,
        issues: countsMap.issues[userId] || 0,
        debates: countsMap.debates[userId] || 0,
        projects: countsMap.projects[userId] || 0,
      };

      return {
        ...member,
        contributions,
        totalContributions: Object.values(contributions).reduce(
          (a, b) => a + b,
          0,
        ),
      };
    });
  }

  /**
   * Retrieves all nodes that a user is a member of.
   * @param userId The id of the user to retrieve nodes for
   * @returns An array of nodes that the user is a member of, with the node and user populated
   * @throws `BadRequestException` if there is an error while trying to get nodes
   */
  async getAllNodesOfUser(userId: Types.ObjectId) {
    try {
      const user = await this.userModel.findById(userId).lean();
      if (!user) throw new BadRequestException('User not found.');

      // Fetch all node members for the user
      const nodeMembers = await this.nodeMembersModel
        .find({ user: userId })
        .populate({
          path: 'node',
          select: 'name about domain profileImage coverImage  ',
        })
        .populate({
          path: 'user',
          select:
            'userName firstName middleName lastName profileImage interests',
        })
        .lean();

      const sortedNodes = nodeMembers.sort((a, b) => {
        if (a.pinned == null && b.pinned == null) return 0;
        if (a.pinned == null) return 1;  // a is null → push to end
        if (b.pinned == null) return -1; // b is null → a comes first
        return a.pinned - b.pinned;      // both non-null → numeric sort
      });

      return sortedNodes;
    } catch (error) {
      console.error('Error fetching nodes:', error);
      throw new BadRequestException(
        'Error while trying to get nodes. Please try again later.',
      );
    }
  }

  /**
   * Requests to join a node.
   * @param nodeId The id of the node to request to join
   * @param userId The id of the user making the request
   * @returns The newly created node join request
   * @throws `BadRequestException` if the node is not found,
   * or if the user is already a member of the node,
   * or if the user has been blocked from the node,
   * or if the user has already requested to join the node.
   * @throws `NotFoundException` if the node is not found.
   */
  async requestToJoin(
    nodeId: Types.ObjectId,
    userId: Types.ObjectId,
    user: any,
    requestNote?: string,
  ) {
    try {
      const existingNode = await this.nodeModel.findById(nodeId);

      if (!existingNode) {
        throw new NotFoundException('Node not found');
      }

      const existingMember = await this.nodeMembersModel.findOne({
        node: nodeId,
        user: userId,
      });

      if (existingMember) {
        switch (existingMember.status) {
          case 'MEMBER':
            throw new BadRequestException(
              'You are already a member of this node',
            );
          case 'BLOCKED':
            throw new BadRequestException(
              'You have been blocked from this node',
            );
        }
      }

      const existingRequest = await this.nodeJoinRequestModel.findOne({
        node: nodeId,
        user: userId,
        status: 'REQUESTED',
      });

      if (existingRequest) {
        throw new ConflictException(
          'You have already requested to join this node',
        );
      }

      const sanitizedRequestNote =
        requestNote?.trim() !== '' ? requestNote?.trim() : undefined;

      const response = await this.nodeJoinRequestModel.create({
        node: existingNode._id,
        user: userId,
        status: 'REQUESTED',
        ...(sanitizedRequestNote && { requestNote: sanitizedRequestNote }),
      });

      const ownerAndAdmins = await this.nodeMembersModel.find({
        role: { $in: ['owner', 'admin'] },
        node: existingNode._id,
      });

      const notificationMessage = `${user.firstName} ${user.lastName} sent request to join ${existingNode.name} `;
      const emitUserJoinRequest: EmitUserJoinRequestProps = {
        forum: {
          type: 'node',
          id: nodeId.toString(),
        },
        from: userId.toString(),
        message: notificationMessage,
        memberIds: ownerAndAdmins.map((member) => member.user.toString()),
      };

      await this.notificationEventsService.emitUserJoinRequest(
        emitUserJoinRequest,
      );

      return response;
    } catch (error) {
      if (error instanceof ConflictException) {
        throw new ConflictException(
          'You have already requested to join this node',
        );
      }
      throw new BadRequestException(
        'Error while trying to request to join. Please try again later.',
      );
    }
  }

  /**
   * Cancel a join request made by a user to a node.
   * @param nodeId The ID of the node the user is canceling the request for.
   * @param userId The ID of the user canceling the request.
   * @returns The deleted join request.
   * @throws NotFoundException if the user has not requested to join the node.
   * @throws BadRequestException if there is an error while canceling the request.
   */
  async cancelJoinRequest(nodeId: Types.ObjectId, userId: Types.ObjectId) {
    try {
      if (!nodeId) {
        throw new BadRequestException('Please provide node id');
      }
      if (!userId) {
        throw new BadRequestException('Please provide user id');
      }

      const response = await this.nodeJoinRequestModel.findOneAndDelete({
        node: nodeId,
        user: userId,
        status: 'REQUESTED',
      });

      if (!response) {
        throw new NotFoundException('You have not requested to join this node');
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

  /**
   * Retrieves all join requests for a specific node.
   * @param nodeId - The ID of the node for which to retrieve join requests.
   * @returns A promise that resolves to an array of join requests, populated with node and user details.
   * @throws BadRequestException if there is an error while trying to get join requests.
   */
  async getAllJoinRequestsOfNode(nodeId: Types.ObjectId) {
    try {
      const requests = await this.nodeJoinRequestModel
        .find({ node: nodeId })
        .populate({
          path: 'node',
          select: 'name about domain profileImage coverImage  ',
        })
        .populate({
          path: 'user',
          select:
            'userName firstName middleName lastName profileImage interests',
        })
        .exec();
      return requests;
    } catch (error) {
      throw new BadRequestException(
        'Error while trying to get node join requests. Please try again later.',
      );
    }
  }

  /**
   * Retrieves all join requests made by a specific user.
   * @param userId - The ID of the user for which to retrieve join requests.
   * @returns A promise that resolves to an array of join requests, populated with node and user details.
   * @throws BadRequestException if there is an error while trying to get user join requests.
   */
  async getAllJoinRequestsOfUser(userId: Types.ObjectId) {
    try {
      const request = await this.nodeJoinRequestModel
        .find({ user: userId, status: 'REQUESTED' })
        .populate({
          path: 'node',
          select: 'name about domain profileImage coverImage  ',
        })
        .populate({
          path: 'user',
          select:
            'userName firstName middleName lastName profileImage interests',
        })
        .exec();
      return request;
    } catch (error) {
      error;
      throw new BadRequestException(
        'Error while trying to get user join requests. Please try again later.',
      );
    }
  }

  /**
   * Accepts or rejects a node join request.
   * @param nodeId - The ID of the node for which the request was made.
   * @param userId - The ID of the user who is accepting or rejecting the request.
   * @param requestId - The ID of the request to accept or reject.
   * @param status - The status to set the request to - either 'ACCEPTED' or 'REJECTED'.
   * @returns A promise that resolves to the updated join request.
   * @throws BadRequestException if there is an error while trying to accept or reject the request.
   */
  async acceptOrRejectRequest(
    nodeId: Types.ObjectId,
    userId: Types.ObjectId,
    requestId: Types.ObjectId,
    status: 'ACCEPTED' | 'REJECTED',
    user: any,
  ) {
    try {
      const updateData: any = { status };
      if (status === 'REJECTED') {
        // const response = await this.nodeJoinRequestModel
        //   .findOne({ _id: requestId })
        //   .populate("user") // Populate the 'user' field
        //   .populate("node"); // Populate the 'node' field

        // if (response) {
        //   await this.nodeJoinRequestModel.deleteOne({ _id: requestId });
        // }

        // const notificationMessage = `${user.firstName} ${user.lastName} sent request to join ${response.node.name} `
        // const emitUserJoinRejected: EmitUserJoinRejectedProps = {
        //   forum: {
        //     type: "node",
        //     id: nodeId.toString(),
        //   },
        //   approver: userId.toString(),
        //   message: notificationMessage,
        //   memberIds: [response.user.toString()]
        // }

        // return response;

        const response = await this.nodeJoinRequestModel
          .findOne({ _id: requestId })
          .populate('user') // Populate the 'user' field
          .populate('node'); // Populate the 'node' field

        if (!response) return null; // Handle case where request is not found

        await this.nodeJoinRequestModel.deleteOne({ _id: requestId });

        // Extract node details safely
        const node = response.node as any;
        const rejectedUser = response.user as any;

        const notificationMessage = `Admin has rejected your request to join ${node.name}`;

        const emitUserJoinRejected: EmitUserJoinRejectedProps = {
          forum: {
            type: 'node',
            id: node._id.toString(),
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

      const response = await this.nodeJoinRequestModel
        .findOneAndUpdate({ _id: requestId }, updateData, { new: true })
        .populate('node', 'name profileImage');

      const node = response.node as any;

      if (response.status === 'ACCEPTED') {
        const createNodeMember = new this.nodeMembersModel({
          node: response.node,
          user: response.user,
          role: 'member',
          status: 'MEMBER',
        });

        await createNodeMember.save();
      }

      const notificationMessage = `Admin has accepted your request to join ${node.name}`;

      const emitUserJoinApproved: EmitUserJoinApprovedProps = {
        forum: {
          type: 'node',
          id: node._id.toString(),
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
      throw new BadRequestException(
        'Error while trying to accept or reject request. Please try again later.',
      );
    }
  }

  /**
   * Updates a node with the given data.
   * @param id - The ID of the node to update.
   * @param updateNodeDto - The data to update the node with.
   * @returns A promise that resolves to the updated node.
   * @throws BadRequestException if there is an error while trying to update the node.
   * @throws NotFoundException if the node is not found.
   */
  async updateNode(id: Types.ObjectId, updateNodeDto: UpdateNodeDto) {
    try {
      const node = await this.nodeModel.findById(id);
      if (!node) {
        throw new NotFoundException('Node not found');
      }

      const updateData: any = {};
      const {
        name,
        about,
        description,
        location,
        profileImage,
        coverImage,
        removeCoverImage,
        domain,
        customColor,
      } = updateNodeDto;

      if (profileImage) {
        const profileImageResult = await this.uploadService.uploadFile(
          profileImage.buffer,
          profileImage.originalname,
          profileImage.mimetype,
          'node',
        );
        updateData.profileImage = profileImageResult;
      }

      if (coverImage) {
        const coverImageResult = await this.uploadService.uploadFile(
          coverImage.buffer,
          coverImage.originalname,
          coverImage.mimetype,
          'node',
        );
        updateData.coverImage = coverImageResult;
      } else if (removeCoverImage) {
        updateData.coverImage = { filename: '', url: '' };
      }
      if (name !== undefined) updateData.name = name;
      if (about !== undefined) updateData.about = about;
      if (description !== undefined) updateData.description = description;
      if (location !== undefined) updateData.location = location;
      if (domain !== undefined) updateData.domain = JSON.parse(domain);
      if (customColor !== undefined) updateData.customColor = customColor;

      const updatedNode = await this.nodeModel.findByIdAndUpdate(
        id,
        updateData,
        {
          new: true, // Return the updated document
          runValidators: true, // Ensure validation is applied
        },
      );

      return updatedNode;
    } catch (error) {
      console.log({ error });
      throw new BadRequestException(
        'Error while trying to update node. Please try again later.',
      );
    }
  }

  /**
   * Allows a user to leave a node by deleting their membership and any join requests.
   * Initiates a database transaction to ensure both operations are atomic.
   * @param nodeId - The ID of the node to leave.
   * @param userId - The ID of the user leaving the node.
   * @returns An object containing the responses of the membership and join request deletions, along with a success message.
   * @throws `BadRequestException` if the user is not a member of the node or if an error occurs during the transaction.
   */
  async leaveNode(nodeId: Types.ObjectId, userId: Types.ObjectId) {
    const session = await this.connection.startSession();
    try {
      session.startTransaction();

      const membershipResponse = await this.nodeMembersModel.findOneAndDelete(
        {
          node: nodeId,
          user: userId,
        },
        { session },
      );

      const joinRequestResponse =
        await this.nodeJoinRequestModel.findOneAndDelete(
          {
            node: nodeId,
            user: userId,
          },
          { session },
        );

      if (!membershipResponse && !joinRequestResponse) {
        throw new BadRequestException('You are not a member of this node');
      }

      await session.commitTransaction();

      return {
        membershipResponse,
        joinRequestResponse,
        message: 'You have left the node',
      };
    } catch (error) {
      await session.abortTransaction();
      throw new BadRequestException(
        'Error while trying to leave node. Please try again later.',
      );
    } finally {
      await session.endSession();
    }
  }

  /**
   * Checks the status of the given user in the given node.
   * The status can be one of the following:
   * - 'VISITOR': The user is not a member of the node.
   * - 'MEMBER': The user is a member of the node.
   * - 'REQUESTED': The user has requested to join the node, but has not yet been accepted.
   * @param userId The ID of the user to check the status of.
   * @param nodeId The ID of the node to check the status of.
   * @returns A promise that resolves to an object with a single property, `status`, which is a string indicating the status of the user in the node.
   */
  async checkStatus(userId: Types.ObjectId, nodeId: Types.ObjectId) {
    try {
      let status = 'VISITOR';

      const isMember = await this.nodeMembersModel
        .findOne({ node: nodeId, user: userId })
        .populate({
          path: 'node',
          select: 'name about domain profileImage coverImage  ',
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
      const isRequested = await this.nodeJoinRequestModel.findOne({
        node: nodeId,
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
        'Failed to fetch node join requests. Please try again later.',
      );
    }
  }
  /**
   * Pins a node, and shifts all nodes that were pinned after it one position up.
   * If the user already has 3 pinned nodes, the oldest pinned node will be unpinned.
   * @param nodeId The id of the node to pin
   * @param userId The id of the user to pin the node for
   * @returns The node that was pinned
   * @throws `BadRequestException` if the node memeber is not found, or the node is already pinned
   */
  async pinNode(nodeId: string, userId: string) {
    try {
      // Step 1: Find all pinned nodes sorted by priority (1 → 3)
      const pinnedNodes = await this.nodeMembersModel
        .find({ user: new Types.ObjectId(userId), pinned: { $ne: null } })
        .sort({ pinned: 1 });

      // Step 2: Check if this node is already pinned
      const existing = pinnedNodes.find(
        (c) => c.node.toString() === nodeId.toString(),
      );

      // ✅ If already pinned, do nothing
      if (existing) {
        return existing;
      }

      // Step 3: If there are already 3 pinned, unpin the oldest (pinned = 3)
      if (pinnedNodes.length >= 3) {
        const oldestPinned = pinnedNodes.pop();
        if (oldestPinned) {
          oldestPinned.pinned = null;
          await oldestPinned.save();
        }
      }

      // Step 4: Shift remaining pins down by 1 (1→2, 2→3)
      for (const node of pinnedNodes) {
        node.pinned = (node.pinned! + 1) as 1 | 2 | 3;
        await node.save();
      }

      // Step 5: Pin the selected node as #1 (most recent)
      const nodeTopin = await this.nodeMembersModel.findOneAndUpdate(
        { node: new Types.ObjectId(nodeId), user: new Types.ObjectId(userId) },
        { pinned: 1 },
        { new: true },
      );

      if (!nodeTopin) {
        throw new Error('Node member not found.');
      }

      return nodeTopin;
    } catch (error) {
      console.error(error);
      throw new BadRequestException('Failed to pin node. Please try again later.');
    }
  }

  /**
   * Unpin a node, and shift all nodes that were pinned after it one position up.
   * @param nodeId The id of the node to unpin
   * @param userId The id of the user to unpin the node for
   * @returns The node that was unpinned
   * @throws `BadRequestException` if the node memeber is not found, or the node is already unpinned
   */
  async unpinNode(nodeId: string, userId: string) {
    try {
      // Step 1: Find the node to unpin
      const nodeToUnpin = await this.nodeMembersModel.findOne({
        node: new Types.ObjectId(nodeId),
        user: new Types.ObjectId(userId),
      });

      if (!nodeToUnpin) {
        throw new Error('Node member not found');
      }

      // If it's not pinned, nothing to do
      if (nodeToUnpin.pinned === null) {
        return nodeToUnpin;
      }

      const unpinnedPosition = nodeToUnpin.pinned; // 1, 2, or 3

      // Step 2: Unpin it
      nodeToUnpin.pinned = null;
      await nodeToUnpin.save();

      // Step 3: Get all remaining pinned nodes sorted by current position
      const pinnedNodes = await this.nodeMembersModel
        .find({ user: new Types.ObjectId(userId), pinned: { $ne: null } })
        .sort({ pinned: 1 });

      // Step 4: Shift positions only for nodes after the one we removed
      for (const node of pinnedNodes) {
        if (node.pinned > unpinnedPosition) {
          node.pinned = (node.pinned - 1) as 1 | 2 | 3;
          await node.save();
        }
      }

      return nodeToUnpin;
    } catch (error) {
      console.error(error);
      throw new BadRequestException(
        'Failed to unpin node. Please try again later.',
      );
    }
  }

  async getNodeMembers(nodeId: Types.ObjectId) {
    try {
      return await this.nodeMembersModel
        .find({ node: nodeId })
        .populate({
          path: 'user',
          select:
            'userName firstName middleName lastName profileImage interests',
        })
        .exec();
    } catch (error) {
      throw new BadRequestException(
        'Failed to get node members. Please try again later.',
      );
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
        node: new Types.ObjectId(createGuidingPrinciples.node),
        createdBy: new Types.ObjectId(userId),
      });

      await newGuidingPrinciple.save();

      return {
        success: true,
        message: 'Guiding principles added successfully',
      };
    } catch (error: unknown) {
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

  async getGuidingPrinciples(nodeId: string) {
    try {
      if (!nodeId) {
        throw new BadRequestException('Please provide node id');
      }

      return await this.guidingPrinciplesModel
        .find({ node: new Types.ObjectId(nodeId) })
        .sort({ createdAt: 1 });
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw error;
    }
  }

  async getNodeStatistics(nodeId: string) {
    try {
      const membersCount = await this.nodeMembersModel
        .find({ node: new Types.ObjectId(nodeId) })
        .countDocuments();
      const approvalCount = await this.nodeJoinRequestModel
        .find({ node: new Types.ObjectId(nodeId), status: 'REQUESTED' })
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
    nodeId: string,
    plugin: { plugin: TPlugins; createdAt: Date; type: 'standard' | 'custom' },
  ) {
    try {
      const nodeExists = await this.nodeModel.exists({ _id: nodeId });
      if (!nodeExists)
        throw new NotFoundException(`Node with ID ${nodeId} not found`);

      let stdPlugin;
      if (plugin.type === 'standard') {
        console.log({ plugin });
        stdPlugin = await this.stdPluginModel.findOne({ slug: plugin.plugin });
        console.log({ stdPlugin });
        if (!stdPlugin)
          throw new NotFoundException(`Module  ${plugin.plugin} not found`);
      }

      const existingPlugin = await this.nodeModel.findOne({
        _id: nodeId,
        'plugins.plugin': stdPlugin ? stdPlugin._id : plugin.plugin,
      });

      if (existingPlugin) {
        throw new BadRequestException(
          `Module '${plugin.plugin}' already exists for this node`,
        );
      }

      plugin.plugin = stdPlugin ? stdPlugin._id : plugin.plugin;
      console.log({ stdPlugin, plugin });

      const result = await this.nodeModel.updateOne(
        { _id: nodeId },
        {
          $addToSet: {
            plugins: plugin,
          },
        },
      );

      if (result.modifiedCount === 0 && result.matchedCount > 0) {
        console.log('No new plugins were added to the node');
      }

      const updatedNode = await this.nodeModel.findById(nodeId);
      return updatedNode;
    } catch (error) {
      console.log('Error adding plugin', error);
      throw error;
    }
  }

  async nodeOpened(nodeId: Types.ObjectId, userId: Types.ObjectId) {
    try {
      // Remove the node if it already exists to avoid duplicates
      await this.userModel.updateOne(
        { _id: userId },
        { $pull: { lastOpenedNodes: nodeId } },
      );

      // Add the new nodeId to the beginning of the array, keeping existing nodes
      // Limit array to last 10 nodes
      const result = await this.userModel.updateOne(
        { _id: userId },
        {
          $push: {
            lastOpenedNodes: {
              $each: [nodeId],
              $position: 0, // Insert at the beginning
              $slice: 10, // Keep only 10 items
            },
          },
        },
      );

      if (result.modifiedCount === 0) {
        return {
          success: false,
          message: 'Failed to update last opened nodes',
        };
      }

      return {
        success: true,
        message: 'Node opened status updated successfully',
      };
    } catch (error) {
      console.error('Error in nodeOpened method:', error);

      if (error instanceof NotFoundException) {
        throw error;
      }

      throw new InternalServerErrorException(
        'An error occurred while updating node opened status',
      );
    }
  }

  async getAssetsByNodeWithDeadline(nodeId: string) {
    try {
      const issues = await this.issuesModel
        .find({
          node: new Types.ObjectId(nodeId),
          // publishedStatus: 'published',
        })
        .populate('createdBy', 'userName firstName lastName profileImage')
        .lean();
      const debates = await this.debatesModel
        .find({
          node: new Types.ObjectId(nodeId),
          // publishedStatus: 'published',
        })
        .populate('createdBy', 'userName firstName lastName profileImage')
        .lean();
      const projects = await this.projectModel
        .find({
          node: new Types.ObjectId(nodeId),
          // publishedStatus: 'published',
          deadline: { $exists: true, $ne: null },
        })
        .populate('createdBy', 'userName firstName lastName profileImage')
        .lean();
      const stdAssets = await this.stdPluginAssetModel
        .find({
          node: new Types.ObjectId(nodeId),
          // publishedStatus: 'published',
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


  async getMemoryUsage(nodeId: string) {
    try {
      const calculations = await Promise.all([
        this.calculateModelMemory(this.rulesModel, nodeId, rule => rule.files),
        this.calculateModelMemory(this.issuesModel, nodeId, issue => issue.files),
        this.calculateModelMemory(this.debatesModel, nodeId, debate => debate.files),
        this.calculateModelMemory(this.genericPostModel, nodeId, post => post.files),
        this.calculateModelMemory(this.stdPluginAssetModel, nodeId, post => (post.data as any).files),
      ]);

      const totalFilesSizeInBytes = calculations.reduce((sum, size) => sum + size, 0);
      const totalFilesSizeInMB = parseFloat((totalFilesSizeInBytes / (1024 * 1024)).toFixed(2));

      console.log(`Total size: ${totalFilesSizeInMB} MB`);

      return {
        success: true,
        memoryUsage: totalFilesSizeInMB,
        message: 'Memory usage calculated successfully',
      };
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  async manageArchive(nodeId: string, body: { plugin: string, pluginType: 'standard' | 'custom', action: "archive" | "unarchive" }) {
    try {

      const { plugin, pluginType, action } = body;
      const isArchived = action === "archive";

      const updatedNode = await this.nodeModel.findOneAndUpdate(
        { _id: nodeId, "plugins.plugin": plugin },
        { $set: { "plugins.$.isArchived": isArchived } },
        { new: true }
      );

      if (!updatedNode) {
        throw new NotFoundException("Plugin not found or node does not exist");
      }

      return {
        success: true,
        message: 'Node archived status updated successfully',
      };
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  async getArchivedPlugins(nodeId: string) {
    try {
      const node = await this.nodeModel.findById(nodeId).lean();
      const plugins = await Promise.all(
        node.plugins.map(async (p) => {
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

  async getExistingPlugins(nodeId: string) {
    try {
      const node = await this.nodeModel.findById(nodeId).lean();
      const plugins = await Promise.all(
        node.plugins.map(async (p) => {
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

  async manageFaqs(nodeId: string, body: { question: string, answer: string, isPublic: boolean, faqId?: string }) {
    try {
      const { question, answer, isPublic, faqId } = body;


      if (faqId) {
        const faqUpdateData: Record<string, any> = {
          isPublic: isPublic || false
        };
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
        node: new Types.ObjectId(nodeId),
        question,
        answer,
        isPublic: isPublic || false
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

  async getFaqs(nodeId: string, userId: string) {
    try {
      const nodeMember = await this.nodeMembersModel.findOne({ user: new Types.ObjectId(userId), node: new Types.ObjectId(nodeId), status: 'MEMBER' });
      const isNodeMember = nodeMember ? true : false;
      const extraQuery = isNodeMember ? {} : { isPublic: true };
      const faqs = await this.forumFaqsModel.find({ node: new Types.ObjectId(nodeId), ...extraQuery }).sort({ createdAt: -1 }).lean();
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

  async getShowcases(nodeId: string, type?: string) {
    try {
      const forumProfile = await this.forumProfileModel.findOne({ node: new Types.ObjectId(nodeId) }).lean();
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

  async manageShowcase(nodeId: string, body: {
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
      let forumProfile = await this.forumProfileModel.findOne({ node: new Types.ObjectId(nodeId) });
      
      if (!forumProfile) {
        forumProfile = new this.forumProfileModel({
          node: new Types.ObjectId(nodeId),
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

  async deleteShowcase(nodeId: string, showcaseId: string) {
    try {
      const forumProfile = await this.forumProfileModel.findOne({ node: new Types.ObjectId(nodeId) });

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
    nodeId: string,
    body: {
      name: string;
      email: string;
      address: string;
      phoneNumber?: string;
      customerNumber?: string;
      complaintNumber?: string;
      isMainBranch?: boolean;
      branchId?: string;
      googleMapLink?: string;
    }
  ) {
    try {
      const existingProfile = await this.forumProfileModel.findOne({
        node: new Types.ObjectId(nodeId),
      });

      const branchData = {
        name: body.name,
        email: body.email,
        address: body.address,
        phoneNumber: body.phoneNumber,
        customerNumber: body.customerNumber,
        complaintNumber: body.complaintNumber,
        isMainBranch: body.isMainBranch || false,
        googleMapLink: body.googleMapLink,
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
        node: new Types.ObjectId(nodeId),
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

  async getForumBranches(nodeId: string) {
    try {
      const forumProfile = await this.forumProfileModel.findOne({ node: new Types.ObjectId(nodeId) }).lean();

      let branches = forumProfile?.branches || [];

      const sortedBranches = branches.sort((a: any, b: any) => {
        return b?._id - a?._id;
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
    nodeId: string,
    body: { links: { name: string; link: string; title?: string }[] },
  ) {
    try {
      const nodeObjectId = new Types.ObjectId(nodeId);

      // ✅ Normalize input (replace null/undefined/empty with "")
      const cleanedLinks = body.links.map(link => ({
        name: link?.name?.trim() || '',
        link: link?.link?.trim() || '',
        title: link?.title?.trim() || '',
      }));

      // ✅ Find existing profile
      let forumProfile = await this.forumProfileModel.findOne({ node: nodeObjectId });

      // ✅ If profile not found, create a new one
      if (!forumProfile) {
        const newProfile = await this.forumProfileModel.create({
          node: nodeObjectId,
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
        { node: nodeObjectId },
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

  async getForumSocialLinks(nodeId: string) {
    try {
      const forumProfile = await this.forumProfileModel.findOne({ node: new Types.ObjectId(nodeId) }).lean();

      if (!forumProfile) {
        return {
          data: {},
          success: true,
          message: "Social links fetched successfully",
        };
      }

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
    nodeId: string,
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
        node: new Types.ObjectId(nodeId),
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
          node: new Types.ObjectId(nodeId),
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
  async getCommittees(nodeId: string) {
    try {
      const forumProfile = await this.forumProfileModel
        .findOne({ node: new Types.ObjectId(nodeId) })
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
    nodeId: string,
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
        node: new Types.ObjectId(nodeId),
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

  async getCommitteeEvents(nodeId: string, committeeId: string) {
    try {
      const forumProfile = await this.forumProfileModel.findOne({
        node: new Types.ObjectId(nodeId),
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
    nodeId: string,
    body: {
      usp?: string;
      website?: string;
      specialization?: string;
      challenges?: string;
      headerImages?: Express.Multer.File[];
      testimonialImages?: Express.Multer.File[];
      attachments?: Express.Multer.File[];
      showcaseImages?: Express.Multer.File[];
      deletedImageUrls?: string;
      deletedAttachmentUrls?: string;
      deletedShowcaseImageUrls?: string;
      newAttachmentTitles?: string;
      showcase?: string;
      updatedAttachments?: string;
      testimonials?: string;
      targetDomains?: string;
      ourClients?: string;
      clientLogos?: Express.Multer.File[];
      // New fields for folder structure
      deletedResourceIds?: string;
      newFolders?: string;
      updatedResources?: string;
      newAttachmentMeta?: string;
    },
  ) {
    try {
      const node = await this.nodeModel.findById(nodeId);
      if (!node) {
        throw new BadRequestException('Node not found');
      }

      let forumProfile = await this.forumProfileModel.findOne({
        node: new Types.ObjectId(nodeId),
      });

      if (!forumProfile) {
        forumProfile = await this.forumProfileModel.create({
          node: new Types.ObjectId(nodeId),
          about: {
            headerImages: [],
            usp: '',
            website: '',
            specialization: '',
            challenges: '',
            testimonials: [],
            targetDomains: [],
            attachments: [],
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
            // If uuid not provided in meta, generate one? Backend should probably generate if not provided, 
            // but for sync with frontend, frontend usually sends UUID if it wants to track it immediately or we return it.
            // Let's generate one if missing.
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

      // Handle Our Clients
      if (body.ourClients) {
        const clients = JSON.parse(body.ourClients);
        let logoIndex = 0;
        const processedClients = [];

        // Process sequentially to avoid race condition with logoIndex
        for (const client of clients) {
          if (
            client.hasNewLogo &&
            body.clientLogos &&
            body.clientLogos[logoIndex]
          ) {
            const file = body.clientLogos[logoIndex];
            const uploadResult = await this.uploadFile(file);
            logoIndex++;
            processedClients.push({
              ...client,
              logo: uploadResult.url,
              hasNewLogo: undefined,
              logoFile: undefined,
            });
          } else {
            const { hasNewLogo, logoFile, ...rest } = client;
            processedClients.push(rest);
          }
        }

        forumProfile.about.ourClients = processedClients;
      }

      if (!forumProfile.about.ourClients) {
        forumProfile.about.ourClients = [];
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
            // Filter out blob URLs if any slipped through
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

      if (body.deletedShowcaseImageUrls) {
        const deletedShowcaseImageUrls = JSON.parse(body.deletedShowcaseImageUrls);
        if (deletedShowcaseImageUrls.length > 0) {
          await this.deleteFiles(deletedShowcaseImageUrls);
        }
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

  async getForumAbout(nodeId: string) {
    try {
      const forumProfile = await this.forumProfileModel.findOne({
        node: new Types.ObjectId(nodeId),
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

  async getBrandStories(nodeId: string) {
    try {
      const forumProfile = await this.forumProfileModel.findOne({
        node: new Types.ObjectId(nodeId),
      });
      return forumProfile?.brandStories || [];
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  async getHierarchy(nodeId: string) {
    try {
      const forumProfile = await this.forumProfileModel.findOne({
        node: new Types.ObjectId(nodeId),
      });
      return forumProfile?.hierarchy || null;
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  async manageHierarchy(nodeId: string, body: any) {
    try {
      const { file, deletedFileUrl } = body;

      let forumProfile = await this.forumProfileModel.findOne({
        node: new Types.ObjectId(nodeId),
      });

      if (!forumProfile) {
        forumProfile = await this.forumProfileModel.create({
          node: new Types.ObjectId(nodeId),
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

  async manageBrandStories(nodeId: string, body: any) {
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
        node: new Types.ObjectId(nodeId),
      });

      if (!forumProfile) {
        forumProfile = await this.forumProfileModel.create({
          node: new Types.ObjectId(nodeId)
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

        // Remove deleted images from the array
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

  async getManagementTeam(nodeId: string) {
    try {
      const forumProfile = await this.forumProfileModel.findOne({
        node: new Types.ObjectId(nodeId),
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

  async manageManagementTeam(nodeId: string, body: any) {
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
        node: new Types.ObjectId(nodeId),
      });

      if (!forumProfile) {
        forumProfile = await this.forumProfileModel.create({
          node: new Types.ObjectId(nodeId)
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

  async deleteManagementTeamMember(nodeId: string, memberId: string) {
    try {
      const forumProfile = await this.forumProfileModel.findOne({
        node: new Types.ObjectId(nodeId),
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
        this.uploadService.deleteFile(url)
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

  private async calculateModelMemory(
    model: any,
    nodeId: string,
    filesExtractor: (item: any) => any[]
  ): Promise<number> {
    const items = await model.find({
      node: new Types.ObjectId(nodeId),
      isDeleted: false,
    });

    return items.reduce((total: number, item: any) => {
      const files = Array.isArray(filesExtractor(item)) ? filesExtractor(item) : [];
      return total + files.reduce((sum: number, file: any) => sum + (file?.size || 0), 0);
    }, 0);
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
    const existing = await this.nodeModel.exists({ username });

    if (!existing) {
      return username;
    }

    // 3️⃣ Append random 4-digit suffix until unique
    let uniqueUsername = username;
    let isTaken = true;

    while (isTaken) {
      const randomSuffix = Math.floor(1000 + Math.random() * 9000); // random 4 digits
      uniqueUsername = `${username}_${randomSuffix}`;
      isTaken = !!(await this.nodeModel.exists({ username: uniqueUsername }));
    }

    return uniqueUsername;
  }

  async getProductComparisons(nodeId: string) {
    try {
      const forumProfile = await this.forumProfileModel.findOne({
        node: new Types.ObjectId(nodeId),
      });
      return forumProfile?.productComparisons || [];
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  async manageProductComparisons(nodeId: string, body: any) {
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
        node: new Types.ObjectId(nodeId),
      });

      if (!forumProfile) {
        forumProfile = await this.forumProfileModel.create({
          node: new Types.ObjectId(nodeId),
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
    nodeId: string,
    body: {
      type: string;
      contactDetails?: string;
      description: string;
    },
  ) {
    try {
      const nodeObjectId = new Types.ObjectId(nodeId);

      let forumProfile = await this.forumProfileModel.findOne({
        node: nodeObjectId,
      });

      if (!forumProfile) {
        forumProfile = await this.forumProfileModel.create({
          node: nodeObjectId,
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

  async getMakeItBetter(nodeId: string) {
    try {
      const forumProfile = await this.forumProfileModel.findOne({
        node: new Types.ObjectId(nodeId),
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

  async deleteMakeItBetter(nodeId: string, feedbackId: string) {
    try {
      const forumProfile = await this.forumProfileModel.findOne({
        node: new Types.ObjectId(nodeId),
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

  //handling file uploads
  private async uploadFile(file: Express.Multer.File) {
    try {
      //uploading file
      const response = await this.uploadService.uploadFile(
        file.buffer,
        file.originalname,
        file.mimetype,
        'node',
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
}
