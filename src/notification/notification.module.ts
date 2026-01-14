import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { SharedModule } from 'src/shared/shared.module';
import { NotificationGateway } from './notification.gateway';
import { NotificationEventsService } from './notification-events.service';

@Module({
  imports: [
    SharedModule,
  ],
  providers: [NotificationService, NotificationGateway, NotificationEventsService],
  exports: [NotificationService, NotificationGateway, NotificationEventsService]
})
export class NotificationModule { }
