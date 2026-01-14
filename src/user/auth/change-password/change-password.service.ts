import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { User } from 'src/shared/entities/user.entity';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ServiceResponse } from 'src/shared/types/service.response.type';
import { TokenExpiredError } from 'jsonwebtoken';
import { hashPassword, verifyToken } from 'src/utils'; // Assuming you have a utility function to verify tokens
import { TokenExpiredException } from 'src/shared/exceptions/token-expired.exception';

@Injectable()
export class ChangePasswordService {
  constructor(@InjectModel(User.name) private userModel: Model<User>) { }

  async changePassword(
    password: string,
    authorization: string,
  ) {
    const token = authorization.replace('Bearer ', '');

    try {
      if (!token) {
        throw new BadRequestException('Token is required');
      }

      // Step 2: Verify the token
      const decoded = verifyToken(token) as { email: string };

      if (!decoded) {
        throw new BadRequestException('Invalid or expired token');
      }

      const user = await this.userModel.findOne({ email: decoded.email });
      if (!user) {
        throw new NotFoundException('User not found');
      }
      const hashedPassword = await hashPassword(password);
      user.password = hashedPassword;
      await user.save();

      return {
        success: true,
        message: 'Password changed successfully',
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      if (error instanceof NotFoundException) throw error;
      if (error instanceof TokenExpiredError) throw new TokenExpiredException('This password reset link has expired. Please request a new link');
      throw error;
    }
  }

  validateToken(token: string): boolean {
    // Remove Bearer prefix if present
    const cleanToken = token.startsWith('Bearer ')
      ? token.replace('Bearer ', '')
      : token;

    try {
      // Verify the token using the existing verifyToken function
      const decoded = verifyToken(cleanToken);

      // If verification was successful, return true
      return !!decoded;
    } catch (error) {
      // Token verification failed
      return false;
    }
  }
}
