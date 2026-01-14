import { PartialType } from '@nestjs/mapped-types';
import { CreateGenericPostDto } from './create-generic-post.dto';

export class UpdateGenericPostDto extends PartialType(CreateGenericPostDto) { }
