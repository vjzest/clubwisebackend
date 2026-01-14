import {
  Body,
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Param,
  HttpStatus,
  UseInterceptors,
  UploadedFiles,
  UploadedFile,
  BadRequestException,
  NotFoundException,
  Req,
  Query,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ClubService } from './club.service';
import { Club } from 'src/shared/entities/club.entity';

import { CreateClubDto, UpdateClubDto } from './dto/club.dto';
import { FileFieldsInterceptor, FilesInterceptor, FileInterceptor } from '@nestjs/platform-express';
import { FileValidationPipe } from 'src/shared/pipes/file-validation.pipe';
import { SkipAuth } from 'src/decorators/skip-auth.decorator';
import { Request } from 'express';
import { Types } from 'mongoose';
import { ClubMembers } from 'src/shared/entities/clubmembers.entity';
import { ClubRoleGuard } from '../guards/club/club-role.guard';
import { Roles } from 'src/decorators/role.decorator';
import { TPlugins } from 'typings';
import { ApiOperation, ApiParam, ApiResponse, ApiQuery } from '@nestjs/swagger';
import {
  CreateGuidingPrinciples,
  UpdateGuidingPrinciples,
} from './dto/guiding-principle.dto';
import { memoryStorage } from 'multer';

/**
 * Controller handling all club-related operations
 * Includes functionality for creating, reading, updating and deleting clubs
 * as well as managing club memberships and requests
 */
@ApiTags('Clubs')
@ApiBearerAuth()
@Controller('clubs')
export class ClubController {
  constructor(private readonly clubService: ClubService) { }

