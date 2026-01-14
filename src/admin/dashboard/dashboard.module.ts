import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { User, UserSchema } from '../../shared/entities/user.entity';
import { Node_, NodeSchema } from '../../shared/entities/node.entity';
import { Club, ClubSchema } from '../../shared/entities/club.entity';
import { StdPluginAsset, StdPluginAssetSchema } from '../../shared/entities/standard-plugin/std-plugin-asset.entity';
import { Module as ModuleEntity, ModuleSchema } from '../../shared/entities/module.entity';
import { AuthModule } from '../../user/auth/auth.module';
import { Report, ReportSchema } from '../../shared/entities/reports.entity';
import { StdPlugin, StdPluginSchema } from '../../shared/entities/standard-plugin/std-plugin.entity';
import { Domain, DomainSchema } from '../../shared/entities/domain.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Node_.name, schema: NodeSchema },
      { name: Club.name, schema: ClubSchema },
      { name: StdPluginAsset.name, schema: StdPluginAssetSchema },
      { name: ModuleEntity.name, schema: ModuleSchema },
      { name: Report.name, schema: ReportSchema },
      { name: StdPlugin.name, schema: StdPluginSchema },
      { name: Domain.name, schema: DomainSchema },
    ]),
    AuthModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule { }