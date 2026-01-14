import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Club } from '../../shared/entities/club.entity';
import { Node_ } from '../../shared/entities/node.entity';

@Injectable()
export class ForumsService {
  constructor(
    @InjectModel(Club.name) private readonly clubModel: Model<Club>,
    @InjectModel(Node_.name) private readonly nodeModel: Model<Node_>,
  ) { }

  async getAllClubs(page: number = 1, limit: number = 10, search?: string) {
    try {
      const skip = (page - 1) * limit;

      let query = {};

      if (search) {
        query = {
          name: { $regex: search, $options: 'i' },
        };
      }

      const [clubs, total] = await Promise.all([
        this.clubModel
          .find(query)
          .populate('createdBy', 'userName firstName lastName email')
          .skip(skip)
          .limit(limit)
          .sort({ createdAt: -1 })
          .lean()
          .exec(),
        this.clubModel.countDocuments(),
      ]);

      return {
        clubs,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      throw new InternalServerErrorException('Error fetching clubs');
    }
  }

  async getAllNodes(page: number = 1, limit: number = 10, search?: string) {
    try {
      const skip = (page - 1) * limit;

      let query = {};

      if (search) {
        query = {
          name: { $regex: search, $options: 'i' },
        };
      }

      const [nodes, total] = await Promise.all([
        this.nodeModel
          .find(query)
          .populate('createdBy', 'userName firstName lastName email')
          .skip(skip)
          .limit(limit)
          .sort({ createdAt: -1 })
          .lean()
          .exec(),
        this.nodeModel.countDocuments(),
      ]);

      return {
        nodes,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      throw new InternalServerErrorException('Error fetching nodes');
    }
  }
}