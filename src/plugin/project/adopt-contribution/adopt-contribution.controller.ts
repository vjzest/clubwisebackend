import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Req,
  UploadedFiles,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Types } from 'mongoose';
import { AdoptContributionService } from './adopt-contribution.service';
import { CreateAdoptContributionDto } from './dto/create-adopt-contribution.dto';
import { ProjectFiles } from '../../../decorators/project-file-upload/project-files.decorator';
import { FileValidationPipe } from '../../../shared/pipes/file-validation.pipe';

@ApiTags('Projects - Contributions')
@ApiBearerAuth()
@Controller('adopt-contribution')
export class AdoptContributionController {
  constructor(
    private readonly adoptContributionService: AdoptContributionService,
  ) { }

  @Post()
  @ProjectFiles()
  create(
    @Body() createAdoptContributionDto: CreateAdoptContributionDto,
    @Req() { user },
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
    files: { file: Express.Multer.File[] },
  ) {
    console.log({ f: files.file });
    if (!files?.file?.length) throw new BadRequestException('Please upload proof of contribution.');

    return this.adoptContributionService.create(
      createAdoptContributionDto,
      user._id,
      files,
    );
  }

  @Post('adopt-project')
  adoptProject(@Req() { user }, @Body() adoptForumDto) {
    return this.adoptContributionService.adoptProject(user._id, adoptForumDto);
  }

  /**
   * 
   * @param param0 
   * @param projectId 
   * @returns   
   * 
   */
  @Get('not-adopted-forum/:projectId')
  notAdoptedForum(
    @Req() { user },
    @Param('projectId') projectId: Types.ObjectId,
  ) {
    return this.adoptContributionService.notAdoptedForum(user._id, projectId);
  }

  @Get('project-activities/:projectId')
  projectActivities(@Param('projectId') projectId: Types.ObjectId) {
    return this.adoptContributionService.getActivitiesOfProject(projectId);
  }
  @Get('leaderboard')
  getLeaderBoard(
    @Req() { user },
    @Query('projectId') projectId: Types.ObjectId | null,
    @Query('forumId') forumId?: Types.ObjectId | null,
    @Query('forumType') forumType?: 'club' | 'node' | null,
  ) {
    return this.adoptContributionService.getLeaderBoard(
      user._id,
      projectId,
      forumId,
      forumType,
    );
  }
}
