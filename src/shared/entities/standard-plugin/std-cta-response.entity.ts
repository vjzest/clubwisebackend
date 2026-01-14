import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types, Schema as MongooseSchema } from 'mongoose';

@Schema({ _id: false })
class CTAResponseAnswer {
  @Prop({ required: true })
  questionId: string;

  @Prop({ required: true })
  questionText: string;

  @Prop({ required: true, enum: ['yes_no', 'text', 'number', 'multiple_choice', 'file'] })
  responseType: string;

  @Prop({ type: MongooseSchema.Types.Mixed, required: true })
  answer: string | number | Record<string, any>;

  @Prop()
  idealAnswer?: string;
}

const CTAResponseAnswerSchema = SchemaFactory.createForClass(CTAResponseAnswer);

@Schema({ timestamps: true })
export class StdCtaResponse extends Document {
  @Prop({ type: Types.ObjectId, ref: 'StdPluginAsset', required: true })
  asset: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'StdPlugin', required: true })
  plugin: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Club', required: false })
  club?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Chapter', required: false })
  chapter?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Node', required: false })
  node?: Types.ObjectId;

  @Prop({ type: [CTAResponseAnswerSchema], required: true })
  responses: CTAResponseAnswer[];

  @Prop({ default: Date.now })
  submittedAt: Date;
}

export const StdCtaResponseSchema = SchemaFactory.createForClass(StdCtaResponse);

// Add indexes for efficient querying
// Unique compound index to prevent duplicate submissions from the same user for the same asset
StdCtaResponseSchema.index({ asset: 1, user: 1 }, { unique: true });
StdCtaResponseSchema.index({ plugin: 1 });
StdCtaResponseSchema.index({ club: 1 });
StdCtaResponseSchema.index({ chapter: 1 });
StdCtaResponseSchema.index({ node: 1 });
StdCtaResponseSchema.index({ submittedAt: -1 });
