import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from 'src/shared/entities/user.entity';
import { Node_ } from 'src/shared/entities/node.entity';
import { Club } from 'src/shared/entities/club.entity';
import { StdPluginAsset } from 'src/shared/entities/standard-plugin/std-plugin-asset.entity';
import { Module } from 'src/shared/entities/module.entity';
import { StdPlugin } from 'src/shared/entities/standard-plugin/std-plugin.entity';
import { Report } from 'src/shared/entities/reports.entity';
import { Domain } from 'src/shared/entities/domain.entity';

@Injectable()
export class DashboardService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(Node_.name) private nodeModel: Model<Node_>,
    @InjectModel(Club.name) private clubModel: Model<Club>,
    @InjectModel(StdPluginAsset.name) private assetModel: Model<StdPluginAsset>,
    @InjectModel(Module.name) private moduleModel: Model<Module>,
    @InjectModel(StdPlugin.name) private stdPluginModel: Model<StdPlugin>,
    @InjectModel(Report.name) private reportModel: Model<Report>,
    @InjectModel(Domain.name) private domainModel: Model<Domain>,
  ) { }

  async getDashboardStats() {
    const [userCount, nodeCount, clubCount, assetCount, moduleCount, reportCount, domainCount] = await Promise.all([
      this.userModel.countDocuments(),
      this.nodeModel.countDocuments(),
      this.clubModel.countDocuments(),
      this.assetModel.countDocuments(),
      this.stdPluginModel.countDocuments(),
      this.reportModel.countDocuments(),
      this.domainModel.countDocuments(),
    ]);

    return {
      success: true,
      data: {
        userCount,
        nodeCount,
        clubCount,
        assetCount,
        moduleCount,
        reportCount,
        domainCount,
      },
    };
  }
}