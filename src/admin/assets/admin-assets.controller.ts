import { Controller, Get, Param, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { Types } from 'mongoose';
import { AdminAssetsService } from './admin-assets.service';
import { AuthorizationService } from 'src/user/auth/authorization.service';

@ApiTags('Admin - Assets')
@ApiBearerAuth()
@Controller('admin/assets')
export class AdminAssetsController {
  constructor(private readonly adminAssetsService: AdminAssetsService,
    private readonly authorizationService: AuthorizationService) { }

  @Get('standard/slug/:slug')
  async getStandardAssetBySlug(
    @Req() req: Request,
    @Param('slug') slug: string,
    @Query('adoptionId') adoptionId?: string,
    @Query('chapterAlyId') chapterAlyId?: string
  ) {
    await this.authorizationService.validateAdmin(req?.user?._id);
    return this.adminAssetsService.getStandardAssetBySlug(req?.user?._id, slug, adoptionId, chapterAlyId);
  }

  @Get('rules/:ruleId')
  async getRule(
    @Req() req: Request,
    @Param('ruleId') ruleId: Types.ObjectId,
    @Query('adoptionId') adoptionId?: Types.ObjectId
  ) {
    await this.authorizationService.validateAdmin(req?.user?._id);
    return this.adminAssetsService.getRule(req?.user?._id, ruleId, adoptionId);
  }

  @Get('issues/:issueId')
  async getIssue(
    @Req() req: Request,
    @Param('issueId') issueId: string,
    @Query('adoptionId') adoptionId?: string,
    @Query('chapterAlyId') chapterAlyId?: string
  ) {
    await this.authorizationService.validateAdmin(req?.user?._id);
    return this.adminAssetsService.getIssue(req?.user?._id, new Types.ObjectId(issueId), adoptionId, chapterAlyId);
  }

  @Get('debates/:debateId')
  async getDebate(
    @Req() req: Request,
    @Param('debateId') debateId: string,
    @Query('adoptionId') adoptionId?: string,
    @Query('chapterAlyId') chapterAlyId?: string
  ) {
    await this.authorizationService.validateAdmin(req?.user?._id);
    return this.adminAssetsService.getDebate(req?.user?._id, debateId, adoptionId, chapterAlyId);
  }

  @Get('debates/replies/:parentId')
  async getRepliesForParent(
    @Req() req: Request,
    @Param('parentId') parentId: string
  ) {
    await this.authorizationService.validateAdmin(req?.user?._id);
    return this.adminAssetsService.getRepliesForParent(parentId);
  }

  @Get('projects/:projectId')
  async getProject(
    @Req() req: Request,
    @Param('projectId') projectId: string
  ) {
    await this.authorizationService.validateAdmin(req?.user?._id);
    return this.adminAssetsService.getProject(projectId);
  }

  @Get('projects/leaderboard/:projectId')
  async getProjectLeaderboard(
    @Req() req: Request,
    @Param('projectId') projectId: string
  ) {
    await this.authorizationService.validateAdmin(req?.user?._id);
    return this.adminAssetsService.getProjectLeaderboard(projectId);
  }

  @Get('projects/announcements/:projectId')
  async getAllAnnouncementsOfProject(
    @Req() req: Request,
    @Param('projectId') projectId: string
  ) {
    await this.authorizationService.validateAdmin(req?.user?._id);
    return this.adminAssetsService.getAllAnnouncementsOfProject(projectId);
  }


  @Get('projects/activities/:projectId')
  async getAllActivitiesOfProject(
    @Req() req: Request,
    @Param('projectId') projectId: string
  ) {
    await this.authorizationService.validateAdmin(req?.user?._id);
    return this.adminAssetsService.getAllActivitiesOfProject(projectId);
  }

  @Get('projects/faqs/:projectId')
  async getAllFaqsOfProject(
    @Req() req: Request,
    @Param('projectId') projectId: string
  ) {
    await this.authorizationService.validateAdmin(req?.user?._id);
    return this.adminAssetsService.getAllFaqsOfProject(projectId);
  }

  @Get('standard/:assetId')
  async getStandardAsset(
    @Req() req: Request,
    @Param('assetId') assetId: string
  ) {
    await this.authorizationService.validateAdmin(req?.user?._id);
    return this.adminAssetsService.getStandardAsset(assetId);
  }
}