import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Headers,
  Req,
} from '@nestjs/common';
import { PaymentService } from './payment.service';
import { UserAuthGuard } from '../user/guards/user-auth.guard';
import {
  CreateSubscriptionDto,
  VerifyPaymentDto,
  CancelSubscriptionDto,
  GetSubscriptionDto,
} from './dto/create-subscription.dto';
import { ForumType } from '../shared/entities/forum-subscription.entity';
import { Request } from 'express';
import { SkipAuth } from '../decorators/skip-auth.decorator';

@Controller('payment')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  // Get payment plans/slabs (public endpoint)
  @Get('plans')
  @SkipAuth()
  async getPlans() {
    const slabs = await this.paymentService.getPaymentSlabs();
    return {
      success: true,
      data: slabs,
    };
  }

  // Get current subscription for a forum
  @Get('subscription')
  @UseGuards(UserAuthGuard)
  async getSubscription(@Query() dto: GetSubscriptionDto) {
    const result = await this.paymentService.getForumSubscription(
      dto.forumId,
      dto.forumType,
    );
    return {
      success: true,
      data: result,
    };
  }

  // Get feature access for a forum (public endpoint for checking features)
  @Get('feature-access')
  @SkipAuth()
  async getFeatureAccess(
    @Query('forumId') forumId: string,
    @Query('forumType') forumType: ForumType,
  ) {
    const result = await this.paymentService.getFeatureAccess(
      forumId,
      forumType,
    );
    return {
      success: true,
      data: result,
    };
  }

  // Create subscription
  @Post('subscribe')
  @UseGuards(UserAuthGuard)
  async createSubscription(
    @Req() req: Request,
    @Body() dto: CreateSubscriptionDto,
  ) {
    const userId = req.user._id.toString();
    const result = await this.paymentService.createSubscription(userId, dto);
    return {
      success: true,
      data: result,
    };
  }

  // Verify payment after Razorpay checkout
  @Post('verify')
  @UseGuards(UserAuthGuard)
  async verifyPayment(@Req() req: Request, @Body() dto: VerifyPaymentDto) {
    const userId = req.user._id.toString();
    const result = await this.paymentService.verifyPayment(userId, dto);
    return result;
  }

  // Cancel subscription
  @Post('cancel')
  @UseGuards(UserAuthGuard)
  async cancelSubscription(
    @Req() req: Request,
    @Body() dto: CancelSubscriptionDto,
  ) {
    const userId = req.user._id.toString();
    const result = await this.paymentService.cancelSubscription(userId, dto);
    return result;
  }

  // Downgrade to free tier
  @Post('downgrade')
  @UseGuards(UserAuthGuard)
  async downgradeToFree(
    @Req() req: Request,
    @Body() dto: CancelSubscriptionDto,
  ) {
    const userId = req.user._id.toString();
    const result = await this.paymentService.downgradeToFree(userId, dto);
    return result;
  }

  // Razorpay webhook handler (public endpoint, verified via signature)
  @Post('webhook')
  @SkipAuth()
  async handleWebhook(
    @Body() payload: any,
    @Headers('x-razorpay-signature') signature: string,
  ) {
    const result = await this.paymentService.handleWebhook(payload, signature);
    return result;
  }
}
