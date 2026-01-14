import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdminStdAssetsService } from './std-assets.service';
import { AdminStdAssetsController } from './std-assets.controller';
import { StdPluginAsset, StdPluginAssetSchema } from 'src/shared/entities/standard-plugin/std-plugin-asset.entity';
import { StdPlugin, StdPluginSchema } from 'src/shared/entities/standard-plugin/std-plugin.entity';
import { UploadService } from 'src/shared/upload/upload.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: StdPluginAsset.name, schema: StdPluginAssetSchema },
      { name: StdPlugin.name, schema: StdPluginSchema }
    ])
  ],
  controllers: [AdminStdAssetsController],
  providers: [AdminStdAssetsService, UploadService],
  exports: [MongooseModule]
})
export class AdminStdAssetsModule { }
