import { IsEnum, IsMongoId, IsOptional, IsString, MaxLength } from 'class-validator';
import { Types } from 'mongoose';
import { AssetType } from '../../../shared/entities/reports.entity';

export class CreateReportDto {
  @IsEnum(AssetType)
  assetType: AssetType;

  @IsMongoId()
  assetId: Types.ObjectId;

  @IsString()
  @IsOptional()
  assetReference: string;

  @IsMongoId()
  reasonId: Types.ObjectId;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  additionalDetails?: string;

  @IsOptional()
  @IsString({ each: true })
  attachments?: string[];
}