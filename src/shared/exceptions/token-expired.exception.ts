import { HttpException, HttpStatus } from '@nestjs/common';

export class TokenExpiredException extends HttpException {
  constructor(message: string = 'Token expired') {
    super(message, HttpStatus.UNAUTHORIZED);
  }
}
