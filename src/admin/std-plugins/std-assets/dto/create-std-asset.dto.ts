// import { Type } from 'class-transformer';
// import {
//     IsString, IsOptional, IsBoolean, IsEnum, IsMongoId,
//     ValidateNested, IsArray, IsNumber, IsDate, IsUrl,
//     MinLength, MaxLength, Min, Max, ArrayMinSize
// } from 'class-validator';
// import { Types } from 'mongoose';
// import { EPublishedStatus } from 'src/shared/entities/standard-plugin/std-plugin-asset.entity';
// // import { EPublishedStatus } from 'typings';


// class FaqItemDto {
//     @IsString()
//     @MinLength(3)
//     @MaxLength(200)
//     question: string;

//     @IsString()
//     @MinLength(3)
//     @MaxLength(500)
//     answer: string;
// }

// class UpdateItemDto {
//     @IsString()
//     @MinLength(3)
//     @MaxLength(100)
//     title: string;

//     @IsString()
//     @MinLength(10)
//     @MaxLength(1000)
//     content: string;

//     @IsDate()
//     @Type(() => Date)
//     date: Date;
// }

// export class AssetDataDto {
//     @IsString()
//     @MinLength(3)
//     @MaxLength(100)
//     title: string;

//     @IsString()
//     @MinLength(10)
//     @MaxLength(1000)
//     description: string;

//     @ValidateNested({ each: true })
//     @IsArray()
//     @IsOptional()
//     @Type(() => UpdateItemDto)
//     updates?: UpdateItemDto[];

//     @IsString()
//     @IsOptional()
//     type?: string;

//     @IsString()
//     @IsOptional()
//     totalBeneficiaries?: string;

//     @IsNumber()
//     @Min(0)
//     @IsOptional()
//     totalBudget?: number;

//     @IsString()
//     @IsOptional()
//     qualifications?: string;

//     @IsString()
//     @MinLength(2)
//     @MaxLength(50)
//     @IsOptional()
//     domain?: string;

//     @IsArray()
//     @IsString({ each: true })
//     @IsOptional()
//     tags?: string[];

//     @IsArray()
//     @IsUrl({}, { each: true })
//     @IsOptional()
//     authenticityLink?: string[];

//     @ValidateNested({ each: true })
//     @IsArray()
//     @IsOptional()
//     @Type(() => FaqItemDto)
//     faq?: FaqItemDto[];

//     @IsString()
//     @IsOptional()
//     @MinLength(3)
//     @MaxLength(500)
//     significance?: string;

//     @IsDate()
//     @Type(() => Date)
//     deadline: Date;

//     @IsString()
//     @MinLength(10)
//     @MaxLength(500)
//     howItHelps: string;

//     @IsString()
//     @MinLength(3)
//     @MaxLength(100)
//     @IsOptional()
//     pocDetails?: string;

//     @IsNumber()
//     @Min(10)
//     @Max(50000)
//     @IsOptional()
//     cost?: number;

//     @IsArray()
//     @ArrayMinSize(1)
//     files: string[];
// }


// export class CreateStdAssetDto {
//     @IsString()
//     plugin: string;

//     @IsMongoId()
//     club: Types.ObjectId;

//     @IsMongoId()
//     node: Types.ObjectId;

//     @IsMongoId()
//     chapter: Types.ObjectId;

//     @IsEnum(EPublishedStatus)
//     @IsOptional()
//     publishedStatus?: EPublishedStatus;

//     @IsString()
//     @IsOptional()
//     statusNotes?: string;

//     @IsBoolean()
//     @IsOptional()
//     isPublic?: boolean;

//     // Data fields based on the plugin fields
//     @ValidateNested()
//     @Type(() => AssetDataDto)
//     data: AssetDataDto;
// }

