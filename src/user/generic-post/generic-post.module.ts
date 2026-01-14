import { Module } from '@nestjs/common';
import { GenericPostService } from './generic-post.service';
import { GenericPostController } from './generic-post.controller';
import { SharedModule } from 'src/shared/shared.module';
import { AssetsModule } from 'src/assets/assets.module';
import { NotificationModule } from 'src/notification/notification.module';
import { CommonModule } from 'src/plugin/common/common.module';

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
