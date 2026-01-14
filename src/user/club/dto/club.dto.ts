import { IsString, IsBoolean, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Types } from 'mongoose';

export class CreateClubDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  readonly name: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  readonly about: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  readonly description: string;

  @ApiProperty()
  @IsBoolean()
  readonly isPublic: boolean;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  readonly createdBy: Types.ObjectId;

  profileImage: Express.Multer.File;

  @IsOptional()
  coverImage: Express.Multer.File;

  link?: string;

  plugins: { plugin: string, type: string }[];
  domain: [string]
}

export class UpdateClubDto {
  @ApiProperty({ required: false })
  name?: string;

  @ApiProperty({ required: false })
  about?: string;

  @ApiProperty({ required: false })
  description?: string;

  @ApiProperty({ type: 'string', format: 'binary', required: false })
  profileImage?: Express.Multer.File;

  @ApiProperty({ type: 'string', format: 'binary', required: false })
  coverImage?: Express.Multer.File;

  removeCoverImage: string

  domain: string

  customColor?: string
}
