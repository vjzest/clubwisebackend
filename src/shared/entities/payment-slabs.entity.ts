import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ _id: false })
export class FeatureValue {
  @Prop({ type: String, required: true })
  featureKey: string;

  @Prop({ type: Number, default: 0 })
  countValue: number;

  @Prop({ type: Boolean, default: false })
  enabled: boolean;
}

export const FeatureValueSchema = SchemaFactory.createForClass(FeatureValue);

@Schema({ _id: false })
export class Slab {
  @Prop({ type: String, required: true })
  slabKey: string;

  @Prop({ type: String, required: true })
  name: string;

  @Prop({ type: Number, default: 0 })
  price: number;

  @Prop({ type: Boolean, default: false })
  isFree: boolean;

  @Prop({ type: Number, required: true })
  order: number;

  @Prop({ type: [FeatureValueSchema], default: [] })
  features: FeatureValue[];

  // Pricing card display fields
  @Prop({ type: String, default: '' })
  description: string;

  @Prop({ type: Number, default: 0 })
  annualPrice: number;

  @Prop({ type: Boolean, default: false })
  isPopular: boolean;

  @Prop({ type: String, default: 'Get started' })
  buttonText: string;

  @Prop({ type: [String], default: [] })
  displayFeatures: string[];
}

export const SlabSchema = SchemaFactory.createForClass(Slab);

@Schema({ timestamps: true })
export class PaymentSlabs extends Document {
  @Prop({ type: [SlabSchema], required: true })
  slabs: Slab[];
}

export const PaymentSlabsSchema = SchemaFactory.createForClass(PaymentSlabs);
