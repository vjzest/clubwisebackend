import { Module } from '@nestjs/common';
import { BookmarksController } from './bookmarks.controller';
import { BookmarksService } from './bookmarks.service';
import { SharedModule } from '../../shared/shared.module';

@Module({
  imports: [
    SharedModule
  ],
  controllers: [BookmarksController],
  providers: [BookmarksService]
})
export class BookmarksModule { }
