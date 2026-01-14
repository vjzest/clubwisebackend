import { Module } from '@nestjs/common';
import { ConfigurationService } from './configuration.service';
import { SharedModule } from '../../shared/shared.module';
import { ConfigurationController } from './configuration.controller';
import { AuthModule } from '../../user/auth/auth.module';

@Module({
  imports: [SharedModule, AuthModule],
  controllers: [ConfigurationController],
  providers: [ConfigurationService]
})
export class ConfigurationModule { }
