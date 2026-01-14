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

export class CreateDomainDto {
    @IsString()
    @IsNotEmpty()
    label: string;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => DomainItemDto)
    items: DomainItemDto[];

    @IsOptional()
    @IsIn(['active', 'inactive'])
    status?: 'active' | 'inactive';
}
