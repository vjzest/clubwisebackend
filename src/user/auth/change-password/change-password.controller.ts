import {
  Body,
  Controller,
  Post,
  Headers,
  Res,
  HttpStatus,
  BadRequestException,
  NotFoundException,
  Get,
  HttpCode,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { TokenExpiredError } from 'jsonwebtoken';
import { ChangePasswordService } from './change-password.service';
import { Response } from 'express';
import { SkipAuth } from 'src/decorators/skip-auth.decorator';

@ApiTags('Auth')
@SkipAuth()
@Controller()
export class ChangePasswordController {
  constructor(private readonly changePasswordService: ChangePasswordService) { }

  @Post('/change-password')
  async changePassword(
    @Headers('authorization') authorization: string,
    @Body('password') password: string,
  ) {
    // try {
    const response = await this.changePasswordService.changePassword(
      password,
      authorization,
    );

    return response;
    // return res.status(HttpStatus.OK).json(response);
    // } catch (error) {
    //   if (error instanceof TokenExpiredError) {
    //     console.log("{ error }");
    //     return res.status(401).json(error);
    //   }
    //   if (error instanceof BadRequestException) {
    //     return res.status(HttpStatus.BAD_REQUEST).json(error);
    //   }

    //   if (error instanceof NotFoundException) {
    //     return res.status(HttpStatus.NOT_FOUND).json(error);
    //   }

    //   return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
    //     success: false,
    //     status: HttpStatus.INTERNAL_SERVER_ERROR,
    //     message: 'Internal server error',
    //   });
    // }
  }


  @Get('validate-token')
  @HttpCode(HttpStatus.OK)
  validateToken(@Headers('authorization') authorization: string) {
    if (!authorization) {
      return { valid: false, message: 'No token provided' };
    }

    const isValid = this.changePasswordService.validateToken(authorization);

    return {
      valid: isValid,
      message: isValid ? 'Token is valid' : 'Token is invalid or expired'
    };
  }
}
