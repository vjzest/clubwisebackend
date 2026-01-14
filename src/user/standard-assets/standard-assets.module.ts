import { Module } from '@nestjs/common';
import { StdAssetsService } from './standard-assets.service';
import { StdAssetsController, StdCtaResponsesController } from './standard-assets.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { StdPluginAsset, StdPluginAssetSchema } from 'src/shared/entities/standard-plugin/std-plugin-asset.entity';
import { StdPlugin, StdPluginSchema } from 'src/shared/entities/standard-plugin/std-plugin.entity';
import { AuthModule } from 'src/user/auth/auth.module';
import { SharedModule } from 'src/shared/shared.module';
import { StdAssetAdoption, StdAssetAdoptionSchema } from 'src/shared/entities/standard-plugin/std-asset-adoption.entity';
import { CommonModule } from 'src/plugin/common/common.module';
import { NotificationModule } from 'src/notification/notification.module';
import { AssetsModule } from 'src/assets/assets.module';
import { StdCtaResponse, StdCtaResponseSchema } from 'src/shared/entities/standard-plugin/std-cta-response.entity';

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
