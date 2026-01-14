import { forwardRef, Module } from '@nestjs/common';
import { UploadModule } from './upload/upload.module';
import { User, UserSchema } from './entities/user.entity';
import { MongooseModule } from '@nestjs/mongoose';
import { NodeMembers, NodeMembersSchema } from './entities/node-members.entity';
import { SearchModule } from './search/search.module';
import { Club, ClubSchema } from './entities/club.entity';
import { Invitation, InvitationSchema } from './entities/invitation.entity';
import { ClubMembers, ClubMembersSchema } from './entities/clubmembers.entity';
import {
  RulesRegulations,
  RulesRegulationsSchema,
} from './entities/rules/rules-regulations.entity';
import { Comment, CommentSchema } from './entities/comment.entity';
import { Report, ReportSchema } from './entities/reports.entity';
import { ReportReason, ReportReasonSchema } from './entities/report-reason.entity';
import {
  RulesOffenseReports,
  RulesOffenseReportSchema,
} from './entities/rules/report-offense.entity';
import { Node_, NodeSchema } from './entities/node.entity';
import { Issues, IssuesSchema } from './entities/issues/issues.entity';
import {
  ProposeRulesAndRegulation,
  ProposeRulesAndRegulationSchema,
} from './entities/propose-rulesAndRegulations';
import { Debate, DebateSchema } from './entities/debate/debate.entity';
import {
  NodeJoinRequest,
  NodeJoinRequestSchema,
} from './entities/node-join-requests.entity';
import {
  ClubJoinRequests,
  ClubJoinRequestsSchema,
} from './entities/club-join-requests.entity';
import {
  DebateArgument,
  DebateArgumentSchema,
} from './entities/debate/debate-argument.entity';
import { Projects, ProjectsSchema } from './entities/projects/project.entity';
import { ProjectFaq, ProjectFaqSchema } from './entities/projects/faq.enitity';
import {
  ProjectParameter,
  ProjectParameterSchema,
} from './entities/projects/parameter.entity';
import {
  ProjectContribution,
  ProjectContributionSchema,
} from './entities/projects/contribution.entity';
import { ProjectAdoption, ProjectAdoptionSchema } from './entities/projects/project-adoption.entity';
import { ProjectActivities, ProjectActivitiesSchema } from './entities/projects/project-activities.entity';
import { ProjectAnnouncement, ProjectAnnouncementSchema } from './entities/projects/project-announcement.entity';
import { Chapter, ChapterSchema } from './entities/chapters/chapter.entity';
import { ChapterMember, ChapterMemberSchema } from './entities/chapters/chapter-member.entity';
import { Bookmarks, BookmarksSchema } from './entities/bookmarks.entity';

