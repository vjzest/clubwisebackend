import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import {
  IsString,
  IsNumber,
  IsOptional,
  IsDate,
  IsArray,
  IsBoolean,
  IsMongoId,
} from 'class-validator';
import { Type } from 'class-transformer';
import mongoose, { Document, Types } from 'mongoose';
import { Node_ } from '../node.entity';
import { Club } from '../club.entity';
import { User } from '../user.entity';
import { Chapter } from '../chapters/chapter.entity';

// Nested subdocument for banner image
interface View {
  user: Types.ObjectId;
  date: Date;
}
// Nested subdocument for committees and champions
class TeamMember {
  @IsMongoId()
  user: Types.ObjectId;

  designation: string[];
}
//type for budget
type Budget = { from: number; to: number; currency: string };

@Schema({
  timestamps: true,
  toJSON: {
    virtuals: true,
    getters: true,
  },
  toObject: {
    virtuals: true,
    getters: true,
  },
})
export class Projects extends Document {
  @Prop({ type: Types.ObjectId, ref: Club.name })
  @IsOptional()
  club: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: Node_.name })
  @IsOptional()
  node: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: Chapter.name })
  @IsOptional()
  chapter: Types.ObjectId;

  @Prop({
    type: String,
    required: false,
    trim: true,
    maxlength: 100,
  })
  @IsString()
  title: string;

  @Prop({
    type: String,
    required: false,
    trim: true,
    maxlength: 100,
  })
  @IsString()
  region: string;

  @Prop({
    type: Object,
    min: 0,
    default: 0,
  })
  budget: Budget;

  @Prop({ type: Date })
  @IsDate()
  @Type(() => Date)
  @IsOptional()
  deadline: Date;

  @Prop({
    type: String,
    trim: true,
    maxlength: 500,
  })
  @IsString()
  significance: string;

  @Prop({
    type: String,
    trim: true,
  })
  @IsString()
  @IsOptional()
  solution: string;

  @Prop({ type: Object })
  bannerImage: any;

  // @Prop({ type: [Object] })
  // @IsArray()
  // @Type(() => TeamMember)
  // @IsOptional()
  // committees: TeamMember[];

  @Prop({ type: [Object] })
  @IsArray()
  @IsOptional()
  champions: { user: Types.ObjectId }[];


  @Prop([{
    userIds: [{ userId: { type: mongoose.Schema.Types.ObjectId, ref: User.name } }],
    designation: String
  }])
  @IsArray()
  committees: { userIds: { userId: Types.ObjectId }[]; designation: string }[];

  @Prop([
    {
      user: { type: Types.ObjectId, ref: User.name, required: true },
      date: { type: Date, default: Date.now },
    },
  ])
  views: View[];


  @Prop({
    type: String,
    trim: true,
    maxlength: 1000,
  })
  @IsString()
  @IsOptional()
  aboutPromoters: string;

  @Prop({
    type: String,
    trim: true,
    maxlength: 1000,
  })
  @IsString()
  @IsOptional()
  fundingDetails: string;

  @Prop({
    type: String,
    trim: true,
    maxlength: 1000,
  })
  @IsString()
  @IsOptional()
  keyTakeaways: string;

  @Prop({
    type: String,
    trim: true,
    maxlength: 1000,
  })
  @IsString()
  @IsOptional()
  howToTakePart: string;

  @Prop({
    type: String,
    trim: true,
    maxlength: 1000,
  })
  @IsString()
  @IsOptional()
  risksAndChallenges: string;

  @IsString()
  @Prop({
    type: String,
    enum: ['draft', 'published', 'proposed', 'rejected', 'inactive'],
    default: 'draft',
  })
  publishedStatus: string;

  @Prop({ type: Boolean })
  @IsBoolean()
  @IsOptional()
  active: boolean;

  @Prop({ type: [Object] })
  @IsArray()
  @IsOptional()
  files: any[];

  @Prop({ type: String })
  relatedEvent: string


  @Prop({
    type: [{
      user: { type: Types.ObjectId, ref: User.name },
      date: { type: Date, default: Date.now }
    }],
    default: []
  })
  relevant: Array<{ user: Types.ObjectId; date: Date }>;

  @Prop({
    type: [{
      user: { type: Types.ObjectId, ref: User.name },
      date: { type: Date, default: Date.now }
    }],
    default: []
  })
  irrelevant: Array<{ user: Types.ObjectId; date: Date }>;

  @Prop({ type: String, default: 'creation' })
  type: string

  @Prop([
    {
      club: { type: Types.ObjectId, ref: Club.name },
      date: { type: Date, default: Date.now },
    },
  ])
  adoptedClubs: {
    club: Types.ObjectId;
    date: Date;
  }[];

  @Prop([
    {
      node: { type: Types.ObjectId, ref: Node_.name },
      date: { type: Date, default: Date.now },
    },
  ])
  adoptedNodes: {
    node: Types.ObjectId;
    date: Date;
  }[];

  @Prop({ type: String })
  closingRemark: string

  @Prop({ default: false })
  isPublic: boolean;

  createdAt: Date;

  @Prop({ type: Types.ObjectId, ref: User.name })
  @IsOptional()
  createdBy: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: User.name, default: null })
  @IsOptional()
  publishedBy: Types.ObjectId | null;

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

  @Prop({ default: false })
  isDeleted: boolean;
}

//Mongoose schema
export const ProjectsSchema = SchemaFactory.createForClass(Projects);
