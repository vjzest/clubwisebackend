import { ForbiddenException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import {  StdPluginAsset } from 'src/shared/entities/standard-plugin/std-plugin-asset.entity';
import { StdPlugin } from 'src/shared/entities/standard-plugin/std-plugin.entity';
import { Model, Types } from 'mongoose';

@Injectable()
export class AdminStdAssetsService {

  constructor(
    @InjectModel(StdPluginAsset.name)
    private stdPluginAssetModel: Model<StdPluginAsset>,
    @InjectModel(StdPlugin.name)
    private stdPluginModel: Model<StdPlugin>,
  ) { }

  async findAll(pluginId?: string, clubId?: string) {
    try {
      const query: any = { isActive: true };

      if (pluginId) {
        query.plugin = new Types.ObjectId(pluginId);
      }

      if (clubId) {
        query.club = new Types.ObjectId(clubId);
      }

      return this.stdPluginAssetModel.find(query)
        .populate('plugin', 'name slug')
        .populate('club', 'name')
        .populate('node', 'name')
        .populate('chapter', 'name')
        .populate('createdBy', 'name email')
        .populate('publishedBy', 'name email')
        .sort({ createdAt: -1 });
    } catch (error) {
      console.log('StdPluginAsset FIND ALL Error :: ', error);
      throw new InternalServerErrorException('Failed to fetch plugin assets');
    }
  }

  async findOne(id: string, userId: string) {
    try {
      const asset = await this.stdPluginAssetModel.findById(id)
        .populate('plugin', 'name slug fields')
        .populate('club', 'name')
        .populate('node', 'name')
        .populate('chapter', 'name')
        .populate('createdBy', 'name email')
        .populate('publishedBy', 'name email')
        .populate('statusHistory.changedBy', 'name email');

      if (!asset) {
        throw new NotFoundException('Asset not found');
      }

      // Add to views if not already viewed by this user
      const alreadyViewed = asset.views.some(view =>
        view.user.toString() === userId
      );

      if (!alreadyViewed) {
        asset.views.push({
          user: new Types.ObjectId(userId),
          date: new Date()
        });
        await asset.save();
      }

      return asset;
    } catch (error) {
      console.log('StdPluginAsset FIND ONE Error :: ', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to fetch plugin asset');
    }
  }


  async remove(id: string, userId: string) {
    try {
      const asset = await this.stdPluginAssetModel.findById(id);
      if (!asset) {
        throw new NotFoundException('Asset not found');
      }

      // Check if user is the creator or has appropriate permissions
      if (asset.createdBy.toString() !== userId) {
        // Here you might add additional permission checks
        throw new ForbiddenException('You do not have permission to delete this asset');
      }

      // Soft delete by setting isActive to false
      return this.stdPluginAssetModel.findByIdAndUpdate(
        id,
        { isActive: false },
        { new: true }
      );
    } catch (error) {
      console.log('StdPluginAsset REMOVE Error :: ', error);
      if (error instanceof NotFoundException ||
        error instanceof ForbiddenException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to delete plugin asset');
    }
  }
}
