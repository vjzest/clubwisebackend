import { IsString, IsNotEmpty, IsOptional, IsMongoId } from 'class-validator';

export class CreateStrategicNeedDto {
    @IsString()
    @IsNotEmpty()
    type: string;

    @IsString()
    @IsNotEmpty()
    description: string;

    @IsOptional()
    @IsMongoId()
    node?: string;

    @IsOptional()
    @IsMongoId()
    club?: string;
}
