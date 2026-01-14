import { ClientSession, FilterQuery, Model, PipelineStage, Types } from 'mongoose';
import { BadRequestException, ForbiddenException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Projects } from '../shared/entities/projects/project.entity';
import { Debate } from '../shared/entities/debate/debate.entity';
import { Issues } from '../shared/entities/issues/issues.entity';
import { RulesRegulations } from '../shared/entities/rules/rules-regulations.entity';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Feed } from '../shared/entities/feed.entity';
import { ASSET_ADOPTION_TYPE_MAP, FORUM_TYPE_MAP, MODULE_TYPE_MAP } from '../utils/text';
import { User } from '../shared/entities/user.entity';
import { StdPluginAsset } from '../shared/entities/standard-plugin/std-plugin-asset.entity';
import { StdPlugin } from '../shared/entities/standard-plugin/std-plugin.entity';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Comment } from '../shared/entities/comment.entity';
import { GenericPost } from '../shared/entities/generic-post.entity';
import { Configuration } from '../shared/entities/configuration.entity';
import { config } from 'process';
import { Node_ } from '../shared/entities/node.entity';
import { Club } from '../shared/entities/club.entity';
import { CustomerConnect } from '../shared/entities/customer-connect.entity';
import { UploadService } from '../shared/upload/upload.service';
import { EmitCustomerConnectAnnouncementProps, NotificationEventsService } from '../notification/notification-events.service';
import { ForumCampaign } from '../shared/entities/forum-campaign.entity';

export interface ICacheManager extends Cache {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T, options?: { ttl?: number }): Promise<void>;
  del(key: string): Promise<void>;
  reset(): Promise<void>;
}

interface IAsset {
  _id: any;
  relevant?: any[];
  irrelevant?: any[];
  adoptedNodes?: any[];
  adoptedClubs?: any[];
  createdAt?: Date;
}

interface IFeed {
  _id: any;
  assetId?: IAsset;
  feedType?: 'adopted' | 'original';
  adoptionId?: any;
  score?: number;
}

// Configurable scoring weights
const SCORE_WEIGHTS = {
  ADOPTION: 2,
  COMMENT: 2,
  RELEVANT: 1,
  IRRELEVANT: -1,
};


@Injectable()
export class AssetsService {

  private readonly CACHE_TTL = {
    SINGLE_FEED: 60 * 5, // 5 minutes for single feed
    FEED_LIST: 60 * 2, // 2 minutes for feed lists
    POPULAR_FEEDS: 60 * 10, // 10 minutes for popular feeds
  };

  // Cache key tracking registry
  private cacheKeyRegistry = new Map<string, Set<string>>();

  private readonly logger = new Logger(AssetsService.name);

  constructor(
    @InjectModel(Projects.name) private readonly projectModel: Model<Projects>,
    @InjectModel(Debate.name) private readonly debateModel: Model<Debate>,
    @InjectModel(Issues.name) private readonly issueModel: Model<Issues>,
    @InjectModel(RulesRegulations.name) private readonly rulesRegulationsModel: Model<RulesRegulations>,
    @InjectModel(StdPluginAsset.name) private readonly stdPluginAssetModel: Model<StdPluginAsset>,
    @InjectModel(StdPlugin.name) private readonly stdPluginModel: Model<StdPlugin>,
    @InjectModel(Feed.name) private readonly feedModel: Model<Feed>,
    @InjectModel(Comment.name) private readonly commentModel: Model<Comment>,
    @InjectModel(GenericPost.name) private readonly genericPostModel: Model<GenericPost>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @Inject(CACHE_MANAGER) private readonly cacheManager: ICacheManager,
    @InjectModel(Configuration.name) private readonly configurationModel: Model<Configuration>,
    @InjectModel(Node_.name) private readonly nodeModel: Model<Node_>,
    @InjectModel(Club.name) private readonly clubModel: Model<Club>,
    @InjectModel(CustomerConnect.name) private readonly customerConnectModel: Model<CustomerConnect>,
    @InjectModel(ForumCampaign.name) private readonly forumCampaignModel: Model<ForumCampaign>,
    private readonly uploadService: UploadService,
    private notificationEventsService: NotificationEventsService,
  ) { }

  async getAssetsByEntity(
    entity: 'club' | 'node',
    entityId: string,
    page: number = 1,
    limit: number = 10
  ) {
    try {
      const skip = (page - 1) * limit;

      const matchCondition = {
        [entity]: new Types.ObjectId(entityId),
        isArchived: false,
        $or: [
          { publishedStatus: "published" },
          { status: "published" }
        ]
      };

      const createPipeline = (type: 'project' | 'debate' | 'issues' | 'rules'): PipelineStage[] => [
        {
          $match: matchCondition,
        },
        {
          $lookup: {
            from: 'users',
            localField: 'createdBy',
            foreignField: '_id',
            as: 'author',
          },
        },
        {
          $unwind: {
            path: '$author',
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $project: {
            _id: 1,
            [entity]: 1,
            title: 1,
            createdAt: 1,
            description: 1,
            views: 1,
            files: {
              $cond: {
                if: { $isArray: '$files' },
                then: '$files',
                else: []
              }
            },
            // author: {
            //   name: { $concat: ['$author.firstName', ' ', '$author.lastName'] },
            //   userName: '$author.userName',
            //   email: '$author.email',
            //   profileImage: '$author.profileImage'
            // },
            author: {
              $cond: {
                if: { $and: [{ $eq: ['issues', type] }, { $eq: ['$isAnonymous', true] }] },
                then: '$$REMOVE',
                else: {
                  name: { $concat: ['$author.firstName', ' ', '$author.lastName'] },
                  userName: '$author.userName',
                  email: '$author.email',
                  profileImage: '$author.profileImage'
                }
              }
            },
            type: { $literal: type },

            // Specific fields for each type
            projectSignificance: {
              $cond: { if: { $eq: ['project', type] }, then: '$significance', else: '$$REMOVE' }
            },
            debateSignificance: {
              $cond: { if: { $eq: ['debate', type] }, then: '$significance', else: '$$REMOVE' }
            },
            issueSignificance: {
              $cond: { if: { $eq: ['issues', type] }, then: '$significance', else: '$$REMOVE' }
            },
            issueType: {
              $cond: { if: { $eq: ['issues', type] }, then: '$issueType', else: '$$REMOVE' }
            },
            deadline: {
              $cond: { if: { $eq: ['project', type] }, then: '$deadline', else: '$$REMOVE' }
            },
            budget: {
              $cond: { if: { $eq: ['project', type] }, then: '$budget', else: '$$REMOVE' }
            },
            startingComment: {
              $cond: { if: { $eq: ['debate', type] }, then: '$startingComment', else: '$$REMOVE' }
            },
            tags: {
              $cond: { if: { $eq: ['debate', type] }, then: '$tags', else: '$$REMOVE' }
            },
            topic: {
              $cond: { if: { $eq: ['debate', type] }, then: '$topic', else: '$$REMOVE' }
            },
            isAnonymous: {
              $cond: { if: { $eq: ['issues', type] }, then: '$isAnonymous', else: '$$REMOVE' }
            },

            // RulesRegulations specific fields
            category: {
              $cond: { if: { $eq: ['rules', type] }, then: '$category', else: '$$REMOVE' }
            },
            significance: {
              $cond: { if: { $eq: ['rules', type] }, then: '$significance', else: '$$REMOVE' }
            },
            isPublic: {
              $cond: { if: { $eq: ['rules', type] }, then: '$isPublic', else: '$$REMOVE' }
            },
            version: {
              $cond: { if: { $eq: ['rules', type] }, then: '$version', else: '$$REMOVE' }
            },
            publishedStatus: {
              $cond: { if: { $eq: ['rules', type] }, then: '$publishedStatus', else: '$$REMOVE' }
            },
            relevant: 1,
            irrelevant: 1
          },
        },
        {
          $sort: { createdAt: -1 },
        },
      ];

      // Execute count queries first
      const [projectCount, debateCount, issueCount, rulesCount] = await Promise.all([
        this.projectModel.countDocuments(matchCondition),
        this.debateModel.countDocuments(matchCondition),
        this.issueModel.countDocuments(matchCondition),
        this.rulesRegulationsModel.countDocuments(matchCondition),
      ]);
      const total = projectCount + debateCount + issueCount + rulesCount;

      // Add pagination stages to pipeline
      const paginatedPipeline = (type: 'project' | 'debate' | 'issues' | 'rules'): PipelineStage[] => [
        ...createPipeline(type),
        { $skip: skip },
        { $limit: limit },
      ];

      // Execute aggregation on each collection with pagination
      const [projects, debates, issues, rules] = await Promise.all([
        this.projectModel.aggregate(paginatedPipeline('project')).exec(),
        this.debateModel.aggregate(paginatedPipeline('debate')).exec(),
        this.issueModel.aggregate(paginatedPipeline('issues')).exec(),
        this.rulesRegulationsModel.aggregate(paginatedPipeline('rules')).exec(),
      ]);

      // Combine and sort results
      const allResults = [...projects, ...debates, ...issues, ...rules]
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, limit);

      return {
        items: allResults,
        total,
        page,
        limit,
        hasMore: skip + limit < total,
      };
    } catch (error) {
      console.log({ error });
      throw error;
    }
  }


