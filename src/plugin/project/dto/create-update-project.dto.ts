import { PartialType } from '@nestjs/mapped-types';
import { Transform, Type } from 'class-transformer';
import {
  IsString,
  IsNumber,
  IsOptional,
  IsDate,
  IsArray,
  ValidateNested,
  IsEnum,
  IsMongoId,
} from 'class-validator';
import { Types } from 'mongoose';

class TeamMemberDto {
  @IsMongoId()
  name: Types.ObjectId;

  @IsString()
  designation: string[];
}

class BudgetDto {
  @IsNumber()
  from: number;

  @IsNumber()
  to: number;

  @IsString()
  currency: string;
}

// Parameter DTO
class ParameterDto {
  @IsString()
  title: string;

  @IsNumber()
  value: number;

  @IsString()
  unit: string;
}

// FAQ DTO
class FaqDto {
  @IsMongoId()
  @IsOptional()
  project?: Types.ObjectId;

  @IsEnum(['proposed', 'approved', 'rejected'])
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  answer: string;

  @IsString()
  question: string;

  @IsMongoId()
  @IsOptional()
  askedBy?: Types.ObjectId;

  @IsMongoId()
  @IsOptional()
  answeredBy?: Types.ObjectId;

  @IsDate()
  @Type(() => Date)
  @IsOptional()
  Date?: Date;
}

// Combined Project Creation DTO
export class CreateProjectDto {

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  deletedImageUrls?: string[];

  @IsOptional()
  deletedParameters?: string[];

  @IsOptional()
  deletedFaqs?: string[];

  @IsMongoId()
  @IsOptional()
  club?: Types.ObjectId;

  @IsMongoId()
  @IsOptional()
  node?: Types.ObjectId;

  @IsMongoId()
  @IsOptional()
  chapter?: Types.ObjectId;

  // Project Details
  @IsString()
  title: string;

  @IsString()
  region: string;

  @ValidateNested()
  budget: any;

  @IsOptional()
  @Transform(({ value }) => {
    if (value) {
      const [day, month, year] = value.split('/');
      return new Date(year, month - 1, day);
    }
    return undefined;
  })
  @IsDate()
  deadline?: Date;

  @IsString()
  significance: string;

  @IsString()
  @IsOptional()
  solution?: string;

  bannerImage: Express.Multer.File;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TeamMemberDto)
  @IsOptional()
  committees?: TeamMemberDto[];

  @IsArray()
  @IsOptional()
  champions?: { user: Types.ObjectId }[];

  @IsString()
  @IsOptional()
  aboutPromoters?: string;

  @IsString()
  @IsOptional()
  fundingDetails?: string;

  @IsString()
  @IsOptional()
  keyTakeaways?: string;

  @IsString()
  @IsOptional()
  howToTakePart?: string;

  @IsString()
  @IsOptional()
  risksAndChallenges?: string;

  @IsEnum(['draft', 'published', 'proposed', 'rejected'])
  @IsOptional()
  status?: string;

  @IsArray()
  @IsOptional()
  files?: Express.Multer.File[];

  // Optional Parameters Array
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ParameterDto)
  parameters: ParameterDto[];

  // Optional FAQs Array
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FaqDto)
  @IsOptional()
  faqs?: FaqDto[];

  @IsMongoId()
  @IsOptional()
  createdBy?: Types.ObjectId;

  @IsString()
  relatedEvent: string

  @IsString()
  closingRemark: string

  @IsString()
  @IsOptional()
  publishedStatus?: string
}

export class UpdateProjectDto extends PartialType(CreateProjectDto) { }
