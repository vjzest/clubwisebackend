import { Injectable, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User } from '../../shared/entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
  ) { }

  async getAllUsers(page: number = 1, limit: number = 10, search?: string) {
    try {
      const skip = (page - 1) * limit;

      let query = {};
      if (search) {
        const searchRegex = new RegExp(search, 'i');
        query = {
          $or: [
            { userName: searchRegex },
            { firstName: searchRegex },
            { lastName: searchRegex },
            { email: searchRegex },
          ],
        };
      }

      const [users, total] = await Promise.all([
        this.userModel
          .find(query)
          .select('-password')
          .skip(skip)
          .limit(limit)
          .sort({ createdAt: -1 })
          .lean()
          .exec(),
        this.userModel.countDocuments(query),
      ]);

      return {
        users,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      throw new InternalServerErrorException('Error fetching users');
    }
  }

  async getUserById(userId: string) {
    try {
      const user = await this.userModel
        .findById(userId)
        .select('-password')
        .lean()
        .exec();

      if (!user) {
        throw new NotFoundException('User not found');
      }

      return user;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Error fetching user');
    }
  }

  async blockUser(userId: string) {
    try {
      const user = await this.userModel.findByIdAndUpdate(
        userId,
        { $set: { isBlocked: true } },
        { new: true }
      ).select('-password');

      if (!user) {
        throw new NotFoundException('User not found');
      }

      return {
        success: true,
        message: 'User blocked successfully',
        user,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Error blocking user');
    }
  }

  async unblockUser(userId: string) {
    try {
      const user = await this.userModel.findByIdAndUpdate(
        userId,
        { $set: { isBlocked: false } },
        { new: true }
      ).select('-password');

      if (!user) {
        throw new NotFoundException('User not found');
      }

      return {
        success: true,
        message: 'User unblocked successfully',
        user,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Error unblocking user');
    }
  }
}