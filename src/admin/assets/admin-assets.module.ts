import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdminAssetsController } from './admin-assets.controller';
import { AdminAssetsService } from './admin-assets.service';
import { User, UserSchema } from '../../shared/entities/user.entity';
import { StdPluginAsset, StdPluginAssetSchema } from '../../shared/entities/standard-plugin/std-plugin-asset.entity';
import { StdAssetAdoption, StdAssetAdoptionSchema } from '../../shared/entities/standard-plugin/std-asset-adoption.entity';
import { RulesRegulations, RulesRegulationsSchema } from '../../shared/entities/rules/rules-regulations.entity';
import { RulesAdoption, RulesAdoptionSchema } from '../../shared/entities/rules/rules-adoption.entity';
import { Issues, IssuesSchema } from '../../shared/entities/issues/issues.entity';
import { IssuesAdoption, IssuesAdoptionSchema } from '../../shared/entities/issues/issues-adoption.entity';
import { ChapterIssues, ChapterIssueSchema } from '../../shared/entities/chapters/modules/chapter-issues.entity';
import { Debate, DebateSchema } from '../../shared/entities/debate/debate.entity';
import { DebateAdoption, DebateAdoptionSchema } from '../../shared/entities/debate/debate-adoption-entity';
import { ChapterDebates, ChapterDebateSchema } from '../../shared/entities/chapters/modules/chapter-debates.entity';
import { Comment, CommentSchema } from '../../shared/entities/comment.entity';
import { AuthModule } from '../../user/auth/auth.module';
import { IssueSolution, issueSolutionSchema } from '../../shared/entities/issues/issue-solution.entity';
import { DebateArgument, DebateArgumentSchema } from '../../shared/entities/debate/debate-argument.entity';
import { Projects, ProjectsSchema } from '../../shared/entities/projects/project.entity';
import { ProjectContribution, ProjectContributionSchema } from '../../shared/entities/projects/contribution.entity';
import { ProjectAnnouncement, ProjectAnnouncementSchema } from '../../shared/entities/projects/project-announcement.entity';
import { ProjectActivities, ProjectActivitiesSchema } from '../../shared/entities/projects/project-activities.entity';
import { ProjectFaq, ProjectFaqSchema } from '../../shared/entities/projects/faq.enitity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: StdPluginAsset.name, schema: StdPluginAssetSchema },
      { name: StdAssetAdoption.name, schema: StdAssetAdoptionSchema },
      { name: RulesRegulations.name, schema: RulesRegulationsSchema },
      { name: RulesAdoption.name, schema: RulesAdoptionSchema },
      { name: Issues.name, schema: IssuesSchema },
      { name: IssuesAdoption.name, schema: IssuesAdoptionSchema },
      { name: ChapterIssues.name, schema: ChapterIssueSchema },
      { name: Debate.name, schema: DebateSchema },
      { name: DebateAdoption.name, schema: DebateAdoptionSchema },
      { name: ChapterDebates.name, schema: ChapterDebateSchema },
      { name: Comment.name, schema: CommentSchema },
      { name: IssueSolution.name, schema: issueSolutionSchema },
      { name: DebateArgument.name, schema: DebateArgumentSchema },
      { name: Projects.name, schema: ProjectsSchema },
      { name: ProjectContribution.name, schema: ProjectContributionSchema },
      { name: ProjectAnnouncement.name, schema: ProjectAnnouncementSchema },
      { name: ProjectActivities.name, schema: ProjectActivitiesSchema },
      { name: ProjectFaq.name, schema: ProjectFaqSchema },
    ]),
    AuthModule,
  ],
  controllers: [AdminAssetsController],
  providers: [AdminAssetsService],
  exports: [AdminAssetsService],
})
export class AdminAssetsModule { }