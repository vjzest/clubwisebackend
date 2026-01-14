import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { SharedModule } from 'src/shared/shared.module';
import { AuthModule } from 'src/user/auth/auth.module';

@Module({
  imports: [SharedModule, AuthModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
})
export class PaymentsModule {}
