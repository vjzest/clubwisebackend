import { IsMongoId } from 'class-validator';
import { Types } from 'mongoose';
import { RulesRegulations } from '../../../shared/entities/rules/rules-regulations.entity';
import { Comment } from '../../../shared/entities/comment.entity';

export class CreateReportDto {
  type: typeof RulesRegulations.name | typeof Comment.name;

  @IsMongoId()
  typeId: Types.ObjectId;
}
