import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Report } from 'src/shared/entities/reports.entity';
import { ReportReason } from 'src/shared/entities/report-reason.entity';
import { CreateReportDto } from './dto/create-report.dto';
import { DEFAULT_REPORT_REASONS } from 'src/shared/entities/report-reason.seeder';

@Injectable()
export class ReportsService {
  constructor(
    @InjectModel(Report.name) private reportModel: Model<Report>,
    @InjectModel(ReportReason.name) private reportReasonModel: Model<ReportReason>,
  ) {}

  async createReport(userId: Types.ObjectId, createReportDto: CreateReportDto) {
    const reasonExists = await this.reportReasonModel.findById(createReportDto.reasonId);
    if (!reasonExists) {
      throw new NotFoundException('Report reason not found');
    }

    const report = await this.reportModel.create({
      ...createReportDto,
      reportedBy: userId,
    });

    return report.populate('reasonId reportedBy', 'title description firstName lastName userName');
  }

  async getReportReasons() {
    const reasons = await this.reportReasonModel.find({ isActive: true }).sort({ sortOrder: 1 });
    
    // If no reasons exist, seed them
    if (reasons.length === 0) {
      await this.seedReportReasons();
      return await this.reportReasonModel.find({ isActive: true }).sort({ sortOrder: 1 });
    }
    
    return reasons;
  }

  private async seedReportReasons() {
    await this.reportReasonModel.insertMany(DEFAULT_REPORT_REASONS);
  }
}