  /**
   * Creates a new club with provided details and images
   * @param req - Express request object containing user info
   * @param files - Object containing profile and cover image files
   * @param createClubDto - DTO containing club details
   * @returns Newly created club
   * @throws BadRequestException if required fields or images are missing
   */
  @Post()
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'profileImage', maxCount: 1 },
      { name: 'coverImage', maxCount: 1 },
    ]),
  )
  async createClub(
    @Req() req: Request,
    @UploadedFiles(
      new FileValidationPipe({
        profileImage: {
          maxSizeMB: 5,
          allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png'],
          required: true,
        },
        coverImage: {
          maxSizeMB: 10,
          allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png'],
          required: false,
        },
      }),
    )
    files: {
      profileImage: Express.Multer.File[];
      coverImage: Express.Multer.File[];
    },
    @Body() createClubDto: any,
  ) {
    if (
      !createClubDto.name ||
      !createClubDto.about ||
      !createClubDto.description
    ) {
      throw new BadRequestException(
        'Name, about, and description are required fields',
      );
    }

    const userId = new Types.ObjectId(req.user._id);
    ({ userId });
    return await this.clubService.createClub({
      ...createClubDto,
      profileImage: files.profileImage[0],
      coverImage: files.coverImage?.[0],
      createdBy: userId,
      plugins: JSON.parse(createClubDto.plugins),
      domain: JSON.parse(createClubDto.domain),
    });
  }

  /**
   * Retrieves all clubs in the system
   * @returns Array of all clubs
   */
  @Get()
  async getAllClubs() {
    return await this.clubService.getAllClubs();
  }

  /**
   * Gets all clubs associated with the current user
   * @param req - Express request object containing user info
   * @returns Array of clubs associated with the user
   */
  @Get('user-clubs')
  async getAllClubsOfUser(@Req() req: Request) {
    const userId = new Types.ObjectId(req.user._id);
    return await this.clubService.getAllClubsOfUser(userId);
  }

  /**
   * Gets all pending join requests for a specific club
   * @param clubId - ID of the club
   * @returns Array of pending join requests
   */
  @Get('club-requests/:clubId')
  @ApiOperation({ summary: 'Get all requests of a club' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns all requests of the club',
    type: [ClubMembers],
  })
  async getAllRequestsOfClub(@Param('clubId') clubId: string) {
    const CLUBID = new Types.ObjectId(clubId);
    return await this.clubService.getAllRequestsOfClub(CLUBID);
  }

  /**
   * Gets all join requests made by the current user
   * @param req - Express request object containing user info
   * @returns Array of user's join requests
   */
  @Get('user-join-requests')
  @ApiOperation({ summary: 'Get all requests of a user' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns all requests of the user',
    type: [ClubMembers],
  })
  async getAllRequestsOfUser(@Req() req: Request) {
    const userId = new Types.ObjectId(req.user._id);
    return await this.clubService.getAllRequestsOfUser(userId);
  }

  /**
   * Handles user requests to join a club
   * @param req - Express request object containing user info
   * @param clubId - ID of the club to join
   * @returns Result of join request operation
   */
  @Put('request-join/:clubId')
  @ApiOperation({ summary: 'Request or join a club' })
  @ApiParam({ name: 'groupId', type: 'string' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Request or join a club',
    type: ClubMembers,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Club not found',
  })
  async requestOrJoinClub(
    @Req() req: Request,
    @Param('clubId') clubId: string,
    @Body() body: { requestNote: string },
  ) {
    const userId = new Types.ObjectId(req.user._id);
    const CLUBID = new Types.ObjectId(clubId);
    return await this.clubService.requestOrJoinClub(
      CLUBID,
      userId,
      req.user,
      body.requestNote,
    );
  }

  /**
   * Cancels a pending join request
   * @param req - Express request object containing user info
   * @param clubId - ID of the club
   * @returns Result of cancellation operation
   */
  @Delete('cancel-join-request/:clubId')
  async cancelJoinRequest(
    @Req() req: Request,
    @Param('clubId') clubId: string,
  ) {
    const userId = new Types.ObjectId(req.user._id);
    const CLUBID = new Types.ObjectId(clubId);
    return await this.clubService.cancelJoinRequest(CLUBID, userId);
  }

  /**
   * Checks the membership status of current user in a club
   * @param req - Express request object containing user info
   * @param clubId - ID of the club
   * @returns User's membership status
   */
  @Get('check-status/:clubId')
  @ApiOperation({ summary: 'Check the status of the user in a club' })
  @ApiParam({ name: 'clubId', type: 'string' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns the status of the user in the club',
    type: ClubMembers,
  })
  async checkStatus(@Req() req: Request, @Param('clubId') clubId: string) {
    const userId = new Types.ObjectId(req.user._id);
    const CLUBID = new Types.ObjectId(clubId);
    return await this.clubService.checkStatus(CLUBID, userId);
  }

  /**
   * Gets all members of a specific club
   * @param clubId - ID of the club
   * @returns Array of club members
   */
  @Get('club-members/:clubId')
  @ApiOperation({ summary: 'Get all members of a club' })
  @ApiParam({ name: 'clubId', type: 'string' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns all members of the club',
    type: [ClubMembers],
  })
  async getAllMembersOfClub(@Param('clubId') clubId: string) {
    const CLUBID = new Types.ObjectId(clubId);
    return await this.clubService.getAllMembersOfClub(CLUBID);
  }

  /**
   * Searches for members within a club
   * @param clubId - ID of the club to search in
   * @param search - Search term
   * @returns Array of matching members
   */
  @Get('search-member/:clubId')
  @ApiParam({
    name: 'clubId',
    type: 'string',
    description: 'The ID of the club to search in',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: 'string',
    description: 'Search term for filtering members',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns the members of the club matching the search criteria',
    type: [ClubMembers],
  })
  async searchMemberOfClub(
    @Param('clubId') clubId: Types.ObjectId,
    @Query('search') search: string = '',
  ) {
    ({ clubId, search });
    return await this.clubService.searchMemberOfClub(
      new Types.ObjectId(clubId),
      search,
    );
  }

  /**
   * Handles accepting or rejecting join requests
   * @param requestBody - Contains request details and decision
   * @param req - Express request object containing user info
   * @returns Result of request handling operation
   */
  @Post('handle-request')
  async acceptOrRejectRequest(
    @Body()
    requestBody: {
      clubId: string;
      requestId: string;
      status: 'ACCEPTED' | 'REJECTED';
    },
    @Req() req: any,
  ) {
    const { clubId, requestId, status } = requestBody;
    const userId = req.user.id;

    const REQUESTID = new Types.ObjectId(requestId);
    const USERID = new Types.ObjectId(userId);
    const CLUBID = new Types.ObjectId(clubId);

    return await this.clubService.acceptOrRejectRequest(
      REQUESTID,
      USERID,
      CLUBID,
      status,
    );
  }

  /**
   * Handles user leaving a club
   * @param req - Express request object containing user info
   * @param clubId - ID of the club to leave
   * @returns Result of leave operation
   */
  @Delete('leave-club/:clubId')
  @ApiOperation({ summary: 'Leave a club' })
  @ApiParam({ name: 'clubId', type: 'string' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns the status of the user in the club',
    type: ClubMembers,
  })
  async leaveClub(
    @Req() req: Request,
    @Param('clubId') clubId: Types.ObjectId,
  ) {
    const userId = new Types.ObjectId(req.user._id);
    const CLUBID = new Types.ObjectId(clubId);
    return await this.clubService.leaveClub(CLUBID, userId);
  }

  /**
   * Pins a club for quick access
   * @param clubId - ID of the club to pin
   * @param req - Express request object containing user info
   * @returns Result of pin operation
   */
  @Put('pin-club/:clubId')
  async pinClub(@Param('clubId') clubId: string, @Req() req: Request) {
    const CLUBID = new Types.ObjectId(clubId);
    const userId = new Types.ObjectId(req.user._id);
    return await this.clubService.pinClub(CLUBID, userId);
  }

  /**
   * Unpins a previously pinned club
   * @param clubId - ID of the club to unpin
   * @param req - Express request object containing user info
   * @returns Result of unpin operation
   */
  @Put('unpin-club/:clubId')
  async unpinClub(@Param('clubId') clubId: string, @Req() req: Request) {
    const CLUBID = new Types.ObjectId(clubId);
    const userId = new Types.ObjectId(req.user._id);
    return await this.clubService.unpinClub(CLUBID, userId);
  }

  @Get('chapter-chats/:clubId')
  async getChapterChats(@Param('clubId') clubId: string) {
    return await this.clubService.getChapterChats(clubId);
  }

  @Roles('owner', 'admin', 'moderator', 'member')
  @UseGuards(ClubRoleGuard)
  @Get('club-statistics/:id')
  getClubStatistics(@Param('id') clubId: string) {
    return this.clubService.getClubStatistics(clubId);
  }

  @Post('plugins/:clubId')
  async addPlugin(
    @Param('clubId') clubId: string,
    @Body()
    addPluginDto: {
      plugin: {
        plugin: TPlugins;
        createdAt: Date;
        type: 'standard' | 'custom';
      };
    },
  ): Promise<Club> {
    return await this.clubService.addPlugin(clubId, addPluginDto.plugin);
  }

  // -----------------------------ADD GUIDING PRINCIPLES ---------------------------
  @Roles('owner', 'admin')
  @UseGuards(ClubRoleGuard)
  @Put('guiding-principles')
  addGuidingPrinciples(
    @Req() req: Request,
    @Body(
      new ValidationPipe({
        transform: true, // Enable transformation
        transformOptions: {
          enableImplicitConversion: true, // Enable implicit conversions
        },
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    )
    createGuidingPrinciples: CreateGuidingPrinciples,
  ) {
    const userId = req.user._id;
    return this.clubService.addGuidingPrinciples(
      userId,
      createGuidingPrinciples,
    );
  }

  //-----------------------------UPDATE GUIDING PRINCIPLES ---------------------------
  @Roles('owner', 'admin')
  @UseGuards(ClubRoleGuard)
  @Put('guiding-principles/:guidingPrincipleId')
  updateGuidingPrinciples(
    @Req() req: Request,
    @Param('guidingPrincipleId') guidingPrincipleId: string,
    @Body(
      new ValidationPipe({
        transform: true, // Enable transformation
        transformOptions: {
          enableImplicitConversion: true, // Enable implicit conversions
        },
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    )
    updateGuidingPrinciples: UpdateGuidingPrinciples,
  ) {
    const userId = req.user._id;
    return this.clubService.updateGuidingPrinciples(
      userId,
      guidingPrincipleId,
      updateGuidingPrinciples,
    );
  }

  @Get('assets/:clubId')
  async getAssetsByNodeWithDeadline(@Param('clubId') clubId: string) {
    return await this.clubService.getAssetsByClubWithDeadline(clubId);
  }

  //-----------------------------GET GUIDING PRINCIPLES ---------------------------
  @Get('guiding-principles/:clubId')
  getGuidingPrinciples(@Req() req: Request, @Param('clubId') clubId: string) {
    return this.clubService.getGuidingPrinciples(clubId);
  }

  /**
   * Deletes a club by its ID
   * @param id - ID of the club to delete
   * @returns Result of deletion operation
   */
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a club' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'The club has been successfully deleted.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Club not found',
  })
  async deleteClub(@Param('id') id: string) {
    return await this.clubService.deleteClub(id);
  }

  @Get('archived-plugins/:clubId')
  async getArchivedPlugins(@Param('clubId') clubId: string) {
    return await this.clubService.getArchivedPlugins(clubId);
  }

  @Roles('owner', 'admin')
  @UseGuards(ClubRoleGuard)
  @Put('manage-archive/:id')
  async manageArchive(@Body() body: { plugin: string, pluginType: 'standard' | 'custom', action: "archive" | "unarchive" }, @Param('id') clubId: string) {
    return await this.clubService.manageArchive(clubId, body);
  }

  @Get('existing-plugins/:clubId')
  async getExistingPlugins(@Param('clubId') clubId: string) {
    return await this.clubService.getExistingPlugins(clubId);
  }

  @Roles('owner', 'admin')
  @UseGuards(ClubRoleGuard)
  @Put('committee-event/:id')
  @UseInterceptors(
    FilesInterceptor('images', 25, {
      storage: memoryStorage(),
    }),
  )
  async manageCommitteeEvent(
    @UploadedFiles(
      new FileValidationPipe({
        images: {
          maxSizeMB: 4,
          allowedMimeTypes: [
            'image/jpeg',
            'image/jpg',
            'image/png',
          ],
          required: false,
        },
      }),
    )
    images: Express.Multer.File[],
    @Body() body: any,
    @Param('id') clubId: string,
  ) {
    const updatedBody = {
      ...body,
      images: images,
    };
    return this.clubService.manageCommitteeEvent(clubId, updatedBody);
  }

  @Get('committee-events/:clubId/:committeeId')
  getCommitteeEvents(
    @Param('clubId') clubId: string,
    @Param('committeeId') committeeId: string,
  ) {
    return this.clubService.getCommitteeEvents(clubId, committeeId);
  }

  // -------------------------------- MAKE IT BETTER --------------------------------

  @Post('make-it-better/:id')
  async submitMakeItBetter(
    @Body() body: { type: string; contactDetails?: string; description: string },
    @Param('id') clubId: string,
  ) {
    return await this.clubService.submitMakeItBetter(clubId, body);
  }

  @Roles('owner', 'admin')
  @UseGuards(ClubRoleGuard)
  @Get('make-it-better/:id')
  async getMakeItBetter(@Param('id') clubId: string) {
    return await this.clubService.getMakeItBetter(clubId);
  }

  @Roles('owner', 'admin')
  @UseGuards(ClubRoleGuard)
  @Delete('make-it-better/:id/:feedbackId')
  async deleteMakeItBetter(
    @Param('id') clubId: string,
    @Param('feedbackId') feedbackId: string,
  ) {
    return await this.clubService.deleteMakeItBetter(clubId, feedbackId);
  }

  /**
   * Updates an existing club's details
   * @param id - ID of the club to update
   * @param files - Optional updated profile and cover images
   * @param updateClubDto - DTO containing updated club details
   * @returns Updated club
   */
  @Put(':id')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'profileImage', maxCount: 1 },
      { name: 'coverImage', maxCount: 1 },
    ]),
  )
  async updateClub(
    @Param('id') id: string,
    @UploadedFiles(
      new FileValidationPipe({
        profileImage: {
          maxSizeMB: 5,
          allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png'],
          required: false,
        },
        coverImage: {
          maxSizeMB: 10,
          allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png'],
          required: false,
        },
      }),
    )
    files: {
      profileImage?: Express.Multer.File[];
      coverImage?: Express.Multer.File[];
    },
    @Body() updateClubDto: UpdateClubDto,
  ) {
    return await this.clubService.updateClub(id, {
      ...updateClubDto,
      customColor: updateClubDto.customColor,
      profileImage: files?.profileImage?.[0],
      coverImage: files?.coverImage?.[0],
    });
  }

  /**
   * Gets details of a specific club
   * @param id - ID of the club to retrieve
   * @returns Club details
   * @throws NotFoundException if club doesn't exist
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get a club by id' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns the club',
    type: Club,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Club not found',
  })
  async getClub(@Param('id') id: Types.ObjectId, @Req() req: Request) {
    const club = await this.clubService.getClubById(id, req.user.isOnBoarded);
    if (!club) {
      throw new NotFoundException('Club not found');
    }
    return club;
  }
}
