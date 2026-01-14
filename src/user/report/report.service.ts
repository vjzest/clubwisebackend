import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Report } from 'src/shared/entities/reports.entity';
import { CreateReportDto } from './dto/createreport.dto';

@Injectable()
export class ReportService {
  constructor(@InjectModel(Report.name) private reportModel: Model<Report>) {}

  async report(userId: Types.ObjectId, reportData: CreateReportDto) {
    const response = await this.reportModel.create({
      type: reportData.type,
      reportedBy: userId,
      typeId: reportData.typeId,
    });
  }
}
