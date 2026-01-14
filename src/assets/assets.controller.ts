import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AssetsService } from './assets.service';
import { Request } from 'express';
import { BookmarksService } from '../user/bookmarks/bookmarks.service';
import { Types } from 'mongoose';
import { FORUM_TYPE_MAP, MODULE_TYPE_MAP } from '../utils/text';

@ApiTags('Assets')
@ApiBearerAuth()
@Controller('assets')
export class AssetsController {
  constructor(
    private readonly assetsService: AssetsService,
    private readonly bookmarkService: BookmarksService,
  ) { }
  @Get('feed')
  async getFeed(
    @Query('entity') entity: 'club' | 'node',
    @Query('entityId') entityId: string,
    @Query('page') page: number,
    @Query('limit') limit: number,
    @Req() req: Request
  ) {
    const user = req.user;

    // Get assets for the entity
    const assets = await this.assetsService.getAssetsByEntity(entity, entityId, page, Number(limit));

    // If no items, return the original pagination structure with empty items
    if (!assets.items.length) {
      return assets;
    }

    // Prepare entities array for bookmark check
    const entitiesToCheck = assets.items.map(asset => ({
      id: asset._id.toString(),
      type: asset.type,
    }));

    // Get bookmark status for all assets
    const bookmarkStatus = await this.bookmarkService.checkBookmarkStatus(
      user._id.toString(),
      entitiesToCheck,
    );


    // Update items with bookmark status while keeping the pagination structure
    return {
      ...assets,
      items: assets.items.map(asset => {
        const bookmarkInfo = bookmarkStatus.find(
          status =>
            status.entityId === asset._id.toString() &&
            status.entityType === asset.type
        );

        return {
          ...asset,
          isBookmarked: bookmarkInfo?.isBookmarked || false,
        };
      })
    };
  }


  @Post('relevancy')
  async toggleRelevancy(
    @Body() body: {
      type: 'project' | 'issues' | 'debate',
      moduleId: string,
      action: 'like' | 'dislike'
    },
    @Req() request: Request
  ) {
    return this.assetsService.feedRelevancyAction(
      body.type,
      body.moduleId,
      body.action,
      request.user._id
    );
  }

  @Get('feeds')
  async getFeeds(
    @Query('filter') filterCondition: 'all' | 'forum',
    @Query('forumId') forumId?: string,
    @Query('forumType') forumType?: string,
    @Query('moduleType') moduleType?: string,
    @Query('limit') limit?: string,
    @Query('lastId') lastId?: string
  ) {
    // Build filter object from query params
    const filter: Record<string, any> = {
      status: "published",
    };

    if (forumId) {
      filter.forum = new Types.ObjectId(forumId);
    }

    if (forumType) {
      filter.forumType = FORUM_TYPE_MAP.get(forumType);
    }

    if (moduleType) {
      filter.moduleType = MODULE_TYPE_MAP.get(moduleType);
    }

    if (filterCondition === 'forum') {
      filter.feedType = "original";
    }

    // Parse limit with fallback to default 20
    const parsedLimit = limit ? parseInt(limit, 10) : 10;

    console.log({ filter, parsedLimit, lastId })

    return this.assetsService.getPaginatedFeeds(
      filter,
      parsedLimit,
      lastId
    );
  }

  @Post('feeds/relevancy')
  async toggleFeedsRelevancy(
    @Body() body: {
      type: 'Projects' | 'Issues' | 'Debate' | 'RulesRegulations' | 'StdPluginAsset' | 'GenericPost',
      moduleId: string,
      action: 'like' | 'dislike'
    },
    @Req() request: Request
  ) {
    return this.assetsService.feedRelevancyActions(
      body.type,
      body.moduleId,
      body.action,
      request.user._id
    );
  }

  @Get('product-services')
  async getProductServices(
    @Query('forumId') forumId?: string,
    @Query('forumType') forumType?: string,
    @Query('limit') limit?: string,
    @Query('lastId') lastId?: string
  ) {
    const filter: Record<string, any> = {
      publishedStatus: "published",
    };

    if (forumId) {
      filter[forumType] = new Types.ObjectId(forumId);
    }

    const parsedLimit = limit ? parseInt(limit, 10) : 10;

    return this.assetsService.getProductServices(filter, parsedLimit, lastId);
  }

