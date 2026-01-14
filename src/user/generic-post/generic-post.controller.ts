import { Body, Controller, Get, Param, Patch, Post, Put, Req, UploadedFiles, UseInterceptors, ValidationPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { FileDto } from '../../plugin/issues/dto/create-issue.dto';
import { FileValidationPipe } from '../../shared/pipes/file-validation.pipe';
import { CreateGenericPostDto } from './dto/create-generic-post.dto';
import { GenericPostService } from './generic-post.service';
import { Request } from 'express';

@ApiTags('Generic Posts')
@ApiBearerAuth()
@Controller('generic-post')
export class GenericPostController {
    constructor(
        private readonly genericPostService: GenericPostService,
    ) { }

    @Post()
    @UseInterceptors(
        FilesInterceptor('files', 4, {
            storage: memoryStorage(),
        }),
    )
    async create(
        @UploadedFiles(
            new FileValidationPipe({
                files: {
                    maxSizeMB: 5,
                    allowedMimeTypes: [
                        'image/jpeg',
                        'image/jpg',
                        'image/png',
                    ],
                    required: false,
                },
            }),
        )
        files: Express.Multer.File[],
        @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
        createPostDto: CreateGenericPostDto,
        @Req() req: Request,
    ) {

        // map Multer files into FileDto format
        const mappedFiles: any[] =
            files?.map((file) => ({
                buffer: file.buffer,
                originalname: file.originalname,
                mimetype: file.mimetype,
                size: file.size,
            })) ?? [];

        const userId = req.user._id;
        return this.genericPostService.create({
            ...createPostDto,
            files: mappedFiles,
        }, userId);
    }

    @Put("like")
    async likeGenericPost(@Body("postId") postId: string, @Req() req: Request) {
        return this.genericPostService.likeGenericPost(postId, req.user._id);
    }

    @Put("view")
    async viewGenericPost(@Body("postId") postId: string, @Req() req: Request) {
        return this.genericPostService.viewGenericPost(postId, req.user._id);
    }

    @Get(":id")
    async findGenericPostById(@Param('id') id: string, @Req() req: Request) {
        return this.genericPostService.findGenericPostById(id, req.user._id);
    }

    @Patch("delete-generic/:id")
    async deleteGenericPost(@Param('id') id: string, @Req() req: Request) {
        return this.genericPostService.deleteGenericPost(id, req.user._id);
    }
}
