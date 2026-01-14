import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotAcceptableException,
} from '@nestjs/common';
import { CreateAdoptContributionDto } from './dto/create-adopt-contribution.dto';
import { Model, Types } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { Projects } from '../../../shared/entities/projects/project.entity';
import { ProjectContribution } from '../../../shared/entities/projects/contribution.entity';
import { UploadService } from '../../../shared/upload/upload.service';
import { ClubMembers } from '../../../shared/entities/clubmembers.entity';
import { ProjectAdoption } from '../../../shared/entities/projects/project-adoption.entity';
import { Club } from '../../../shared/entities/club.entity';
import { Node_ } from '../../../shared/entities/node.entity';
import { ProjectActivities } from '../../../shared/entities/projects/project-activities.entity';
import { NodeMembers } from '../../../shared/entities/node-members.entity';
import { AssetsService } from '../../../assets/assets.service';

/**
 * Service responsible for handling project contribution adoptions
 * Manages the creation and processing of contributions from users
 */
@Injectable()
export class AdoptContributionService {
  constructor(
    @InjectModel(Projects.name) private projectModel: Model<Projects>,
    @InjectModel(ProjectContribution.name)
    private contributionModel: Model<ProjectContribution>,
    @InjectModel(ClubMembers.name)
    private clubMemberModel: Model<ClubMembers>,
    @InjectModel(NodeMembers.name)
    private nodeMemberModel: Model<NodeMembers>,
    private s3FileUpload: UploadService,
    @InjectModel(ProjectAdoption.name)
    private projectAdoptionModel: Model<ProjectAdoption>,
    @InjectModel(Club.name) private clubModel: Model<Club>,
    @InjectModel(Node_.name) private nodeModel: Model<Node_>,
    @InjectModel(ProjectActivities.name)
    private projectActivitiesModel: Model<ProjectActivities>,
    private assetService: AssetsService,
  ) { }

