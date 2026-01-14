import { IsString, IsArray, IsEnum, IsNotEmpty, ValidateNested, IsOptional, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class CTAResponseAnswerDto {
  @IsString()
  @IsNotEmpty()
  questionId: string;

  @IsString()
  @IsNotEmpty()
  questionText: string;

  @IsEnum(['yes_no', 'text', 'number', 'multiple_choice', 'file'])
  @IsNotEmpty()
  responseType: string;

  // Answer is validated in the service layer based on isRequired field
  @IsOptional()
  answer?: string | number | Record<string, any>;

  @IsString()
  @IsOptional()
  idealAnswer?: string;

  // File metadata for file uploads
  @IsString()
  @IsOptional()
  fileUrl?: string;

  @IsNumber()
  @IsOptional()
  fileSize?: number;

  @IsString()
  @IsOptional()
  fileName?: string;
}

export class SubmitCtaResponseDto {
  @IsString()
  @IsNotEmpty()
  assetId: string;

  @IsString()
  @IsNotEmpty()
  pluginId: string;

  @IsEnum(['club', 'chapter', 'node'])
  @IsNotEmpty()
  forum: string;

  @IsString()
  @IsNotEmpty()
  forumId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CTAResponseAnswerDto)
  responses: CTAResponseAnswerDto[];
}
