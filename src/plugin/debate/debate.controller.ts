import {
  Controller,
  Post,
  Body,
  Req,
  Res,
  HttpStatus,
  HttpException,
  UploadedFiles,
  UseInterceptors,
  BadRequestException,
  Query,
  Get,
  Patch,
  Put,

  NotFoundException,
  Delete,
  DefaultValuePipe,
  ParseIntPipe,
  ParseBoolPipe,
  InternalServerErrorException,
  Param,
} from '@nestjs/common';
import { DebateService } from './debate.service';
import { CreateDebateDto } from './dto/create.dto';
import { Request, Response } from 'express';
import { FileValidationPipe } from '../../shared/pipes/file-validation.pipe';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Types } from 'mongoose';
import { AdoptDebateDto } from './dto/adopte.dto';
import { DebateArgument } from '../../shared/entities/debate/debate-argument.entity';
import { TForum } from 'typings';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('Debates')
@ApiBearerAuth()
@Controller('debate')
export class DebateController {
  constructor(private readonly debateService: DebateService) { }

  @UseInterceptors(
    FilesInterceptor('files', 5, {
      storage: memoryStorage(),
    }),
  )
  @Post()
  async createDebate(
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
    files: Express.Multer.File[], // Captures the files

    @Body() createDebateDto: CreateDebateDto, // Captures the body data
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const userId = req.user._id;
    try {
      const dataToSave = {
        ...createDebateDto,
        files,
      };

      // Pass the data to the service for creation
      const result = await this.debateService.createDebate(dataToSave, userId);

      // Return the response
      return res.status(HttpStatus.OK).json({
        message: result.message,
      })
    } catch (error) {
      // Handle errors
      if (error instanceof HttpException) {
        return res.status(error.getStatus()).json({
          statusCode: error.getStatus(),
          error: error.getResponse()['error'],
          message: error.getResponse()['message'],
        });
      }

      return res.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        error: 'Bad Request',
        message: error.message || 'An unexpected error occurred.',
      });
    }
  }

  @Get('/')
  async getDebates(
    @Req() req: Request,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('search') search?: string,
    @Query('forum') forum?: TForum,
    @Query('forumId') forumId?: string,
    @Query('type') type?: 'all' | 'active' | 'proposed' | 'global',
  ) {
    return await this.debateService.getDebates({
      page,
      limit,
      search,
      forum,
      forumId,
      type,
      userId: req.user?._id,
    });
  }


  @Post('adopt')
  async adoptDebate(@Body() body: AdoptDebateDto, @Req() req: any) {
    if (!body.type || !body.debateId) {
      throw new BadRequestException('Type and Debate ID are required fields');
    }
    return await this.debateService.adoptDebate({
      ...body,
      userId: new Types.ObjectId(req?.user?._id),
      debateId: new Types.ObjectId(body.debateId),
      clubId: body.clubId ? new Types.ObjectId(body.clubId) : undefined,
      nodeId: body.nodeId ? new Types.ObjectId(body.nodeId) : undefined,
    });

    // return {
    //   success: true,
    //   message: result.message,
    //   data: result.data,
    // };
  }
  @Get('my-debates')
  async getMyDebates(
    @Query('entityId') entityId: string,
    @Query('entity') entity: 'node' | 'club',
    @Query('page') page: number,
    @Query('limit') limit: number,
    @Req() req: Request,
  ) {
    const userId = req.user._id;

    const result = await this.debateService.myDebates({
      entity,
      userId,
      entityId,
      page,
      limit
    });

    return result;
  }

  @Get('all-club-debates-by-chapterid')
  async getAllClubDebatesWithChapterId(
    @Req() req: Request,
    @Query('page', new ParseIntPipe()) page: number,
    @Query('limit', new ParseIntPipe()) limit: number,
    @Query('isActive', new ParseBoolPipe()) isActive: boolean,
    @Query('search') search: string,
    @Query('chapterId') chapter?: Types.ObjectId,
  ) {

    return await this.debateService.getAllClubDebatesWithChapterId(
      page,
      limit,
      isActive,
      search,
      chapter,
      req.user._id,
    );
  }
  @Get('all-debates')
  async allDebates(
    @Query('entity') entity: 'node' | 'club',
    @Query('entityId') entityId: string,
    @Query('page') page: number,
    @Query('limit') limit: number,
    @Req() req: Request,
  ) {
    return await this.debateService.myDebatesByStatus({
      entity,
      entityId,
      page,
      limit
    });
  }
  @Get('ongoing')
  async getOngoingDebates(
    @Query('entityId') entityId: string,
    @Query('entity') entityType: TForum,
    @Query('page') page: number,
    @Query('limit') limit: number,
  ) {
    const result = await this.debateService.getOngoingDebatesForEntity({
      entityId,
      entityType,
      page,
      limit,
    });

    return result;
  }

  @Get('global')
  async getOngoingPublicGlobalDebates(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    return await this.debateService.getOngoingPublicGlobalDebates(
      page,
      limit
    );
  }

  @Patch(':debateId/publish')
  async publishDebate(
    @Param('debateId') debateId: string,
    @Body('userId') userId: string,
    @Body('entityId') entityId: string,
    @Body('entityType') entityType: 'node' | 'club',
  ) {
    try {
      const updatedDebate = await this.debateService.publishDebate(
        debateId,
        userId,
        entityId,
        entityType,
      );

      return {
        message: 'Debate published successfully.',
        data: updatedDebate,
      };
    } catch (error) {
      throw error;
    }
  }

  @Put('create-view')
  async createViewsForDebate(
    @Req() req: Request,
    @Body('debateId') rulesId: Types.ObjectId,
  ) {
    try {
      return await this.debateService.createViewsForDebate(
        req.user._id,
        rulesId,
      );
    } catch (error) {
      throw new InternalServerErrorException(
        'Error while liking rules-regulations',
        error,
      );
    }
  }

  @Get('get-clubs-nodes-notadopted/:debateId')
  async getClubsNodesNotAdopted(
    @Req() req: Request,
    @Param('debateId') rulesId: Types.ObjectId,
  ) {
    try {
      return await this.debateService.getNonAdoptedClubsAndNodes(
        req.user._id,
        new Types.ObjectId(rulesId),
      );
    } catch (error) {
      throw new InternalServerErrorException(
        'Error while getting active rules-regulations',
        error,
      );
    }
  }

  @Get('view/:id')
  async viewDebate(@Param('id') id: string, @Req() req: Request, @Query('requestFromForumId') requestFromForumId: Types.ObjectId, @Query('chapterAlyId') chapterAlyId?: string, @Query('adoptionId') adoptionId?: string) {
    try {
      return this.debateService.getDebateById(id, req?.user?._id, requestFromForumId, chapterAlyId, adoptionId);
    } catch (error) {
      throw error;
    }
  }

  @Get('argument/:debateId')
  async getArgumentsByDebate(@Param('debateId') debateId: string) {
    return this.debateService.getArgumentsByDebate(debateId);
  }

  @UseInterceptors(FilesInterceptor('file', 1, { storage: memoryStorage() }))
  @Post('create-argument')
  async createArgument(
    @Req() req: Request,
    @UploadedFiles(
      new FileValidationPipe({
        file: {
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
    file: Express.Multer.File,

    @Body() createDebateArgumentDto,
  ): Promise<DebateArgument> {
    const userId = req.user._id;
    createDebateArgumentDto.userId = userId;
    return this.debateService.createArgument(createDebateArgumentDto, file);
  }

  @Post('vote/:argumentId')
  async toggleVote(
    @Req() req: Request,
    @Param('argumentId') argumentId: string,
    @Body() body: { voteType: 'relevant' | 'irrelevant' },
  ) {
    const { voteType } = body;
    const userId = req.user._id;
    return this.debateService.toggleVote(argumentId, userId, voteType);
  }

  @Get('proposed/:entityId/:entityType/:page')
  async getProposedDebatesByClub(
    @Req() req: Request,
    @Param('entityId') entityId: string,
    @Param('page') page: number,

    @Param('entityType') entityType: 'club' | 'node',
  ) {
    try {
      const userId = req.user._id;
      return await this.debateService.getProposedDebatesByEntityWithAuthorization(
        entityType,
        entityId,
        userId,
        page
      );
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to fetch proposed debates for the club',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }


  @Put('accept/:debateId/:type')
  async acceptDebate(@Req() req: Request, @Param('debateId') debateId: string, @Param('type') type: string) {
    return this.debateService.acceptDebate(debateId, type, req.user._id);
  }

  @Put('reject/:debateId/:type')
  async rejectDebate(@Param('debateId') debateId: string, @Param('type') type: string, @Req() req: Request) {
    return this.debateService.rejectDebate(debateId, type, req.user._id);
  }

  @Post('check-status')
  async checkParticipationStatus(
    @Req() req: Request,
    @Body()
    body: {
      debateId: string;
      entityType: 'club' | 'node' | 'chapter';
      entity: string;
    },
  ): Promise<{ isAllowed: boolean; reason?: string }> {
    const userId = req.user._id;
    const { debateId, entityType, entity } = body;

    // Validate input parameters
    if (!userId || !debateId || !entityType || !entity) {
      throw new BadRequestException(
        'UserId, debateId, entityType, and entity are required',
      );
    }

    return this.debateService.validateParticipation(
      userId,
      debateId,
      entityType,
      entity,
    );
  }

  @Post(':parentId/reply')
  async replyToDebateArgument(
    @Req() req: Request,
    @Param('parentId') parentId: string,
    @Body('content') content: string,
  ) {
    const userId = req.user._id;
    return this.debateService.replyToDebateArgument(parentId, content, userId);
  }

  @Get('replies/:parentId')
  async getReplies(@Param('parentId') parentId: string) {
    // Fetch replies using service
    const replies = await this.debateService.getRepliesForParent(parentId);
    if (!replies) {
      throw new NotFoundException(
        `No replies found for debate argument with id ${parentId}`,
      );
    }
    return replies;
  }

  @Post('pin/:id')
  async pin(@Param('id') id: string, @Query('debateType') debateType: string = "original") {
    try {
      return await this.debateService.pin(id, debateType);
    } catch (error) {
      throw error;
    }
  }
  @Post('unpin/:id')
  async unpin(@Param('id') id: string, @Query('debateType') debateType: string = "original") {
    try {
      return await this.debateService.unpin(id, debateType);
    } catch (error) {
      throw error;
    }
  }

  @Delete('argument/:id')
  async deleteArgument(@Param('id') id: string) {
    try {
      return await this.debateService.deleteArgument(id);
    } catch (error) {
      throw error;
    }
  }

  @Patch('vote/:id')
  toggleReaction(@Req() req: Request, @Param('id') debateId: string, @Body('type') type: 'relevant' | 'irrelevant') {
    return this.debateService.toggleReaction(debateId, req.user._id, type)
  }

  @Patch('toggle-private-public/:debateId')
  async publishToGlobal(@Req() req: Request, @Param('debateId') debateId: string, @Query('isPublic') isPublic: boolean) {
    return this.debateService.togglePublicPrivate(debateId, req.user._id, isPublic);
  }

  @Get('/all-arguments/:debateId')
  getAllDebateArguments(@Param('debateId') debateId: string, @Req() req: Request) {

    return this.debateService.getAllDebateArguments(debateId, req.user._id);
  }

  // @Get('/all-debate-marquee')
  // async getAllDebateMarquee() {
  //   return this.debateService.getAllDebateMarquee();
  // }

  @Patch('archive-debate/:debateId')
  async archiveDebate(@Req() req: Request, @Param('debateId') debateId: string, @Query('action') action: 'archive' | 'unarchive') {
    return this.debateService.archiveDebate(debateId, req.user._id, action);
  }

  @Patch('toggle-removeadoption-and-re-adopt/:projectId')
  async toggleRemoveAdoptAndReadopt(@Req() req: Request, @Param('projectId') projectId: string, @Query('action') action: 're-adopt' | 'removeadoption') {
    return this.debateService.toggleRemoveAdoptionAndReadopt(projectId, req.user._id, action);
  }

  @Get('public-marquee-points/:debateId')
  async getPublicMarqueePoints(@Param('debateId') debateId: string) {
    return this.debateService.getPublicMarqueePoints(debateId);
  }

  @Patch('delete-debate/:debateId')
  async deleteDebate(@Req() req: Request, @Param('debateId') debateId: string) {
    return this.debateService.deleteDebate(debateId, req.user._id);
  }

  @Get('draft-debates/:debateId')
  async getDraftDebates(@Req() req: Request, @Param('debateId') debateId: string) {
    return this.debateService.getDraftDebates(debateId, req.user._id);
  }
}

