import { IsString, IsOptional } from 'class-validator';

export class UpdateStrategicNeedDto {
    @IsString()
    @IsOptional()
    type?: string;

    @IsString()
    @IsOptional()
    description?: string;
}
