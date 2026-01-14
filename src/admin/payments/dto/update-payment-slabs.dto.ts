import {
  IsString,
  IsNumber,
  IsArray,
  ValidateNested,
  IsBoolean,
  Min,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';

export class FeatureValueDto {
  @IsString()
  featureKey: string;

  @IsNumber()
  @Min(0)
  countValue: number;

  @IsBoolean()
  enabled: boolean;
}

export class SlabDto {
  @IsString()
  slabKey: string;

  @IsString()
  name: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsBoolean()
  isFree: boolean;

  @IsNumber()
  order: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FeatureValueDto)
  features: FeatureValueDto[];

  // Pricing card display fields
  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  annualPrice?: number;

  @IsOptional()
  @IsBoolean()
  isPopular?: boolean;

  @IsOptional()
  @IsString()
  buttonText?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  displayFeatures?: string[];
}

export class UpdatePaymentSlabsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SlabDto)
  slabs: SlabDto[];
}
