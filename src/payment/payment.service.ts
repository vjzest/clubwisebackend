import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  ForumSubscription,
  SubscriptionStatus,
  BillingCycle,
  ForumType,
} from 'src/shared/entities/forum-subscription.entity';
import { PaymentSlabs } from 'src/shared/entities/payment-slabs.entity';
import { Club } from 'src/shared/entities/club.entity';
import { Node_ } from 'src/shared/entities/node.entity';
import { ClubMembers } from 'src/shared/entities/clubmembers.entity';
import { NodeMembers } from 'src/shared/entities/node-members.entity';
import { User } from 'src/shared/entities/user.entity';
import { RazorpayService } from './razorpay.service';
import {
  CreateSubscriptionDto,
  VerifyPaymentDto,
  CancelSubscriptionDto,
} from './dto/create-subscription.dto';
import { ENV } from 'src/utils/config/env.config';

@Injectable()
export class PaymentService {
  constructor(
    @InjectModel(ForumSubscription.name)
    private readonly subscriptionModel: Model<ForumSubscription>,
    @InjectModel(PaymentSlabs.name)
    private readonly paymentSlabsModel: Model<PaymentSlabs>,
    @InjectModel(Club.name)
    private readonly clubModel: Model<Club>,
    @InjectModel(Node_.name)
    private readonly nodeModel: Model<Node_>,
    @InjectModel(ClubMembers.name)
    private readonly clubMembersModel: Model<ClubMembers>,
    @InjectModel(NodeMembers.name)
    private readonly nodeMembersModel: Model<NodeMembers>,
    @InjectModel(User.name)
    private readonly userModel: Model<User>,
    private readonly razorpayService: RazorpayService,
  ) {}

  // Check if user is admin or owner of the forum
  private async checkUserPermission(
    userId: string,
    forumId: string,
    forumType: ForumType,
  ): Promise<boolean> {
    if (forumType === ForumType.CLUB) {
      const membership = await this.clubMembersModel.findOne({
        club: new Types.ObjectId(forumId),
        user: new Types.ObjectId(userId),
        role: { $in: ['admin', 'owner'] },
      });
      return !!membership;
    } else {
      const membership = await this.nodeMembersModel.findOne({
        node: new Types.ObjectId(forumId),
        user: new Types.ObjectId(userId),
        role: { $in: ['admin', 'owner'] },
      });
      return !!membership;
    }
  }

  // Get forum details
  private async getForumDetails(forumId: string, forumType: ForumType) {
    if (forumType === ForumType.CLUB) {
      return this.clubModel.findById(forumId);
    }
    return this.nodeModel.findById(forumId);
  }

  // Get current subscription for a forum
  async getForumSubscription(forumId: string, forumType: ForumType) {
    const subscription = await this.subscriptionModel.findOne({
      forumId: new Types.ObjectId(forumId),
      forumType,
      status: { $in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.PENDING] },
    });

    if (!subscription) {
      // Return free tier as default
      return {
        subscription: null,
        slabKey: 'slab1',
        isFreeTier: true,
      };
    }

