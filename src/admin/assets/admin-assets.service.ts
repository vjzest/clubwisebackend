import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AuthorizationService } from 'src/user/auth/authorization.service';
import { StdPluginAsset } from 'src/shared/entities/standard-plugin/std-plugin-asset.entity';
import { StdAssetAdoption } from 'src/shared/entities/standard-plugin/std-asset-adoption.entity';
import { RulesRegulations } from 'src/shared/entities/rules/rules-regulations.entity';
import { RulesAdoption } from 'src/shared/entities/rules/rules-adoption.entity';
import { Issues } from 'src/shared/entities/issues/issues.entity';
import { IssuesAdoption } from 'src/shared/entities/issues/issues-adoption.entity';
import { ChapterIssues } from 'src/shared/entities/chapters/modules/chapter-issues.entity';
import { Debate } from 'src/shared/entities/debate/debate.entity';
import { DebateAdoption } from 'src/shared/entities/debate/debate-adoption-entity';
import { ChapterDebates } from 'src/shared/entities/chapters/modules/chapter-debates.entity';
import { Comment } from 'src/shared/entities/comment.entity';
import { IssueSolution } from 'src/shared/entities/issues/issue-solution.entity';
import { DebateArgument } from 'src/shared/entities/debate/debate-argument.entity';
import { Projects } from 'src/shared/entities/projects/project.entity';
import { ProjectContribution } from 'src/shared/entities/projects/contribution.entity';
import { ProjectAnnouncement } from 'src/shared/entities/projects/project-announcement.entity';
import { ProjectActivities } from 'src/shared/entities/projects/project-activities.entity';
import { ProjectFaq } from 'src/shared/entities/projects/faq.enitity';

@Injectable()
export class AdminAssetsService {
  constructor(
    @InjectModel(StdPluginAsset.name) private readonly standardAssetModel: Model<StdPluginAsset>,
    @InjectModel(StdAssetAdoption.name) private readonly stdAssetAdoptionModel: Model<StdAssetAdoption>,
    @InjectModel(RulesRegulations.name) private readonly rulesregulationModel: Model<RulesRegulations>,
    @InjectModel(RulesAdoption.name) private readonly rulesAdoptionModel: Model<RulesAdoption>,
    @InjectModel(Issues.name) private readonly issuesModel: Model<Issues>,
    @InjectModel(IssuesAdoption.name) private readonly issuesAdoptionModel: Model<IssuesAdoption>,
    @InjectModel(ChapterIssues.name) private readonly chapterIssuesModel: Model<ChapterIssues>,
    @InjectModel(Debate.name) private readonly debateModel: Model<Debate>,
    @InjectModel(DebateAdoption.name) private readonly debateAdoptionModel: Model<DebateAdoption>,
    @InjectModel(ChapterDebates.name) private readonly chapterDebatesModel: Model<ChapterDebates>,
    @InjectModel(Comment.name) private readonly commentModel: Model<Comment>,
    @InjectModel(IssueSolution.name) private readonly solutionModel: Model<IssueSolution>,
    @InjectModel(DebateArgument.name) private readonly debateArgumentModel: Model<DebateArgument>,
    @InjectModel(Projects.name) private readonly projectModel: Model<Projects>,
    @InjectModel(ProjectContribution.name) private readonly projectContributionModel: Model<ProjectContribution>,
    @InjectModel(ProjectAnnouncement.name) private readonly projectAnnouncementModel: Model<ProjectAnnouncement>,
    @InjectModel(ProjectActivities.name) private readonly projectActivitiesModel: Model<ProjectActivities>,
    @InjectModel(ProjectFaq.name) private readonly faqModel: Model<ProjectFaq>,
    private readonly authorizationService: AuthorizationService,
  ) { }

  async getStandardAssetBySlug(userId: string, slug: string, adoptionId?: string, chapterAlyId?: string) {
    try {
      await this.authorizationService.validateAdmin(userId);

      const forumPopulateSelect = 'name slug profileImage';
      const asset: any = await this.standardAssetModel.findOne({ slug })
        .populate('createdBy', 'name userName profileImage firstName middleName lastName')
        .populate({ path: 'chapter', select: forumPopulateSelect })
        .populate({ path: 'node', select: forumPopulateSelect })
        .populate({ path: 'club', select: forumPopulateSelect })
        .lean();

      if (!asset) {
        throw new NotFoundException('Standard asset not found');
      }

      const commentCount = await this.commentModel.countDocuments({
        'entity.entityId': chapterAlyId || adoptionId || asset?._id,
        parent: null
      });

      let adoption;
      if (adoptionId) {
        adoption = await this.stdAssetAdoptionModel.findOne({ _id: adoptionId })
          .populate('asset proposedBy publishedBy');
        if (adoption) {
          (asset as any).publishedStatus = adoption.publishedStatus;
          (asset as any).type = 'adopted';
          (asset as any)._adoptedAssetId = adoptionId;
          (asset as any).adoptionProposedBy = adoption.proposedBy;
          (asset as any).adoptionDate = adoption.createdAt;
        }
      }

      (asset as any).commentCount = commentCount;
      return asset;
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to find standard asset by slug');
    }
  }

