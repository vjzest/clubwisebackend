import { Module } from '@nestjs/common';
import { RulesRegulationsController } from './rules-regulations.controller';
import { RulesRegulationsService } from './rules-regulations.service';

import { SharedModule } from '../../shared/shared.module';
import { CommentModule } from '../../user/comment/comment.module';
import { CommonModule } from '../common/common.module';
import { AssetsModule } from '../../assets/assets.module';

@Module({
  imports: [SharedModule, CommentModule, CommonModule, AssetsModule],

  controllers: [RulesRegulationsController],

  providers: [RulesRegulationsService],
})
export class RulesRegulationsModule { }