  async feedRelevancyAction(
    type: 'project' | 'issues' | 'debate' | 'rules',
    assetId: string,
    action: 'like' | 'dislike',
    userId: string,
  ) {
    console.log({ type })
    try {
      // Convert userId to ObjectId
      const userObjectId = new Types.ObjectId(userId);

      // Select model based on type
      let model: Model<any>;
      switch (type) {
        case 'project':
          model = this.projectModel;
          break;
        case 'issues':
          model = this.issueModel;
          break;
        case 'debate':
          model = this.debateModel
          break;
        case 'rules':
          model = this.rulesRegulationsModel
          break;
        default:
          throw new Error('Invalid content type');
      }

      // Get current document state
      let currentDoc = await model.findById(assetId);
      if (!currentDoc) {
        throw new Error(`${type} document not found`);
      }

      // Ensure arrays exist in the document
      if (!currentDoc.relevant || !currentDoc.irrelevant) {
        await model.updateOne(
          { _id: assetId },
          { $set: { relevant: [], irrelevant: [] } }
        );
        currentDoc = await model.findById(assetId); // Refresh the document
      }

      if (action === 'like') {
        // Remove the user from irrelevant first, if they exist there
        await model.updateOne(
          { _id: assetId },
          { $pull: { irrelevant: { user: userObjectId } } }
        );

        // Check if the user already exists in relevant
        const alreadyLiked = currentDoc.relevant.some(
          (entry: any) => entry.user.equals(userObjectId)
        );

        if (alreadyLiked) {
          // Remove the user from relevant if they already liked
          await model.updateOne(
            { _id: assetId },
            { $pull: { relevant: { user: userObjectId } } }
          );
        } else {
          // Add the user to relevant
          const relevantEntry = { user: userObjectId, date: new Date() };
          await model.updateOne(
            { _id: assetId },
            { $addToSet: { relevant: relevantEntry } }
          );
        }
      } else if (action === 'dislike') {
        // Remove the user from relevant first, if they exist there
        await model.updateOne(
          { _id: assetId },
          { $pull: { relevant: { user: userObjectId } } }
        );

        // Check if the user already exists in irrelevant
        const alreadyDisliked = currentDoc.irrelevant.some(
          (entry: any) => entry.user.equals(userObjectId)
        );

        if (alreadyDisliked) {
          // Remove the user from irrelevant if they already disliked
          await model.updateOne(
            { _id: assetId },
            { $pull: { irrelevant: { user: userObjectId } } }
          );
        } else {
          // Add the user to irrelevant
          const irrelevantEntry = { user: userObjectId, date: new Date() };
          await model.updateOne(
            { _id: assetId },
            { $addToSet: { irrelevant: irrelevantEntry } }
          );
        }
      }

      return {
        success: true,
        data: await model.findById(assetId),
      };
    } catch (error) {
      throw new Error(`Failed to update relevancy: ${error.message}`);
    }
  }



  //-----------------------------------------------------------------------------


  /**
 * Get single feed by ID with caching
 */
  async getFeedById(feedId: string): Promise<Feed> {
    const cacheKey = this.getSingleFeedCacheKey(feedId);

    // 1. Try to get from cache first
    const cachedFeed = await this.cacheManager.get<Feed>(cacheKey);
    if (cachedFeed) {
      return cachedFeed;
    }

    // 2. If not in cache, fetch from database
    const feed = await this.feedModel
      .findById(feedId)
      .populate('assetId')
      .lean()
      .exec();

    if (!feed) {
      throw new Error('Feed not found');
    }

    // 3. Store in cache before returning
    await this.cacheManager.set(cacheKey, feed, { ttl: this.CACHE_TTL.SINGLE_FEED * 1000 });

    return feed;
  }



  async getPaginatedFeeds(
    filter: Record<string, any> = {},
    limit: number = 10,
    lastId?: string
  ) {
    try {
      const query = this.feedModel.find(filter);

      if (lastId) {
        // For subsequent pages → normal pagination by score
        const lastFeed = await this.feedModel.findById(lastId).select('createdAt score').lean();
        if (lastFeed) {
          query.where({
            $or: [
              { score: { $lt: lastFeed.score } },
              {
                score: lastFeed.score,
                _id: { $lt: new Types.ObjectId(lastId) }
              }
            ]
          });
        }

        // ✅ Normal pagination feed
        const results = await query
          .sort({ score: -1, _id: -1 })
          .limit(limit)
          .populate({
            path: 'forum',
            select: 'name profileImage',
            options: { lean: true }
          })
          .populate({
            path: 'assetId',
            options: { lean: true },
            strictPopulate: false,
            populate: [
              {
                path: 'createdBy',
                select: 'userName profileImage firstName lastName',
                options: { lean: true }
              },
              {
                path: 'plugin',
                model: StdPlugin.name,
                select: 'name slug',
                options: {
                  lean: true,
                  match: { moduleType: StdPluginAsset.name },
                  strictPopulate: false
                }
              }
            ]
          })
          .lean()
          .exec();

        return {
          feeds: results,
          hasMore: results.length === limit,
          lastId: results.length ? results[results.length - 1]._id : null
        };
      }

      // ✅ INITIAL LOAD → Include “latest” logic
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

      // Fetch recent posts (within 1 hour)
      const recentFeeds = await this.feedModel
        .find({ ...filter, createdAt: { $gte: oneHourAgo } })
        .sort({ createdAt: -1 }) // newest first
        .limit(limit)
        .populate({
          path: 'forum',
          select: 'name profileImage',
          options: { lean: true }
        })
        .populate({
          path: 'assetId',
          options: { lean: true },
          strictPopulate: false,
          populate: [
            {
              path: 'createdBy',
              select: 'userName profileImage firstName lastName',
              options: { lean: true }
            },
            {
              path: 'plugin',
              model: StdPlugin.name,
              select: 'name slug',
              options: {
                lean: true,
                match: { moduleType: StdPluginAsset.name },
                strictPopulate: false
              }
            }
          ]
        })
        .lean()
        .exec();

      const remainingLimit = limit - recentFeeds.length;

      let olderFeeds: any[] = [];
      if (remainingLimit > 0) {
        olderFeeds = await this.feedModel
          .find({
            ...filter,
            createdAt: { $lt: oneHourAgo }
          })
          .sort({ score: -1, _id: -1 })
          .limit(remainingLimit)
          .populate({
            path: 'forum',
            select: 'name profileImage',
            options: { lean: true }
          })
          .populate({
            path: 'assetId',
            options: { lean: true },
            strictPopulate: false,
            populate: [
              {
                path: 'createdBy',
                select: 'userName profileImage firstName lastName',
                options: { lean: true }
              },
              {
                path: 'plugin',
                model: StdPlugin.name,
                select: 'name slug',
                options: {
                  lean: true,
                  match: { moduleType: StdPluginAsset.name },
                  strictPopulate: false
                }
              }
            ]
          })
          .lean()
          .exec();
      }

      const results = [...recentFeeds, ...olderFeeds].slice(0, limit);

      return {
        feeds: results,
        hasMore: results.length === limit,
        lastId: results.length ? results[results.length - 1]._id : null
      };
    } catch (error) {
      console.log({ error });
      throw error;
    }
  }


