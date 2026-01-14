import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { User, UserSchema } from 'src/shared/entities/user.entity';
import { Node_, NodeSchema } from 'src/shared/entities/node.entity';
import { Club, ClubSchema } from 'src/shared/entities/club.entity';
import { StdPluginAsset, StdPluginAssetSchema } from 'src/shared/entities/standard-plugin/std-plugin-asset.entity';
import { Module as ModuleEntity, ModuleSchema } from 'src/shared/entities/module.entity';
import { AuthModule } from 'src/user/auth/auth.module';
import { Report, ReportSchema } from 'src/shared/entities/reports.entity';
import { StdPlugin, StdPluginSchema } from 'src/shared/entities/standard-plugin/std-plugin.entity';
import { Domain, DomainSchema } from 'src/shared/entities/domain.entity';

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