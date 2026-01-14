// standard-plugin-update.dto.ts
import { IsString, IsBoolean, IsOptional, MinLength, MaxLength } from 'class-validator';

export class UpdateStdPluginDto {
    @IsOptional()
    @IsString()
    @MinLength(3)
    @MaxLength(100)
    name?: string;

    @IsOptional()
    @IsString()
    @MinLength(10)
    @MaxLength(1000)
    description?: string;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}
