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
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RulesRegulationsService } from './rules-regulations.service';
import { CreateRulesRegulationsDto } from './dto/rules-regulation.dto';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { FileValidationPipe } from 'src/shared/pipes/file-validation.pipe';
import { memoryStorage } from 'multer';
import { Types } from 'mongoose';
import { CommentService } from 'src/user/comment/comment.service';
import { RulesRegulations } from 'src/shared/entities/rules/rules-regulations.entity';
import { TForum } from 'typings';

export interface IFileObject {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

@ApiTags('Rules & Regulations')
@ApiBearerAuth()
@Controller('rules-regulations')
export class RulesRegulationsController {
  //@inject
  constructor(
    private readonly rulesRegulationsService: RulesRegulationsService,
    private readonly commentService: CommentService,
  ) { }
  /*---------------GET ALL RULES-REGULATIONS
  
  @Query type:node|club
  @return :RulesRegulations*/


  @Get('rules')
  async getRulesRegulations(
    @Req() req: Request,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('search') search?: string,
    @Query('forum') forum?: TForum,
    @Query('forumId') forumId?: string,
    @Query('type') type?: 'all' | 'active' | 'proposed' | 'global',
  ) {
    return await this.rulesRegulationsService.getRules({
      page,
      limit,
      search,
      forum,
      forumId,
      type,
      userId: req.user._id
    });
  }


  @Get('all-club-rules')
  async getAllClubRulesWithChapterId(
    @Req() req: Request,
    @Query('page', new ParseIntPipe()) page: number,
    @Query('limit', new ParseIntPipe()) limit: number,
    @Query('isActive', new ParseBoolPipe()) isActive: boolean,
    @Query('search') search: string,
    @Query('chapterId') chapterId?: Types.ObjectId,
  ) {

    return await this.rulesRegulationsService.getAllClubRulesWithChapterId(
      page,
      limit,
      isActive,
      search,
      req?.user?._id,
      chapterId,
    );
  }

  @Get('all-chapter-rules')
  async getAllChapterRules(
    @Req() req: Request,
    @Query('page', new ParseIntPipe()) page: number,
    @Query('limit', new ParseIntPipe()) limit?: number,
    @Query('search') search?: string,
    @Query('from') from?: Types.ObjectId,
  ) {

    return await this.rulesRegulationsService.getAllChapterRules(
      page,
      limit,
      search,
      from,
      req.user.userId
    );
  }


  /* -----------------------------CREATE RULES AND REGULATIONS
  
  @Param :createRulesRegulationsDto
  @Res :RulesRegulations
  @description :Create a new rules-regulations
  @Req:user_id */

  @UseInterceptors(
    FilesInterceptor('file', 5, {
      storage: memoryStorage(),
    }),
  )
  @Post()
  async createRulesRegulations(
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
    @Body() createRulesRegulationsDto: CreateRulesRegulationsDto,
  ) {
    try {
      if (!createRulesRegulationsDto.node && !createRulesRegulationsDto.club && !createRulesRegulationsDto?.chapter) {
        throw new BadRequestException(
          'Invalid type parameter. Must be "node", "club" or "chapter".',
        );
      }

      // Validate number of file
      if (files.length > 5) {
        throw new BadRequestException('Must provide between 1 and 5 file');
      }

      // if (createRulesRegulationsDto.publishedStatus === 'draft') {
      //   throw new BadRequestException('Cannot save to draft')
      // }

      // saving all the detail to sent to the service
      const dataToSave = {
        ...createRulesRegulationsDto,
        createdBy: req.user._id,
        version: 1,
        files,
      };

      return await this.rulesRegulationsService.createRulesRegulations(
        dataToSave, req.user._id
      );




    } catch (error) {
      console.log('Controller Error Create Rule ', error)
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw error
    }
  }


  /*------------------------------SAVE TO DRAFT RULES AND REGULATIONS 
  @Param :createRulesRegulationsDto
  @Res :RulesRegulations
  @description :Create a new rules-regulations
  @Req:user_id 
  */

