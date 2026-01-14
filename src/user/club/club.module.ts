import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ClubController } from './club.controller';
import { ClubService } from './club.service';
import { Club, ClubSchema } from 'src/shared/entities/club.entity';
import { SharedModule } from 'src/shared/shared.module';
import {
  ClubMembers,
  ClubMembersSchema,
} from 'src/shared/entities/clubmembers.entity';
import {
  ClubJoinRequests,
  ClubJoinRequestsSchema,
} from 'src/shared/entities/club-join-requests.entity';
import { NotificationModule } from 'src/notification/notification.module';
import { StdPlugin, StdPluginSchema } from 'src/shared/entities/standard-plugin/std-plugin.entity';

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
