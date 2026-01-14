import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum SubscriptionStatus {
  ACTIVE = 'active',
  CANCELLED = 'cancelled',
  PAST_DUE = 'past_due',
  PENDING = 'pending',
  HALTED = 'halted',
  EXPIRED = 'expired',
}

export enum BillingCycle {
  MONTHLY = 'monthly',
  ANNUAL = 'annual',
}

export enum ForumType {
  CLUB = 'club',
  NODE = 'node',
}

@Schema({ _id: false })
export class RazorpayDetails {
  @Prop({ type: String })
  orderId: string; // For one-time payments

  @Prop({ type: String })
  paymentId: string;

  // For subscriptions (when enabled later)
  @Prop({ type: String })
  subscriptionId: string;

  @Prop({ type: String })
  planId: string;

  @Prop({ type: String })
  customerId: string;

  @Prop({ type: String })
  shortUrl: string;
}

export const RazorpayDetailsSchema =
  SchemaFactory.createForClass(RazorpayDetails);

@Schema({ timestamps: true })
export class ForumSubscription extends Document {
  @Prop({ type: Types.ObjectId, required: true, refPath: 'forumType' })
  forumId: Types.ObjectId;

  @Prop({ type: String, enum: ForumType, required: true })
  forumType: ForumType;

  @Prop({ type: String, required: true })
  slabKey: string;

  @Prop({ type: String, enum: BillingCycle, required: true })
  billingCycle: BillingCycle;

  @Prop({ type: String, enum: SubscriptionStatus, default: SubscriptionStatus.PENDING })
  status: SubscriptionStatus;

  @Prop({ type: RazorpayDetailsSchema })
  razorpayDetails: RazorpayDetails;

  @Prop({ type: Date })
  currentPeriodStart: Date;

  @Prop({ type: Date })
  currentPeriodEnd: Date;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;

  @Prop({ type: Number, default: 0 })
  amount: number;

  @Prop({ type: String })
  currency: string;

  @Prop({ type: Date })
  cancelledAt: Date;

  @Prop({ type: String })
  cancellationReason: string;
}

export const ForumSubscriptionSchema =
  SchemaFactory.createForClass(ForumSubscription);

// Create indexes for efficient queries
ForumSubscriptionSchema.index({ forumId: 1, forumType: 1 });
ForumSubscriptionSchema.index({ 'razorpayDetails.subscriptionId': 1 });
ForumSubscriptionSchema.index({ status: 1 });
