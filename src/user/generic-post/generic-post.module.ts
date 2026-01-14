import { Module } from '@nestjs/common';
import { GenericPostService } from './generic-post.service';
import { GenericPostController } from './generic-post.controller';
import { SharedModule } from '../../shared/shared.module';
import { AssetsModule } from '../../assets/assets.module';
import { NotificationModule } from '../../notification/notification.module';
import { CommonModule } from '../../plugin/common/common.module';

@Module({
  imports: [
    SharedModule,
    AssetsModule,
    NotificationModule,
    CommonModule
  ],
  providers: [GenericPostService],
  controllers: [GenericPostController]
})
export class GenericPostModule { }