import { IssuesAdoption, IssuesAdoptionSchema } from './entities/issues/issues-adoption.entity';
import { ChapterRuleRegulations, ChapterRuleRegulationsSchema } from './entities/chapters/modules/chapter-rule-regulations.entity';
import { ChapterProject, ChapterProjectSchema } from './entities/chapters/modules/chapter-projects.entity';
import { DebateAdoption, DebateAdoptionSchema } from './entities/debate/debate-adoption-entity';
import { GroupChat, GroupChatSchema } from './entities/chat/group-chat.entity';
import { ChatMessage, ChatMessageSchema } from './entities/chat/chat-message.entity';
import { ChapterIssues, ChapterIssueSchema } from './entities/chapters/modules/chapter-issues.entity';
import { ChapterDebates, ChapterDebateSchema } from './entities/chapters/modules/chapter-debates.entity';
import { IssueSolution, issueSolutionSchema, } from './entities/issues/issue-solution.entity';
import { GuidingPrinciples, GuidingPrinciplesSchema } from './entities/guiding-principles.entity';
import { Notification, NotificationSchema } from './entities/notification/notification.entity';
import { Feed, FeedSchema } from './entities/feed.entity';
import { StdPluginAsset, StdPluginAssetSchema } from './entities/standard-plugin/std-plugin-asset.entity';
import { StdAssetAdoption, StdAssetAdoptionSchema } from './entities/standard-plugin/std-asset-adoption.entity';
import { RulesAdoption, RulesAdoptionSchema } from './entities/rules/rules-adoption.entity';
import { StdPlugin, StdPluginSchema } from './entities/standard-plugin/std-plugin.entity';
import { GenericPost, GenericPostSchema } from './entities/generic-post.entity';
import { Domain, DomainSchema } from './entities/domain.entity';
import { HistoryTimeline, HistoryTimelineSchema } from './entities/history-timeline.entity';
import { Configuration, ConfigurationSchema } from './entities/configuration.entity';
import { ForumFaqs, ForumFaqsSchema } from './entities/forum-faqs.entity';
import { ForumAchievements, ForumAchievementsSchema } from './entities/forum-achievements.entity';
import { ForumProfile, ForumProfileSchema } from './entities/forum-profile.entity';
import { CustomerConnect, CustomerConnectSchema } from './entities/customer-connect.entity';
import { ForumCampaign, ForumCampaignSchema } from './entities/forum-campaign.entity';
import { PaymentSlabs, PaymentSlabsSchema } from './entities/payment-slabs.entity';
import { ForumSubscription, ForumSubscriptionSchema } from './entities/forum-subscription.entity';
@Module({
  imports: [
    UploadModule,
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Node_.name, schema: NodeSchema },
      { name: NodeMembers.name, schema: NodeMembersSchema },
      { name: Club.name, schema: ClubSchema },
      { name: Invitation.name, schema: InvitationSchema },
      { name: ClubMembers.name, schema: ClubMembersSchema },
      { name: RulesRegulations.name, schema: RulesRegulationsSchema },
      { name: Comment.name, schema: CommentSchema },
      { name: Report.name, schema: ReportSchema },
      { name: ReportReason.name, schema: ReportReasonSchema },
      { name: RulesOffenseReports.name, schema: RulesOffenseReportSchema },
      { name: Issues.name, schema: IssuesSchema },
      { name: ProposeRulesAndRegulation.name, schema: ProposeRulesAndRegulationSchema },
      { name: Debate.name, schema: DebateSchema },
      { name: DebateAdoption.name, schema: DebateAdoptionSchema },
      { name: NodeJoinRequest.name, schema: NodeJoinRequestSchema },
      { name: ClubJoinRequests.name, schema: ClubJoinRequestsSchema },
      { name: DebateArgument.name, schema: DebateArgumentSchema },
      { name: Projects.name, schema: ProjectsSchema },
      { name: ProjectFaq.name, schema: ProjectFaqSchema },
      { name: ProjectParameter.name, schema: ProjectParameterSchema },
      { name: ProjectContribution.name, schema: ProjectContributionSchema },
      { name: ProjectAdoption.name, schema: ProjectAdoptionSchema },
      { name: ProjectActivities.name, schema: ProjectActivitiesSchema },
      { name: ProjectAnnouncement.name, schema: ProjectAnnouncementSchema },
      { name: Bookmarks.name, schema: BookmarksSchema },
      { name: Chapter.name, schema: ChapterSchema },
      { name: ChapterMember.name, schema: ChapterMemberSchema },
      { name: IssuesAdoption.name, schema: IssuesAdoptionSchema },
      { name: StdPluginAsset.name, schema: StdPluginAssetSchema },
      { name: StdAssetAdoption.name, schema: StdAssetAdoptionSchema },
      { name: RulesAdoption.name, schema: RulesAdoptionSchema },

      { name: ChapterProject.name, schema: ChapterProjectSchema },
      { name: ChapterRuleRegulations.name, schema: ChapterRuleRegulationsSchema },
      { name: ChapterIssues.name, schema: ChapterIssueSchema },
      { name: ChapterDebates.name, schema: ChapterDebateSchema },

      { name: GroupChat.name, schema: GroupChatSchema },
      { name: ChatMessage.name, schema: ChatMessageSchema },
      { name: IssueSolution.name, schema: issueSolutionSchema },
      { name: GuidingPrinciples.name, schema: GuidingPrinciplesSchema },
      { name: Notification.name, schema: NotificationSchema },
      { name: Feed.name, schema: FeedSchema },
      { name: StdPluginAsset.name, schema: StdPluginAssetSchema },
      { name: StdPlugin.name, schema: StdPluginSchema },
      { name: GenericPost.name, schema: GenericPostSchema },
      { name: Domain.name, schema: DomainSchema },
      { name: HistoryTimeline.name, schema: HistoryTimelineSchema },
      { name: Configuration.name, schema: ConfigurationSchema },
      { name: ForumFaqs.name, schema: ForumFaqsSchema },
      { name: ForumAchievements.name, schema: ForumAchievementsSchema },
      { name: ForumProfile.name, schema: ForumProfileSchema },
      { name: CustomerConnect.name, schema: CustomerConnectSchema },
      { name: ForumCampaign.name, schema: ForumCampaignSchema },
      { name: PaymentSlabs.name, schema: PaymentSlabsSchema },
      { name: ForumSubscription.name, schema: ForumSubscriptionSchema },
    ]),
    forwardRef(() => SearchModule),
  ],
  exports: [MongooseModule, UploadModule, SearchModule],
})
export class SharedModule { }
