import {
  Injectable,
  ConflictException,
  BadRequestException,
  InternalServerErrorException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { CreateUserDto } from './dto/create-user.dto';

import { generateToken, hashPassword } from 'src/utils';
import { UpdateUserDto } from 'src/user/onboarding/dto/update-user.dto';
import { ImageData } from './entities/user.entity';
import { User } from 'src/shared/entities/user.entity';
import { ENV } from 'src/utils/config/env.config';
import { OtpService } from './otp.service';
interface OnBoardingData {
  userId: string;
  stage: 'details' | 'image' | 'interest' | 'node';
  data: any;
}

@Injectable()
export class SignupService {
  constructor(@InjectModel(User.name) private userModel: Model<User>,
    private readonly OtpService: OtpService
  ) { }

  async signUp(
    signupData: CreateUserDto,
  ): Promise<{ status: boolean; message: string; data?: any; token: string }> {
    const { email, password } = signupData;
    console.log({ email, password })
    const existingUser: any = await this.userModel.findOne({
      email,
    });

    const thirtyMinutesAgo = new Date(Date.now() - 1 * 60 * 1000);// 30 minutes before now

    if (existingUser && existingUser?.registered) {
      throw new ConflictException('Email already exists');
    }

    const session = await this.userModel.startSession();
    session.startTransaction();

    try {
      const hashedPassword = await hashPassword(password);

      existingUser.password = hashedPassword;
      existingUser.registered = true;

      await existingUser.save({ session });
      await session.commitTransaction();

      const token = generateToken({ email, id: existingUser._id }, ENV.TOKEN_EXPIRY_TIME);

      const sanitizedUser = JSON.parse(JSON.stringify(existingUser));
      delete sanitizedUser.password;


      console.log({ sanitizedUser })

      return {
        status: true,
        message: 'Your account has been created successfully',
        data: sanitizedUser,
        token,
      };
    } catch (error) {
      console.log({ error })
      console.log({ error });
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async onBoarding(
    onBoardingData: OnBoardingData,
  ): Promise<{ status: boolean; message: string; data: any }> {
    const { userId, stage, data } = onBoardingData;

    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    try {
      switch (stage) {
        case 'details':
          await this.handleDetailsUpdate(user, data as UpdateUserDto);
          break;

        case 'image':
          await this.handleImageUpdate(
            user,
            data as {
              profileImage?: string;
              coverImage?: string;
            },
          );
          break;

        default:
          throw new BadRequestException('Invalid onboarding stage');
      }

      user.isOnBoarded = true;
      await user.save();

      return {
        status: true,
        message: `${stage} stage completed successfully`,
        data: user,
      };
    } catch (error) {
      console.error(`Error in onboarding ${stage} stage:`, error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Failed to complete ${stage} stage`,
      );
    }
  }

  private async handleDetailsUpdate(
    user: User,
    data: UpdateUserDto,
  ): Promise<void> {
    // Update only provided fields
    if (data.firstName) user.firstName = data.firstName;
    if (data.lastName) user.lastName = data.lastName;
    if (data.gender) user.gender = data.gender;
    if (data.dateOfBirth) user.dateOfBirth = new Date(data.dateOfBirth);
    if (data.phoneNumber) user.phoneNumber = data.phoneNumber;

    user.onBoardingStage = 'details';
    await user.save();
  }

  private async handleImageUpdate(
    user: User,
    data: {
      profileImage?: string;
      coverImage?: string;
    },
  ): Promise<void> {
    if (data.profileImage) {
      user.profileImage = data.profileImage;
    }

    if (data.coverImage) {
      user.coverImage = data.coverImage;
    }

    user.onBoardingStage = 'image';
    await user.save();
  }
}
