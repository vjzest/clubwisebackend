import { Module } from '@nestjs/common';
import { AssetsController } from './assets.controller';
import { AssetsService } from './assets.service';
import { SharedModule } from 'src/shared/shared.module';
import { BookmarksService } from 'src/user/bookmarks/bookmarks.service';
import { NotificationModule } from 'src/notification/notification.module';

@Module({
  imports: [
    SharedModule,
    NotificationModule
  ],
  controllers: [AssetsController],
  providers: [AssetsService, BookmarksService],
  exports: [AssetsService]
})
export class AssetsModule { }
