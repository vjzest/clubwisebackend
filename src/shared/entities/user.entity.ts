import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Club } from './club.entity';
import { Node_ } from './node.entity';

@Schema({ timestamps: true })
export class User extends Document {
  @Prop({ trim: true })
  userName: string;

  @Prop({ required: true, trim: true })
  email: string;

  @Prop()
  password: string;

  @Prop({ required: false, trim: true })
  firstName: string;

  @Prop({ required: false, trim: true })
  lastName: string;

  @Prop({ required: false, trim: true })
  phoneNumber: string;

  @Prop({
    type: Date,
    required: false,
    validate: {
      validator: (value: Date) => value < new Date(),
      message: 'Date of birth must be in the past',
    },
  })
  dateOfBirth: Date;

  @Prop({ enum: ['male', 'female', 'other'] })
  gender: string;

  @Prop({
    type: String,
    required: false,
  })
  profileImage?: string;

  @Prop({
    type: String,
    required: false,
  })
  coverImage?: string;

  @Prop({ required: false })
  interests?: string[];

  @Prop({ default: false })
  isBlocked: boolean;

  @Prop({ default: false })
  emailVerified: boolean;

  @Prop({ default: false })
  registered: boolean;

  @Prop({
    type: String,
    enum: ['google', 'apple', 'facebook', 'gmail'],
    default: 'gmail',
    required: true,
  })
  signupThrough: string;

  @Prop({ default: false })
  isOnBoarded: boolean;

  @Prop({
    type: {
      email: { type: Boolean, default: false },
      phoneNumber: { type: Boolean, default: false }
    }
  })
  visibility: {
    email: boolean;
    phoneNumber: boolean;
  }
  @Prop({
    type: String,
    enum: ['details', 'image', 'interest', 'node', 'completed'],
    default: 'details',
    required: true,
  })
  onBoardingStage: 'details' | 'image' | 'interest' | 'node' | 'completed';


  // @Prop({ type: [{ type: Types.ObjectId, ref: Node_.name }], required: false, default: [] })
  @Prop({ type: [{ type: Types.ObjectId }], required: false, default: [] })
  lastOpenedNodes: Types.ObjectId[];

  // @Prop({ type: [{ type: Types.ObjectId, ref: Club.name }], required: false, default: [] })
  @Prop({ type: [{ type: Types.ObjectId }], required: false, default: [] })
  lastOpenedClubs: Types.ObjectId[];

  @Prop({ default: false })
  isAdmin: boolean;

  @Prop({ type: Number, default: 0 })
  assetCreatedCount: number;
}

export const UserSchema = SchemaFactory.createForClass(User);
