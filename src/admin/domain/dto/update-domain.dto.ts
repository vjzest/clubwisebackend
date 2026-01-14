// src/domains/dto/update-domain.dto.ts
import {
    IsString,
    IsNotEmpty,
    IsArray,
    ValidateNested,
    IsOptional,
    IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

export class DomainItemDto {
    @IsString()
    @IsNotEmpty()
    value: string;

    @IsString()
    @IsNotEmpty()
    label: string;
}

export class UpdateDomainDto {
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    label?: string;

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => DomainItemDto)
    items?: DomainItemDto[];

    @IsOptional()
    @IsIn(['active', 'inactive'])
    status?: 'active' | 'inactive';
}
