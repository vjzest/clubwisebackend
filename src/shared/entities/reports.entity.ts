import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from './user.entity';
import { ReportReason } from './report-reason.entity';

export enum AssetType {
  RULES = 'rules',
  DEBATE = 'debate',
  ISSUES = 'issues',
  PROJECTS = 'projects',
  STANDARD_ASSETS = 'standard'
}

export enum ReportStatus {
  PENDING = 'pending',
  UNDER_REVIEW = 'under_review',
  RESOLVED = 'resolved',
  REJECTED = 'rejected'
}

@Schema({ timestamps: true })
export class Report extends Document {
  @Prop({
    type: String,
    required: true,
    enum: Object.values(AssetType),
  })
  assetType: AssetType;

  @Prop({ type: Types.ObjectId, required: true })
  assetId: Types.ObjectId;

  @Prop({ type: String, required: false })
  assetReference: string;

  @Prop({ type: Types.ObjectId, ref: ReportReason.name, required: true })
  reasonId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: User.name, required: true })
  reportedBy: Types.ObjectId;

  @Prop({
    type: String,
    enum: Object.values(ReportStatus),
    default: ReportStatus.PENDING
  })
  status: ReportStatus;

  @Prop({ type: String, trim: true })
  additionalDetails?: string;

  @Prop({ type: [String], default: [] })
  attachments: string[];

  @Prop({ type: Types.ObjectId, ref: User.name })
  reviewedBy?: Types.ObjectId;

  @Prop()
  reviewedAt?: Date;

  @Prop({ type: String, trim: true })
  reviewNotes?: string;
}

export const ReportSchema = SchemaFactory.createForClass(Report);