    return {
      subscription,
      slabKey: subscription.slabKey,
      isFreeTier: subscription.slabKey === 'slab1',
    };
  }

  // Get payment slabs with plans
  async getPaymentSlabs() {
    const config = await this.paymentSlabsModel.findOne({});
    return config?.slabs || [];
  }

  // Create subscription (one-time payment using Orders API)
  async createSubscription(userId: string, dto: CreateSubscriptionDto) {
    // Check permission
    const hasPermission = await this.checkUserPermission(
      userId,
      dto.forumId,
      dto.forumType,
    );
    if (!hasPermission) {
      throw new ForbiddenException(
        'Only admins or owners can manage subscriptions',
      );
    }

    // Check if slab1 (free tier) - no payment needed
    if (dto.slabKey === 'slab1') {
      throw new BadRequestException(
        'Free tier does not require subscription. Use downgrade instead.',
      );
    }

    // Get slab details
    const paymentSlabs = await this.paymentSlabsModel.findOne({});
    const slab = paymentSlabs?.slabs.find((s) => s.slabKey === dto.slabKey);
    if (!slab) {
      throw new NotFoundException('Invalid slab selected');
    }

    // Get user details
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Get forum details
    const forum = await this.getForumDetails(dto.forumId, dto.forumType);
    if (!forum) {
      throw new NotFoundException('Forum not found');
    }

    // Check for existing active subscription
    const existingSubscription = await this.subscriptionModel.findOne({
      forumId: new Types.ObjectId(dto.forumId),
      forumType: dto.forumType,
      status: { $in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.PENDING] },
    });

    if (existingSubscription) {
      throw new BadRequestException(
        'Forum already has an active subscription. Cancel it first to change plans.',
      );
    }

    // Calculate amount based on billing cycle
    const amount =
      dto.billingCycle === BillingCycle.MONTHLY
        ? slab.price * 100 // Convert to paise
        : slab.annualPrice * 100;

    // Create Razorpay order (one-time payment)
    const receipt = `${dto.forumType}_${dto.forumId}_${Date.now()}`;
    const razorpayOrder = await this.razorpayService.createOrder({
      amount,
      currency: 'INR',
      receipt,
      notes: {
        forumId: dto.forumId,
        forumType: dto.forumType,
        slabKey: dto.slabKey,
        billingCycle: dto.billingCycle,
        userId,
      },
    });

    // Create subscription record in database (pending status)
    const subscription = new this.subscriptionModel({
      forumId: new Types.ObjectId(dto.forumId),
      forumType: dto.forumType,
      slabKey: dto.slabKey,
      billingCycle: dto.billingCycle,
      status: SubscriptionStatus.PENDING,
      razorpayDetails: {
        orderId: razorpayOrder.id,
      },
      amount: amount / 100, // Store in rupees
      currency: 'INR',
      createdBy: new Types.ObjectId(userId),
    });

    await subscription.save();

    return {
      subscription,
      razorpayOrderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      keyId: ENV.RAZORPAY_KEY_ID,
      prefill: {
        name:
          `${user.firstName || ''} ${user.lastName || ''}`.trim() ||
          user.userName ||
          '',
        email: user.email,
        contact: user.phoneNumber || '',
      },
    };
  }

  // Verify payment and activate subscription
  async verifyPayment(userId: string, dto: VerifyPaymentDto) {
    // Verify signature for order-based payment
    const isValid = this.razorpayService.verifyOrderSignature({
      razorpay_order_id: dto.razorpay_order_id,
      razorpay_payment_id: dto.razorpay_payment_id,
      razorpay_signature: dto.razorpay_signature,
    });

    if (!isValid) {
      throw new BadRequestException('Invalid payment signature');
    }

    // Update subscription status
    const subscription = await this.subscriptionModel.findOneAndUpdate(
      {
        forumId: new Types.ObjectId(dto.forumId),
        forumType: dto.forumType,
        'razorpayDetails.orderId': dto.razorpay_order_id,
      },
      {
        $set: {
          status: SubscriptionStatus.ACTIVE,
          'razorpayDetails.paymentId': dto.razorpay_payment_id,
          currentPeriodStart: new Date(),
        },
      },
      { new: true },
    );

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    // Calculate period end based on billing cycle
    const periodEnd = new Date();
    if (subscription.billingCycle === BillingCycle.MONTHLY) {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    } else {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    }

    subscription.currentPeriodEnd = periodEnd;
    await subscription.save();

    return {
      success: true,
      message: 'Subscription activated successfully',
      subscription,
    };
  }

  // Cancel subscription
  async cancelSubscription(userId: string, dto: CancelSubscriptionDto) {
    // Check permission
    const hasPermission = await this.checkUserPermission(
      userId,
      dto.forumId,
      dto.forumType,
    );
    if (!hasPermission) {
      throw new ForbiddenException(
        'Only admins or owners can cancel subscriptions',
      );
    }

    const subscription = await this.subscriptionModel.findOne({
      forumId: new Types.ObjectId(dto.forumId),
      forumType: dto.forumType,
      status: SubscriptionStatus.ACTIVE,
    });

    if (!subscription) {
      throw new NotFoundException('No active subscription found');
    }

    // Update database (no Razorpay cancellation needed for one-time payments)
    subscription.status = SubscriptionStatus.CANCELLED;
    subscription.cancelledAt = new Date();
    subscription.cancellationReason = dto.reason;
    await subscription.save();

    return {
      success: true,
      message: 'Subscription cancelled successfully',
      subscription,
    };
  }

  // Get feature access for a forum
  async getFeatureAccess(forumId: string, forumType: ForumType) {
    const { slabKey } = await this.getForumSubscription(forumId, forumType);

    const paymentSlabs = await this.paymentSlabsModel.findOne({});
    const slab = paymentSlabs?.slabs.find((s) => s.slabKey === slabKey);

    if (!slab) {
      // Return default free tier features
      const freeSlab = paymentSlabs?.slabs.find((s) => s.slabKey === 'slab1');
      return {
        slabKey: 'slab1',
        slabName: freeSlab?.name || 'Free',
        features: freeSlab?.features || [],
      };
    }

    return {
      slabKey: slab.slabKey,
      slabName: slab.name,
      features: slab.features,
    };
  }

  // Handle webhook events from Razorpay
  async handleWebhook(payload: any, signature: string) {
    // Verify webhook signature
    const body = JSON.stringify(payload);
    const isValid = this.razorpayService.verifyWebhookSignature(body, signature);

    if (!isValid) {
      throw new BadRequestException('Invalid webhook signature');
    }

    const event = payload.event;
    const paymentData = payload.payload?.payment?.entity;

    if (!paymentData) {
      return { received: true };
    }

    switch (event) {
      case 'payment.captured':
        await this.handlePaymentCaptured(paymentData);
        break;
      case 'payment.failed':
        await this.handlePaymentFailed(paymentData);
        break;
      case 'refund.created':
        await this.handleRefundCreated(payload.payload?.refund?.entity);
        break;
    }

    return { received: true };
  }

  private async handlePaymentCaptured(data: any) {
    const orderId = data.order_id;
    if (!orderId) return;

    await this.subscriptionModel.findOneAndUpdate(
      { 'razorpayDetails.orderId': orderId },
      {
        $set: {
          status: SubscriptionStatus.ACTIVE,
          'razorpayDetails.paymentId': data.id,
        },
      },
    );
  }

  private async handlePaymentFailed(data: any) {
    const orderId = data.order_id;
    if (!orderId) return;

    await this.subscriptionModel.findOneAndUpdate(
      { 'razorpayDetails.orderId': orderId },
      { $set: { status: SubscriptionStatus.EXPIRED } },
    );
  }

  private async handleRefundCreated(data: any) {
    if (!data?.payment_id) return;

    await this.subscriptionModel.findOneAndUpdate(
      { 'razorpayDetails.paymentId': data.payment_id },
      {
        $set: {
          status: SubscriptionStatus.CANCELLED,
          cancelledAt: new Date(),
          cancellationReason: 'Payment refunded',
        },
      },
    );
  }

  // Downgrade to free tier
  async downgradeToFree(userId: string, dto: CancelSubscriptionDto) {
    const result = await this.cancelSubscription(userId, dto);

    // Mark subscription as expired
    await this.subscriptionModel.findOneAndUpdate(
      {
        forumId: new Types.ObjectId(dto.forumId),
        forumType: dto.forumType,
        status: SubscriptionStatus.CANCELLED,
      },
      { $set: { status: SubscriptionStatus.EXPIRED } },
    );

    return {
      success: true,
      message: 'Downgraded to free tier',
    };
  }
}
