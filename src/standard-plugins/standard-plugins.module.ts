import { Module } from '@nestjs/common';
import { UserStdPluginsService } from './standard-plugins.service';
import { UserStdPluginsController } from './standard-plugins.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { StdPlugin, StdPluginSchema } from '../shared/entities/standard-plugin/std-plugin.entity';
import { StdPluginAsset, StdPluginAssetSchema } from '../shared/entities/standard-plugin/std-plugin-asset.entity';
import { AuthModule } from '../user/auth/auth.module';
import { StdAssetsModule } from '../user/standard-assets/standard-assets.module';
import { Club, ClubSchema } from 'src/shared/entities/club.entity';
import { Node_, NodeSchema } from 'src/shared/entities/node.entity';
import { Chapter, ChapterSchema } from 'src/shared/entities/chapters/chapter.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: StdPlugin.name, schema: StdPluginSchema },
      { name: StdPluginAsset.name, schema: StdPluginAssetSchema },
      { name: Club.name, schema: ClubSchema },
      { name: Node_.name, schema: NodeSchema },
      { name: Chapter.name, schema: ChapterSchema },
    ]),
    AuthModule,
    StdAssetsModule
  ],
  controllers: [UserStdPluginsController],
  providers: [UserStdPluginsService],
})
export class UserStdPluginsModule { }
