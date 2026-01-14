import { Module } from '@nestjs/common';
import { StdAssetsService } from './standard-assets.service';
import { StdAssetsController, StdCtaResponsesController } from './standard-assets.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { StdPluginAsset, StdPluginAssetSchema } from '../../shared/entities/standard-plugin/std-plugin-asset.entity';
import { StdPlugin, StdPluginSchema } from '../../shared/entities/standard-plugin/std-plugin.entity';
import { AuthModule } from '../../user/auth/auth.module';
import { SharedModule } from '../../shared/shared.module';
import { StdAssetAdoption, StdAssetAdoptionSchema } from '../../shared/entities/standard-plugin/std-asset-adoption.entity';
import { CommonModule } from '../../plugin/common/common.module';
import { NotificationModule } from '../../notification/notification.module';
import { AssetsModule } from '../../assets/assets.module';
import { StdCtaResponse, StdCtaResponseSchema } from '../../shared/entities/standard-plugin/std-cta-response.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: StdPluginAsset.name, schema: StdPluginAssetSchema },
      { name: StdPlugin.name, schema: StdPluginSchema },
      { name: StdAssetAdoption.name, schema: StdAssetAdoptionSchema },
      { name: StdCtaResponse.name, schema: StdCtaResponseSchema }
    ]),
    AuthModule,
    SharedModule,
    CommonModule,
    NotificationModule,
    AssetsModule
  ],
  controllers: [StdAssetsController, StdCtaResponsesController],
  providers: [StdAssetsService],
  exports: [StdAssetsService]
})
export class StdAssetsModule { }
