import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, SchemaTypes, Types } from 'mongoose';
import { User } from './user.entity';
import slugify from 'slugify';

export interface IBlockedUser {
  userId: Types.ObjectId;
  date: Date;
}

@Schema({
  timestamps: true,
})
export class Node_ extends Document {
  @Prop({ required: true })
  name: string;

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

  @Prop({ required: false })
  customColor: string;

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

  @Prop({ required: true })
  about: string;
  @Prop({ required: true })
  domain: [string]
  @Prop({ required: true })
  description: string;

  @Prop({
    type: [
      {
        user: { type: Types.ObjectId, ref: User.name, required: true },
        date: { type: Date, default: Date.now, required: true },
      },
    ],
    default: [],
  })
  blockedUsers: IBlockedUser[];

  @Prop({ type: Types.ObjectId, ref: User.name, required: true })
  createdBy: Types.ObjectId;

  @Prop({ default: false })
  isVerified?: boolean;

  //link for joining the node
  @Prop({ required: false, unique: false, type: String })
  link: string;

  @Prop({ required: false })
  location: string;

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

  @Prop({ unique: true, type: String })
  slug: string;

  @Prop({ type: Number, default: 0 })
  memoryUsageInBytes: number;

  @Prop({ unique: true, type: String })
  username: string;

}

export const NodeSchema = SchemaFactory.createForClass(Node_);

NodeSchema.pre<Node_>('save', function (next) {
  if (!this.slug) {
    this.slug = slugify(this.name, {
      lower: true,
      strict: true,
      remove: /[*+~.()'"!:@]/g,
    });
  }
  next();
});