  async getRule(userId: string, ruleId: Types.ObjectId, adoptionId?: Types.ObjectId) {
    try {
      await this.authorizationService.validateAdmin(userId);

      let adoptedRule;
      if (adoptionId) {
        adoptedRule = await this.rulesAdoptionModel.findById(adoptionId);
      }

      const rule = await this.rulesregulationModel.findById(ruleId)
        .populate({
          path: 'createdBy',
          select: 'userName firstName middleName lastName profileImage interests',
          strictPopulate: false
        })
        .populate({
          path: 'adoptedBy',
          select: 'userName firstName middleName lastName profileImage interests',
          strictPopulate: false
        })
        .populate({
          path: 'club',
          select: 'name about domain profileImage coverImage isPublic',
          strictPopulate: false
        })
        .populate({
          path: 'node',
          select: 'name about domain profileImage coverImage isPublic',
          strictPopulate: false
        })
        .populate({
          path: 'chapter',
          select: 'name about domain profileImage coverImage isPublic',
          strictPopulate: false
        })
        .lean();

      if (!rule) {
        throw new NotFoundException('Rule not found');
      }

      const commentCount = await this.commentModel.countDocuments({
        "entity.entityId": adoptionId || ruleId,
        "entity.entityType": RulesRegulations.name,
        parent: null
      });

      let _rule = { ...rule, isOwnerOfAsset: String(rule.createdBy._id) === String(userId) };

      return {
        commentCount,
        rule: _rule,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Error while getting rule');
    }
  }

  async getIssue(userId: string, issueId: Types.ObjectId, adoptionId?: string, chapterAlyId?: string) {
    try {
      await this.authorizationService.validateAdmin(userId);

      let alyIssue;
      if (adoptionId || chapterAlyId) {
        if (adoptionId) {
          alyIssue = await this.issuesAdoptionModel.findById(adoptionId);
        } else if (chapterAlyId) {
          alyIssue = await this.chapterIssuesModel.findById(chapterAlyId);
        }
      }

      const issue = await this.issuesModel.findById(issueId)
        .populate({
          path: 'createdBy',
          select: 'userName firstName middleName lastName profileImage interests',
          strictPopulate: false
        })
        .populate({
          path: 'club',
          select: 'name about domain profileImage coverImage isPublic',
          strictPopulate: false
        })
        .populate({
          path: 'node',
          select: 'name about domain profileImage coverImage isPublic',
          strictPopulate: false
        })
        .populate({
          path: 'chapter',
          select: 'name about domain profileImage coverImage isPublic',
          strictPopulate: false
        })
        .populate({
          path: 'whoShouldAddress',
          select: 'userName firstName middleName lastName profileImage interests'
        })
        .lean();

      if (!issue) {
        throw new NotFoundException('Issue not found');
      }

      const commentCount = await this.commentModel.countDocuments({
        "entity.entityId": adoptionId || chapterAlyId || issueId,
        "entity.entityType": Issues.name,
        parent: null
      });

      const enhancedIssue = {
        ...issue,
        isOwnerOfAsset: String(issue?.createdBy?._id) === String(userId)
      };

      if (enhancedIssue?.isAnonymous) {
        delete enhancedIssue.createdBy;
      }

      const solutions = await this.solutionModel
        .find({ issue: new Types.ObjectId(issueId) }).sort({ createdAt: -1 }).populate({
          path: 'user',
          select: 'userName firstName middleName lastName profileImage interests'
        })
        .populate('issue', 'title description')
        .lean();

      return {
        issue: enhancedIssue,
        commentCount,
        solutions,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Error while getting issue');
    }
  }

  async getDebate(userId: string, id: string, adoptionId?: string, chapterAlyId?: string) {
    try {
      await this.authorizationService.validateAdmin(userId);

      let alyDebate;
      if (adoptionId) {
        alyDebate = await this.debateAdoptionModel.findById(adoptionId)
          .populate({
            path: 'proposedBy',
            select: 'userName firstName middleName lastName profileImage interests',
            strictPopulate: false,
          })
          .lean();
      } else if (chapterAlyId) {
        alyDebate = await this.chapterDebatesModel.findById(chapterAlyId);
      }

      const debate = await this.debateModel
        .findById(id)
        .populate({
          path: 'createdBy',
          select: 'userName firstName middleName lastName profileImage interests'
        })
        .lean()
        .exec();

      if (!debate) {
        throw new NotFoundException('Debate not found');
      }

      let _debate: any = {
        ...debate,
        isOwnerOfAsset: String(debate.createdBy._id) === String(userId)
      };

      if (adoptionId && alyDebate) {
        _debate.adoptedBy = alyDebate.proposedBy;
        _debate.adoptedAt = alyDebate.createdAt;
        _debate.publishedStatus = alyDebate.publishedStatus;
      }

      const debateArguments = await this.debateArgumentModel
        .find({
          debate: new Types.ObjectId(id),
        })
        .sort({ startingPoint: -1, isPinned: -1, pinnedAt: -1 })
        .populate({
          path: 'participant.user',
          select: 'userName firstName middleName lastName profileImage interests'
        })
        .exec();

      return {
        debate: _debate,
        debateArguments,
      };
    } catch (error) {
      console.log(error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Error while getting debate');
    }
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

  async getProject(id: string) {
    try {
      const result = await this.projectModel.aggregate([
        {
          $match: {
            _id: new Types.ObjectId(id)
          }
        },
        // Lookup creator details
        {
          $lookup: {
            from: 'users',
            localField: 'createdBy',
            foreignField: '_id',
            as: 'creatorDetails',
            pipeline: [
              {
                $project: {
                  userName: 1,
                  firstName: 1,
                  lastName: 1,
                  profileImage: 1,
                  email: 1
                }
              }
            ]
          }
        },
        {
          $unwind: {
            path: '$creatorDetails',
            preserveNullAndEmptyArrays: true
          }
        },
        // Lookup champions details
        {
          $lookup: {
            from: 'users',
            localField: 'champions.user',
            foreignField: '_id',
            as: 'championUsers',
            pipeline: [
              {
                $project: {
                  _id: 1,
                  userName: 1,
                  firstName: 1,
                  lastName: 1,
                  profileImage: 1
                }
              }
            ]
          }
        },
        {
          $addFields: {
            champions: '$championUsers'
          }
        },
        // Lookup committee members details
        {
          $lookup: {
            from: 'users',
            localField: 'committees.userIds.userId',
            foreignField: '_id',
            as: 'committeeUsers',
            pipeline: [
              {
                $project: {
                  _id: 1,
                  userName: 1,
                  firstName: 1,
                  lastName: 1,
                  profileImage: 1
                }
              }
            ]
          }
        },
        // Restructure committees with populated user data
        {
          $addFields: {
            committees: {
              $map: {
                input: '$committees',
                as: 'committee',
                in: {
                  designation: '$$committee.designation',
                  users: {
                    $filter: {
                      input: '$committeeUsers',
                      as: 'user',
                      cond: {
                        $in: ['$$user._id', '$$committee.userIds.userId']
                      }
                    }
                  }
                }
              }
            }
          }
        },
        // Lookup parameters
        {
          $lookup: {
            from: 'projectparameters',
            localField: '_id',
            foreignField: 'project',
            as: 'parameters'
          }
        },
        // Get only accepted contributions
        {
          $lookup: {
            from: 'projectcontributions',
            let: { paramIds: '$parameters._id' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $in: ['$parameter', '$$paramIds'] },
                      { $eq: ['$status', 'accepted'] }
                    ]
                  }
                }
              },
              // Join with parameters
              {
                $lookup: {
                  from: 'projectparameters',
                  localField: 'parameter',
                  foreignField: '_id',
                  as: 'parameterDetails'
                }
              },
              // Join with users
              {
                $lookup: {
                  from: 'users',
                  localField: 'user',
                  foreignField: '_id',
                  as: 'contributorDetails'
                }
              },
              // Join with clubs
              {
                $lookup: {
                  from: 'clubs',
                  localField: 'club',
                  foreignField: '_id',
                  as: 'clubDetails'
                }
              },
              // Unwind arrays
              {
                $unwind: {
                  path: '$parameterDetails',
                  preserveNullAndEmptyArrays: true
                }
              },
              {
                $unwind: {
                  path: '$contributorDetails',
                  preserveNullAndEmptyArrays: true
                }
              },
              {
                $unwind: {
                  path: '$clubDetails',
                  preserveNullAndEmptyArrays: true
                }
              },
              // Project needed fields
              {
                $project: {
                  _id: 1,
                  parameter: 1,
                  value: 1,
                  files: 1,
                  createdAt: 1,
                  parameterDetails: {
                    _id: 1,
                    title: 1,
                    value: 1
                  },
                  contributorDetails: {
                    _id: 1,
                    userName: 1,
                    profileImage: 1
                  },
                  clubDetails: {
                    _id: 1,
                    name: 1,
                    logo: 1
                  },
                  node: 1,
                  rootProject: 1,
                  views: 1,
                }
              }
            ],
            as: 'contributions'
          }
        },
        // Calculate totals
        {
          $addFields: {
            totalParameters: { $size: '$parameters' },
            hasParameters: { $gt: [{ $size: '$parameters' }, 0] },
            totalContributors: {
              $size: {
                $setUnion: '$contributions.contributorDetails._id'
              }
            },
            totalAcceptedValue: {
              $reduce: {
                input: '$contributions',
                initialValue: 0,
                in: { $add: ['$$value', '$$this.value'] }
              }
            }
          }
        },
        // Final projection
        {
          $project: {
            title: 1,
            region: 1,
            budget: 1,
            deadline: 1,
            significance: 1,
            solution: 1,
            committees: 1,
            champions: 1,
            aboutPromoters: 1,
            fundingDetails: 1,
            keyTakeaways: 1,
            risksAndChallenges: 1,
            bannerImage: 1,
            relatedEvent: 1,
            files: 1,
            status: 1,
            createdBy: '$creatorDetails',
            publishedBy: 1,
            parameters: 1,
            contributions: 1,
            totalParameters: 1,
            hasParameters: 1,
            totalContributors: 1,
            totalAcceptedValue: 1,
            relevant: 1,
            irrelevant: 1,
            createdAt: 1,
            updatedAt: 1,
            views: 1,
            adoptedNodes: 1,
            adoptedClubs: 1,
            node: 1,
            club: 1,
            chapter: 1,
            isPublic: 1,
            closingRemark: 1,
            howToTakePart: 1,
            publishedStatus: 1,
            isArchived: 1
          }
        }
      ]);

      if (!result || result.length === 0) throw new NotFoundException('Project not found');

      const commentCount = await this.commentModel.countDocuments({
        "entity.entityId": id,
        "entity.entityType": Projects.name,
        parent: null
      })

      return { project: result[0], commentCount };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Error while getting project');
    }
  }

  async getProjectLeaderboard(projectId: string) {
    try {

      const memberWize = await this.projectContributionModel.aggregate([
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

      const forumWise = await this.projectContributionModel.aggregate([
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

  async getAllAnnouncementsOfProject(projectId: string) {
    try {
      const announcements = await this.projectAnnouncementModel
        .find({ project: new Types.ObjectId(projectId) })
        .populate({
          path: 'user',
          select: 'firstName lastName  profileImage userName',
          strictPopulate: false
        })
        .sort({ createdAt: -1 });

      return {
        announcements
      };
    } catch (error) {
      throw new BadRequestException('Server error');
    }
  }

  async getAllActivitiesOfProject(projectId: string) {
    try {
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

      return { activities };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  async getAllFaqsOfProject(projectId: string) {
    try {
      const faqs = await this.faqModel
        .find({ project: new Types.ObjectId(projectId), status: 'approved' })
        .populate({ path: 'askedBy', select: 'userName email profilePicture' });
      return { faqs };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  async getStandardAsset(assetId: string) {
    try {
      const forumPopulateSelect = 'name slug profileImage';

      const asset = await this.standardAssetModel.findOne({ _id: assetId })
        .populate('createdBy', 'name userName profileImage firstName middleName lastName')
        .populate({ path: 'chapter', select: forumPopulateSelect })
        .populate({ path: 'node', select: forumPopulateSelect })
        .populate({ path: 'club', select: forumPopulateSelect })
        .lean();


      if (!asset) {
        throw new NotFoundException('Standard asset not found');
      }

      const commentsCount = await this.commentModel.countDocuments({
        'entity.entityId': asset?._id,
        parent: null
      });

      return {
        asset,
        commentsCount
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }
}