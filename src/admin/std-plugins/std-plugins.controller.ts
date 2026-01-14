import { Controller, Get, Post, Body, Req, UsePipes, ValidationPipe, NotFoundException, Param, Patch, UploadedFiles, BadRequestException, InternalServerErrorException, ConflictException, Delete } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminStdPluginsService } from './std-plugins.service';
import { AuthorizationService } from 'src/user/auth/authorization.service';
import { Request } from 'express';
import { CreateStdPluginDto } from './dto/create-standard-plugin.dto';
import { UpdateStdPluginDto } from './dto/update-standard-plugin.dto';
import { FileValidationPipe } from 'src/shared/pipes/file-validation.pipe';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { UseInterceptors } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateOrReject } from 'class-validator';

@ApiTags('Admin - Standard Plugins')
@ApiBearerAuth()
@Controller('admin/std-plugins')
export class AdminStdPluginsController {
    constructor(private readonly stdPluginsService: AdminStdPluginsService,
        private readonly authorizationService: AuthorizationService
    ) { }

    @Get()
    async findAll(@Req() req: Request) {
        await this.authorizationService.validateAdmin(req?.user?._id);
        return this.stdPluginsService.findAll();
    }

    // find by slug
    @Get(':slug')
    async findOneBySlug(@Param('slug') slug: string, @Req() req: Request) {
        await this.authorizationService.validateAdmin(req?.user?._id);
        return this.stdPluginsService.findOneBySlug(slug);
    }

    @Post()
    @UsePipes(new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidUnknownValues: true,
        transformOptions: {
            enableImplicitConversion: true,
        },
    }))
    @UseInterceptors(
        FileFieldsInterceptor([
            { name: 'logo', maxCount: 1 },
        ]),
    )

    // async create(@Req() req: Request, @Body() createStdPluginDto: CreateStdPluginDto,
    async create(@Req() req: Request, @Body() createStdPluginDto,
        @UploadedFiles(
            new FileValidationPipe({
                logo: {
                    maxSizeMB: 5,
                    allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png'],
                    required: true,
                },
            }),
        )
        files: {
            logo: Express.Multer.File[];
        },
    ) {
        if (typeof createStdPluginDto.fields === 'string') {
            try {
                createStdPluginDto.fields = JSON.parse(createStdPluginDto.fields);
            } catch (e) {
                throw new BadRequestException('Invalid JSON in "fields"');
            }
        }
        try {
            const dto = plainToInstance(CreateStdPluginDto, createStdPluginDto);
            // await validateOrReject(dto);
            await this.authorizationService.validateAdmin(req?.user?._id);
            return this.stdPluginsService.create(dto, req?.user?._id, files.logo[0]);
        } catch (error) {
            console.log('Standard Plugin CREATE Error :: ', error);
            if (error instanceof BadRequestException || error instanceof ConflictException) {
                throw error;
            }
            throw new InternalServerErrorException('Failed to create standard plugin');
        }
    }

    @Patch(':id')
    @UsePipes(new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidUnknownValues: true,
        transformOptions: {
            enableImplicitConversion: true,
        },
    }))
    @UseInterceptors(
        FileFieldsInterceptor([
            { name: 'logo', maxCount: 1 },
        ]),
    )
    async update(
        @Param('id') id: string,
        @Req() req: Request,
        @Body() updateStdPluginDto,
        @UploadedFiles(
            new FileValidationPipe({
                logo: {
                    maxSizeMB: 5,
                    allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png'],
                    required: false, // Logo is optional for updates
                },
            }),
        )
        files?: {
            logo?: Express.Multer.File[];
        },
    ) {

        console.log('updateStdPluginDto :: ', updateStdPluginDto);
        if (typeof updateStdPluginDto.fields === 'string') {
            try {
                updateStdPluginDto.fields = JSON.parse(updateStdPluginDto.fields);
            } catch (e) {
                throw new BadRequestException('Invalid JSON in "fields"');
            }
        }

        try {
            const dto = plainToInstance(UpdateStdPluginDto, updateStdPluginDto);
            // await validateOrReject(dto);
            await this.authorizationService.validateAdmin(req?.user?._id);

            const logoFile = files?.logo?.[0] || null;
            console.log('logoFile :: ', dto);
            return this.stdPluginsService.update(id, dto, req?.user?._id, logoFile);
        } catch (error) {
            console.log('Standard Plugin UPDATE Error :: ', error);
            if (error instanceof BadRequestException || error instanceof ConflictException || error instanceof NotFoundException) {
                throw error;
            }
            throw new InternalServerErrorException('Failed to update standard plugin');
        }
    }

    // publish plugin
    @Patch(':id/publish')
    async publishPlugin(@Param('id') id: string, @Req() req: Request) {
        await this.authorizationService.validateAdmin(req?.user?._id);
        return this.stdPluginsService.publishPlugin(id);
    }

    // delete plugin
    @Delete(':id')
    async deletePlugin(@Param('id') id: string, @Req() req: Request) {
        await this.authorizationService.validateAdmin(req?.user?._id);
        return this.stdPluginsService.deletePlugin(id);
    }
}