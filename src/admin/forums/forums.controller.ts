import {
  Controller,
  Get,
  Query,
  Req,
  BadRequestException,
  InternalServerErrorException
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { ForumsService } from './forums.service';
import { AuthorizationService } from '../../user/auth/authorization.service';

@ApiTags('Admin - Forums')
@ApiBearerAuth()
@Controller('admin')
export class ForumsController {
  constructor(
    private readonly forumsService: ForumsService,
    private readonly authorizationService: AuthorizationService
  ) { }

  @Get('clubs')
  async getAllClubs(
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

      return this.forumsService.getAllClubs(pageNum, limitNum, search);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException('Error fetching clubs');
    }
  }

  @Get('nodes')
  async getAllNodes(
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

      return this.forumsService.getAllNodes(pageNum, limitNum, search);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException('Error fetching nodes');
    }
  }
}