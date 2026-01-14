import { IsBoolean, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class CreateGuidingPrinciples {
    @IsString()
    @IsNotEmpty()
    club: string;

    @IsString()
    @IsNotEmpty()
    title: string;

    @IsString()
    @IsNotEmpty()
    content: string;

    @IsBoolean()
    @IsNotEmpty()
    visibility: boolean;
}

export class UpdateGuidingPrinciples {
    @IsString()
    @IsNotEmpty()
    club: string;

    @IsString()
    @IsOptional()
    title: string;

    @IsString()
    @IsOptional()
    content: string;

    @IsBoolean()
    @IsOptional()
    visibility: boolean;
}