import { Module } from '@nestjs/common';
import { NodeService } from './node.service';
import { NodeController } from './node.controller';
import { SharedModule } from '../../shared/shared.module';
import { MongooseModule } from '@nestjs/mongoose';
import {
  NodeJoinRequest,
  NodeJoinRequestSchema,
} from '../../shared/entities/node-join-requests.entity';
import { NotificationModule } from '../../notification/notification.module';
import { StdPlugin, StdPluginSchema } from '../../shared/entities/standard-plugin/std-plugin.entity';
import { AssetsModule } from '../../assets/assets.module';

@Module({
  imports: [
    SharedModule,
    MongooseModule.forFeature([
      { name: NodeJoinRequest.name, schema: NodeJoinRequestSchema },
      { name: StdPlugin.name, schema: StdPluginSchema },
    ]),
    NotificationModule,
    AssetsModule
  ],
  controllers: [NodeController],
  providers: [NodeService],
})
export class NodeModule { }
