import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { Report, ReportStatus, AssetType } from '../../shared/entities/reports.entity';
import { UpdateReportStatusDto } from './dto/update-report-status.dto';
import { QueryReportsDto } from './dto/query-reports.dto';
import { StdPluginAsset } from '../../shared/entities/standard-plugin/std-plugin-asset.entity';
import { StdPlugin } from '../../shared/entities/standard-plugin/std-plugin.entity';
import { RulesRegulations } from '../../shared/entities/rules/rules-regulations.entity';
import { Issues } from '../../shared/entities/issues/issues.entity';
import { Debate } from '../../shared/entities/debate/debate.entity';
import { Projects } from '../../shared/entities/projects/project.entity';

@Injectable()
export class AdminReportsService {
  constructor(
    @InjectModel(Report.name) private reportModel: Model<Report>,
    @InjectModel(StdPluginAsset.name) private stdPluginAssetModel: Model<StdPluginAsset>,
    @InjectModel(RulesRegulations.name) private rulesRegulationsModel: Model<RulesRegulations>,
    @InjectModel(Issues.name) private issuesModel: Model<Issues>,
    @InjectModel(Debate.name) private debateModel: Model<Debate>,
    @InjectModel(Projects.name) private projectsModel: Model<Projects>,
  ) { }

  async getAllReports(query: QueryReportsDto) {
    const {
      status,
      assetType,
      reasonId,
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = query;

    const filter: any = {};

    if (status) filter.status = status;
    if (assetType) filter.assetType = assetType;
    if (reasonId) filter.reasonId = reasonId;

    const skip = (page - 1) * limit;
    const sortObj: any = {};
    sortObj[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const [rawReports, total] = await Promise.all([
      this.reportModel
        .find(filter)
        .populate('reasonId', 'title description')
        .populate('reportedBy', 'firstName lastName userName email')
        .populate('reviewedBy', 'firstName lastName userName')
        .sort(sortObj)
        .skip(skip)
        .limit(limit)
        .lean(),
      this.reportModel.countDocuments(filter),
    ]);

    // 🧠 Define possible asset models
    const assetModels: {
      model: any;
      populate?: { path: string; model: string; select?: string };
    }[] = [
        { model: this.stdPluginAssetModel, populate: { path: 'plugin', model: 'StdPlugin', select: 'name slug logo' } },
        { model: this.rulesRegulationsModel },
        { model: this.issuesModel },
        { model: this.debateModel },
        { model: this.projectsModel },
      ];

    // ⚡ Populate dynamically (TypeScript-safe)
    const reports = await Promise.all(
      rawReports.map(async (report) => {
        for (const { model, populate } of assetModels) {
          let query = model.findById(report.assetId).lean();

          // ✅ Only apply populate if defined
          if (populate) {
            query = model.findById(report.assetId).populate(populate).lean();
          }

          const asset = await query.catch(() => null);
          if (asset) {
            report.assetId = asset;
            break;
          }
        }
        return report;
      })
    );

    return {
      data: reports,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getReportById(id: string) {
    const report = await this.reportModel
      .findById(id)
      .populate('reasonId', 'title description')
      .populate('reportedBy', 'firstName lastName userName email profileImage')
      .populate('reviewedBy', 'firstName lastName userName')
      .lean();

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    return report;
  }

  async updateReportStatus(id: string, adminId: Types.ObjectId, updateDto: UpdateReportStatusDto) {
    const report = await this.reportModel.findById(id);

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    const updatedReport = await this.reportModel
      .findByIdAndUpdate(
        id,
        {
          status: updateDto.status,
          reviewedBy: adminId,
          reviewedAt: new Date(),
          reviewNotes: updateDto.reviewNotes,
        },
        { new: true }
      )
      .populate('reasonId', 'title description')
      .populate('reportedBy', 'firstName lastName userName')
      .populate('reviewedBy', 'firstName lastName userName');

    return updatedReport;
  }

  async getReportsStats() {
    const [
      totalReports,
      pendingReports,
      underReviewReports,
      resolvedReports,
      rejectedReports,
      assetTypeStats,
      recentReports
    ] = await Promise.all([
      this.reportModel.countDocuments(),
      this.reportModel.countDocuments({ status: ReportStatus.PENDING }),
      this.reportModel.countDocuments({ status: ReportStatus.UNDER_REVIEW }),
      this.reportModel.countDocuments({ status: ReportStatus.RESOLVED }),
      this.reportModel.countDocuments({ status: ReportStatus.REJECTED }),
      this.reportModel.aggregate([
        {
          $group: {
            _id: '$assetType',
            count: { $sum: 1 }
          }
        }
      ]),
      this.reportModel
        .find()
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('reasonId', 'title')
        .populate('reportedBy', 'firstName lastName userName')
        .select('assetType status createdAt')
        .lean()
    ]);

    return {
      total: totalReports,
      pending: pendingReports,
      underReview: underReviewReports,
      resolved: resolvedReports,
      rejected: rejectedReports,
      byAssetType: assetTypeStats.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      recent: recentReports
    };
  }
}