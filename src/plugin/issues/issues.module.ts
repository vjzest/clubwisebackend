import { Module } from '@nestjs/common';
import { IssuesService } from './issues.service';
import { IssuesController } from './issues.controller';
import { SharedModule } from 'src/shared/shared.module';
import { APP_GUARD } from '@nestjs/core';
import { CommonModule } from '../common/common.module';
import { AssetsModule } from 'src/assets/assets.module';

@Module({
  imports: [SharedModule, CommonModule, AssetsModule],
  providers: [IssuesService

  ],
  controllers: [IssuesController],
})
export class IssuesModule { }
