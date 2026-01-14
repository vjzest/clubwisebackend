import { Controller, Get, Param, Post, Req, UsePipes, ValidationPipe, Body } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserStdPluginsService } from './standard-plugins.service';
import { Request } from 'express';
import { AuthorizationService } from '../user/auth/authorization.service';
import { TForum } from 'typings';

@ApiTags('Standard Plugins')
@ApiBearerAuth()
@Controller('user/std-plugins')
export class UserStdPluginsController {
  constructor(private readonly standardPluginsService: UserStdPluginsService,
    private readonly authorizationService: AuthorizationService
  ) { }

  @Get()
  async findAll(@Req() req: Request) {
    return this.standardPluginsService.findAll();
  }

  @Get('/forum/:forum/:forumId')
  async getPluginsToAddToForum(@Req() req: Request, @Param('forum') forum: TForum, @Param('forumId') forumId: string) {
    return this.standardPluginsService.getPluginsToAddToForum(forum, forumId);
  }

  @Get(':slug')
  async findBySlug(@Req() req: Request, @Param('slug') slug: string) {
    // await this.authorizationService.validateAdmin(req?.user?._id);
    return this.standardPluginsService.findOneBySlug(slug);
  }
}