  /**
   * Creates a new contribution for a project
   * @param createAdoptContributionDto - Contains contribution details like project, parameter, value etc
   * @param userId - ID of the user creating the contribution
   * @param files - Array of files to be uploaded with the contribution
   * @returns Newly created contribution document
   * @throws BadRequestException if validation fails or user lacks permissions
   */
  async create(
    createAdoptContributionDto: CreateAdoptContributionDto,
    userId: Types.ObjectId,
    files: { file: Express.Multer.File[] },
  ) {
    try {
      let { rootProject, project, parameter, club, node, chapter, value, status } =
        createAdoptContributionDto;

      if (!project) project = rootProject;

      // Validate that either club or node is provided
      if (!club && !node && !chapter) throw new BadRequestException('Club or node or chapter is required');


      // Upload all files concurrently for better performance
      const uploadedFiles = await Promise.all(
        files?.file?.map((file) => this.uploadFiles(file)),
      );
      // Create standardized file objects with metadata
      const fileObjects = uploadedFiles?.map((file, index) => ({
        url: file.url,
        originalname: files.file[index].originalname,
        mimetype: files.file[index].mimetype,
        size: files.file[index].size,
      }));

      // Check if user is the original project creator
      // This determines if contribution is auto-accepted
      const _project = await this.projectModel.findOne({
        _id: new Types.ObjectId(rootProject),
        isArchived: false
      });

      // Create the contribution document with processed data
      const newContribution = await this.contributionModel.create({
        rootProject: new Types.ObjectId(rootProject),
        project: new Types.ObjectId(project),
        parameter: new Types.ObjectId(parameter),
        club: club ? new Types.ObjectId(club) : null,
        node: node ? new Types.ObjectId(node) : null,
        user: new Types.ObjectId(userId),
        value,
        // reamarks,
        status: String(_project?.createdBy) === String(userId) ? 'accepted' : 'pending',
        files: fileObjects?.map((file) => ({
          url: file?.url,
          originalname: file?.originalname,
          mimetype: file?.mimetype,
          size: file?.size,
        })),
      });
      const newActivity = await this.projectActivitiesModel.create({
        author: new Types.ObjectId(userId),
        contribution: newContribution._id,
      });

      return {
        success: true,
        data: { newContribution, newActivity },
        message: 'Contributed successfully',
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to contribute');
    }
  }
  /**
   * Adopt or propose project in a forum based on user role
   * @param userId
   * @param adoptForumDto
   * @returns proposed project with message
   */

  async adoptProject(
    userId: Types.ObjectId,
    adoptForumDto: {
      project: Types.ObjectId;
      node?: Types.ObjectId;
      club?: Types.ObjectId;
      proposalMessage: string
    },
  ) {

    try {
      if (adoptForumDto.club && adoptForumDto.node) {
        throw new BadRequestException(
          'Forum must be either club or node, not both',
        );
      }

      let userDetails;
      if (adoptForumDto.club) {
        userDetails = await this.clubMemberModel.findOne({
          user: new Types.ObjectId(userId),
          club: new Types.ObjectId(adoptForumDto.club),
        });
        if (userDetails?.role !== 'member') {
          await this.projectModel.findByIdAndUpdate(
            adoptForumDto.project,
            {
              $addToSet: {
                adoptedClubs: {
                  club: new Types.ObjectId(adoptForumDto.club),
                  date: new Date()
                }
              }
            }
          );
        }
      } else if (adoptForumDto.node) {
        // Check role for node
        userDetails = await this.nodeMemberModel.findOne({
          user: new Types.ObjectId(userId),
          node: new Types.ObjectId(adoptForumDto.node),
        });
        if (userDetails?.role !== 'member') {
          await this.projectModel.findByIdAndUpdate(
            adoptForumDto.project,
            {
              $addToSet: {
                adoptedNodes: {
                  node: new Types.ObjectId(adoptForumDto.node),
                  date: new Date()
                }
              }
            }
          );
        }
      }

      if (!userDetails) {
        throw new NotAcceptableException(
          'User not found in the specified forum',
        );
      }


      const adoptionData = {
        project: new Types.ObjectId(adoptForumDto.project),
        proposedBy: new Types.ObjectId(userId),
        ...(userDetails.role !== 'member' && {
          acceptedBy: new Types.ObjectId(userId),
        }),
        ...(userDetails.role === 'member' && {
          message: adoptForumDto.proposalMessage,  // Add message for members
        }),
        publishedStatus: userDetails.role === 'member' ? 'proposed' : 'published',
        node: adoptForumDto.node
          ? new Types.ObjectId(adoptForumDto.node)
          : null,
        club: adoptForumDto.club
          ? new Types.ObjectId(adoptForumDto.club)
          : null,
      };

      // Create adoption record
      const adoptedProject =
        await this.projectAdoptionModel.create(adoptionData);

      if (adoptedProject?.publishedStatus === 'published') {
        await this.assetService.createFeed(
          adoptedProject?.club || adoptedProject?.node || adoptedProject?.chapter,
          adoptedProject?.club ? 'Club' : adoptedProject?.node ? 'Node' : 'Chapter',
          'Projects',
          adoptedProject?.project,
          "ProjectAdoption",
          adoptedProject?._id,
        )
      }

      return {
        success: true,
        data: adoptedProject,
        message: 'Project adopted successfully',
      };
    } catch (error) {
      console.log({ error });

      throw new NotAcceptableException('Failed to adopt forum');
    }
  }

  /**
   * Get not adopted forum list of a user based on project
   * @param userId
   * @param projectId
   */



  async notAdoptedForum(userId: Types.ObjectId, projectId: Types.ObjectId) {
    const project = await this.projectModel.findById(projectId);
    if (!project) {
      throw new BadRequestException('Project not found');
    }

    const adoptedProjects = await this.projectAdoptionModel.find({
      project: new Types.ObjectId(projectId),
    });

    // Extract adopted club and node IDs
    const adoptedClubIds = adoptedProjects
      .filter((ap) => ap.club)
      .map((ap) => ap.club.toString());
    const adoptedNodeIds = adoptedProjects
      .filter((ap) => ap.node)
      .map((ap) => ap.node.toString());

    console.log({ adoptedClubIds, adoptedNodeIds });

    const eligibleClubs = await this.clubMemberModel
      .find({
        user: userId,
        status: 'MEMBER',
      })
      .populate('club', 'name profileImage isPublic createdBy description')
      .then((members) =>
        members
          .filter((member) => {
            const clubId = member.club._id.toString();
            const hasAdopted = adoptedClubIds.includes(clubId);
            const currentProject = project.club?.toString() === clubId;
            return !hasAdopted && !currentProject;
          })
          .map((member: any) => ({
            _id: member.club._id,
            name: member.club['name'],
            type: 'club',
            role: member.role,
            description: member?.club?.description,
            profileImage: member?.club?.profileImage,
          })),
      );

    const eligibleNodes = await this.nodeMemberModel
      .find({
        user: userId,
        status: 'MEMBER',
      })
      .populate('node', 'name profileImage isPublic createdBy description')
      .then((members: any) =>
        members
          .filter((member) => {
            const nodeId = member.node._id.toString();
            const hasAdopted = adoptedNodeIds.includes(nodeId);
            const isCurrentProject = project.node?.toString() === nodeId;
            return !isCurrentProject && !hasAdopted;
          })
          .map((member) => ({
            _id: member?.node._id,
            name: member?.node['name'],
            description: member?.node?.description,
            type: 'node',
            role: member?.role,
            profileImage: member?.node?.profileImage,
          })),
      );

    return {
      clubs: eligibleClubs,
      nodes: eligibleNodes
    };
  }

  /**
   *
   */

  /**
   *
   */
  async getActivitiesOfProject(projectId: string | Types.ObjectId) {
    try {
      if (!projectId) {
        throw new BadRequestException('Project id is required');
      }

      const objectId = typeof projectId === 'string' ? new Types.ObjectId(projectId) : projectId;

      const activities = await this.projectActivitiesModel.aggregate([
        // Match activities of type contribution
        {
          $match: {
            activityType: "contribution"
          }
        },
        // Lookup contributions with project matching
        {
          $lookup: {
            from: 'projectcontributions',
            let: { contributionId: '$contribution' },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ['$_id', '$$contributionId'] },
                  $or: [
                    { project: objectId },
                    { rootProject: objectId }
                  ]
                }
              }
            ],
            as: 'contributionDetails'
          }
        },
        {
          $match: {
            'contributionDetails.0': { $exists: true }
          }
        },
        {
          $unwind: '$contributionDetails'
        },
        // Lookup project parameter details
        {
          $lookup: {
            from: 'projectparameters',
            let: { parameterId: '$contributionDetails.parameter' },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ['$_id', '$$parameterId'] }
                }
              }
            ],
            as: 'parameterDetails'
          }
        },
        {
          $unwind: {
            path: '$parameterDetails',
            preserveNullAndEmptyArrays: true
          }
        },
        // Lookup project details
        {
          $lookup: {
            from: 'projects',
            localField: 'contributionDetails.project',
            foreignField: '_id',
            as: 'projectDetails'
          }
        },
        {
          $unwind: '$projectDetails'
        },
        // Lookup root project details
        {
          $lookup: {
            from: 'projects',
            localField: 'contributionDetails.rootProject',
            foreignField: '_id',
            as: 'rootProjectDetails'
          }
        },
        {
          $unwind: '$rootProjectDetails'
        },
        // Lookup user details
        {
          $lookup: {
            from: 'users',
            localField: 'contributionDetails.user',
            foreignField: '_id',
            as: 'userDetails'
          }
        },
        {
          $unwind: '$userDetails'
        },
        // Lookup author details
        {
          $lookup: {
            from: 'users',
            localField: 'author',
            foreignField: '_id',
            as: 'authorDetails'
          }
        },
        {
          $unwind: '$authorDetails'
        },
        // Optional: Lookup club details if exists
        {
          $lookup: {
            from: 'clubs',
            localField: 'contributionDetails.club',
            foreignField: '_id',
            as: 'clubDetails'
          }
        },
        {
          $unwind: {
            path: '$clubDetails',
            preserveNullAndEmptyArrays: true
          }
        },
        // Optional: Lookup node details if exists
        {
          $lookup: {
            from: 'node_',
            localField: 'contributionDetails.node',
            foreignField: '_id',
            as: 'nodeDetails'
          }
        },
        {
          $unwind: {
            path: '$nodeDetails',
            preserveNullAndEmptyArrays: true
          }
        },
        // Project final shape
        {
          $project: {
            _id: 1,
            date: 1,
            activityType: 1,
            contribution: {
              _id: '$contributionDetails._id',
              rootProject: {
                _id: '$rootProjectDetails._id',
                title: '$rootProjectDetails.title',
                description: '$rootProjectDetails.description',
                publishedStatus: '$rootProjectDetails.publishedStatus'
              },
              project: {
                _id: '$projectDetails._id',
                title: '$projectDetails.title',
                description: '$projectDetails.description',
                publishedStatus: '$projectDetails.publishedStatus'
              },
              parameter: {
                _id: '$parameterDetails._id',
                title: '$parameterDetails.title',
                value: '$parameterDetails.value',
                unit: '$parameterDetails.unit',
                project: '$parameterDetails.project'
              },
              user: {
                _id: '$userDetails._id',
                userName: '$userDetails.userName',
                firstName: '$userDetails.firstName',
                lastName: '$userDetails.lastName',
                image: '$userDetails.profileImage'
              },
              club: {
                $cond: {
                  if: { $ifNull: ['$clubDetails', false] },
                  then: {
                    _id: '$clubDetails._id',
                    name: '$clubDetails.name',
                    // Add other club fields you want to include
                  },
                  else: null
                }
              },
              node: {
                $cond: {
                  if: { $ifNull: ['$nodeDetails', false] },
                  then: {
                    _id: '$nodeDetails._id',
                    name: '$nodeDetails.name',
                    // Add other node fields you want to include
                  },
                  else: null
                }
              },
              value: '$contributionDetails.value',
              files: '$contributionDetails.files',
              remarks: '$contributionDetails.remarks',
              status: '$contributionDetails.status',
              createdAt: '$contributionDetails.createdAt',
              updatedAt: '$contributionDetails.updatedAt'
            },
            author: {
              _id: '$authorDetails._id',
              userName: '$authorDetails.userName',
              firstName: '$authorDetails.firstName',
              lastName: '$authorDetails.lastName',
              image: '$authorDetails.profileImage'
            },
            createdAt: 1,
            updatedAt: 1
          }
        },
        // Sort by date descending
        {
          $sort: { createdAt: -1 }
        }
      ]);

      return activities;
    } catch (error) {
      console.error('Error in get activities of project:', error);
      throw new BadRequestException(error.message);
    }
  }

  async getLeaderBoard(
    userId: Types.ObjectId,
    projectId: Types.ObjectId,
    forumId: Types.ObjectId,
    forumType: 'club' | 'node',
  ) {
    try {

      const memberWize = await this.contributionModel.aggregate([
        // Match contributions for the specific root project
        {
          $match: {
            rootProject: new Types.ObjectId(projectId),
          },
        },

        // Lookup to get parameter details
        {
          $lookup: {
            from: 'projectparameters',
            localField: 'parameter',
            foreignField: '_id',
            as: 'parameterDetails',
          },
        },

        // Unwind the parameter details
        {
          $unwind: '$parameterDetails',
        },

        // Lookup to get user details
        {
          $lookup: {
            from: 'users',
            localField: 'user',
            foreignField: '_id',
            as: 'userDetails',
          },
        },

        // Unwind the user details
        {
          $unwind: '$userDetails',
        },

        // Group by user and parameter
        {
          $group: {
            _id: {
              userId: '$user',
              parameterId: '$parameter',
            },
            user: { $first: '$userDetails' },
            parameter: { $first: '$parameterDetails' },
            totalValue: { $sum: '$value' },
            contributions: {
              $push: {
                _id: '$_id',
                value: '$value',
                files: '$files',
                status: '$status',
                createdAt: '$createdAt',
              },
            },
          },
        },

        // Group by user to get all parameters for each user
        {
          $group: {
            _id: '$_id.userId',
            userData: { $first: '$user' },
            totalContributions: {
              $push: {
                parameter: '$parameter',
                totalValue: '$totalValue',
                contributions: '$contributions',
              },
            },
            overallTotal: { $sum: '$totalValue' },
          },
        },

        // Project the final shape of the document
        {
          $project: {
            _id: 1,
            user: {
              _id: '$userData._id',
              userName: '$userData.userName',
              firstName: '$userData.firstName',
              lastName: '$userData.lastName',
              profileImage: '$userData.profileImage',
            },
            totalContributions: 1,
            overallTotal: 1,
          },
        },

        // Sort by overall total in descending order
        {
          $sort: {
            overallTotal: -1,
          },
        },
      ]);

      const forumWise = await this.contributionModel.aggregate([
        // Match contributions for the specific root project
        {
          $match: {
            rootProject: new Types.ObjectId(projectId),
          },
        },

        // Add lookups for club and node details
        {
          $lookup: {
            from: 'clubs',
            localField: 'club',
            foreignField: '_id',
            as: 'clubDetails',
          },
        },
        {
          $lookup: {
            from: 'node_',
            localField: 'node',
            foreignField: '_id',
            as: 'nodeDetails',
          },
        },

        // Add lookup for parameter details
        {
          $lookup: {
            from: 'projectparameters',
            localField: 'parameter',
            foreignField: '_id',
            as: 'parameterDetails',
          },
        },

        // Unwind the parameter details
        {
          $unwind: '$parameterDetails',
        },

        // Determine forum type and details
        {
          $addFields: {
            forumType: {
              $cond: {
                if: { $gt: [{ $size: '$clubDetails' }, 0] },
                then: 'club',
                else: 'node',
              },
            },
            forumDetails: {
              $cond: {
                if: { $gt: [{ $size: '$clubDetails' }, 0] },
                then: { $arrayElemAt: ['$clubDetails', 0] },
                else: { $arrayElemAt: ['$nodeDetails', 0] },
              },
            },
          },
        },

        // Group by forum and parameter
        {
          $group: {
            _id: {
              forumId: {
                $cond: {
                  if: { $eq: ['$forumType', 'club'] },
                  then: '$club',
                  else: '$node',
                },
              },
              parameterId: '$parameter',
            },
            forumType: { $first: '$forumType' },
            forumDetails: { $first: '$forumDetails' },
            parameter: { $first: '$parameterDetails' },
            totalValue: { $sum: '$value' },
            contributions: {
              $push: {
                _id: '$_id',
                value: '$value',
                files: '$files',
                status: '$status',
                createdAt: '$createdAt',
              },
            },
          },
        },

        // Group by forum to get all parameters
        {
          $group: {
            _id: '$_id.forumId',
            forumType: { $first: '$forumType' },
            forumDetails: { $first: '$forumDetails' },
            totalContributions: {
              $push: {
                parameter: '$parameter',
                totalValue: '$totalValue',
                contributions: '$contributions',
              },
            },
            overallTotal: { $sum: '$totalValue' },
          },
        },

        // Final project stage
        {
          $project: {
            _id: 1,
            forumType: 1,
            forum: {
              _id: '$_id',
              name: '$forumDetails.name',
              profileImage: '$forumDetails.profileImage',
              forumDetails: '$forumDetails'
            },
            totalContributions: 1,
            overallTotal: 1,
          },
        },

        // Sort by overall total
        {
          $sort: {
            overallTotal: -1,
          },
        },
      ]);

      return {
        totalContributors: memberWize.length,
        memberWize,
        forumWise,
      };
    } catch (error) {
      // Handle any errors
      console.error('Error fetching leaderboard:', error);
      throw new Error('Failed to retrieve leaderboard');
    }
  }

  /**
   * Helper method to upload files to S3 storage
   * @param file - File to be uploaded
   * @returns Upload response containing the file URL
   * @throws BadRequestException if upload fails
   */

  private async uploadFiles(file: Express.Multer.File) {
    try {
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
}
