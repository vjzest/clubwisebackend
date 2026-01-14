// src/auth/auth.service.ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { verifyToken } from '../../../utils';
import { HttpException, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { User } from '../../../shared/entities/user.entity';
import { Model } from 'mongoose';

@Injectable()
export class VerifyToken {
  constructor(@InjectModel(User.name) private userModel: Model<User>) { }

  async verifyToken(token: string) {
    try {
      // Verify the token using the JWT service
      const decoded = verifyToken(token);

      return {
        status: true,
        message: 'Token is valid',
        data: decoded,
      };
    } catch (error) {
      // Handle specific JWT errors
      if (error.name === 'TokenExpiredError') {
        throw new HttpException(
          {
            status: false,
            message: 'Token has expired',
          },
          HttpStatus.UNAUTHORIZED,
        );
      } else if (error.name === 'JsonWebTokenError') {
        throw new HttpException(
          {
            status: false,
            message: 'Invalid token',
          },
          HttpStatus.UNAUTHORIZED,
        );
      } else {
        throw new HttpException(
          {
            status: false,
            message: 'Token verification failed',
          },
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    }
  }

  async verifyLogin(token: string) {
    try {
      if (!token) {
        throw new BadRequestException('Token is required');
      }
      const decoded = verifyToken(token) as { email: string };
      const user = this.userModel
        .findOne({ email: decoded.email })
        .select('-password');
      return {
        status: true,
        user,
      };
    } catch (error) {
      throw error;
    }
  }

  async checkUserStatus(email: string) {


    const user: any = await this.userModel.findOne({ email });



    if (!user) {
      throw new NotFoundException('User not found');
    }

    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000); // 30 minutes ago

    if (user.emailVerified && user.createdAt < thirtyMinutesAgo) {
      console.log('Email verified more than 1 min ago');
      // If email was verified more than 1 min ago, update it to false
      await this.userModel.updateOne(
        { email },
        { $set: { emailVerified: false } }
      );

      // Fetch the updated user
      user.emailVerified = false;
    }

    return {
      isVerified: user.emailVerified,
    };
  }

}
