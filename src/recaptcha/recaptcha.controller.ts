import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RecaptchaService } from './recaptcha.service';

@ApiTags('Recaptcha')
@Controller('recaptcha')
export class RecaptchaController {
  constructor(private readonly recaptchaService: RecaptchaService) { }

  @Post()
  async validateRecaptcha(
    @Body('token') token: string,
  ): Promise<{ success: boolean }> {
    if (!token) {
      throw new BadRequestException('Recaptcha token is required');
    }

    try {
      const isValid = await this.recaptchaService.validateRecaptcha(token);

      if (!isValid) {
        throw new BadRequestException('Recaptcha validation failed');
      }

      return { success: true };
    } catch (error) {
      throw error;
    }
  }
}
