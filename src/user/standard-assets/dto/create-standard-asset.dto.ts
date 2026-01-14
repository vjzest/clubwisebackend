import { Type } from 'class-transformer';
import {
    IsString, IsOptional, IsBoolean, IsEnum, IsMongoId,
    ValidateNested, IsArray, IsNumber, IsDate, IsUrl,
    MinLength, MaxLength, Min, Max, ArrayMinSize,
    IsObject,
    ValidateIf
} from 'class-validator';
import { Types } from 'mongoose';
import { EPublishedStatus } from 'src/shared/entities/standard-plugin/std-plugin-asset.entity';
import { Transform } from 'class-transformer';


class FaqItemDto {
    @IsString()
    @MinLength(3)
    @MaxLength(200)
    question: string;

    @IsString()
    @MinLength(3)
    @MaxLength(500)
    answer: string;
}

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

export class AssetDataDto {
    @IsOptional()
    @IsString()
    @ValidateIf((o) => o.publishedStatus !== EPublishedStatus.DRAFT)
    @MinLength(3)
    @MaxLength(100)
    title: string;

    @IsOptional()
    @IsString()
    @ValidateIf((o) => o.publishedStatus !== EPublishedStatus.DRAFT)
    @MinLength(10)
    @MaxLength(1000)
    description: string;

    @Transform(({ value }) => value === 'true')
    @IsBoolean()
    @IsOptional()
    isUpdatesExist?: boolean;

    @IsString()
    @IsOptional()
    type?: string;

    @IsString()
    @IsOptional()
    totalBeneficiaries?: string;

    @IsString()
    @IsOptional()
    totalBudget?: string;

    @IsString()
    @IsOptional()
    qualifications?: string;

    @Transform(({ value }) => {
        try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed.map((tag) => tag.trim()) : [];
        } catch {
            return [];
        }
    })
    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    domain?: string[];

    @Transform(({ value }) => {
        try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed.map((tag) => tag.trim()) : [];
        } catch {
            return [];
        }
    })
    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    tags?: string[];

    @Transform(({ value }) => {
        try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed.map((tag) => tag.trim()) : [];
        } catch {
            return [];
        }
    })
    @IsArray()
    @IsOptional()
    authenticityLink?: string[];

    @Transform(({ value }) => {
        try {
            // Parse if it's a JSON string
            const parsed = typeof value === 'string' ? JSON.parse(value) : value;
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    })
    @IsArray()
    // @ValidateNested({ each: true })
    @Type(() => FaqItemDto)
    @IsOptional()
    faq?: FaqItemDto[];

    @IsString()
    @IsOptional()
    @MinLength(3)
    @MaxLength(500)
    significance?: string;

    @IsDate()
    @Type(() => Date)
    @IsOptional()
    deadline?: Date;

    @IsString()
    @MinLength(10)
    @MaxLength(500)
    @IsOptional()
    howItHelps?: string;

    @IsString()
    @MinLength(3)
    @MaxLength(100)
    @IsOptional()
    pocDetails?: string;

    @IsString()
    @IsOptional()
    cost?: string;

    @Transform(({ value }) => JSON.parse(value))
    @IsObject()
    @IsOptional()
    cta?: {
        label: string;
        link: string;
    };

    @IsOptional()
    files?: string[];

    @IsOptional()
    department?: string;
}


export class CreateStdAssetDto extends AssetDataDto {

    @IsString()
    @IsOptional()
    stdAssetId?: string;

    @IsString()
    @IsOptional()
    deletedImageUrls?: string[];

    @IsString()
    plugin: string;

    @IsMongoId()
    @IsOptional()
    club: Types.ObjectId;

    @IsMongoId()
    @IsOptional()
    node: Types.ObjectId;

    @IsMongoId()
    @IsOptional()
    chapter: Types.ObjectId;

    @IsEnum(EPublishedStatus)
    @IsOptional()
    publishedStatus?: EPublishedStatus;

    @IsString()
    @IsOptional()
    statusNotes?: string;

    @IsBoolean()
    @IsOptional()
    isPublic?: boolean;

    // Data fields based on the plugin fields
    // @ValidateNested()
    // @Type(() => AssetDataDto)
    // data: AssetDataDto;
}