  async createFeed(
    forum: Types.ObjectId,
    forumType: 'Club' | 'Node' | 'Chapter',
    moduleType: 'Projects' | 'Issues' | 'Debate' | 'RulesRegulations' | 'StdPluginAsset' | 'Generic',
    assetId: Types.ObjectId,
    assetAdoptionType?: "RulesRegulationsAdoption" | "IssuesAdoption" | "ProjectAdoption" | "DebateAdoption" | "StdAssetAdoption",
    adoptionId?: Types.ObjectId,
  ): Promise<Feed> {

    try {
      const resolvedForumType = FORUM_TYPE_MAP.get(forumType);
      const resolvedModuleType = MODULE_TYPE_MAP.get(moduleType);

      const FeedData: Record<string, any> = {
        forum,
        forumType: resolvedForumType,
        moduleType: resolvedModuleType,
        assetId,
        status: 'published',
        createdAt: new Date(),
      }

      if (adoptionId) {
        FeedData.adoptionId = adoptionId;
        FeedData.feedType = 'adopted';
        FeedData.assetAdoptionType = ASSET_ADOPTION_TYPE_MAP.get(assetAdoptionType);
      } else {
        FeedData.feedType = 'original';
      }

      const feed = await this.feedModel.create(FeedData);
      const leanFeed = feed.toObject();

      // Invalidate caches for the new feed
      await this.invalidateCachesForFeed(leanFeed);

      return leanFeed;
    } catch (error) {
      console.log({ error });
      if (error.code === 11000) {
        return this.feedModel.findOne({ assetId }).lean().exec();
      }
      throw error;
    }
  }

  async updateFeed(
    assetId: string,
    status?: 'published' | 'archived' | 'deleted',
    score?: number,
    assetType: "standard" | "custom" = "custom",
    adoptionId?: string,
  ) {

    try {
      const query: Record<string, any> = { assetId: new Types.ObjectId(assetId) };

      if (assetType === "standard" && adoptionId) {
        query.adoptionId = new Types.ObjectId(adoptionId);
        query.feedType = "adopted";
      } else if (assetType === "standard" && !adoptionId) {
        query.feedType = "original";
      }

      if (status === undefined && score === undefined) {
        return this.feedModel.findOne(query).lean().exec();
      }

      // Strongly typed update object
      const update: {
        $set?: { status?: 'published' | 'archived' | 'deleted' },
        $inc?: { score?: number }
      } = {};

      // Conditional update building
      if (status !== undefined) update.$set = { ...update.$set, status };
      if (score !== undefined) update.$inc = { ...update.$inc, score };

      await this.feedModel.updateMany(query, update, { readPreference: 'primary' }).exec();

      const updatedFeeds = await this.feedModel.find(query).lean().exec();

      if (updatedFeeds) {
        await Promise.all(
          updatedFeeds.map(async (feed) => {
            await this.invalidateCachesForFeed(feed);
          })
        )
      }
    } catch (error) {
      throw error;
    }

  }

  async feedRelevancyActions(
    type: 'Projects' | 'Issues' | 'Debate' | 'RulesRegulations' | 'StdPluginAsset' | 'GenericPost',
    assetId: string,
    action: 'like' | 'dislike',
    userId: string,
  ) {
    console.log({ type })
    try {
      // Convert userId to ObjectId
      const userObjectId = new Types.ObjectId(userId);

      // Select model based on type
      let model: Model<any>;
      switch (type) {
        case 'Projects':
          model = this.projectModel;
          break;
        case 'Issues':
          model = this.issueModel;
          break;
        case 'Debate':
          model = this.debateModel
          break;
        case 'RulesRegulations':
          model = this.rulesRegulationsModel
          break;
        case 'StdPluginAsset':
          model = this.stdPluginAssetModel
          break;
        case 'GenericPost':
          model = this.genericPostModel
          break;
        default:
          throw new Error('Invalid content type');
      }

      // Get current document state
      let currentDoc = await model.findById(assetId);
      if (!currentDoc) {
        throw new Error(`${type} document not found`);
      }

      if (!currentDoc?.relevant || !currentDoc?.irrelevant) {
        const updateFields: Record<string, any> = {};

        if (!currentDoc?.relevant) updateFields.relevant = [];
        if (!currentDoc?.irrelevant) updateFields.irrelevant = [];

        if (Object.keys(updateFields).length > 0) {
          await model.updateOne({ _id: assetId }, { $set: updateFields });
          currentDoc = await model.findById(assetId); // refresh document
        }
      }

      if (action === 'like') {
        // Remove the user from irrelevant first, if they exist there
        await model.updateOne(
          { _id: assetId },
          { $pull: { irrelevant: { user: userObjectId } } }
        );

        // Check if the user already exists in relevant
        const alreadyLiked = currentDoc.relevant.some(
          (entry: any) => entry.user.equals(userObjectId)
        );

        if (alreadyLiked) {
          // Remove the user from relevant if they already liked
          await model.updateOne(
            { _id: assetId },
            { $pull: { relevant: { user: userObjectId } } }
          );
        } else {
          // Add the user to relevant
          const relevantEntry = { user: userObjectId, date: new Date() };
          await model.updateOne(
            { _id: assetId },
            { $addToSet: { relevant: relevantEntry } }
          );
        }
      } else if (action === 'dislike') {
        // Remove the user from relevant first, if they exist there
        await model.updateOne(
          { _id: assetId },
          { $pull: { relevant: { user: userObjectId } } }
        );

        // Check if the user already exists in irrelevant
        const alreadyDisliked = currentDoc.irrelevant.some(
          (entry: any) => entry.user.equals(userObjectId)
        );

        if (alreadyDisliked) {
          // Remove the user from irrelevant if they already disliked
          await model.updateOne(
            { _id: assetId },
            { $pull: { irrelevant: { user: userObjectId } } }
          );
        } else {
          // Add the user to irrelevant
          const irrelevantEntry = { user: userObjectId, date: new Date() };
          await model.updateOne(
            { _id: assetId },
            { $addToSet: { irrelevant: irrelevantEntry } }
          );
        }
      }

      return {
        success: true,
        data: await model.findById(assetId),
      };
    } catch (error) {
      throw new Error(`Failed to update relevancy: ${error.message}`);
    }
  }

