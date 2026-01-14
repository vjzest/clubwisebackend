import { Module } from '@nestjs/common';
import { RulesRegulationsController } from './rules-regulations.controller';
import { RulesRegulationsService } from './rules-regulations.service';

import { SharedModule } from 'src/shared/shared.module';
import { CommentModule } from 'src/user/comment/comment.module';
import { CommonModule } from '../common/common.module';
import { AssetsModule } from 'src/assets/assets.module';

@Module({
  imports: [SharedModule, CommentModule, CommonModule, AssetsModule],

  controllers: [RulesRegulationsController],

  providers: [RulesRegulationsService],
})
export class RulesRegulationsModule { }
