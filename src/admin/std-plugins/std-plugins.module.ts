import { Module } from '@nestjs/common';
import { AdminStdAssetsModule } from './std-assets/std-assets.module';
import { AdminStdPluginsController } from './std-plugins.controller';
import { AdminStdPluginsService } from './std-plugins.service';
import { MongooseModule } from '@nestjs/mongoose';
import { StdPlugin, StdPluginSchema } from 'src/shared/entities/standard-plugin/std-plugin.entity';
import { AuthModule } from 'src/user/auth/auth.module';
import { UploadService } from 'src/shared/upload/upload.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: StdPlugin.name, schema: StdPluginSchema },
    ]),
    AdminStdAssetsModule,
    AuthModule
  ],
  controllers: [AdminStdPluginsController],
  providers: [AdminStdPluginsService, UploadService],
})
export class AdminStdPluginsModule { }