  async getProductServices(
    filter: Record<string, any> = {},
    limit: number = 10,
    lastId?: string
  ) {
    try {
      const portfolioPlugin = await this.stdPluginModel.findOne({ safekey: "portfolio" }).lean().exec();

      if (!portfolioPlugin) {
        return {
          feeds: [],
          hasMore: false,
          lastId: null
        };
      }

      filter.plugin = portfolioPlugin._id;

      const query = this.stdPluginAssetModel.find(filter);

      if (lastId) {
        const lastFeed = await this.stdPluginAssetModel.findById(lastId).lean();
        if (lastFeed) {
          query.where({
            $or: [
              { createdAt: { $lt: lastFeed.createdAt } },
              {
                createdAt: lastFeed.createdAt,
                _id: { $lt: new Types.ObjectId(lastId) }
              }
            ]
          });
        }
      }

      const results = await query
        .sort({ createdAt: -1, _id: -1 })
        .limit(limit)
        .populate({
          path: 'node',
          select: 'name profileImage',
          options: { lean: true }
        })
        .populate({
          path: 'club',
          select: 'name profileImage',
          options: { lean: true }
        })
        .populate({
          path: 'createdBy',
          select: 'userName profileImage firstName lastName',
          options: { lean: true }
        })
        .populate({
          path: 'plugin',
          model: StdPlugin.name,
          select: 'name slug',
          options: {
            lean: true,
            match: { moduleType: StdPluginAsset.name },
            strictPopulate: false
          }
        })
        .lean()
        .exec();

      return {
        feeds: results,
        hasMore: results.length === limit,
        lastId: results.length ? results[results.length - 1]._id : null
      };
    } catch (error) {
      console.log({ error })
      throw error;
    }
  }

  async getJobOpportunities(
    filter: Record<string, any> = {},
    limit: number = 10,
    lastId?: string
  ) {
    try {
      const jobOpportunitiesPlugin = await this.stdPluginModel.findOne({ safekey: "job_opportunities" }).lean().exec();

      if (!jobOpportunitiesPlugin) {
        return {
          feeds: [],
          hasMore: false,
          lastId: null
        };
      }

      filter.plugin = jobOpportunitiesPlugin._id;

      const query = this.stdPluginAssetModel.find(filter);

      if (lastId) {
        const lastFeed = await this.stdPluginAssetModel.findById(lastId).lean();
        if (lastFeed) {
          query.where({
            $or: [
              { createdAt: { $lt: lastFeed.createdAt } },
              {
                createdAt: lastFeed.createdAt,
                _id: { $lt: new Types.ObjectId(lastId) }
              }
            ]
          });
        }
      }

      const results = await query
        .sort({ createdAt: -1, _id: -1 })
        .limit(limit)
        .populate({
          path: 'node',
          select: 'name profileImage',
          options: { lean: true }
        })
        .populate({
          path: 'club',
          select: 'name profileImage',
          options: { lean: true }
        })
        .populate({
          path: 'createdBy',
          select: 'userName profileImage firstName lastName',
          options: { lean: true }
        })
        .populate({
          path: 'plugin',
          model: StdPlugin.name,
          select: 'name slug',
          options: {
            lean: true,
            match: { moduleType: StdPluginAsset.name },
            strictPopulate: false
          }
        })
        .lean()
        .exec();

      return {
        feeds: results,
        hasMore: results.length === limit,
        lastId: results.length ? results[results.length - 1]._id : null
      };
    } catch (error) {
      console.log({ error })
      throw error;
    }
  }

  async getBizOpportunities(
    filter: Record<string, any> = {},
    limit: number = 10,
    lastId?: string
  ) {
    try {
      const bizOpportunitiesPlugin = await this.stdPluginModel.findOne({ safekey: "biz_opportunities" }).lean().exec();

      if (!bizOpportunitiesPlugin) {
        return {
          feeds: [],
          hasMore: false,
          lastId: null
        };
      }

      filter.plugin = bizOpportunitiesPlugin._id;

      const query = this.stdPluginAssetModel.find(filter);

      if (lastId) {
        const lastFeed = await this.stdPluginAssetModel.findById(lastId).lean();
        if (lastFeed) {
          query.where({
            $or: [
              { createdAt: { $lt: lastFeed.createdAt } },
              {
                createdAt: lastFeed.createdAt,
                _id: { $lt: new Types.ObjectId(lastId) }
              }
            ]
          });
        }
      }

      const results = await query
        .sort({ createdAt: -1, _id: -1 })
        .limit(limit)
        .populate({
          path: 'node',
          select: 'name profileImage',
          options: { lean: true }
        })
        .populate({
          path: 'club',
          select: 'name profileImage',
          options: { lean: true }
        })
        .populate({
          path: 'createdBy',
          select: 'userName profileImage firstName lastName',
          options: { lean: true }
        })
        .populate({
          path: 'plugin',
          model: StdPlugin.name,
          select: 'name slug',
          options: {
            lean: true,
            match: { moduleType: StdPluginAsset.name },
            strictPopulate: false
          }
        })
        .lean()
        .exec();

      return {
        feeds: results,
        hasMore: results.length === limit,
        lastId: results.length ? results[results.length - 1]._id : null
      };
    } catch (error) {
      console.log({ error })
      throw error;
    }
  }

  async getEvents(
    filter: Record<string, any> = {},
    limit: number = 10,
    lastId?: string
  ) {
    try {
      const eventsPlugin = await this.stdPluginModel.findOne({ safekey: "events" }).lean().exec();

      if (!eventsPlugin) {
        return {
          feeds: [],
          hasMore: false,
          lastId: null
        };
      }

      filter.plugin = eventsPlugin._id;

      const query = this.stdPluginAssetModel.find(filter);

      if (lastId) {
        const lastFeed = await this.stdPluginAssetModel.findById(lastId).lean();
        if (lastFeed) {
          query.where({
            $or: [
              { createdAt: { $lt: lastFeed.createdAt } },
              {
                createdAt: lastFeed.createdAt,
                _id: { $lt: new Types.ObjectId(lastId) }
              }
            ]
          });
        }
      }

      const results = await query
        .sort({ createdAt: -1, _id: -1 })
        .limit(limit)
        .populate({
          path: 'node',
          select: 'name profileImage',
          options: { lean: true }
        })
        .populate({
          path: 'club',
          select: 'name profileImage',
          options: { lean: true }
        })
        .populate({
          path: 'createdBy',
          select: 'userName profileImage firstName lastName',
          options: { lean: true }
        })
        .populate({
          path: 'plugin',
          model: StdPlugin.name,
          select: 'name slug',
          options: {
            lean: true,
            match: { moduleType: StdPluginAsset.name },
            strictPopulate: false
          }
        })
        .lean()
        .exec();

      return {
        feeds: results,
        hasMore: results.length === limit,
        lastId: results.length ? results[results.length - 1]._id : null
      };
    } catch (error) {
      console.log({ error })
      throw error;
    }
  }

  async getMakeItBetter(
    filter: Record<string, any> = {},
    limit: number = 10,
    lastId?: string
  ) {
    try {
      const makeItBetterPlugin = await this.stdPluginModel.findOne({ safekey: "make_it_better" }).lean().exec();

      if (!makeItBetterPlugin) {
        return {
          feeds: [],
          hasMore: false,
          lastId: null
        };
      }

      filter.plugin = makeItBetterPlugin._id;

      const query = this.stdPluginAssetModel.find(filter);

      if (lastId) {
        const lastFeed = await this.stdPluginAssetModel.findById(lastId).lean();
        if (lastFeed) {
          query.where({
            $or: [
              { createdAt: { $lt: lastFeed.createdAt } },
              {
                createdAt: lastFeed.createdAt,
                _id: { $lt: new Types.ObjectId(lastId) }
              }
            ]
          });
        }
      }

      const results = await query
        .sort({ createdAt: -1, _id: -1 })
        .limit(limit)
        .populate({
          path: 'node',
          select: 'name profileImage',
          options: { lean: true }
        })
        .populate({
          path: 'club',
          select: 'name profileImage',
          options: { lean: true }
        })
        .populate({
          path: 'createdBy',
          select: 'userName profileImage firstName lastName',
          options: { lean: true }
        })
        .populate({
          path: 'plugin',
          model: StdPlugin.name,
          select: 'name slug',
          options: {
            lean: true,
            match: { moduleType: StdPluginAsset.name },
            strictPopulate: false
          }
        })
        .lean()
        .exec();

      return {
        feeds: results,
        hasMore: results.length === limit,
        lastId: results.length ? results[results.length - 1]._id : null
      };
    } catch (error) {
      console.log({ error })
      throw error;
    }
  }