  @UseInterceptors(
    FilesInterceptor('file', 5, {
      storage: memoryStorage(),
    }),
  )
  @Post('draft')
  async saveToDraft(
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
    @Body() createRulesRegulationsDto,
  ) {
    try {

      console.log({ createRulesRegulationsDto })
      if (!createRulesRegulationsDto.node && !createRulesRegulationsDto.club) {
        throw new BadRequestException(
          'Invalid type parameter. Must be "node" or "club".',
        );
      }

      // Validate number of file
      if (files.length > 5) {
        throw new BadRequestException('Must provide between 1 and 5 file');
      }

      if (createRulesRegulationsDto.publishedStatus !== 'draft') {
        throw new BadRequestException('Error while saving to draft please try again ')
      }
      //saving all the detail to sent to the service
      const dataToSave = {
        ...createRulesRegulationsDto,
        createdBy: req['user']._id,
        isPublic: false,
        isActive: false,
        version: 1,
        files,
        publishedStatus: 'draft',
      };
      console.log({ dataToSave })

      return await this.rulesRegulationsService.saveToDraft(
        dataToSave
      );

    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Error while creating rules-regulations',
        error,
      );
    }
  }



  @Put('accept-reject-proposed-rules')
  async acceptProposedRulesAndRegulations(@Req() { user }, @Query('rulesId') rulesId: Types.ObjectId, @Query('forumId') forumId: Types.ObjectId, @Query('forum') forum: TForum, @Query('acceptOrReject') acceptOrReject: 'accept' | 'reject') {
    console.log({ rulesId, forumId, forum, acceptOrReject })
    return await this.rulesRegulationsService.acceptProposedRulesAndRegulations(user._id, rulesId, forumId, forum, acceptOrReject);
  }
  /* ----------------------------------UPDATING RULES AND REGULATIONS
  @Param :updateRulesRegulationDto
  @Res:RulesRegulations
  @Description :Update rules-regulations
  @Req:user_id*/

