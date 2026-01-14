import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from '../user.entity';
import { Club } from '../club.entity';
import { Node_ } from '../node.entity';
import { Chapter } from '../chapters/chapter.entity';
import { IRelevantAndView, IAdoptedClub, IAdoptedNode } from 'typings';


@Schema({ timestamps: true })
export class Issues extends Document {
  @Prop({ trim: true })
  title: string;

  @Prop({ trim: true })
  issueType: string;

  @Prop({ trim: true })
  whereOrWho: string;

  @Prop({ required: false })
  deadline: Date;

  @Prop({ required: false })
  reasonOfDeadline: string;

  @Prop({ required: false })
  significance: string;

  @Prop({
    type: [Types.ObjectId],
    ref: User.name,
    required: false,
  })
  whoShouldAddress: Types.ObjectId[];

  @Prop({})
  description: string;

  @Prop({
    type: [
      {
        url: String,
        originalname: String,
        mimetype: String,
        size: Number,
      },
    ],
  })
  files: { url: string; originalname: string; mimetype: string; size: number }[];

  @Prop({ default: false })
  isPublic: boolean;

  @Prop({ default: false })
  isAnonymous: boolean;

  @Prop({
    type: [{
      comment: { type: Types.ObjectId },
      creator: { type: Types.ObjectId },
      date: { type: Date, default: Date.now }
    }],
  })
  solutions: {
    comment: Types.ObjectId;
    creator: Types.ObjectId;
    date: Date;
  }[];

  @Prop([
    {
      user: { type: Types.ObjectId, ref: User.name },
      date: { type: Date, default: Date.now },
    },
  ])
  views: IRelevantAndView[];

  @Prop([
    {
      user: { type: Types.ObjectId, ref: User.name },
      date: { type: Date, default: Date.now },
    },
  ])
  relevant: IRelevantAndView[];

  @Prop([
    {
      user: { type: Types.ObjectId, ref: User.name },
      date: { type: Date, default: Date.now },
    },
  ])
  irrelevant: IRelevantAndView[];

  @Prop({
    type: Types.ObjectId,
    ref: Club.name,
  })
  club: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: Node_.name,
  })
  node: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: Chapter.name,
  })
  chapter: Types.ObjectId;

  publishedDate: Date;
  updatedDate: Date;

  @Prop([
    {
      club: { type: Types.ObjectId, ref: Club.name },
      date: { type: Date, default: Date.now },
    },
  ])
  adoptedClubs: IAdoptedClub[];

  @Prop([
    {
      node: { type: Types.ObjectId, ref: Node_.name },
      date: { type: Date, default: Date.now },
    },
  ])
  adoptedNodes: IAdoptedNode[];

  @Prop({ default: 'draft' })
  publishedStatus:
    | 'draft'
    | 'published'
    | 'olderversion'
    | 'proposed'
    | 'rejected'
    | 'archived'
    | 'inactive';

  @Prop({ default: false })
  isIssueResolved: boolean;

  @Prop({ default: false })
  isArchived: boolean;

  @Prop()
  isActive: boolean;

  @Prop({ default: false })
  isDeleted: boolean;

  @Prop({ default: 1 })
  version: number;

  @Prop()
  olderVersions: [{}];

  rootParent: null | Types.ObjectId;

  createdAt: Date;

  @Prop({ type: Types.ObjectId, ref: User.name })
  createdBy: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: User.name })
  publishedBy: Types.ObjectId;

  @Prop({
    type: [
      {
        user: { type: Types.ObjectId, ref: User.name, required: true },
        seconds: { type: Number, required: true },
        date: { type: Date, required: true },
        _id: false
      }
    ],
    required: false
  })
  timeSpent: {
    user: Types.ObjectId;
    seconds: number;
    date: Date;
  }[];
}

export const IssuesSchema = SchemaFactory.createForClass(Issues);