  async getCollaborations(
    filter: Record<string, any> = {},
    limit: number = 10,
    lastId?: string
  ) {
    try {
      const collaborationsPlugin = await this.stdPluginModel.findOne({ safekey: "collaborations" }).lean().exec();

      if (!collaborationsPlugin) {
        return {
          feeds: [],
          hasMore: false,
          lastId: null
        };
      }

      filter.plugin = collaborationsPlugin._id;

      const query = this.stdPluginAssetModel.find(filter);

      if (lastId) {
        const lastFeed = await this.stdPluginAssetModel.findById(lastId).lean();
        if (lastFeed) {
          query.where({
            $or: [
              { createdAt: { $lt: lastFeed.createdAt } },
              {
                createdAt: lastFeed.createdAt,
                _id: { $lt: new Types.ObjectId(lastId) }
              }
            ]
          });
        }
      }

      const results = await query
        .sort({ createdAt: -1, _id: -1 })
        .limit(limit)
        .populate({
          path: 'node',
          select: 'name profileImage',
          options: { lean: true }
        })
        .populate({
          path: 'club',
          select: 'name profileImage',
          options: { lean: true }
        })
        .populate({
          path: 'createdBy',
          select: 'userName profileImage firstName lastName',
          options: { lean: true }
        })
        .populate({
          path: 'plugin',
          model: StdPlugin.name,
          select: 'name slug',
          options: {
            lean: true,
            match: { moduleType: StdPluginAsset.name },
            strictPopulate: false
          }
        })
        .lean()
        .exec();

      return {
        feeds: results,
        hasMore: results.length === limit,
        lastId: results.length ? results[results.length - 1]._id : null
      };
    } catch (error) {
      console.log({ error })
      throw error;
    }
  }

  async getLastMinuteSales(
    filter: Record<string, any> = {},
    limit: number = 10,
    lastId?: string
  ) {
    try {
      const lastMinuteSalesPlugin = await this.stdPluginModel.findOne({ safekey: "last_minute_sales" }).lean().exec();

      if (!lastMinuteSalesPlugin) {
        return {
          feeds: [],
          hasMore: false,
          lastId: null
        };
      }

      filter.plugin = lastMinuteSalesPlugin._id;

      const query = this.stdPluginAssetModel.find(filter);

      if (lastId) {
        const lastFeed = await this.stdPluginAssetModel.findById(lastId).lean();
        if (lastFeed) {
          query.where({
            $or: [
              { createdAt: { $lt: lastFeed.createdAt } },
              {
                createdAt: lastFeed.createdAt,
                _id: { $lt: new Types.ObjectId(lastId) }
              }
            ]
          });
        }
      }

      const results = await query
        .sort({ createdAt: -1, _id: -1 })
        .limit(limit)
        .populate({
          path: 'node',
          select: 'name profileImage',
          options: { lean: true }
        })
        .populate({
          path: 'club',
          select: 'name profileImage',
          options: { lean: true }
        })
        .populate({
          path: 'createdBy',
          select: 'userName profileImage firstName lastName',
          options: { lean: true }
        })
        .populate({
          path: 'plugin',
          model: StdPlugin.name,
          select: 'name slug',
          options: {
            lean: true,
            match: { moduleType: StdPluginAsset.name },
            strictPopulate: false
          }
        })
        .lean()
        .exec();

      return {
        feeds: results,
        hasMore: results.length === limit,
        lastId: results.length ? results[results.length - 1]._id : null
      };
    } catch (error) {
      console.log({ error })
      throw error;
    }
  }

  async getSuperDeals(
    filter: Record<string, any> = {},
    limit: number = 10,
    lastId?: string
  ) {
    try {

      const superDealsPlugin = await this.stdPluginModel.findOne({ safekey: "super_deals" }).lean().exec();

      if (!superDealsPlugin) {
        return {
          feeds: [],
          hasMore: false,
          lastId: null
        };
      }

      filter.plugin = superDealsPlugin._id;

      const query = this.stdPluginAssetModel.find(filter);

      if (lastId) {
        const lastFeed = await this.stdPluginAssetModel.findById(lastId).lean();
        if (lastFeed) {
          query.where({
            $or: [
              { createdAt: { $lt: lastFeed.createdAt } },
              {
                createdAt: lastFeed.createdAt,
                _id: { $lt: new Types.ObjectId(lastId) }
              }
            ]
          });
        }
      }

      const results = await query
        .sort({ createdAt: -1, _id: -1 })
        .limit(limit)
        .populate({
          path: 'node',
          select: 'name profileImage',
          options: { lean: true }
        })
        .populate({
          path: 'club',
          select: 'name profileImage',
          options: { lean: true }
        })
        .populate({
          path: 'createdBy',
          select: 'userName profileImage firstName lastName',
          options: { lean: true }
        })
        .populate({
          path: 'plugin',
          model: StdPlugin.name,
          select: 'name slug',
          options: {
            lean: true,
            match: { moduleType: StdPluginAsset.name },
            strictPopulate: false
          }
        })
        .lean()
        .exec();

      return {
        feeds: results,
        hasMore: results.length === limit,
        lastId: results.length ? results[results.length - 1]._id : null
      };

    } catch (error) {
      console.log({ error })
      throw error;
    }
  }


  async getResourcesOnHire(
    filter: Record<string, any> = {},
    limit: number = 10,
    lastId?: string
  ) {
    try {

      const resourcesOnHirePlugin = await this.stdPluginModel.findOne({ safekey: "resources_on_hire" }).lean().exec();

      if (!resourcesOnHirePlugin) {
        return {
          feeds: [],
          hasMore: false,
          lastId: null
        };
      }

      filter.plugin = resourcesOnHirePlugin._id;

      const query = this.stdPluginAssetModel.find(filter);

      if (lastId) {
        const lastFeed = await this.stdPluginAssetModel.findById(lastId).lean();
        if (lastFeed) {
          query.where({
            $or: [
              { createdAt: { $lt: lastFeed.createdAt } },
              {
                createdAt: lastFeed.createdAt,
                _id: { $lt: new Types.ObjectId(lastId) }
              }
            ]
          });
        }
      }

      const results = await query
        .sort({ createdAt: -1, _id: -1 })
        .limit(limit)
        .populate({
          path: 'node',
          select: 'name profileImage',
          options: { lean: true }
        })
        .populate({
          path: 'club',
          select: 'name profileImage',
          options: { lean: true }
        })
        .populate({
          path: 'createdBy',
          select: 'userName profileImage firstName lastName',
          options: { lean: true }
        })
        .populate({
          path: 'plugin',
          model: StdPlugin.name,
          select: 'name slug',
          options: {
            lean: true,
            match: { moduleType: StdPluginAsset.name },
            strictPopulate: false
          }
        })
        .lean()
        .exec();

      return {
        feeds: results,
        hasMore: results.length === limit,
        lastId: results.length ? results[results.length - 1]._id : null
      };

    } catch (error) {
      console.log({ error })
      throw error;
    }
  }

