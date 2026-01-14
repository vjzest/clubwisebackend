import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { User } from '../user.entity';
import { Projects } from './project.entity';
import { Club } from '../club.entity';
import { Node_ } from '../node.entity';
import { IsString } from 'class-validator';
import { Chapter } from '../chapters/chapter.entity';

@Schema({
  timestamps: true,
})
export class ProjectAdoption {
  @Prop({ required: true, type: Types.ObjectId, ref: User.name })
  proposedBy: Types.ObjectId

  @Prop({ required: false, type: Types.ObjectId, ref: User.name })
  acceptedBy: Types.ObjectId

  @Prop({ required: true, type: Types.ObjectId, ref: Projects.name })
  project: Types.ObjectId

  @Prop({ required: false, type: Types.ObjectId, ref: Club.name })
  club: Types.ObjectId

  @Prop({ required: false, type: Types.ObjectId, ref: Chapter.name })
  chapter: Types.ObjectId

  @Prop({ required: false, type: Types.ObjectId, ref: Node_.name })
  node: Types.ObjectId

  @Prop({ type: String })
  message: string

  @IsString()
  @Prop({
    type: String,
    enum: ['draft', 'published', 'proposed', 'rejected', 'inactive'],
    default: 'proposed',
  })
  publishedStatus: string;

  @Prop({ type: String, default: 'adopted' })
  type: string

  createdAt: Date;

  @Prop({ type: Boolean, default: false })
  isArchived: boolean;
}


export const ProjectAdoptionSchema = SchemaFactory.createForClass(ProjectAdoption)