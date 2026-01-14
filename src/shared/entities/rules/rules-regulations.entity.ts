import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from '../user.entity';
import { Club } from '../club.entity';
import { Node_ } from '../node.entity';
import { Chapter } from '../chapters/chapter.entity';

// Interface for the views array objects
export interface View {
  user: Types.ObjectId;
  date: Date;
}

@Schema({ timestamps: true })
export class RulesRegulations extends Document {

  @Prop({ trim: true })
  title: string;

  @Prop({})
  description: string;

  @Prop({})
  category: string;

  @Prop({})
  significance: string;

  @Prop({ type: [String] })
  tags: string[];

  @Prop({ type: String })
  applicableFor: string;

  @Prop({ default: false })
  isPublic: boolean;

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

  @Prop([
    {
      user: { type: Types.ObjectId, ref: User.name, required: true },
      date: { type: Date, default: Date.now },
    },
  ])
  views: View[];

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
    ref: Chapter.name
  })
  chapter: Types.ObjectId


  @Prop([
    {
      club: { type: Types.ObjectId, ref: Club.name },
      date: { type: Date, default: Date.now },
    },
  ])
  adoptedClubs: [];

  @Prop([
    {
      node: { type: Types.ObjectId, ref: Node_.name },
      date: { type: Date, default: Date.now },
    },
  ])
  adoptedNodes: [];
  @Prop({ default: 1 })
  version: number;

  @Prop({ type: String, enum: ['draft', 'published', 'proposed', 'inactive', 'rejected'], default: 'draft' })
  publishedStatus: string;

  @Prop({ default: 'original' })
  creationType: 'original' | 'adopted'

  @Prop({})
  publishedDate: Date;

  updatedDate: Date;

  adoptedDate: Date;

  createdAt: Date;

  @Prop({ required: false, ref: RulesRegulations.name })
  rootParent: Types.ObjectId;

  @Prop({
    type: [{ type: Types.ObjectId, ref: User.name }],
    default: [],
  })
  relevant: Types.ObjectId[];

  @Prop({
    type: [{ type: Types.ObjectId, ref: User.name }],
    default: [],
  })
  irrelevant: Types.ObjectId[];
  @Prop({ default: false })
  isDeleted: boolean;

  @Prop({})
  domain: [string];


  //  One who creates the rule (even if he is a member and he propses it he is a creator) 
  @Prop({
    type: Types.ObjectId,
    ref: User.name,
  })
  createdBy: Types.ObjectId;


  // one who initially publishes the rule
  @Prop({ required: false, ref: User.name })
  publishedBy: Types.ObjectId;


  // One who proposes to adopt or adopts
  @Prop({ required: false, ref: User.name })
  adoptedBy: Types.ObjectId;

  originalCreatedAt: Date;


  @Prop({ type: Boolean, default: false })
  isArchived: boolean;

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

export const RulesRegulationsSchema =
  SchemaFactory.createForClass(RulesRegulations);