  async createCustomerConnect(body: {
    title: string;
    description: string;
    dates?: string;
    files?: Express.Multer.File[];
    forumType: "club" | "node";
    forumId: string;
  }, userId: string) {
    try {

      let forum;

      if (body.forumType === "club") {
        forum = await this.clubModel.findById(body.forumId).lean().exec();
      } else if (body.forumType === "node") {
        forum = await this.nodeModel.findById(body.forumId).lean().exec();
      }

      if (!forum) {
        throw new NotFoundException(`${body.forumType} not found`);
      }

      let fileObjects = [];
      if (body.files && body.files.length > 0) {
        const uploadPromises = body.files.map((file: any) =>
          this.uploadFile({
            buffer: file.buffer,
            originalname: file.originalname,
            mimetype: file.mimetype,
          } as Express.Multer.File, body.forumType),
        );
        const uploadedFiles = await Promise.all(uploadPromises);
        fileObjects = uploadedFiles.map((uploadedFile, index) => ({
          url: uploadedFile.url,
          originalname: body.files[index].originalname,
          mimetype: body.files[index].mimetype,
          size: body.files[index].size,
        }));
      }

      const postData: Record<string, any> = {
        title: body.title,
        description: body.description,
        ...(body.dates && { dates: body.dates }),
        createdBy: new Types.ObjectId(userId),
        createdAt: new Date(),
        files: fileObjects,
      }

      const query: Record<string, any> = {}

      if (body.forumType === "club") {
        query.club = forum._id
      } else if (body.forumType === "node") {
        query.node = forum._id
      }

      const existedCustomerConnect = await this.customerConnectModel.findOne(query).lean().exec();

      let customerConnect;

      if (!existedCustomerConnect) {
        customerConnect = await this.customerConnectModel.create({
          data: postData,
          ...(body.forumType === "club" && { club: forum._id }),
          ...(body.forumType === "node" && { node: forum._id }),
        });
      } else {
        customerConnect = await this.customerConnectModel.findOneAndUpdate(query, { $push: { data: postData } }, { new: true });
      }

      const subscriberIds = customerConnect?.subscribers.map((subscriber) => subscriber.user.toString()) || [];
      const notificationMessage = `You have new announcement in`;
      const emitCustomerConnectAnnouncementProps: EmitCustomerConnectAnnouncementProps = {
        forum: {
          type: body.forumType,
          id: forum._id.toString(),
        },
        from: userId.toString(),
        message: notificationMessage,
        memberIds: subscriberIds,
      };

      await this.notificationEventsService.emitCustomerConnectAnnouncement(
        emitCustomerConnectAnnouncementProps,
      );

      return {
        data: customerConnect,
        message: "Customer connect created successfully",
        success: true,
      };
    } catch (error) {
      console.log({ error })

      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw error;
    }
  }

  async getCustomerConnect(
    filter: Record<string, any> = {},
    limit = 10,
    userId: string,
    lastDataId?: string,
  ) {
    try {
      // Fetch the full connect doc (with populated fields)
      const connect = await this.customerConnectModel
        .findOne(filter)
        .populate({
          path: 'club',
          select: 'name profileImage',
          options: { lean: true },
        })
        .populate({
          path: 'node',
          select: 'name profileImage',
          options: { lean: true },
        })
        .populate({
          path: 'data.createdBy',
          select: 'userName firstName lastName profileImage',
          options: { lean: true },
        })
        .lean();

      if (!connect) {
        return {
          connect: null,
          hasMore: false,
          lastId: null,
          isUserSubscribed: false,
        };
      }

      const isUserSubscribed = connect.subscribers.some(
        (subscriber) => subscriber.user.toString() === userId.toString()
      );

      // Sort data by createdAt and _id descending
      let sortedData = (connect.data || []).sort((a, b) => {
        const dateDiff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        if (dateDiff !== 0) return dateDiff;
        return b._id.toString().localeCompare(a._id.toString());
      });

      // Paginate based on lastDataId
      if (lastDataId) {
        const index = sortedData.findIndex(
          (item) => item._id.toString() === lastDataId
        );
        if (index >= 0) sortedData = sortedData.slice(index + 1);
      }

      const paginatedData = sortedData.slice(0, limit);
      const lastId =
        paginatedData.length > 0
          ? paginatedData[paginatedData.length - 1]._id
          : null;

      const hasMore = sortedData.length > limit;

      // Get followers count before deleting subscribers
      const followersCount = connect.subscribers?.length || 0;

      // Replace full data with only paginated slice
      connect.data = paginatedData;
      delete connect.subscribers;

      // Attach pagination metadata directly to the response
      return {
        connect,
        hasMore,
        lastId,
        isUserSubscribed,
        followersCount,
      };
    } catch (error) {
      console.error('Error in getCustomerConnect:', error);
      throw error;
    }
  }

  async deleteCustomerConnect(body: {
    dataId: string
    forumType: "club" | "node"
    forumId: string
  }) {
    try {
      const query: Record<string, any> = {};
      if (body.forumType === "club") query.club = new Types.ObjectId(body.forumId);
      else query.node = new Types.ObjectId(body.forumId);

      const updated = await this.customerConnectModel.findOneAndUpdate(
        query,
        { $pull: { data: { _id: new Types.ObjectId(body.dataId) } } },
        { new: true }
      );

      if (!updated) {
        throw new NotFoundException('CustomerConnect not found for the given forum');
      }

      return {
        message: 'CustomerConnect deleted successfully',
        success: true,
      };
    } catch (error) {
      console.error('Error in deleteCustomerConnect:', error);
      throw error;
    }
  }

  async manageFollow(
    body: {
      forumType: "club" | "node"
      forumId: string
      action: "follow" | "unfollow"
    },
    userId: string
  ) {
    try {
      const query: Record<string, any> = {};
      if (body.forumType === "club") query.club = new Types.ObjectId(body.forumId);
      else query.node = new Types.ObjectId(body.forumId);

      const userObjectId = new Types.ObjectId(userId);

      // Try finding the connect doc first
      let customerConnect = await this.customerConnectModel.findOne(query);

      // Create if not exists
      if (!customerConnect) {
        customerConnect = await this.customerConnectModel.create({
          ...query,
          subscribers: body.action === "follow" ? [{ user: userObjectId, date: new Date() }] : [],
        });
        return {
          message: "CustomerConnect created and followed successfully",
          success: true,
        };
      }

      // Check if user already subscribed
      const isSubscribed = customerConnect.subscribers.some(
        (s) => s.user.toString() === userId.toString()
      );

      let updated;

      if (isSubscribed && body.action === "unfollow") {
        updated = await this.customerConnectModel.findOneAndUpdate(
          query,
          { $pull: { subscribers: { user: userObjectId } } },
          { new: true }
        );
      } else if (!isSubscribed && body.action === "follow") {
        updated = await this.customerConnectModel.findOneAndUpdate(
          query,
          { $push: { subscribers: { user: userObjectId, date: new Date() } } },
          { new: true }
        );
      } else {
        return {
          message: `Already ${body.action}ed`,
          success: false,
        };
      }


      return {
        message: `CustomerConnect ${body.action}ed successfully`,
        success: true,
      };
    } catch (error) {
      console.error("Error in manageFollow:", error);
      throw error;
    }
  }

