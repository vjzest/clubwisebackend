import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Projects } from './project.entity';

@Schema({ timestamps: true })
export class ProjectParameter extends Document {
  @Prop({ type: Types.ObjectId, ref: Projects.name, required: true })
  project: Types.ObjectId;

  @Prop({ required: false })
  title: string;

  @Prop({ required: false })
  value: string;

  @Prop({ required: false })
  unit: string;

}

export const ProjectParameterSchema = SchemaFactory.createForClass(ProjectParameter);
