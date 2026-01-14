import { Module } from '@nestjs/common';

import { RulesRegulationsModule } from './rules-regulations/rules-regulations.module';
import { SharedModule } from '../shared/shared.module';
import { IssuesModule } from './issues/issues.module';
import { DebateModule } from './debate/debate.module';
import { ProjectModule } from './project/project.module';
import { CommonModule } from './common/common.module';

@Module({
  imports: [
    RulesRegulationsModule,
    IssuesModule,
    SharedModule,
    DebateModule,
    ProjectModule,
    CommonModule,
  ],
  exports: [RulesRegulationsModule, IssuesModule, CommonModule],
})
export class PluginModule { }
