import { Module } from '@nestjs/common';
import { ProjectService } from './project.service';
import { ProjectController } from './project.controller';
import { SharedModule } from 'src/shared/shared.module';
import { AdoptContributionModule } from './adopt-contribution/adopt-contribution.module';
import { AnnouncementModule } from './announcement/announcement.module';
import { CommonModule } from '../common/common.module';
import { AssetsModule } from 'src/assets/assets.module';

@Module({
  imports: [SharedModule, AdoptContributionModule, AnnouncementModule, CommonModule, AssetsModule],
  controllers: [ProjectController],
  providers: [ProjectService],
  exports: [ProjectService],
})
export class ProjectModule { }
