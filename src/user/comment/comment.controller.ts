import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Req,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
  ValidationPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CommentService } from './comment.service';
import { SkipAuth } from '../../decorators/skip-auth.decorator';
import { CreateCommentDto } from './dto/comment.dto';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Types } from 'mongoose';
import { FileValidationPipe } from '../../shared/pipes/file-validation.pipe';
import { RulesRegulations } from '../../shared/entities/rules/rules-regulations.entity';
import { Issues } from '../../shared/entities/issues/issues.entity';
import { Projects } from '../../shared/entities/projects/project.entity';
import { IssueSolution } from '../../shared/entities/issues/issue-solution.entity';
import { GenericPost } from '../../shared/entities/generic-post.entity';

@ApiTags('Comments')
@ApiBearerAuth()
@Controller('comments')
export class CommentController {
  constructor(private readonly commentService: CommentService) { }

  @Get()
  async getAllComments() {
    return await this.commentService.getAllComments();
  }

  @Get(':entityType/:entityId')
  async getCommentsByEntity(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: Types.ObjectId,
  ) {
    const entity =
      entityType === 'rules'
        ? RulesRegulations.name
        : entityType === 'issues'
          ? Issues.name
          : entityType === 'projects'
            ? Projects.name
            : entityType === 'issue-solution'
              ? IssueSolution.name
              : entityType === 'generic'
                ? GenericPost.name
                : entityType;
    return this.commentService.getCommentsByEntity(entity, entityId);
  }

  @UseInterceptors(FilesInterceptor('file', 1, { storage: memoryStorage() }))
  @Post()
  async createComment(
    @Req() req,
    @UploadedFiles(
      new FileValidationPipe({
        files: {
          maxSizeMB: 2,
          allowedMimeTypes: [
            'image/jpeg',
            'image/jpg',
            'image/png',
            'image/gif',
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          ],
        },
      }),
    )
    file: Express.Multer.File[],
    @Body() createCommentDto: any,
  ) {
    console.log({ createCommentDto });
    const entity =
      createCommentDto.entityType === 'rules'
        ? RulesRegulations.name
        : createCommentDto.entityType === 'issues'
          ? Issues.name
          : createCommentDto.entityType === 'projects'
            ? Projects.name
            : createCommentDto.entityType === 'issue-solution'
              ? IssueSolution.name
              : createCommentDto.entityType === 'generic'
                ? GenericPost.name
                : createCommentDto.entityType;

    console.log({ entity });
    createCommentDto.entityType = entity;
    const userId = new Types.ObjectId(req.user._id);
    return await this.commentService.createComment(
      createCommentDto,
      userId,
      file[0],
    );
  }

  @Put('like/:id')
  async likeComment(@Req() req, @Param('id') commentId: string) {
    const userId = new Types.ObjectId(req.user._id);
    return await this.commentService.likeComment(
      new Types.ObjectId(commentId),
      userId,
    );
  }

  @Put('dislike/:id')
  async dislikeComment(@Req() req, @Param('id') commentId: string) {
    const userId = new Types.ObjectId(req.user._id);
    return await this.commentService.dislikeComment(
      new Types.ObjectId(commentId),
      userId,
    );
  }

  @Put('delete/:id')
  async deleteComment(@Req() req, @Param('id') commentId: string) {
    return await this.commentService.deleteComment(
      new Types.ObjectId(commentId),
    );
  }
}
