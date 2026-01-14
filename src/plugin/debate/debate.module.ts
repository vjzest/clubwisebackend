import { Module } from '@nestjs/common';
import { DebateController } from './debate.controller';
import { DebateService } from './debate.service';
import { SharedModule } from '../../shared/shared.module';
import { CommonModule } from '../common/common.module';
import { AssetsModule } from '../../assets/assets.module';
@Module({
  imports: [SharedModule, CommonModule, AssetsModule],
  controllers: [DebateController],
  providers: [DebateService],
})
export class DebateModule { }
