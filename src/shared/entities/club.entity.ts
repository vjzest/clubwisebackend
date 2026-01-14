import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { SchemaTypes } from 'mongoose';
import { User } from './user.entity';
import { TPlugins } from 'typings';
import slugify from 'slugify';

export enum MemberRole {
  ADMIN = 'admin',
  MODERATOR = 'moderator',
  MEMBER = 'member',
}

// Interface for members
export interface IMember {
  userId: Types.ObjectId;
  role: MemberRole;
  designation: string;
  date: Date;
}

// Interface for blocked members
export interface IBlockedUser {
  userId: Types.ObjectId;
  date: Date;
}

@Schema({
  timestamps: true,
})
export class Club extends Document {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  about: string;

  @Prop({ required: true })
  domain: [string]

  @Prop({ required: true })
  description: string;

  @Prop({
    type: {
      filename: { type: SchemaTypes.String, required: true },
      url: { type: SchemaTypes.String, required: true },
    },
    _id: false,
    required: true,
  })
  profileImage: {
    filename: string;
    url: string;
  };

  @Prop({
    type: {
      filename: { type: SchemaTypes.String, required: false },
      url: { type: SchemaTypes.String, required: false },
    },
    _id: false,
    required: false,
  })
  coverImage: {
    filename: string;
    url: string;
  };

  @Prop({ required: true, default: false })
  isPublic: boolean;

  //link for joining the club
  @Prop({ required: false, unique: false, type: String })
  link: string;

  //reference of the user who created the club
  @Prop({ type: Types.ObjectId, ref: User.name, required: true })
  createdBy: Types.ObjectId;

  @Prop({
    type: [
      {
        plugin: { type: String, required: true },
        type: { type: String, enum: ["standard", "custom"], required: true, default: "custom" },
        createdAt: { type: Date, default: Date.now(), required: true },
        isArchived: { type: Boolean, default: false, required: false },
      },
    ],
    _id: false,
    validate: [(val: any[]) => val.length > 0, 'At least one plugin is required'],
  })
  plugins: [
    {
      plugin: string,
      type: "standard" | "custom",
      createdAt: Date,
      isArchived: boolean
    }
  ]


  @Prop({ required: false })
  customColor: string;

  @Prop({ unique: true, type: String })
  slug: string;

  @Prop({ type: Number, default: 0 })
  memoryUsageInBytes: number;

  @Prop({ unique: true, type: String })
  username: string;
}

export const ClubSchema = SchemaFactory.createForClass(Club);

ClubSchema.pre<Club>('save', function (next) {
  if (!this.slug) {
    this.slug = slugify(this.name, {
      lower: true,
      strict: true,
      remove: /[*+~.()'"!:@]/g,
    });
  }
  next();
});