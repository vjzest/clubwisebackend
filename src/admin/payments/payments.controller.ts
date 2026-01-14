import {
  Body,
  Controller,
  Get,
  Put,
  Req,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { AuthorizationService } from '../../user/auth/authorization.service';
import { Request } from 'express';
import { UpdatePaymentSlabsDto } from './dto/update-payment-slabs.dto';

@ApiTags('Admin - Payments')
@ApiBearerAuth()
@Controller('admin/payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly authorizationService: AuthorizationService,
  ) {}

  @Get()
  async getPaymentSlabs(@Req() req: Request) {
    await this.authorizationService.validateAdmin(req?.user?._id);
    return this.paymentsService.getPaymentSlabs();
  }

  @Put()
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidUnknownValues: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  )
  async updatePaymentSlabs(
    @Body() updateDto: UpdatePaymentSlabsDto,
    @Req() req: Request,
  ) {
    await this.authorizationService.validateAdmin(req?.user?._id);
    return this.paymentsService.updatePaymentSlabs(updateDto);
  }

  @Get('feature-definitions')
  async getFeatureDefinitions(@Req() req: Request) {
    await this.authorizationService.validateAdmin(req?.user?._id);
    return this.paymentsService.getFeatureDefinitions();
  }
}
