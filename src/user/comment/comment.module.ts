import { Module } from '@nestjs/common';
import { CommentService } from './comment.service';
import { SharedModule } from '../../shared/shared.module';
import { CommentController } from './comment.controller';
import { SocketModule } from '../../socket/socket.module';
import { SocketService } from '../../socket/socket.service';
import { StdPluginAsset } from '../../shared/entities/standard-plugin/std-plugin-asset.entity';
import { MongooseModule } from '@nestjs/mongoose';
import { StdPluginAssetSchema } from '../../shared/entities/standard-plugin/std-plugin-asset.entity';

@Module({
  imports: [SharedModule, SocketModule, MongooseModule.forFeature([
    { name: StdPluginAsset.name, schema: StdPluginAssetSchema },
  ])],
  providers: [CommentService, SocketService],
  controllers: [CommentController],
  exports: [CommentService],
})
export class CommentModule { }
