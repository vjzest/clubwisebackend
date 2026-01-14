import {
  Controller,
  Get,
  Req,
  InternalServerErrorException
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { DashboardService } from './dashboard.service';
import { AuthorizationService } from 'src/user/auth/authorization.service';

@ApiTags('Admin - Dashboard')
@ApiBearerAuth()
@Controller('admin/dashboard')
export class DashboardController {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly authorizationService: AuthorizationService
  ) { }

  @Get('stats')
  async getDashboardStats(@Req() req: Request) {
    try {
      await this.authorizationService.validateAdmin(req?.user?._id);
      return this.dashboardService.getDashboardStats();
    } catch (error) {
      throw new InternalServerErrorException('Error fetching dashboard statistics');
    }
  }
}