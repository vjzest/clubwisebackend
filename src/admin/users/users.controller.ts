import {
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Req,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { UsersService } from './users.service';
import { AuthorizationService } from 'src/user/auth/authorization.service';

@ApiTags('Admin - Users')
@ApiBearerAuth()
@Controller('admin')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly authorizationService: AuthorizationService
  ) { }

  @Get('users')
  async getAllUsers(
    @Req() req: Request,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @Query('search') search?: string
  ) {
    try {
      await this.authorizationService.validateAdmin(req?.user?._id);

      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);

      if (isNaN(pageNum) || pageNum < 1) {
        throw new BadRequestException('Invalid page number');
      }

      if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
        throw new BadRequestException('Invalid limit. Must be between 1 and 100');
      }

      return this.usersService.getAllUsers(pageNum, limitNum, search);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException('Error fetching users');
    }
  }

  @Get('users/:id')
  async getUserById(@Param('id') id: string, @Req() req: Request) {
    try {
      await this.authorizationService.validateAdmin(req?.user?._id);
      return this.usersService.getUserById(id);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Error fetching user');
    }
  }

  @Patch('users/:id/block')
  async blockUser(@Param('id') id: string, @Req() req: Request) {
    try {
      await this.authorizationService.validateAdmin(req?.user?._id);
      return this.usersService.blockUser(id);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Error blocking user');
    }
  }

  @Patch('users/:id/unblock')
  async unblockUser(@Param('id') id: string, @Req() req: Request) {
    try {
      await this.authorizationService.validateAdmin(req?.user?._id);
      return this.usersService.unblockUser(id);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Error unblocking user');
    }
  }
}