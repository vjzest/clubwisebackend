import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ClubController } from './club.controller';
import { ClubService } from './club.service';
import { Club, ClubSchema } from '../../shared/entities/club.entity';
import { SharedModule } from '../../shared/shared.module';
import {
  ClubMembers,
  ClubMembersSchema,
} from '../../shared/entities/clubmembers.entity';
import {
  ClubJoinRequests,
  ClubJoinRequestsSchema,
} from '../../shared/entities/club-join-requests.entity';
import { NotificationModule } from '../../notification/notification.module';
import { StdPlugin, StdPluginSchema } from '../../shared/entities/standard-plugin/std-plugin.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Club.name, schema: ClubSchema },
      { name: ClubMembers.name, schema: ClubMembersSchema },
      { name: ClubJoinRequests.name, schema: ClubJoinRequestsSchema },
      { name: StdPlugin.name, schema: StdPluginSchema },
    ]),
    SharedModule,
    NotificationModule,
  ],
  controllers: [ClubController],
  providers: [ClubService],
})
export class ClubModule { }