  @UseInterceptors(
    FilesInterceptor('file', 5, {
      storage: memoryStorage(),
    }),
  )
  @Put()
  async updateRulesRegulations(
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
          required: false, // Allow empty or no files
        },
      }),
    )
    file: Express.Multer.File[],
    @Body() updateRulesRegulationsDto,
  ) {
    try {
      // Initialize fileObjects array
      const fileObjects = file
        ? file.map((singleFile) => ({
          buffer: singleFile.buffer,
          originalname: singleFile.originalname,
          mimetype: singleFile.mimetype,
          size: singleFile.size,
        }))
        : [];


      // Prepare data to save
      const dataToSave = {
        ...updateRulesRegulationsDto,
        updatedBy: req['user']?._id,
        updatedDate: new Date(),
      };

      // Call the service with data and file objects
      return await this.rulesRegulationsService.updateRulesRegulations(
        dataToSave,
        req['user']?._id,
        fileObjects,
      );
    } catch (error) {
      console.error('Error:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Error while updating rules-regulations',
      );
    }
  }

  /*--------------------------------GET ALL RULES AND REGULATION OF SINGLE CLUB OR NODE 
  @Query : type = club|node 
  @Query : from = club|node id
  @Req   : req.user 
  */

  @Get('get-all-active-rules')
  async getAllActiveRulesRegulations(
    @Query('from') forId: Types.ObjectId,
    @Query('type') type: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('search') search: string,
    @Req() req: Request,
  ) {

    return await this.rulesRegulationsService.getAllActiveRulesRegulations(
      type,
      forId,
      page,
      limit,
      search
    );
  }
  /*-------------------GET MY RULES
   @Req:user_id
   @eturn:RulesRegulations */


  @Get('get-my-rules')
  async getMyRules(
    @Req() req: Request,
    @Query('entity') entity: Types.ObjectId,
    @Query('type') type: 'node' | 'club',
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('search') search: string
  ) {
    try {
      console.log("consolingsearch from controller", search)

      const pageNumber = parseInt(page as any) || 1;
      const limitNumber = parseInt(limit as any) || 10;


      return await this.rulesRegulationsService.getMyRules(
        req.user._id,
        type,
        entity,
        pageNumber,
        limitNumber,
        search
      );
    } catch (error) {
      throw new InternalServerErrorException(
        'Error while getting active rules-regulations',
        error,
      );
    }
  }

  /*--------------------------ADOPT RULES 
  @Body:rulesId,clubId,nodeId,type
  @Req:user_id
  @return:RulesRegulations
   */

  @Post('adopt-rules')
  async adoptRules(
    @Body('rulesId') rulesId: Types.ObjectId,
    @Body('clubId') club: Types.ObjectId,
    @Body('nodeId') node: Types.ObjectId,
    @Body('type') type: 'club' | 'node',
    @Req() req: Request,
  ) {
    const data = {
      rulesId,
      club,
      node,
      proposalMessage: "",
    };

    return await this.rulesRegulationsService.adoptRules(req.user._id, data);
  }
  /*--------------------------GET NOT ADOPTED NODE OR CLUBS */
  @Get('get-clubs-nodes-notadopted/:rulesId')
  async getClubsNodesNotAdopted(
    @Req() req: Request,
    @Param('rulesId') rulesId: Types.ObjectId,
  ) {
    return await this.rulesRegulationsService.getClubsNodesNotAdopted(
      req.user._id,
      new Types.ObjectId(rulesId),
    );
  }
  /*-------------GET SINGLE RULES DETAILS
   */
  @Get('get-rules/:ruleId')
  async getRule(@Param('ruleId') ruleId: Types.ObjectId, @Query('forumId') forumId: Types.ObjectId, @Query('forum') forum: TForum, @Query('adoptionId') adoptionId: Types.ObjectId, @Req() req: Request) {
    return await this.rulesRegulationsService.getRule(ruleId, forumId, forum, req.user?._id, adoptionId);
  }

  //----------LIKE RULES AND REGULATIONS

  @Put('like-rules')
  async likeRulesRegulations(
    @Body('rulesId') rulesId: Types.ObjectId,

    @Req() req: Request,
  ) {
    return await this.rulesRegulationsService.likeRulesRegulations(
      req.user._id,
      rulesId,
    );
  }

  //------------------UNLIKE RULES AND REGULATIONS
  @Put('unlike-rules')
  async unlikeRulesRegulations(
    @Body('rulesId') rulesId: Types.ObjectId,

    @Req() req: Request,
  ) {
    return await this.rulesRegulationsService.unlikeRulesRegulations(
      req.user._id,
      rulesId,
    );
  }


  //-----------------------------REPORT OFFENSE
  @UseInterceptors(
    FilesInterceptor('file', 1, {
      storage: memoryStorage(),
    }),
  )
  @Post('reportOffence')
  async reportOffence(
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
    @Body()
    reportData: {
      type: string;
      typeId: Types.ObjectId;
      reason: string;
      rulesID: Types.ObjectId;
      offenderID: string;
      offenderName: string
    },
    @Req() req: Request,
  ) {
    console.log({ file })
    return await this.rulesRegulationsService.reportOffense(
      req.user._id,
      reportData,
      file[0],
    );
  }
  //-----------------------------GET ALL REPORTS
  @Get('get-all-report-offence')
  async getAllOffence(
    @Req() req: Request,
    @Query('type') type: 'node' | 'club',
    @Query('clubId') clubId: Types.ObjectId,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    return await this.rulesRegulationsService.getAllReportOffence(
      clubId,
      type,
      Number(page),
      Number(limit),
      req?.user?._id,
    );
  }

  /* -------------CRATE VIEWS FOR THE RULES AND REGULATIONS */
  @Put('create-view')
  async createViewsForRulesAndRegulations(
    @Req() req: Request,
    @Body('rulesId') rulesId: Types.ObjectId,
  ) {
    return await this.rulesRegulationsService.createViewsForRulesAndRegulations(
      req.user._id,
      rulesId,
    );
  }
  /**
   * Retrieves all comments for a specific rule
   * @param ruleId - The ObjectId of the rule to get comments for
   * @returns Promise containing comments for the specified rule
   */
  @Get(':ruleId/comments')
  getAllComments(@Param('ruleId') ruleId: Types.ObjectId) {
    return this.commentService.getCommentsByEntity(
      RulesRegulations.name,
      ruleId,
    );
  }

  /**
   * Creates a new comment for a rules and regulations entry
   * @param req - Express request object containing user information
   * @param file - Array containing a single uploaded file (image, PDF or document)
   * @param createCommentData - Comment data to be created
   * @returns Promise containing the created comment
   */
  @UseInterceptors(FilesInterceptor('file', 1, { storage: memoryStorage() }))
  @Post('comment')
  async createComment(
    @Req() req,
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
        },
      }),
    )
    file: Express.Multer.File[],
    @Body() createCommentData: any,
  ) {
    createCommentData.entityType = RulesRegulations.name;
    const userId = new Types.ObjectId(req.user._id);
    return await this.commentService.createComment(
      createCommentData,
      userId,
      file[0],
    );
  }

  /**
   * Adds a like to a comment on rules and regulations
   * @param req - Express request object containing user information
   * @param commentId - ID of the comment to like
   * @returns Promise containing the updated comment with the new like
   */
  @Put('comment/:id/like')
  async likeComment(@Req() req, @Param('id') commentId: string) {
    const userId = new Types.ObjectId(req.user._id);
    return await this.commentService.likeComment(
      new Types.ObjectId(commentId),
      userId,
    );
  }

  /**
   * Adds a dislike to a comment on rules and regulations
   * @param req - Express request object containing user information
   * @param commentId - ID of the comment to dislike
   * @returns Promise containing the updated comment with the new dislike
   */
  @Put('comment/:id/dislike')
  async dislikeComment(@Req() req, @Param('id') commentId: string) {
    const userId = new Types.ObjectId(req.user._id);
    return await this.commentService.dislikeComment(
      new Types.ObjectId(commentId),
      userId,
    );
  }

  /**
   * Deletes a comment from rules and regulations
   * @param req - Express request object
   * @param commentId - ID of the comment to delete
   * @returns Promise containing the result of comment deletion
   */
  @Put('comment/:id/delete')
  async deleteComment(@Req() req, @Param('id') commentId: string) {
    return await this.commentService.deleteComment(
      new Types.ObjectId(commentId),
    );
  }

  /**
   * Propose rules for the club
   * @param req - Express request object
   * @param commentId - ID of the comment to delete
   * @returns Promise containing the result of comment deletion
   */

  @Put('propose-rule')
  async proposeRules(@Req() req: Request, @Body() data) {
    const userId = req.user._id;
    return await this.rulesRegulationsService.proposeRules(userId, data);
  }

  /**
   * Get all the clubs and node of the user with role of the user
   * @param req - Express request object
   * @returns Promise containing the result of the data
   */

  @Get('get-all-clubs-nodes-role')
  async getAllClubsAndNodesWithRole(@Req() req: Request) {
    return this.rulesRegulationsService.getAllClubsAndNodesWithRole(
      req.user._id,
    );
  }

  @Get('chapter-all-club-rules')
  async getChapterAllClubRules(@Req() req: Request, @Query('chapter') chapterId: string) {
    return this.rulesRegulationsService.getChapterAllClubRules(chapterId);
  }

  @Post('toggle-private-public/:rulesId')
  async publishToGlobal(@Req() req: Request, @Param('rulesId') rulesId: string, @Query('isPublic') isPublic: boolean) {
    return this.rulesRegulationsService.togglePublicPrivate(rulesId, req.user._id, isPublic);
  }

  @Patch('archive-rule/:rulesId')
  async archiveRule(@Req() req: Request, @Param('rulesId') rulesId: string, @Query('action') action: 'archive' | 'unarchive') {
    return this.rulesRegulationsService.archiveRule(rulesId, req.user._id, action);
  }

  @Patch('delete-rule/:rulesId')
  async deleteRule(@Req() req: Request, @Param('rulesId') rulesId: string) {
    return this.rulesRegulationsService.deleteRule(rulesId, req.user._id);
  }

  @Patch('remove-rule-from-adoption/:adoptionId')
  async removeAdoption(@Req() req: Request, @Param('adoptionId') adoptionId: string, @Query('action') action: 'removeadoption' | 're-adopt') {
    return this.rulesRegulationsService.removeAdoption(adoptionId, action, req.user._id);
  }

  @Get('draft-rules/:ruleId')
  async getDraftRules(@Req() req: Request, @Param('ruleId') ruleId: string) {
    return this.rulesRegulationsService.getDraftRules(ruleId, req.user._id);
  }
}
