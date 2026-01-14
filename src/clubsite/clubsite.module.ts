import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ClubsiteController } from './clubsite.controller';
import { ClubsiteService } from './clubsite.service';
import { LetsTalkSubmission, LetsTalkSubmissionSchema } from './schemas/lets-talk-submission.schema';
import { StrategicNeed, StrategicNeedSchema } from './schemas/strategic-need.schema';
import { ProductCategory, ProductCategorySchema } from './schemas/product-category.schema';
import { StdPluginAsset, StdPluginAssetSchema } from '../shared/entities/standard-plugin/std-plugin-asset.entity';
import { CommonModule } from '../plugin/common/common.module';
import { ForumProfile, ForumProfileSchema } from '../shared/entities/forum-profile.entity';
import { Node_, NodeSchema } from '../shared/entities/node.entity';
import { Club, ClubSchema } from '../shared/entities/club.entity';
import { Chapter, ChapterSchema } from '../shared/entities/chapters/chapter.entity';
import { HistoryTimeline, HistoryTimelineSchema } from '../shared/entities/history-timeline.entity';
import { ForumAchievements, ForumAchievementsSchema } from '../shared/entities/forum-achievements.entity';
import { ForumFaqs, ForumFaqsSchema } from '../shared/entities/forum-faqs.entity';
import { SharedModule } from '../shared/shared.module';
import { CustomerConnect, CustomerConnectSchema } from '../shared/entities/customer-connect.entity';
import { ForumCampaign, ForumCampaignSchema } from '../shared/entities/forum-campaign.entity';
import { NotificationModule } from '../notification/notification.module';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: LetsTalkSubmission.name, schema: LetsTalkSubmissionSchema },
            { name: StrategicNeed.name, schema: StrategicNeedSchema },
            { name: ProductCategory.name, schema: ProductCategorySchema },
            { name: StdPluginAsset.name, schema: StdPluginAssetSchema },
            { name: ForumProfile.name, schema: ForumProfileSchema },
            { name: Node_.name, schema: NodeSchema },
            { name: Club.name, schema: ClubSchema },
            { name: Chapter.name, schema: ChapterSchema },
            { name: HistoryTimeline.name, schema: HistoryTimelineSchema },
            { name: ForumAchievements.name, schema: ForumAchievementsSchema },
            { name: ForumFaqs.name, schema: ForumFaqsSchema },
            { name: CustomerConnect.name, schema: CustomerConnectSchema },
            { name: ForumCampaign.name, schema: ForumCampaignSchema },
        ]),
        CommonModule,
        SharedModule,
        NotificationModule,
    ],
    controllers: [ClubsiteController],
    providers: [ClubsiteService],
})
export class ClubsiteModule { }
