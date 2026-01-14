import {
  BadRequestException,
  Body,
  Controller,
  Get,
  InternalServerErrorException,
  Param,
  ParseBoolPipe,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
  ValidationPipe,
} from '@nestjs/common';

import { IssuesService } from './issues.service';
import { FileValidationPipe } from 'src/shared/pipes/file-validation.pipe';
import { Request } from 'express';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Types } from 'mongoose';
import { Issues } from 'src/shared/entities/issues/issues.entity';
import { CreateSolutionDto, CreateSolutionsDto } from './dto/create-solution.dto';
import { TCreationType, TForum, TIssueActionType } from 'typings';
import { CommonService } from '../common/common.service';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('Issues')
@ApiBearerAuth()
@Controller('issues')
export class IssuesController {
  constructor(private readonly issuesService: IssuesService, private readonly commonService: CommonService) { }


  /**
   * POST / => Create Issue
   * GET / => Get All Issues
   * GET /:id => Get Issue by ID
   * PUT /:id => Update Issue by ID
   * DELETE /:id => Delete Issue by ID
   * GET /user/:userId => Get Issues by User ID
   * GET /club/:clubId => Get Issues by Club ID
   * GET /node/:nodeId => Get Issues by Node ID
   */

  @Get('/')
  async getIssues(
    @Req() req: Request,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('search') search?: string,
    @Query('forum') forum?: TForum,
    @Query('forumId') forumId?: string,
    @Query('type') type?: 'all' | 'active' | 'proposed' | 'global',
  ) {
    return await this.issuesService.getIssues({
      page,
      limit,
      search,
      forum,
      forumId,
      type,
      userId: req?.user?._id,
    });
  }

  @UseInterceptors(
    FilesInterceptor('files', 5, {
      storage: memoryStorage(),
    }),
  )
  @Post()
  async createIssue(
    @Req() req: Request,
    @UploadedFiles(
      new FileValidationPipe({
        files: {
          maxSizeMB: 5,
          allowedMimeTypes: [
            "image/jpeg",
            "image/png",
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          ],
          required: false,
        },
      }),
    )
    files: Express.Multer.File[],
    @Body() createIssuesData,
  ) {

    if (!createIssuesData.node && !createIssuesData.club && !createIssuesData.chapter) {
      throw new BadRequestException(
        'Invalid type parameter. Must be "node", "club" or "chapter".',
      );
    }

    const memberRole = await this.issuesService.getMemberRoles(
      req.user._id,
      createIssuesData,
    );

    if (createIssuesData.publishedStatus === 'draft') {
      const dataToSave = {
        ...createIssuesData,
        createdBy: new Types.ObjectId(req.user._id),
        isActive: false,
        files,
        whoShouldAddress: createIssuesData.whoShouldAddress.split(','),
      };

      return await this.issuesService.createIssue(dataToSave, req.user._id);
    }

    if (!['admin', 'owner'].includes(memberRole)) {
      const dataToSave = {
        ...createIssuesData,
        createdBy: new Types.ObjectId(req.user._id),
        isActive: false,
        files,
        publishedStatus: 'proposed',
        whoShouldAddress: createIssuesData.whoShouldAddress.split(','),
      };

      return await this.issuesService.createIssue(dataToSave, req.user._id);
    }

    const dataToSave = {
      ...createIssuesData,
      createdBy: new Types.ObjectId(req.user._id),
      publishedBy: new Types.ObjectId(req.user._id),
      publishedDate: new Date(),
      isActive: true,
      files,
      whoShouldAddress: createIssuesData.whoShouldAddress.split(','),
    };

    return await this.issuesService.createIssue(dataToSave, req.user._id);
  }

  @UseInterceptors(
    FilesInterceptor('file', 5, {
      storage: memoryStorage(),
    }),
  )
  @Put()
  async updateIssue(
    @Req() req: Request,
    @UploadedFiles(
      new FileValidationPipe({
        files: {
          maxSizeMB: 5,
          allowedMimeTypes: [
            'image/jpeg',
            'image/jpg',
            'image/png',
            'image/gif',
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          ],
          required: false,
        },
      }),
    )
    files: Express.Multer.File[],
    @Body() updateIssuesData,
  ) {
    const fileObjects = files.map((singleFile) => ({
      buffer: singleFile.buffer,
      originalname: singleFile.originalname,
      mimetype: singleFile.mimetype,
      size: singleFile.size,
    }));

    const dataToSave = {
      ...updateIssuesData,
      updatedBy: new Types.ObjectId(req.user._id),
      updatedDate: new Date(),
    };

    return await this.issuesService.updateIssue(
      new Types.ObjectId(req.user._id),
      dataToSave,
      fileObjects,
    );
  }

  @Get('get-issue/:issueId')
  async getIssue(@Req() req: Request, @Param('issueId') issueId, @Query('requestFromForumId') requestFromForumId: Types.ObjectId, @Query('chapterAlyId') chapterAlyId?: string, @Query('adoptionId') adoptionId?: string) {
    return await this.issuesService.getIssue(new Types.ObjectId(issueId), req?.user?._id, requestFromForumId, chapterAlyId, adoptionId);
  }

