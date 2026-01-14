import { Body, Controller, Get, Param, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminReportsService } from './reports.service';
import { UpdateReportStatusDto } from './dto/update-report-status.dto';
import { QueryReportsDto } from './dto/query-reports.dto';
import { UserAuthGuard } from '../../user/guards/user-auth.guard';
import { Roles } from '../../decorators/role.decorator';
import { AuthorizationService } from '../../user/auth/authorization.service';
import { Request } from 'express';

@ApiTags('Admin - Reports')
@ApiBearerAuth()
@Controller('admin/reports')
@UseGuards(UserAuthGuard)
@Roles('admin')
export class AdminReportsController {
  constructor(private readonly adminReportsService: AdminReportsService,
    private readonly authorizationService: AuthorizationService) { }

  @Get()
  async getAllReports(@Query() query: QueryReportsDto, @Req() req: Request) {
    await this.authorizationService.validateAdmin(req?.user?._id);
    return this.adminReportsService.getAllReports(query);
  }

  @Get('stats')
  async getReportsStats() {
    return this.adminReportsService.getReportsStats();
  }

  @Get(':id')
  async getReportById(@Param('id') id: string) {
    return this.adminReportsService.getReportById(id);
  }

  @Patch(':id/status')
  async updateReportStatus(
    @Param('id') id: string,
    @Req() req: Request,
    @Body() updateDto: UpdateReportStatusDto
  ) {
    await this.authorizationService.validateAdmin(req?.user?._id);
    const adminId = req.user._id;
    return this.adminReportsService.updateReportStatus(id, adminId, updateDto);
  }
}