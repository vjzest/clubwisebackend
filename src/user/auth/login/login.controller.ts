import {
  Controller,
  Post,
  Body,
  Res,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { response, Response } from 'express'; // Import Express Response type
import { LoginService } from './login.service'; // Import the LoginService
import { LoginDto } from './dto/login.sto';
import { SkipAuth } from '../../../decorators/skip-auth.decorator';

@ApiTags('Auth')
@SkipAuth()
@Controller('login')
export class LoginController {
  constructor(private readonly loginService: LoginService) { }

  @Post()
  async login(@Body() loginDto: LoginDto, @Res() response: Response) {
    // Call the login service to authenticate the user
    const result = await this.loginService.login(response, loginDto);
    return response.status(HttpStatus.OK).json(result); // Return the response with 200 OK
  }
}
