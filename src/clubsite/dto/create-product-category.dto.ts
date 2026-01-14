import { IsNotEmpty, IsOptional, IsString } from "class-validator";

export class CreateProductCategoryDto {
    @IsNotEmpty()
    @IsString()
    title: string;

    @IsOptional()
    @IsString()
    image?: string;

    @IsNotEmpty()
    @IsString()
    forumId: string;

    @IsNotEmpty()
    @IsString()
    forumType: string;
}

export class UpdateProductCategoryDto {
    @IsOptional()
    @IsString()
    title?: string;

    @IsOptional()
    @IsString()
    image?: string;
}
