import {
  Controller,
  Post,
  Body,
  ValidationPipe,
  UseInterceptors,
  Req,
  UploadedFiles,
  BadRequestException,
  Put,
  Param,
  Get,
  ParseIntPipe,
  Query,
  ParseBoolPipe,
  Patch,
} from '@nestjs/common';
import { ProjectService } from './project.service';
import {
  CreateProjectDto,
  UpdateProjectDto,
} from './dto/create-update-project.dto';
import { memoryStorage } from 'multer';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { FileValidationPipe } from 'src/shared/pipes/file-validation.pipe';
import { Request } from 'express';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiConsumes,
  ApiResponse,
} from '@nestjs/swagger';
import { ProjectFiles } from 'src/decorators/project-file-upload/project-files.decorator';
import { Types } from 'mongoose';
import { User } from 'src/shared/entities/user.entity';
import { AnswerFaqDto, CreateDtoFaq } from './dto/faq.dto';
import { TForum } from 'typings';

/**
 * Controller handling all project-related operations
 * Includes functionality for creating, reading, updating and managing projects
 */
@ApiTags('Projects')
@ApiBearerAuth()
@Controller('project')
export class ProjectController {
  constructor(private readonly projectService: ProjectService) { }
  @Put('create-view/:projectId')
  async createViewsForProjects(
    @Req() req: Request,
    @Param('projectId') projectId: Types.ObjectId
  ) {
    return await this.projectService.createViewsForProjects(
      req.user._id,
      projectId
    );
  }


  @Get('/')
  async getProjects(
    @Req() req: Request,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('search') search?: string,
    @Query('forum') forum?: TForum,
    @Query('forumId') forumId?: string,
    @Query('type') type?: 'all' | 'active' | 'proposed' | 'global',
  ) {
    return await this.projectService.getProjects2({
      page,
      limit,
      search,
      forum,
      forumId,
      type,
      userId: req.user?._id,
    });
  }


  /**
   * Creates a new project with provided details and files
   * @param req - Express request object containing user info
   * @param createProjectDto - DTO containing project details
   * @param files - Object containing project files and banner image
   * @returns Newly created project
   * @throws BadRequestException if file type is invalid
   */
  @Post()
  @ProjectFiles()
  async create(
    @Req() req: Request,
    // @Body() createProjectDto: CreateProjectDto,
    @Body() createProjectDto: CreateProjectDto,
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
    files: {
      file?: Express.Multer.File[];
      bannerImage?: Express.Multer.File[];
    },
  ) {
    // Extract files from request
    const documentFiles = files.file || [];
    const bannerImage = files.bannerImage?.[0] || null;
    const res = await this.projectService.create(
      createProjectDto,
      req.user._id,
      documentFiles,
      bannerImage,
    );
    return res;
  }

  /**
   * Saves a project as draft with all provided details and files
   * @param req - Express request object containing user info
   * @param updateProjectDto - DTO containing project updates
   * @param files - Object containing project files and banner image
   * @returns Saved draft project
   * @throws BadRequestException if file type is invalid
   */
  @Post('draft')
  @ProjectFiles()
  async saveDraftProject(
    @Req() req: Request,
    @Body() updateProjectDto: UpdateProjectDto,
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
    files: {
      file?: Express.Multer.File[];
      bannerImage?: Express.Multer.File[];
    },
  ) {
    // Extract files from request
    const documentFiles = files.file || [];
    const bannerImage = files.bannerImage?.[0] || null;
    return await this.projectService.saveDraftProject(
      updateProjectDto,
      req.user._id,
      documentFiles,
      bannerImage,
    );
  }

