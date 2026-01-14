import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ReportStatus } from '../../../shared/entities/reports.entity';

export class UpdateReportStatusDto {
  @IsEnum(ReportStatus)
  status: ReportStatus;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reviewNotes?: string;
}