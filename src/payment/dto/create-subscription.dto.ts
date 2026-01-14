import {
  IsString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
} from 'class-validator';
import {
  BillingCycle,
  ForumType,
} from '../../shared/entities/forum-subscription.entity';

export class CreateSubscriptionDto {
  @IsString()
  @IsNotEmpty()
  forumId: string;

  @IsEnum(ForumType)
  forumType: ForumType;

  @IsString()
  @IsNotEmpty()
  slabKey: string;

  @IsEnum(BillingCycle)
  billingCycle: BillingCycle;
}

export class VerifyPaymentDto {
  @IsString()
  @IsNotEmpty()
  razorpay_order_id: string;

  @IsString()
  @IsNotEmpty()
  razorpay_payment_id: string;

  @IsString()
  @IsNotEmpty()
  razorpay_signature: string;

  @IsString()
  @IsNotEmpty()
  forumId: string;

  @IsEnum(ForumType)
  forumType: ForumType;
}

export class CancelSubscriptionDto {
  @IsString()
  @IsNotEmpty()
  forumId: string;

  @IsEnum(ForumType)
  forumType: ForumType;

  @IsString()
  @IsOptional()
  reason?: string;
}

export class GetSubscriptionDto {
  @IsString()
  @IsNotEmpty()
  forumId: string;

  @IsEnum(ForumType)
  forumType: ForumType;
}
