import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { CreateReportDto } from './dto/create-report.dto';
import { UserAuthGuard } from '../guards/user-auth.guard';

@ApiTags('Reports')
@ApiBearerAuth()
@Controller('report')
@UseGuards(UserAuthGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post()
  async createReport(@Req() req: any, @Body() createReportDto: CreateReportDto) {
    const userId = req.user._id;
    return this.reportsService.createReport(userId, createReportDto);
  }

  @Get('reasons')
  async getReportReasons() {
    return this.reportsService.getReportReasons();
  }
}