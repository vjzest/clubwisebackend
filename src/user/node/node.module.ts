import { Module } from '@nestjs/common';
import { NodeService } from './node.service';
import { NodeController } from './node.controller';
import { SharedModule } from 'src/shared/shared.module';
import { MongooseModule } from '@nestjs/mongoose';
import {
  NodeJoinRequest,
  NodeJoinRequestSchema,
} from 'src/shared/entities/node-join-requests.entity';
import { NotificationModule } from 'src/notification/notification.module';
import { StdPlugin, StdPluginSchema } from 'src/shared/entities/standard-plugin/std-plugin.entity';
import { AssetsModule } from 'src/assets/assets.module';

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
