import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { APP_GUARD } from '@nestjs/core';
import { UserAuthGuard } from './guards/user-auth.guard';
import { SharedModule } from '../shared/shared.module';
import { NodeModule } from './node/node.module';
import { ClubModule } from './club/club.module';
import { SearchModule } from '../shared/search/search.module';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { InvitationModule } from './invitation/invitation.module';
import { ReportsModule } from './reports/reports.module';
import { CommentModule } from './comment/comment.module';
import { ChapterService } from './chapter/chapter.service';
import { ChapterController } from './chapter/chapter.controller';
import { ChapterModule } from './chapter/chapter.module';
import { BookmarksModule } from './bookmarks/bookmarks.module';
import { StdAssetsModule } from './standard-assets/standard-assets.module';
import { GenericPostModule } from './generic-post/generic-post.module';
import { DomainModule } from './domain/domain.module';

@Module({
  imports: [
    AuthModule,
    OnboardingModule,
    SharedModule,
    NodeModule,
    ClubModule,
    SearchModule,
    InvitationModule,
    ReportsModule,
    CommentModule,
    BookmarksModule,
    ChapterModule,
    StdAssetsModule,
    GenericPostModule,
    DomainModule,
  ],

  providers: [
    {
      provide: APP_GUARD,
      useClass: UserAuthGuard,
    },
    UserService,
    ChapterService,
  ],
  controllers: [UserController, ChapterController],
})
export class UserModule { }