  /**
   * Updates an existing project with provided details and files
   * @param id - ID of project to update
   * @param updateProjectDto - DTO containing project updates
   * @param req - Express request object containing user info
   * @param files - Object containing project files and banner image
   * @returns Updated project
   * @throws BadRequestException if file type is invalid
   * @throws NotFoundException if project not found
   */
  @Put(':id')
  @ProjectFiles()
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'file', maxCount: 5 },
        { name: 'bannerImage', maxCount: 1 },
      ],
      {
        storage: memoryStorage(),
        fileFilter: (req, file, cb) => {
          // Define allowed file types for upload
          const allowedMimeTypes = [
            'image/jpeg',
            'image/jpg',
            'image/png',
            'image/gif',
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          ];
          if (allowedMimeTypes.includes(file.mimetype)) {
            cb(null, true);
          } else {
            cb(new BadRequestException('Invalid file type'), false);
          }
        },
      },
    ),
  )
  async updateProject(
    @Param('id') id: string,
    @Body() updateProjectDto: UpdateProjectDto,
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
    files: {
      file?: Express.Multer.File[];
      bannerImage?: Express.Multer.File[];
    },
  ) {
    // Extract files from request

    const documentFiles = files.file || [];
    const bannerImage = files.bannerImage?.[0] || null;
    // Forward request to service layer
    return await this.projectService.update(
      id,
      updateProjectDto,
      req.user._id,
      documentFiles,
      bannerImage,
    );
  }
  @Get('single/:id')
  async getSingleProject(@Req() req: Request, @Param('id') id: Types.ObjectId, @Query('requestFromForumId') requestFromForumId: Types.ObjectId, @Query('chapterAlyId') chapterAlyId?: string, @Query('adoptionId') adoptionId?: string) {
    return await this.projectService.getSingleProject(id, req?.user?._id, requestFromForumId, chapterAlyId, adoptionId);
  }

  @Get('all-projects')
  async getAllProjects(
    @Query('status') status: 'published' | 'proposed',
    @Query('page', new ParseIntPipe()) page: number = 1,
    @Query('limit', new ParseIntPipe()) limit: number = 10,
    @Query('isActive', new ParseBoolPipe()) isActive: boolean,
    @Query('search') search: string,
    @Query('node') node?: Types.ObjectId,
    @Query('club') club?: Types.ObjectId,
    @Query('chapter') chapter?: Types.ObjectId,
  ) {

    return await this.projectService.getAllProjects(
      status,
      page,
      limit,
      isActive,
      search,
      node,
      club
    );
  }

  @Get('all-club-projects-by-chapterid')
  async getAllClubProjectsByChapterId(
    @Query('status') status: 'published' | 'proposed',
    @Query('page', new ParseIntPipe()) page: number,
    @Query('limit', new ParseIntPipe()) limit: number,
    @Query('isActive', new ParseBoolPipe()) isActive: boolean,
    @Query('search') search: string,
    @Query('chapter') chapter?: Types.ObjectId,
  ) {

    return await this.projectService.getAllClubProjectsByChapterId(
      status,
      page,
      limit,
      isActive,
      search,
      chapter
    );
  }

  @Get('chapter-all-projects')
  async getChapterAllProjects(
    @Query('status') status: 'published' | 'proposed',
    @Query('page', new ParseIntPipe()) page: number,
    @Query('limit', new ParseIntPipe()) limit: number,
    @Query('isActive', new ParseBoolPipe()) isActive: boolean,
    @Query('search') search: string,
    @Query('chapter') chapter?: Types.ObjectId,
  ) {

    return await this.projectService.getChapterAllProjects(
      status,
      page,
      limit,
      isActive,
      search,
      chapter
    );
  }


  @Get('chapter-all-club-projects')
  async getAllClubProjectsWithChapterId(
    @Query('page', new ParseIntPipe()) page: number,
    @Query('limit', new ParseIntPipe()) limit: number,
    @Query('isActive', new ParseBoolPipe()) isActive: boolean,
    @Query('search') search: string,
    @Query('chapter') chapter?: Types.ObjectId,
  ) {
    return await this.projectService.getAllClubProjectsWithChapterId(
      page,
      limit,
      isActive,
      search,
      chapter
    );
  }

  @Get('my-projects')
  async getMyProjects(
    @Req() req: Request,
    @Query('page', new ParseIntPipe()) page: number,
    @Query('limit', new ParseIntPipe()) limit: number,
    @Query('node') node?: Types.ObjectId,
    @Query('club') club?: Types.ObjectId,
  ) {
    return await this.projectService.getMyProjects(
      req.user._id,
      page,
      limit,
      node,
      club,
    );
  }

  @Get('global-projects')
  async getGlobalProjects(
    @Req() req: Request,
    @Query('page', new ParseIntPipe()) page: number,
    @Query('limit', new ParseIntPipe()) limit: number,
  ) {
    return await this.projectService.getGlobalProjects(page, limit);
  }


  @Get('contributions/:projectId/:status')
  async getContributions(@Req() { user }, @Param('projectId') projectId: Types.ObjectId, @Param('status') status: 'accepted' | 'pending' | 'rejected') {
    return await this.projectService.getContributions(user._id, projectId, status)
  }

  @Put('accept-contributions/:contributionId/:type')
  async acceptOrRejectContributions(@Req() { user }, @Param('contributionId') contributionId: Types.ObjectId, @Param('type', ParseBoolPipe) type: boolean) {
    return this.projectService.acceptOrRejectContributions(user._id, contributionId, type)
  }
  /**
   * @get 

   */

  @Put('accept-proposed-project/:projectId/:type')
  async acceptOrRejectProposedProjectInForum(@Req() { user },
    @Param('projectId') projectId: Types.ObjectId,
    @Param('type') type: 'accept' | 'reject',
    @Body() { creationType, club, node }: { creationType: 'adopt-proposal' | 'create-proposal', club?: Types.ObjectId, node?: Types.ObjectId }) {
    return this.projectService.acceptOrRejectProposedProjectInForum(user._id, projectId, type, creationType, club, node);
  }

  @Post('ask-faq')
  async askFaq(@Req() { user }, @Body() createFaqDto: CreateDtoFaq) {
    return this.projectService.askFaq(user._id, createFaqDto)
  }

  @Get('get-faq/:projectId')
  async getQuestionFaq(@Param('projectId') projectID: Types.ObjectId) {
    return this.projectService.getQuestionFaq(projectID)
  }

  @Put('answer-faq')
  async answerFaq(@Req() { user }, @Body() answerFaqDto: AnswerFaqDto) {
    return this.answerFaq(user._id, answerFaqDto)
  }

  @Patch('/react')
  async reactToPost(
    @Req() { user },
    @Body('postId') postId: string,

    @Body('action') action: 'like' | 'dislike'
  ) {
    return this.projectService.reactToPost(postId, user?._id, action);
  }



  @Post('/create-faq')
  createFaq(@Body() { answer, projectId, question }: { question, answer, projectId }, @Req() req: Request) {
    return this.projectService.createFaq({ question, answer, projectId, userId: req.user._id })
  }

  @Patch('toggle-private-public/:projectId')
  async publishToGlobal(@Req() req: Request, @Param('projectId') projectId: string, @Query('isPublic') isPublic: boolean) {
    return this.projectService.togglePublicPrivate(projectId, req.user._id, isPublic);
  }

  @Patch('archive-project/:projectId')
  async archiveProject(@Req() req: Request, @Param('projectId') projectId: string, @Query('action') action: 'archive' | 'unarchive') {
    return this.projectService.archiveProject(projectId, req.user._id, action);
  }

  @Patch('toggle-removeadoption-and-re-adopt/:projectId')
  async toggleRemoveAdoptAndReadopt(@Req() req: Request, @Param('projectId') projectId: string, @Query('action') action: 're-adopt' | 'removeadoption') {
    return this.projectService.toggleRemoveAdoptAndReadopt(projectId, req.user._id, action);
  }

  @Patch('delete-project/:projectId')
  async deleteProject(@Req() req: Request, @Param('projectId') projectId: string) {
    return this.projectService.deleteProject(projectId, req.user._id);
  }
}