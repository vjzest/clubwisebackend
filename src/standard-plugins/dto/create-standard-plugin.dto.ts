// standard-plugin.dto.ts
import { Type } from 'class-transformer';
import {
    IsString, IsBoolean, IsArray, IsEnum, IsOptional,
    ValidateNested, MinLength, MaxLength, IsNumber, Min,
    ArrayMinSize, IsDateString,
} from 'class-validator';
import { FieldType, KeyType } from '../../shared/entities/standard-plugin/std-plugin.entity';

export class FieldOptionDto {
    @IsString()
    value: string;

    @IsString()
    label: string;
}

export class CreateStdPluginFieldDto {
    @IsEnum(['title', 'description', 'updates', 'type', 'totalBeneficiaries', 'totalBudget', 'qualifications',
        'domain', 'tags', 'authenticityLink', 'faq', 'significance', 'deadline',
        'howItHelps', 'pocDetails', 'cost', 'files'], {
        message: 'Invalid key type'
    })
    key: KeyType;

    @IsString()
    @MinLength(1)
    @MaxLength(100)
    label: string;

    @IsEnum(['text', 'textarea', 'select', 'number', 'date', 'file', 'tags', 'domain', 'updates', 'faq'], {
        message: 'Invalid field type'
    })
    type: FieldType;

    @IsOptional()
    @IsBoolean()
    required?: boolean;

    @IsOptional()
    @IsString()
    placeholder?: string;

    @IsOptional()
    @IsNumber()
    @Min(0)
    minLength?: number;

    @IsOptional()
    @IsNumber()
    @Min(1)
    maxLength?: number;

    @IsOptional()
    @IsNumber()
    min?: number;

    @IsOptional()
    @IsNumber()
    max?: number;

    @IsOptional()
    @IsDateString()
    minDate?: string;

    @IsOptional()
    @IsDateString()
    maxDate?: string;

    @IsOptional()
    @IsBoolean()
    disablePast?: boolean;

    @IsOptional()
    @IsBoolean()
    allowMultiple?: boolean;

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => FieldOptionDto)
    options?: FieldOptionDto[];
}

export class CreateStdPluginDto {
    @IsString()
    @MinLength(3, {
        message: 'Module name must be at least 3 characters long'
    })
    @MaxLength(100, {
        message: 'Module name must be less than 100 characters long'
    })
    name: string;

    @IsString()
    @MinLength(10)
    @MaxLength(1000)
    description: string;

    @IsOptional()
    @IsBoolean()
    canBePublic?: boolean;

    @IsOptional()
    @IsBoolean()
    canBeAdopted?: boolean;

    @IsArray()
    @ArrayMinSize(1)
    @ValidateNested({ each: true })
    @Type(() => CreateStdPluginFieldDto)
    fields: CreateStdPluginFieldDto[];
}
