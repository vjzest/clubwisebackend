import { IsString, IsNotEmpty, IsOptional, IsMongoId } from 'class-validator';

export class CreateLetsTalkDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsString()
    @IsNotEmpty()
    contactInfo: string; // Email or Phone

    @IsString()
    @IsNotEmpty()
    message: string;

    @IsOptional()
    @IsMongoId()
    node?: string;

    @IsOptional()
    @IsMongoId()
    club?: string;
}
