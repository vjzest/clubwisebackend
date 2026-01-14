import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdminAssetsController } from './admin-assets.controller';
import { AdminAssetsService } from './admin-assets.service';
import { User, UserSchema } from 'src/shared/entities/user.entity';
import { StdPluginAsset, StdPluginAssetSchema } from 'src/shared/entities/standard-plugin/std-plugin-asset.entity';
import { StdAssetAdoption, StdAssetAdoptionSchema } from 'src/shared/entities/standard-plugin/std-asset-adoption.entity';
import { RulesRegulations, RulesRegulationsSchema } from 'src/shared/entities/rules/rules-regulations.entity';
import { RulesAdoption, RulesAdoptionSchema } from 'src/shared/entities/rules/rules-adoption.entity';
import { Issues, IssuesSchema } from 'src/shared/entities/issues/issues.entity';
import { IssuesAdoption, IssuesAdoptionSchema } from 'src/shared/entities/issues/issues-adoption.entity';
import { ChapterIssues, ChapterIssueSchema } from 'src/shared/entities/chapters/modules/chapter-issues.entity';
import { Debate, DebateSchema } from 'src/shared/entities/debate/debate.entity';
import { DebateAdoption, DebateAdoptionSchema } from 'src/shared/entities/debate/debate-adoption-entity';
import { ChapterDebates, ChapterDebateSchema } from 'src/shared/entities/chapters/modules/chapter-debates.entity';
import { Comment, CommentSchema } from 'src/shared/entities/comment.entity';
import { AuthModule } from 'src/user/auth/auth.module';
import { IssueSolution, issueSolutionSchema } from 'src/shared/entities/issues/issue-solution.entity';
import { DebateArgument, DebateArgumentSchema } from 'src/shared/entities/debate/debate-argument.entity';
import { Projects, ProjectsSchema } from 'src/shared/entities/projects/project.entity';
import { ProjectContribution, ProjectContributionSchema } from 'src/shared/entities/projects/contribution.entity';
import { ProjectAnnouncement, ProjectAnnouncementSchema } from 'src/shared/entities/projects/project-announcement.entity';
import { ProjectActivities, ProjectActivitiesSchema } from 'src/shared/entities/projects/project-activities.entity';
import { ProjectFaq, ProjectFaqSchema } from 'src/shared/entities/projects/faq.enitity';

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