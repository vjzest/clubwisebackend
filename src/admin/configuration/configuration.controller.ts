import { Body, Controller, Get, Post, Put, Req, UsePipes, ValidationPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ConfigurationService } from './configuration.service';
import { AuthorizationService } from 'src/user/auth/authorization.service';
import { Request } from 'express';
import { CreateConfigurationDto } from './dto/create-configuration.dto';

@ApiTags('Admin - Configuration')
@ApiBearerAuth()
@Controller('admin/configuration')
export class ConfigurationController {
    constructor(
        private readonly configurationService: ConfigurationService,
        private readonly authorizationService: AuthorizationService
    ) { }

    @Put('asset-creation-count')
    @UsePipes(new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidUnknownValues: true,
        transformOptions: {
            enableImplicitConversion: true,
        },
    }))
    async updateAssetCount(@Body() createConfigurationDto: CreateConfigurationDto, @Req() req: Request) {
        await this.authorizationService.validateAdmin(req?.user?._id);
        return this.configurationService.updateAssetCount(createConfigurationDto);
    }

    @Get()
    async getConfiguration() {
        return this.configurationService.getConfiguration();
    }
}