  async forumCreateCampaign(body: {
    title: string;
    description: string;
    dates?: string;
    forumType: "club" | "node";
    forumId: string;
  }, userId: string) {
    try {

      let forum;

      if (body.forumType === "club") {
        forum = await this.clubModel.findById(body.forumId).lean().exec();
      } else if (body.forumType === "node") {
        forum = await this.nodeModel.findById(body.forumId).lean().exec();
      }

      if (!forum) {
        throw new NotFoundException(`${body.forumType} not found`);
      }

      const postData: Record<string, any> = {
        title: body.title,
        description: body.description,
        ...(body.dates && { dates: body.dates }),
        createdBy: new Types.ObjectId(userId),
        createdAt: new Date(),
      }

      const query: Record<string, any> = {}

      if (body.forumType === "club") {
        query.club = forum._id
      } else if (body.forumType === "node") {
        query.node = forum._id
      }

      const existedCampaign = await this.forumCampaignModel.findOne(query).lean().exec();

      let campaign;

      if (!existedCampaign) {
        campaign = await this.forumCampaignModel.create({
          data: postData,
          ...(body.forumType === "club" && { club: forum._id }),
          ...(body.forumType === "node" && { node: forum._id }),
        });
      } else {
        campaign = await this.forumCampaignModel.findOneAndUpdate(query, { $push: { data: postData } }, { new: true });
      }

      return {
        data: campaign,
        message: "Campaign created successfully",
        success: true,
      };
    } catch (error) {
      console.log({ error })

      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw error;
    }
  }

  async getForumCampaign(
    filter: Record<string, any> = {},
    limit = 10,
    userId: string,
    lastDataId?: string,
  ) {
    try {
      // Fetch the full connect doc (with populated fields)
      const campaign = await this.forumCampaignModel
        .findOne(filter)
        .populate({
          path: 'club',
          select: 'name profileImage',
          options: { lean: true },
        })
        .populate({
          path: 'node',
          select: 'name profileImage',
          options: { lean: true },
        })
        .populate({
          path: 'data.createdBy',
          select: 'userName firstName lastName profileImage',
          options: { lean: true },
        })
        .lean();

      if (!campaign) {
        return {
          campaign: null,
          hasMore: false,
          lastId: null,
        };
      }

      // Sort data by createdAt and _id descending
      let sortedData = (campaign.data || []).sort((a, b) => {
        const dateDiff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        if (dateDiff !== 0) return dateDiff;
        return b._id.toString().localeCompare(a._id.toString());
      });

      // Paginate based on lastDataId
      if (lastDataId) {
        const index = sortedData.findIndex(
          (item) => item._id.toString() === lastDataId
        );
        if (index >= 0) sortedData = sortedData.slice(index + 1);
      }

      const paginatedData = sortedData.slice(0, limit);
      const lastId =
        paginatedData.length > 0
          ? paginatedData[paginatedData.length - 1]._id
          : null;

      const hasMore = sortedData.length > limit;

      // Replace full data with only paginated slice
      campaign.data = paginatedData;

      // Attach pagination metadata directly to the response
      return {
        campaign,
        hasMore,
        lastId,
      };
    } catch (error) {
      console.error('Error in getForumCampaign:', error);
      throw error;
    }
  }

  async deleteForumCampaign(body: {
    dataId: string
    forumType: "club" | "node"
    forumId: string
  }) {
    try {
      const query: Record<string, any> = {};
      if (body.forumType === "club") query.club = new Types.ObjectId(body.forumId);
      else query.node = new Types.ObjectId(body.forumId);

      const updated = await this.forumCampaignModel.findOneAndUpdate(
        query,
        { $pull: { data: { _id: new Types.ObjectId(body.dataId) } } },
        { new: true }
      );

      if (!updated) {
        throw new NotFoundException('Campaign not found for the given forum');
      }

      return {
        message: 'Campaign deleted successfully',
        success: true,
      };
    } catch (error) {
      console.error('Error in deleteCampaign:', error);
      throw error;
    }
  }


  private async uploadFile(file: Express.Multer.File, forum: "club" | "node") {
    try {
      //uploading file
      const response = await this.uploadService.uploadFile(
        file.buffer,
        file.originalname,
        file.mimetype,
        forum,
      );
      return response;
    } catch (error) {
      console.log(error)
      throw new BadRequestException(
        'Failed to upload file. Please try again later.',
      );
    }
  }

