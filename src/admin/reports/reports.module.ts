import { Module } from '@nestjs/common';
import { AdminReportsService } from './reports.service';
import { AdminReportsController } from './reports.controller';
import { SharedModule } from '../../shared/shared.module';
import { AuthModule } from '../../user/auth/auth.module';

@Module({
  imports: [SharedModule, AuthModule],
  controllers: [AdminReportsController],
  providers: [AdminReportsService],
  exports: [AdminReportsService],
})
export class AdminReportsModule { }