  @Get('get-my-issues')
  async getMyIssues(
    @Req() req: Request,
    @Query('entity') entity: 'node' | 'club',
    @Query('entityId') entityId: string,
    @Query('page') page: number
  ) {
    return await this.issuesService.getMyIssues(
      new Types.ObjectId(req.user._id),
      entity,
      new Types.ObjectId(entityId),
      page
    );
  }

  @Post('adopt-issue')
  async adoptIssueAndPropose(@Req() req: Request, @Body() data) {
    return await this.issuesService.adoptIssueAndPropose(
      new Types.ObjectId(req.user._id),
      data,
    );
  }

  @Post('publish-reject-inactivate-proposed-issue/:issueId')
  async publishOrRejectProposedIssue(@Req() req: Request, @Param('issueId') issueId, @Query('status') status: TIssueActionType, @Query('creationType') creationType: TCreationType) {
    return this.issuesService.publishOrRejectProposedIssue(
      new Types.ObjectId(req.user._id),
      new Types.ObjectId(issueId),
      status,
      creationType,
    );
  }

  @Get('proposed-issues/:entity/:entityId')
  async getProposedIssues(
    @Req() req: Request,
    @Param('entity') entity,
    @Param('entityId') entityId,
  ) {
    return this.issuesService.getProposedIssues(
      entity,
      new Types.ObjectId(entityId),
    );
  }

  @Put('like/:issueId')
  async likeIssue(@Req() req: Request, @Param('issueId') issueId) {
    return await this.issuesService.likeIssue(
      new Types.ObjectId(req.user._id),
      new Types.ObjectId(issueId),
    );
  }

  @Put('dislike/:issueId')
  async dislikeIssue(@Req() req: Request, @Param('issueId') issueId) {
    return await this.issuesService.dislikeIssue(
      new Types.ObjectId(req.user._id),
      new Types.ObjectId(issueId),
    );
  }

  // @Get('get-clubs-and-nodes-not-adopted/:issueId')
  @Get('non-adopted-forums/:issueId')
  async getClubsNodesNotAdopted(
    @Req() req: Request,
    @Param('issueId') issueId,
  ) {
    return await this.issuesService.getClubsNodesNotAdopted(
      new Types.ObjectId(req.user._id),
      new Types.ObjectId(issueId),
    );
  }

  @Post('create-solution')
  async createSolution(@Body() createSolution: CreateSolutionDto, @Req() { user }) {
    return await this.issuesService.createSolution(user._id, createSolution)
  }



  @UseInterceptors(
    FilesInterceptor('files', 5, {
      storage: memoryStorage(),
    }),
  )
  @Post('add-solution')
  addSolution(@Req() req: Request, @Body() solution: CreateSolutionsDto, @UploadedFiles(
    new FileValidationPipe({
      files: {
        maxSizeMB: 5,
        allowedMimeTypes: [
          "image/jpeg",
          "image/png",
          "application/pdf",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ],
        required: false,
      },
    }),
  )
  files: Express.Multer.File[],) {
    const userId = req.user._id

    return this.issuesService.addSolution(solution, userId, files)

  }

  @Get('solution/:issueId')
  getSolutions(@Param('issueId') issueId: string) {
    return this.issuesService.getSolutionById(issueId)
  }


  @Post('solution/relevance/:id')
  async markRelevance(
    @Param('id') id: string,
    @Body() dto: { isRelevant: boolean },
    @Req() req: Request
  ) {

    return this.issuesService.markSolutionRelevance(
      id,
      req.user._id,
      dto.isRelevant
    );
  }

  @Get('solution')
  getSolutionDetail(@Query('solutionId') solutionId: Types.ObjectId) {
    return this.issuesService.getSolutionDetailById(solutionId)
  }

  @Put('create-view')
  async createViewsForIssue(
    @Req() req: Request,
    @Body('issueId') issueId: Types.ObjectId,
  ) {
    return await this.issuesService.createViewsForIssue(
      req.user._id,
      issueId,
    );
  }



  // issues/
  @Get('chapters/all-club-issues')
  async getAllClubIssuesWithChapterId(
    @Query('page', new ParseIntPipe()) page: number,
    @Query('limit', new ParseIntPipe()) limit: number,
    @Query('isActive', new ParseBoolPipe()) isActive: boolean,
    @Query('search') search: string,
    @Query('chapterId') chapterId?: Types.ObjectId,
  ) {


    return await this.issuesService.getAllClubIssuesWithChapterId(
      page,
      limit,
      isActive,
      search,
      chapterId,
    );
  }

  @Patch('toggle-private-public/:issueId')
  async publishToGlobal(@Req() req: Request, @Param('issueId') issueId: string, @Query('isPublic') isPublic: boolean) {
    return this.issuesService.togglePublicPrivate(issueId, req.user._id, isPublic);
  }

  @Patch('delete-issue/:issueId')
  async deleteIssue(@Req() req: Request, @Param('issueId') issueId: string) {
    return this.issuesService.deleteIssue(issueId, req.user._id);
  }

  @Get('draft-issues/:issueId')
  async getDraftIssues(@Req() req: Request, @Param('issueId') issueId: string) {
    return this.issuesService.getDraftIssues(issueId, req.user._id);
  }

}
