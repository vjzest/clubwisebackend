import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Debate } from './debate.entity';
import { User } from '../user.entity';
import { DebateAdoption } from './debate-adoption-entity';

@Schema({ timestamps: true })
export class DebateArgument extends Document {
  @Prop({ type: Types.ObjectId, ref: Debate.name, required: false })
  debate: Types.ObjectId;

  // if the argument is from adopted debate
  @Prop({ type: Types.ObjectId, ref: DebateAdoption.name, required: false })
  adoptedDebateId: Types.ObjectId;

  @Prop({
    type: {
      user: { type: Types.ObjectId, ref: User.name, required: true },
      side: { type: String, enum: ['support', 'against'] },
    },
    required: true,
  })
  participant: {
    user: Types.ObjectId;
    side: 'support' | 'against';
  };

  @Prop({ type: String, required: true })
  content: string;

  @Prop({ type: Date, default: Date.now })
  timestamp: Date;

  @Prop({
    type: [{
      _id: false,
      url: {
        type: String,
        required: true
      },

      mimetype: {
        type: String,
        required: true
      },

    }],
    default: []
  })
  image: Array<{
    url: string;
    originalName: string;
    mimetype: string;
    size: number;
  }>;
  @Prop({
    type: [{
      _id: false,
      user: { type: Types.ObjectId, ref: User.name },
      date: { type: Date, default: Date.now }
    }],
    default: [],
  })
  relevant: Array<{ user: Types.ObjectId; date: Date }>;

  @Prop({
    type: [{
      _id: false,
      user: { type: Types.ObjectId, ref: User.name },
      date: { type: Date, default: Date.now }
    }],
    default: [],
  })
  irrelevant: Array<{ user: Types.ObjectId; date: Date }>;

  // New fields for pinning functionality
  @Prop({ type: Boolean, default: false })
  isPinned: boolean;

  @Prop({ type: Date, default: null })
  pinnedAt: Date;

  @Prop({ type: Types.ObjectId })
  parentId: Types.ObjectId;

  @Prop({ default: false, type: Boolean })
  startingPoint: boolean;
}

export const DebateArgumentSchema =
  SchemaFactory.createForClass(DebateArgument);
