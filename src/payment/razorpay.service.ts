import { Injectable, InternalServerErrorException } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Razorpay = require('razorpay');
import { ENV } from '../utils/config/env.config';
import * as crypto from 'crypto';

export interface CreateOrderParams {
  amount: number; // in paise
  currency: string;
  receipt: string;
  notes?: Record<string, string>;
}

@Injectable()
export class RazorpayService {
  private razorpay: InstanceType<typeof Razorpay>;

  constructor() {
    this.razorpay = new Razorpay({
      key_id: ENV.RAZORPAY_KEY_ID,
      key_secret: ENV.RAZORPAY_SECRET,
    });
  }

  // Create a Razorpay order for one-time payment
  async createOrder(params: CreateOrderParams): Promise<any> {
    try {
      const order = await this.razorpay.orders.create({
        amount: Math.round(params.amount),
        currency: params.currency,
        receipt: params.receipt,
        notes: params.notes,
      });
      return order;
    } catch (error) {
      console.error('Razorpay Create Order Error:', error);
      throw new InternalServerErrorException('Failed to create payment order');
    }
  }

  // Fetch order details
  async getOrder(orderId: string): Promise<any> {
    try {
      return await this.razorpay.orders.fetch(orderId);
    } catch (error) {
      console.error('Razorpay Get Order Error:', error);
      throw new InternalServerErrorException('Failed to fetch order');
    }
  }

  // Verify payment signature for orders
  verifyOrderSignature(params: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }): boolean {
    try {
      const generatedSignature = crypto
        .createHmac('sha256', ENV.RAZORPAY_SECRET)
        .update(`${params.razorpay_order_id}|${params.razorpay_payment_id}`)
        .digest('hex');
      return generatedSignature === params.razorpay_signature;
    } catch {
      return false;
    }
  }

  // Verify webhook signature
  verifyWebhookSignature(
    body: string,
    signature: string,
    secret: string = ENV.RAZORPAY_SECRET,
  ): boolean {
    try {
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(body)
        .digest('hex');
      return expectedSignature === signature;
    } catch {
      return false;
    }
  }

  // Fetch payment details
  async getPayment(paymentId: string): Promise<any> {
    try {
      return await this.razorpay.payments.fetch(paymentId);
    } catch (error) {
      console.error('Razorpay Get Payment Error:', error);
      throw new InternalServerErrorException('Failed to fetch payment');
    }
  }

  // Refund a payment
  async refundPayment(paymentId: string, amount?: number): Promise<any> {
    try {
      const refundParams: any = {};
      if (amount) {
        refundParams.amount = Math.round(amount);
      }
      return await this.razorpay.payments.refund(paymentId, refundParams);
    } catch (error) {
      console.error('Razorpay Refund Error:', error);
      throw new InternalServerErrorException('Failed to process refund');
    }
  }

  // ============================================================
  // SUBSCRIPTION METHODS (For later - requires Subscriptions enabled in Razorpay)
  // Uncomment when you enable Subscriptions product in Razorpay Dashboard
  // ============================================================

  /*
  export interface CreateSubscriptionParams {
    planId: string;
    customerId?: string;
    customerEmail: string;
    customerContact: string;
    customerName: string;
    totalCount?: number;
    notes?: Record<string, string>;
  }

  export interface CreatePlanParams {
    name: string;
    description: string;
    amount: number;
    currency: string;
    period: 'monthly' | 'yearly';
    interval: number;
  }

  async createPlan(params: CreatePlanParams): Promise<any> {
    try {
      const plan = await this.razorpay.plans.create({
        period: params.period,
        interval: params.interval,
        item: {
          name: params.name,
          description: params.description,
          amount: Math.round(params.amount),
          currency: params.currency,
        },
      });
      return plan;
    } catch (error) {
      console.error('Razorpay Create Plan Error:', error);
      throw new InternalServerErrorException('Failed to create subscription plan');
    }
  }

  async createSubscription(params: CreateSubscriptionParams): Promise<any> {
    try {
      const subscription = await this.razorpay.subscriptions.create({
        plan_id: params.planId,
        total_count: params.totalCount || 12,
        customer_notify: 1,
        notes: params.notes,
      });
      return subscription;
    } catch (error) {
      console.error('Razorpay Create Subscription Error:', error);
      throw new InternalServerErrorException('Failed to create subscription');
    }
  }

  verifySubscriptionSignature(params: {
    razorpay_subscription_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }): boolean {
    try {
      const generatedSignature = crypto
        .createHmac('sha256', ENV.RAZORPAY_SECRET)
        .update(`${params.razorpay_payment_id}|${params.razorpay_subscription_id}`)
        .digest('hex');
      return generatedSignature === params.razorpay_signature;
    } catch {
      return false;
    }
  }
  */
}
