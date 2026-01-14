import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Node_ } from 'src/shared/entities/node.entity';
import { Club } from '../entities/club.entity';
import { StdPluginAsset } from '../entities/standard-plugin/std-plugin-asset.entity';
import { StdPlugin } from '../entities/standard-plugin/std-plugin.entity';

@Injectable()
export class SearchService {
  constructor(
    @InjectModel(Node_.name) private readonly nodeModel: Model<Node_>,
    @InjectModel(Club.name) private readonly clubModel: Model<Club>,
    @InjectModel(StdPluginAsset.name)
    private readonly stdPluginAssetModel: Model<StdPluginAsset>,
    @InjectModel(StdPlugin.name)
    private readonly stdPluginModel: Model<StdPlugin>,
  ) {}

  async search(term: string, tag?: string) {
    try {
      if (tag === 'Node') {
        const nodes = await this.nodeModel.find({
          name: { $regex: term, $options: 'i' },
        });
        return {
          data: {
            nodes,
          },
        };
      }

      if (tag === 'Club') {
        const clubs = await this.clubModel.find({
          name: { $regex: term, $options: 'i' },
        });
        return {
          data: {
            clubs,
          },
        };
      }

      const nodes = await this.nodeModel.find({
        name: { $regex: term, $options: 'i' },
      });
      const clubs = await this.clubModel.find({
        name: { $regex: term, $options: 'i' },
      });
      return {
        data: {
          nodes,
          clubs,
        },
      };
    } catch (error) {
      throw new BadRequestException('Failed to search');
    }
  }

  async searchAssetsByForumNameAndCategory(
    term: string,
    categorySafekey: string,
  ) {
    try {
      // First, find the plugin by its safekey
      const plugin = await this.stdPluginModel.findOne({
        safekey: categorySafekey,
      });

      if (!plugin) {
        return {
          data: {
            assets: [],
          },
        };
      }

      // Find all nodes and clubs whose names match the search term
      const nodes = await this.nodeModel
        .find({
          name: { $regex: term, $options: 'i' },
        })
        .select('_id');

      const clubs = await this.clubModel
        .find({
          name: { $regex: term, $options: 'i' },
        })
        .select('_id');

      const nodeIds = nodes.map((node) => node._id);
      const clubIds = clubs.map((club) => club._id);

      // Find all standard plugin assets that:
      // 1. Belong to the specified plugin (by safekey)
      // 2. Belong to forums (nodes or clubs) that match the search term
      // 3. Are published
      const assets = await this.stdPluginAssetModel
        .find({
          plugin: plugin._id,
          $or: [{ node: { $in: nodeIds } }, { club: { $in: clubIds } }],
          publishedStatus: 'published',
          isDeleted: false,
        })
        .populate('plugin', 'name slug safekey')
        .populate('createdBy', 'userName profileImage _id')
        .populate('node', 'name _id profileImage')
        .populate('club', 'name _id profileImage')
        .sort({ createdAt: -1 });

      return {
        data: {
          assets,
        },
      };
    } catch (error) {
      throw new BadRequestException('Failed to search assets by category');
    }
  }
}
