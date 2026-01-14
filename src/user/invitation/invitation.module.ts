import { Module } from '@nestjs/common';
import { InvitationController } from './invitation.controller';
import { InvitationService } from './invitation.service';
import { SharedModule } from '../../shared/shared.module';
import { NotificationModule } from '../../notification/notification.module';

@Module({
  imports: [
    SharedModule,
    NotificationModule
  ],
  controllers: [InvitationController],
  providers: [InvitationService],
})
export class InvitationModule { }
