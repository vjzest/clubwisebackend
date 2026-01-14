import {
    IsArray,
    IsMongoId,
    IsNotEmpty,
    IsOptional,
    IsString,
    MaxLength,
    ValidateNested,
    IsNumber,
    IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';

export class FileDto {
    @IsString()
    buffer: string;

    @IsString()
    originalname: string;

    @IsString()
    mimetype: string;

    @IsNumber()
    size: number;
}

export class CreateGenericPostDto {
    @IsNotEmpty()
    @IsMongoId()
    forumId: string;

    @IsNotEmpty()
    @IsString()
    forumType: 'node' | 'club' | 'chapter';

    @IsNotEmpty()
    @IsString()
    @MaxLength(5000)
    content: string;

    @IsNotEmpty()
    @IsString()
    @IsEnum(['thought', 'announcement'])
    genericType: 'thought' | 'announcement';

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => FileDto)
    files?: FileDto[];

}