  private async deleteFiles(urls: string[]) {
    try {
      //uploading file
      const deletePromises = urls.map((url: string) =>
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


  @Cron(CronExpression.EVERY_HOUR)
  async handleFeedScores() {
    try {
      console.log("Starting handleFeedScores");
      const batchSize = 500; // Process feeds in batches to avoid memory issues
      let skip = 0;
      let processedCount = 0;

      do {
        console.log(`Processing batch starting at ${skip}`);

        // Fetch feeds with populated assets in batches
        const feeds = await this.feedModel.find()
          .populate('assetId')
          .skip(skip)
          .limit(batchSize)
          .lean<IFeed[]>()
          .exec();

        if (feeds.length === 0) break;

        // Pre-fetch comment counts for all feeds in this batch
        const commentCounts = await this.getCommentCountsForFeeds(feeds);

        // Prepare bulk update operations
        const bulkOps = feeds.map(feed => {
          if (!feed.assetId) return null;

          const asset = feed.assetId;
          const commentCount = commentCounts.get(feed._id.toString()) || 0;

          const releventCount = asset.relevant?.length || 0;
          const irrelevantCount = asset.irrelevant?.length || 0;
          const adoptNodeCount = asset.adoptedNodes?.length || 0;
          const adoptClubCount = asset.adoptedClubs?.length || 0;
          const adoptionCount = adoptNodeCount + adoptClubCount;

          const totalScore = (
            (adoptionCount * SCORE_WEIGHTS.ADOPTION) +
            (commentCount * SCORE_WEIGHTS.COMMENT) +
            (releventCount * SCORE_WEIGHTS.RELEVANT) +
            (irrelevantCount * SCORE_WEIGHTS.IRRELEVANT)
          );

          // 1. Calculate age in hours (ensure feed has createdAt field)
          const ageInHours = (Date.now() - new Date(asset.createdAt).getTime()) / 3_600_000;

          const gravity = 1.1; // Adjust decay strength (1.5-2.0 typical)
          const decayedScore = totalScore / Math.pow(ageInHours + 2, gravity);

          // 3. Apply non-negative clamp (combines decay + your existing sanitization)
          // const sanitizedScore = Math.max(0, decayedScore);
          const sanitizedScore = Math.max(0, decayedScore);

          return {
            updateOne: {
              filter: { _id: feed._id },
              update: { $set: { score: sanitizedScore } }
            }
          };
        }).filter(op => op !== null);

        // Execute bulk write operation
        if (bulkOps.length > 0) {
          await this.feedModel.bulkWrite(bulkOps);
        }

        processedCount += feeds.length;
        skip += batchSize;
        console.log(`Processed ${processedCount} feeds so far`);
      } while (true);

      console.log(`Completed handleFeedScores. Total processed: ${processedCount}`);
    } catch (error) {
      console.error('Error in handleFeedScores:', error);
      // Consider adding error reporting (Sentry, etc.)
      throw error; // Re-throw to allow for retry mechanisms
    }
  }

  // Helper method to get comment counts efficiently
  async getCommentCountsForFeeds(feeds: IFeed[]): Promise<Map<string, number>> {
    const commentCountMap = new Map<string, number>();

    // Separate adopted and original feeds for efficient querying
    const adoptedFeeds = feeds.filter(f => f.feedType === 'adopted' && f.adoptionId);
    const originalFeeds = feeds.filter(f => f.feedType === 'original' && f.assetId?._id);

    // Count comments for adopted feeds
    if (adoptedFeeds.length > 0) {
      const adoptionIds = adoptedFeeds.map(f => f.adoptionId);
      const adoptedComments = await this.commentModel.aggregate([
        { $match: { "entity.entityId": { $in: adoptionIds } } },
        { $group: { _id: "$entity.entityId", count: { $sum: 1 } } }
      ]);

      adoptedComments.forEach(({ _id, count }) => {
        adoptedFeeds
          .filter(f => f.adoptionId.equals(_id))
          .forEach(f => commentCountMap.set(f._id.toString(), count));
      });
    }

    // Count comments for original feeds
    if (originalFeeds.length > 0) {
      const assetIds = originalFeeds.map(f => f.assetId._id);
      const originalComments = await this.commentModel.aggregate([
        { $match: { "entity.entityId": { $in: assetIds } } },
        { $group: { _id: "$entity.entityId", count: { $sum: 1 } } }
      ]);

      originalComments.forEach(({ _id, count }) => {
        originalFeeds
          .filter(f => f.assetId._id.equals(_id))
          .forEach(f => commentCountMap.set(f._id.toString(), count));
      });
    }

    return commentCountMap;
  }

  // ========== CACHE MANAGEMENT ========== //
  private getSingleFeedCacheKey(feedId: string): string {
    return `feed:${feedId}`;
  }

  private getListCacheKey(
    filter: Record<string, any>,
    limit: number,
    lastId?: string
  ): string {
    const filterString = JSON.stringify(filter);
    return `feeds:${filterString}:${limit}:${lastId || 'first'}`;
  }

  private trackCacheKeys(filter: Record<string, any>, cacheKey: string): void {
    if (filter.forum) {
      this.addToRegistry(`forum:${filter.forum}`, cacheKey);
    }
    if (filter.forumType) {
      this.addToRegistry(`forumType:${filter.forumType}`, cacheKey);
    }
    if (filter.moduleType) {
      this.addToRegistry(`moduleType:${filter.moduleType}`, cacheKey);
    }
  }

  private addToRegistry(baseKey: string, cacheKey: string): void {
    const keys = this.cacheKeyRegistry.get(baseKey) || new Set<string>();
    keys.add(cacheKey);
    this.cacheKeyRegistry.set(baseKey, keys);
  }

  private async invalidateCachesForFeed(feed: Feed): Promise<void> {
    await this.cacheManager.del(this.getSingleFeedCacheKey(feed._id.toString()));

    const invalidationPromises = [];

    if (feed.forum) {
      invalidationPromises.push(this.invalidateByBaseKey(`forum:${feed.forum}`));
    }
    if (feed.forumType) {
      invalidationPromises.push(this.invalidateByBaseKey(`forumType:${feed.forumType}`));
    }
    if (feed.moduleType) {
      invalidationPromises.push(this.invalidateByBaseKey(`moduleType:${feed.moduleType}`));
    }

    await Promise.all(invalidationPromises);
  }

  private async invalidateByBaseKey(baseKey: string): Promise<void> {
    const keys = this.cacheKeyRegistry.get(baseKey);
    if (keys) {
      await Promise.all(
        Array.from(keys).map(key => this.cacheManager.del(key))
      );
      this.cacheKeyRegistry.delete(baseKey);
    }
  }

  /**
   * Restriction for assets with limit and window days
   * @param userId - User creating the asset
   * @param session - Optional MongoDB session from asset creation
   */
  async checkAndIncrement(userId: Types.ObjectId, session?: ClientSession) {
    const configuration = await this.configurationModel.findOne({});
    let assetCreationCount = configuration?.assetCreationCount || 10;
    const user = await this.userModel.findById(userId).session(session);

    if (!user) throw new ForbiddenException('User not found.');

    // Check current count
    if (user?.assetCreatedCount >= assetCreationCount) {
      const daysUntilReset = await this.getDaysUntilSaturdayUTC();
      throw new ForbiddenException(
        `You have reached your limit of ${assetCreationCount} assets. Try again after ${daysUntilReset} day${daysUntilReset > 1 ? 's' : ''}.`,
      );
    }

    // Increment the counter and save
    user.assetCreatedCount += 1;
    await user.save({ session });
  }

  @Cron('0 0 * * 6')
  async resetExpiredAssetCounts() {
    try {
      // Find and reset users whose counter window expired
      const result = await this.userModel.updateMany(
        {},
        { assetCreatedCount: 0 },
      );

      if (result.modifiedCount > 0) {
        this.logger.log(`✅ Reset asset counts for ${result.modifiedCount} users`);
      }
    } catch (error) {
      this.logger.error('❌ Failed to reset asset counts', error);
    }
  }

  private async getDaysUntilSaturdayUTC(): Promise<number> {
    const today = new Date();
    const utcDay = today.getUTCDay(); // 0 = Sunday, 6 = Saturday
    const daysUntil = (6 - utcDay + 7) % 7;
    return daysUntil === 0 ? 7 : daysUntil; // if today is Saturday, next Saturday = 7 days away
  }



  @Cron(CronExpression.EVERY_HOUR)
  async calculateForumMemoryUsage() {
    try {
      const forums = [
        ...(await this.nodeModel.find({})).map(f => ({ ...f.toObject(), forumType: 'node' })),
        ...(await this.clubModel.find({})).map(f => ({ ...f.toObject(), forumType: 'club' })),
      ];

      const memoryUsages = await Promise.all(
        forums.map(async forum => {
          const memory = await this.getMemoryUsage(forum._id.toString(), forum.forumType as 'node' | 'club');
          return {
            _id: forum._id,
            forumType: forum.forumType,
            memoryUsageInBytes: memory,
          };
        }),
      );

      const nodeMemoryUsages = memoryUsages.filter(m => m.forumType === 'node');
      const clubMemoryUsages = memoryUsages.filter(m => m.forumType === 'club');

      // For nodes
      await this.nodeModel.bulkWrite(
        nodeMemoryUsages.map(m => ({
          updateOne: {
            filter: { _id: m._id },
            update: { $set: { memoryUsageInBytes: m.memoryUsageInBytes } },
          },
        })),
      );

      // For clubs
      await this.clubModel.bulkWrite(
        clubMemoryUsages.map(m => ({
          updateOne: {
            filter: { _id: m._id },
            update: { $set: { memoryUsageInBytes: m.memoryUsageInBytes } },
          },
        })),
      );

      // Now memoryUsages is an array like [{ _id, forumType, memoryUsageInBytes }, ...]
      // You can use this to updateMany in your DB
      // console.log(nodeMemoryUsages);
      // console.log(clubMemoryUsages);
      // console.log(memoryUsages);
      return memoryUsages;
    } catch (error) {
      this.logger.error('❌ Failed to calculate memory usage', error);
      throw error;
    }
  }

  private async getMemoryUsage(forumId: string, forumType: 'node' | 'club') {
    try {
      // If you have specific models per forum type, you can adjust here
      const calculations = await Promise.all([
        this.calculateModelMemory(this.rulesRegulationsModel, forumId, forumType, item => item.files),
        this.calculateModelMemory(this.issueModel, forumId, forumType, item => item.files),
        this.calculateModelMemory(this.debateModel, forumId, forumType, item => item.files),
        this.calculateModelMemory(this.genericPostModel, forumId, forumType, item => item.files),
        this.calculateModelMemory(this.stdPluginAssetModel, forumId, forumType, item => (item.data as any)?.files),
      ]);

      const totalFilesSizeInBytes = calculations.reduce((sum, size) => sum + size, 0);

      return totalFilesSizeInBytes;
    } catch (error) {
      this.logger.error('❌ Failed to get memory usage for forum', { forumId, forumType, error });
      throw error;
    }
  }

  private async calculateModelMemory(
    model: any,
    forumId: string,
    forumType: 'node' | 'club',
    filesExtractor: (item: any) => any[],
  ): Promise<number> {
    // Assuming your model has `node` or `club` reference field, adjust accordingly
    const queryField = forumType === 'node' ? 'node' : 'club';

    const items = await model.find({
      [queryField]: new Types.ObjectId(forumId),
      isDeleted: false,
    });

    return items.reduce((total: number, item: any) => {
      const files = Array.isArray(filesExtractor(item)) ? filesExtractor(item) : [];
      return total + files.reduce((sum: number, file: any) => sum + (file?.size || 0), 0);
    }, 0);
  }

}