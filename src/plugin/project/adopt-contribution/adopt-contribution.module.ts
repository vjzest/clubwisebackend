import { Module } from '@nestjs/common';
import { AdoptContributionService } from './adopt-contribution.service';
import { AdoptContributionController } from './adopt-contribution.controller';
import { SharedModule } from 'src/shared/shared.module';
import { AssetsModule } from 'src/assets/assets.module';

@Module({
  imports: [SharedModule, AssetsModule],
  controllers: [AdoptContributionController],
  providers: [AdoptContributionService],
  exports: [AdoptContributionService],
})
export class AdoptContributionModule { }