  @Get('job-opportunities')
  async getJobOpportunities(
    @Query('forumId') forumId?: string,
    @Query('forumType') forumType?: string,
    @Query('limit') limit?: string,
    @Query('lastId') lastId?: string
  ) {
    const filter: Record<string, any> = {
      publishedStatus: "published",
    };

    if (forumId) {
      filter[forumType] = new Types.ObjectId(forumId);
    }

    const parsedLimit = limit ? parseInt(limit, 10) : 10;

    return this.assetsService.getJobOpportunities(filter, parsedLimit, lastId);
  }

  @Get('biz-opportunities')
  async getBizOpportunities(
    @Query('forumId') forumId?: string,
    @Query('forumType') forumType?: string,
    @Query('limit') limit?: string,
    @Query('lastId') lastId?: string
  ) {
    const filter: Record<string, any> = {
      publishedStatus: "published",
    };

    if (forumId) {
      filter[forumType] = new Types.ObjectId(forumId);
    }

    const parsedLimit = limit ? parseInt(limit, 10) : 10;

    return this.assetsService.getBizOpportunities(filter, parsedLimit, lastId);
  }

  @Get('events')
  async getEvents(
    @Query('forumId') forumId?: string,
    @Query('forumType') forumType?: string,
    @Query('limit') limit?: string,
    @Query('lastId') lastId?: string
  ) {
    const filter: Record<string, any> = {
      publishedStatus: "published",
    };

    if (forumId) {
      filter[forumType] = new Types.ObjectId(forumId);
    }

    const parsedLimit = limit ? parseInt(limit, 10) : 10;

    return this.assetsService.getEvents(filter, parsedLimit, lastId);
  }

  @Get('make-it-better')
  async getMakeItBetter(
    @Query('forumId') forumId?: string,
    @Query('forumType') forumType?: string,
    @Query('limit') limit?: string,
    @Query('lastId') lastId?: string
  ) {
    const filter: Record<string, any> = {
      publishedStatus: "published",
    };

    if (forumId) {
      filter[forumType] = new Types.ObjectId(forumId);
    }

    const parsedLimit = limit ? parseInt(limit, 10) : 10;

    return this.assetsService.getMakeItBetter(filter, parsedLimit, lastId);
  }

  @Get('collaborations')
  async getCollaborations(
    @Query('forumId') forumId?: string,
    @Query('forumType') forumType?: string,
    @Query('limit') limit?: string,
    @Query('lastId') lastId?: string
  ) {
    const filter: Record<string, any> = {
      publishedStatus: "published",
    };

    if (forumId) {
      filter[forumType] = new Types.ObjectId(forumId);
    }

    const parsedLimit = limit ? parseInt(limit, 10) : 10;

    return this.assetsService.getCollaborations(filter, parsedLimit, lastId);
  }

  @Get('last-minute-sales')
  async getLastMinuteSales(
    @Query('forumId') forumId?: string,
    @Query('forumType') forumType?: string,
    @Query('limit') limit?: string,
    @Query('lastId') lastId?: string
  ) {
    const filter: Record<string, any> = {
      publishedStatus: "published",
    };

    if (forumId) {
      filter[forumType] = new Types.ObjectId(forumId);
    }

    const parsedLimit = limit ? parseInt(limit, 10) : 10;

    return this.assetsService.getLastMinuteSales(filter, parsedLimit, lastId);
  }

  @Get('super-deals')
  async getSuperDeals(
    @Query('forumId') forumId?: string,
    @Query('forumType') forumType?: string,
    @Query('limit') limit?: string,
    @Query('lastId') lastId?: string
  ) {
    const filter: Record<string, any> = {
      publishedStatus: "published",
    };

    if (forumId) {
      filter[forumType] = new Types.ObjectId(forumId);
    }

    const parsedLimit = limit ? parseInt(limit, 10) : 10;

    return this.assetsService.getSuperDeals(filter, parsedLimit, lastId);
  }

  @Get('resources-on-hire')
  async getResourcesOnHire(
    @Query('forumId') forumId?: string,
    @Query('forumType') forumType?: string,
    @Query('limit') limit?: string,
    @Query('lastId') lastId?: string
  ) {
    const filter: Record<string, any> = {
      publishedStatus: "published",
    };

    if (forumId) {
      filter[forumType] = new Types.ObjectId(forumId);
    }

    const parsedLimit = limit ? parseInt(limit, 10) : 10;

    return this.assetsService.getResourcesOnHire(filter, parsedLimit, lastId);
  }
}
