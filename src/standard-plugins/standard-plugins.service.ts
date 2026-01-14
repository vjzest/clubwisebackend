import { ConflictException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { StdPlugin } from '../shared/entities/standard-plugin/std-plugin.entity';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { EPublishedStatus, StdPluginAsset } from '../shared/entities/standard-plugin/std-plugin-asset.entity';

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TForum } from 'typings';
import { Club } from '../shared/entities/club.entity';
import { Chapter } from '../shared/entities/chapters/chapter.entity';
import { Node_ } from '../shared/entities/node.entity';

@Injectable()
export class UserStdPluginsService {
  constructor(
    @InjectModel(StdPlugin.name)
    private stdPluginModel: Model<StdPlugin>,
    @InjectModel(StdPluginAsset.name)
    private stdPluginAssetModel: Model<StdPluginAsset>,
    @InjectModel(Club.name) private clubModel: Model<Club>,
    @InjectModel(Node_.name) private nodeModel: Model<Node_>,
    @InjectModel(Chapter.name) private chapterModel: Model<Chapter>,
  ) { }

  async findAll() {
    return this.stdPluginModel.find().sort({ createdAt: -1 }).select('-createdBy -__v -fields ');
  }

  async getPluginsToAddToForum(forum: TForum, forumId: string) {
    try {
      let _forum = null;

      if (forum === 'club') {
        _forum = await this.clubModel.findById(forumId);
      } else if (forum === 'node') {
        _forum = await this.nodeModel.findById(forumId);
      } else if (forum === 'chapter') {
        _forum = await this.chapterModel.findById(forumId);
      }

      if (!_forum) {
        throw new NotFoundException(`${forum} not found`);
      }

      const existingStandardPluginIds = (_forum.plugins || [])
        .filter((p: any) => p.type === 'standard')
        .map((p: any) => p.plugin);

      const plugins = await this.stdPluginModel.find({
        _id: { $nin: existingStandardPluginIds },
        status: 'published'
      });

      // if (!plugins || plugins.length === 0) {
      //   throw new NotFoundException('No new standard plugins to add');
      // }

      return plugins;
    } catch (error) {
      console.log('StdPluginAsset FIND ALL Error :: ', error);
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to find plugin assets');
    }
  }


  async findOne(id: string) {
    return this.stdPluginModel.findById(id).select('-createdBy -__v ');
  }

  async findOneBySlug(slug: string) {
    return this.stdPluginModel.findOne({ slug }).select('-createdBy -__v ');
  }
}