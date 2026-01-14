import { PartialType } from '@nestjs/mapped-types';
import { CreateNodeDto } from './create-node.dto';
import { IsOptional } from 'class-validator';

export class UpdateNodeDto {
    profileImage: Express.Multer.File;

    @IsOptional()
    coverImage: Express.Multer.File;

    name: string;

    about: string;

    description: string;

    location: string;
    removeCoverImage: boolean
    domain: string
    customColor?: string
}
