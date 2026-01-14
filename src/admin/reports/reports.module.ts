import { Module } from '@nestjs/common';
import { AdminReportsService } from './reports.service';
import { AdminReportsController } from './reports.controller';
import { SharedModule } from 'src/shared/shared.module';
import { AuthModule } from 'src/user/auth/auth.module';

@Module({
  imports: [SharedModule, AuthModule],
  controllers: [AdminReportsController],
  providers: [AdminReportsService],
  exports: [AdminReportsService],
})
export class AdminReportsModule { }