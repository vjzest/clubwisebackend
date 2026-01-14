import {
  Controller,
  Get,
  Param,
  UseGuards,
  UseInterceptors,
  HttpStatus,
  Query,
  Search,
  Req,
  Put,
  Body,
  Patch,
  UploadedFiles,
  Post,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Types } from 'mongoose';
import { UserService } from './user.service';
import { UserResponseDto } from './dto/user.dto';
import { UserWithoutPassword } from './dto/user.type';
import { Request } from 'express';
import { AccessDto } from './dto/access.dto';
import { RoleManagementGuard } from './guards/role-management.guard';
import { Roles } from 'src/decorators/role.decorator';
import { FileFieldsInterceptor } from '@nestjs/platform-express';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) { }

  @Get('search')
  async getUsersNotInClubOrNode(
    @Query('type') type: 'node' | 'club',
    @Query('entityId') id: Types.ObjectId,
    @Query('keyword') keyword?: string,
  ): Promise<UserWithoutPassword[]> {
    try {
      // Return empty array if search term is less than 2 characters
      if (!keyword || keyword.trim().length < 2) {
        return [];
      }
      return await this.userService.getUsersNotInClubOrNode(keyword, type, id);
    } catch (error) {
      throw error;
    }
  }

  @Get('fetch-other-profile/:userId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user profile by ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User profile retrieved successfully',
    type: UserResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'User not found',
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'Internal server error',
  })
  async getUserProfile(@Param('userId') userId: string) {
    return await this.userService.findUserById(new Types.ObjectId(userId));
  }

  /**
   * Retrieves a user by their username
   * @param term - The username search term
   * @returns Promise containing the matching user data
   */
  @Get('username')
  async getUserByUserName(@Query('term') term: string) {
    return await this.userService.getUserByUserName(term);
  }

  @Get('search-by-name')
  async getUsersByNameCriteria(@Query('term') term: string) {
    return await this.userService.getUsersByNameCriteria(term);
  }

  @Get('isUserLoggedIn')
  async isUserLoggedIn(@Req() req: Request) {
    const userId = new Types.ObjectId(req.user._id);
    return await this.userService.isUserLoggedIn(userId);
  }

  // @Get(':search')
  // async getAllUsers(
  //   @Param('search') search: string,
  // ): Promise<UserWithoutPassword[]> {
  //   try {
  //     return await this.userService.getAllUsers(search);
  //   } catch (error) {
  //     throw error;
  //   }
  // }

  //----------------- MAKE ADMIN -------------------------
  // @Roles('owner', 'admin')
  // @UseGuards(RoleManagementGuard)
  @Put('make-admin')
  async makeAdmin(@Req() req: Request, @Body() accessDto: AccessDto) {
    return await this.userService.makeAdmin(accessDto);
  }

  //----------------- MAKE MODERATOR -------------------------
  // @Roles('owner', 'admin')
  // @UseGuards(RoleManagementGuard)
  @Put('make-moderator')
  async makeModerator(@Req() req: Request, @Body() accessDto: AccessDto) {
    return await this.userService.makeModerator(accessDto);
  }

  //----------------- MAKE MEMBER -------------------------
  // @Roles('owner', 'admin')
  // @UseGuards(RoleManagementGuard)
  @Put('make-member')
  async makeMember(@Req() req: Request, @Body() accessDto: AccessDto) {
    return await this.userService.makeMember(accessDto);
  }

  //----------------- REMOVE MEMBER -------------------------
  @Put('remove-member')
  async removeMember(@Req() req: Request, @Body() accessDto: AccessDto) {
    return await this.userService.removeMember(accessDto);
  }

  @Patch('designation')
  async updateDesignation(
    @Req() req: Request,
    @Body()
    {
      designation,
      nodeId,
      memberId,
    }: { designation: string; memberId: string; nodeId: string },
  ) {
    return await this.userService.updateDesignation(
      req.user._id,
      memberId,
      nodeId,
      designation,
    );
  }

  @Patch(':nodeId/members/:memberId/position')
  async updatePosition(
    @Param('nodeId') nodeId: string,
    @Param('memberId') memberId: string,
    @Body('position') position: string,
    @Req() req,
  ) {
    const userId = req.user.id; // Assuming user ID is available in the request
    return await this.userService.updatePosition(
      userId,
      memberId,
      nodeId,
      position,
    );
  }

  @Get('profile/:username')
  async fetchProfile(@Param('username') username: string, @Req() req: Request) {
    console.log(username);
    return this.userService.fetchProfile(username);
  }

  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'profileImage', maxCount: 1 },
      { name: 'coverImage', maxCount: 1 },
    ]),
  )
  @Patch('profile')
  async updateProfile(
    @Body() updateUserProfile,
    @UploadedFiles()
    files: {
      profileImage: Express.Multer.File;
      coverImage: Express.Multer.File;
    },
    @Req() req: Request,
  ) {
    console.log({ updateUserProfile });
    const userId = req.user._id;
    return this.userService.updateProfile(
      updateUserProfile.firstName,
      updateUserProfile.lastName,
      files?.profileImage?.[0],
      files?.coverImage?.[0],
      updateUserProfile.interests,
      userId,
      updateUserProfile.phone,
      updateUserProfile.visibility
        ? JSON.parse(updateUserProfile.visibility)
        : null,
    );
  }

  @Get('my-all-issues')
  fetchMyAllIssues(@Req() req: Request, @Query('id') targetUserId: string) {
    return this.userService.getMyAllIssues(req.user._id, targetUserId);
  }

  @Get('my-all-debates')
  fetchMyAllDebates(@Req() req: Request, @Query('id') targetUserId: string) {
    return this.userService.getMyAllDebates(req.user._id, targetUserId);
  }

  @Get('my-all-projects')
  fetchMyAllProjects(@Req() req: Request, @Query('id') targetUserId: string) {
    return this.userService.getMyAllProjects(req.user._id, targetUserId);
  }

  @Get('my-all-rules')
  fetchMyAllRules(@Req() req: Request, @Query('id') targetUserId: string) {
    return this.userService.getMyAllRules(req.user._id, targetUserId);
  }

  @Get('my-all-standard-assets/:pluginId')
  fetchMyAllStandardAssets(@Req() req: Request, @Param('pluginId') pluginId: string, @Query('id') targetUserId: string) {
    return this.userService.getMyAllStandardAssets(req.user._id, pluginId, targetUserId);
  }

  @Get('/asset-count')
  fetchAssetCount(@Req() req: Request, @Query('id') targetUserId: string) {
    return this.userService.getAssetsCount(req.user._id, targetUserId);
  }

  @Get('dashboard')
  fetchDashboard(@Req() req: Request) {
    return this.userService.getDashboard(req.user._id);
  }

  @Get('treasure/modules')
  fetchTreasureModules(
    @Req() req: Request,
    @Query('search') search?: string,
  ) {
    const searchTerm = search || '';
    return this.userService.getTreasureModules(
      searchTerm,
    );
  }

  @Get('treasure/assets/:moduleType')
  fetchTreasureAssets(
    @Param('moduleType')
    moduleType: 'rule' | 'debate' | 'issue' | 'project' | 'stdPlugin',
    @Query('moduleId') moduleId?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('page') page?: string,
    @Query('forumId') forumId?: string,
    @Query('forumType') forumType?: 'node' | 'club',
  ) {
    const searchTerm = search || '';
    const limitValue = limit ? parseInt(limit) : 9;
    const pageValue = page ? parseInt(page) : 1;
    return this.userService.fetchTreasureAssets(
      searchTerm,
      limitValue,
      pageValue,
      moduleType,
      moduleId,
      forumId,
      forumType,
    );
  }

  @Get('treasure/forums')
  fetchTreasureForums(
    @Query('search') search?: string,
  ) {
    const searchTerm = search || '';
    return this.userService.getTreasureForums(
      searchTerm,
    );
  }

  @Post('post/time-spent')
  async postTimeSpent(
    @Req() req: Request,
    @Body()
    body: {
      postId: string;
      postType: 'rule' | 'debate' | 'issue' | 'project' | 'stdPlugin';
      seconds: number;
    },
  ) {
    return this.userService.postTimeSpent(
      body.postId,
      body.postType,
      body.seconds,
      req.user._id,
    );
  }

  @Get('standard-modules')
  fetchStandardModules(@Req() req: Request) {
    return this.userService.getStandardModules();
  }
}
