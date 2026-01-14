// import { Type } from 'class-transformer';
// import {
//     IsString, IsOptional, IsBoolean, IsEnum, IsMongoId,
//     ValidateNested,
// } from 'class-validator';
// import { Types } from 'mongoose';
// import { EPublishedStatus } from '../../../../shared/entities/standard-plugin/std-plugin-asset.entity';
// import { AssetDataDto } from './create-std-asset.dto';

// export class UpdateStdAssetDto {
//     @IsMongoId()
//     @IsOptional()
//     plugin?: Types.ObjectId;

//     @IsMongoId()
//     @IsOptional()
//     club?: Types.ObjectId;

//     @IsMongoId()
//     @IsOptional()
//     node?: Types.ObjectId;

//     @IsMongoId()
//     @IsOptional()
//     chapter?: Types.ObjectId;

//     @IsEnum(EPublishedStatus)
//     @IsOptional()
//     publishedStatus?: EPublishedStatus;

//     @IsString()
//     @IsOptional()
//     statusNotes?: string;

//     @IsBoolean()
//     @IsOptional()
//     isPublic?: boolean;

//     @IsBoolean()
//     @IsOptional()
//     isActive?: boolean;

//     // Data fields based on the plugin fields
//     @ValidateNested()
//     @Type(() => AssetDataDto)
//     @IsOptional()
//     data?: Partial<AssetDataDto>;
// }
