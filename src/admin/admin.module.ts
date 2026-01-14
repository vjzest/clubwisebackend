import { Module } from '@nestjs/common';
import { AdminStdPluginsModule } from './std-plugins/std-plugins.module';
import { UploadService } from 'src/shared/upload/upload.service';
import { UsersModule } from './users/users.module';
import { ForumsModule } from './forums/forums.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { AdminReportsModule } from './reports/reports.module';
import { AdminAssetsModule } from './assets/admin-assets.module';
import { DomainModule } from './domain/domain.module';
import { ConfigurationModule } from './configuration/configuration.module';
import { PaymentsModule } from './payments/payments.module';

@Module({
  imports: [
    AdminStdPluginsModule,
    UsersModule,
    ForumsModule,
    DashboardModule,
    AdminReportsModule,
    AdminAssetsModule,
    DomainModule,
    ConfigurationModule,
    PaymentsModule,
  ],
  providers: [UploadService]
})
export class AdminModule { }
