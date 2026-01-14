import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Post,
    Put,
    Query,
    Req,
    UnauthorizedException,
    UseInterceptors,
    UploadedFiles,
    UploadedFile,
    BadRequestException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { ClubsiteService } from './clubsite.service';
import { CreateLetsTalkDto } from './dto/create-lets-talk.dto';
import { CreateStrategicNeedDto } from './dto/create-strategic-need.dto';
import { UpdateStrategicNeedDto } from './dto/update-strategic-need.dto';
import { SubmitResponseDto } from './dto/submit-response.dto';
import { CreateProductCategoryDto, UpdateProductCategoryDto } from './dto/create-product-category.dto';
import { CreateHistoryTimelineDto } from './dto/create-history-timeline.dto';
import { UpdateHistoryTimelineDto } from './dto/update-history-timeline.dto';
import { TForum } from 'typings';
import { FileFieldsInterceptor, FilesInterceptor, FileInterceptor } from '@nestjs/platform-express';
import { FileValidationPipe } from '../shared/pipes/file-validation.pipe';
import { memoryStorage } from 'multer';

@ApiBearerAuth()
@Controller('clubsite')
export class ClubsiteController {
    constructor(private readonly clubsiteService: ClubsiteService) { }

    // ==================== Let's Talk ====================

    @ApiTags('Clubsite - Let\'s Talk')
    @Post('lets-talk')
    createLetsTalk(@Body() createLetsTalkDto: CreateLetsTalkDto) {
        return this.clubsiteService.createLetsTalk(createLetsTalkDto);
    }

    @ApiTags('Clubsite - Let\'s Talk')
    @Get('lets-talk')
    async getAllLetsTalk(
        @Req() req: Request,
        @Query('forum') forum: TForum,
        @Query('forumId') forumId: string,
    ) {
        if (!forum || !forumId) {
            throw new UnauthorizedException('Forum type and forum ID are required');
        }

        return this.clubsiteService.getAllLetsTalkByForum(
            req.user._id,
            forum,
            forumId,
        );
    }

    // ==================== Strategic Needs ====================

    @ApiTags('Clubsite - Strategic Needs')
    @Post('strategic-needs')
    createStrategicNeed(
        @Req() req: Request,
        @Body() createDto: CreateStrategicNeedDto,
    ) {
        return this.clubsiteService.createStrategicNeed(req.user._id, createDto);
    }

    @ApiTags('Clubsite - Strategic Needs')
    @Get('strategic-needs')
    getAllStrategicNeeds(
        @Query('forum') forum: TForum,
        @Query('forumId') forumId: string,
    ) {
        if (!forum || !forumId) {
            throw new UnauthorizedException('Forum type and forum ID are required');
        }
        return this.clubsiteService.getAllStrategicNeedsByForum(forum, forumId);
    }

    @ApiTags('Clubsite - Strategic Needs')
    @Get('strategic-needs/:id')
    getStrategicNeedById(@Param('id') id: string) {
        return this.clubsiteService.getStrategicNeedById(id);
    }

    @ApiTags('Clubsite - Strategic Needs')
    @Patch('strategic-needs/:id')
    updateStrategicNeed(
        @Req() req: Request,
        @Param('id') id: string,
        @Body() updateDto: UpdateStrategicNeedDto,
    ) {
        return this.clubsiteService.updateStrategicNeed(req.user._id, id, updateDto);
    }

    @ApiTags('Clubsite - Strategic Needs')
    @Delete('strategic-needs/:id')
    deleteStrategicNeed(
        @Req() req: Request,
        @Param('id') id: string,
    ) {
        return this.clubsiteService.deleteStrategicNeed(req.user._id, id);
    }

    @ApiTags('Clubsite - Strategic Needs')
    @Post('strategic-needs/respond')
    submitStrategicNeedResponse(@Body() submitDto: SubmitResponseDto) {
        return this.clubsiteService.submitStrategicNeedResponse(submitDto);
    }

    @ApiTags('Clubsite - Strategic Needs')
    @Get('strategic-needs/:id/responses')
    getStrategicNeedResponses(
        @Req() req: Request,
        @Param('id') id: string,
    ) {
        return this.clubsiteService.getStrategicNeedResponses(req.user._id, id);
    }

    // ==================== Product Categories ====================

    @ApiTags('Clubsite - Product Categories')
    @Post('product-categories')
    createProductCategory(@Body() createDto: CreateProductCategoryDto) {
        return this.clubsiteService.createProductCategory(createDto);
    }

    @ApiTags('Clubsite - Product Categories')
    @Get('product-categories')
    getAllProductCategories(@Query('forumId') forumId: string) {
        return this.clubsiteService.getAllProductCategories(forumId);
    }

    @ApiTags('Clubsite - Product Categories')
    @Put('product-categories/:id')
    updateProductCategory(
        @Param('id') id: string,
        @Body() updateDto: UpdateProductCategoryDto,
    ) {
        return this.clubsiteService.updateProductCategory(id, updateDto);
    }

    @ApiTags('Clubsite - Product Categories')
    @Delete('product-categories/:id')
    deleteProductCategory(@Param('id') id: string) {
        return this.clubsiteService.deleteProductCategory(id);
    }

    @ApiTags('Clubsite - Product Categories')
    @Patch('product-categories/assign-product/:productId')
    assignProductToCategory(
        @Param('productId') productId: string,
        @Body('categoryId') categoryId: string,
    ) {
        return this.clubsiteService.assignProductToCategory(productId, categoryId);
    }

    @ApiTags('Clubsite - Product Categories')
    @Patch('product-categories/assign-products')
    assignProductsToCategory(@Body() body: { productIds: string[]; categoryId: string }) {
        return this.clubsiteService.assignProductsToCategory(body.productIds, body.categoryId);
    }

    @ApiTags('Clubsite - Product Categories')
    @Get('product-categories/products/:categoryId')
    getProductsByCategory(
        @Query('forumId') forumId: string,
        @Param('categoryId') categoryId: string,
    ) {
        return this.clubsiteService.getProductsByCategory(forumId, categoryId);
    }

    // ==================== About ====================

    @ApiTags('Clubsite - About')
    @Put('about')
    @UseInterceptors(
        FileFieldsInterceptor([
            { name: 'headerImages', maxCount: 10 },
            { name: 'testimonialImages', maxCount: 10 },
            { name: 'attachments', maxCount: 5 },
            { name: 'showcaseImages', maxCount: 20 },
            { name: 'clientLogos', maxCount: 20 },
        ]),
    )
    async manageAbout(
        @Query('forum') forum: TForum,
        @Query('forumId') forumId: string,
        @UploadedFiles(
            new FileValidationPipe({
                headerImages: {
                    maxSizeMB: 4,
                    allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png'],
                    required: false,
                },
                testimonialImages: {
                    maxSizeMB: 4,
                    allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png'],
                    required: false,
                },
                attachments: {
                    maxSizeMB: 10,
                    allowedMimeTypes: [
                        'image/jpeg',
                        'image/jpg',
                        'image/png',
                        'application/pdf',
                        'application/msword',
                        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                        'application/vnd.ms-powerpoint',
                        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                        'application/zip',
                        'application/x-zip-compressed',
                    ],
                    required: false,
                },
                showcaseImages: {
                    maxSizeMB: 4,
                    allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png'],
                    required: false,
                },
                clientLogos: {
                    maxSizeMB: 4,
                    allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png'],
                    required: false,
                },
            }),
        )
        files: {
            headerImages?: Express.Multer.File[];
            testimonialImages?: Express.Multer.File[];
            attachments?: Express.Multer.File[];
            showcaseImages?: Express.Multer.File[];
            clientLogos?: Express.Multer.File[];
        },
        @Body() body: any,
    ) {
        if (!forum || !forumId) {
            throw new BadRequestException('Forum type and forum ID are required');
        }

        const updatedBody = {
            ...body,
            headerImages: files?.headerImages,
            testimonialImages: files?.testimonialImages,
            attachments: files?.attachments,
            showcaseImages: files?.showcaseImages,
            clientLogos: files?.clientLogos,
        };

        return this.clubsiteService.manageAbout(forum, forumId, updatedBody);
    }

    @ApiTags('Clubsite - About')
    @Get('about')
    getAbout(
        @Query('forum') forum: TForum,
        @Query('forumId') forumId: string,
    ) {
        if (!forum || !forumId) {
            throw new BadRequestException('Forum type and forum ID are required');
        }
        return this.clubsiteService.getAbout(forum, forumId);
    }

    // ==================== Achievements ====================

    @ApiTags('Clubsite - Achievements')
    @Get('achievements')
    getAchievements(
        @Query('forum') forum: TForum,
        @Query('forumId') forumId: string,
    ) {
        if (!forum || !forumId) {
            throw new BadRequestException('Forum type and forum ID are required');
        }
        return this.clubsiteService.getAchievements(forum, forumId);
    }

    @ApiTags('Clubsite - Achievements')
    @Put('achievement')
    @UseInterceptors(
        FilesInterceptor('files', 5, {
            storage: memoryStorage(),
        }),
    )
    async manageAchievements(
        @Query('forum') forum: TForum,
        @Query('forumId') forumId: string,
        @UploadedFiles(
            new FileValidationPipe({
                files: {
                    maxSizeMB: 5,
                    allowedMimeTypes: [
                        'image/jpeg',
                        'image/jpg',
                        'image/png',
                        'application/pdf',
                    ],
                    required: false,
                },
            }),
        )
        files: Express.Multer.File[],
        @Body() body: {
            title: string;
            category: string;
            description: string;
            date: Date;
            links: any;
            achievementId?: string;
            deletedFileUrl?: string[];
        },
    ) {
        if (!forum || !forumId) {
            throw new BadRequestException('Forum type and forum ID are required');
        }

        const updatedBody = {
            ...body,
            files: files,
        };
        return this.clubsiteService.manageAchievements(forum, forumId, updatedBody);
    }

    // ==================== History Timeline ====================

    @ApiTags('Clubsite - History Timeline')
    @Post('history-timeline')
    async createHistoryTimeline(@Body() dto: CreateHistoryTimelineDto) {
        return this.clubsiteService.createHistoryTimeline(dto);
    }

    @ApiTags('Clubsite - History Timeline')
    @Get('history-timeline')
    async getAllHistoryTimeline(
        @Query('node') node?: string,
        @Query('club') club?: string,
        @Query('chapter') chapter?: string,
    ) {
        return this.clubsiteService.getAllHistoryTimeline({ node, club, chapter });
    }

    @ApiTags('Clubsite - History Timeline')
    @Put('history-timeline/:id')
    async updateHistoryTimeline(@Param('id') id: string, @Body() dto: UpdateHistoryTimelineDto) {
        return this.clubsiteService.updateHistoryTimeline(id, dto);
    }

    @ApiTags('Clubsite - History Timeline')
    @Delete('history-timeline/:id')
    async deleteHistoryTimeline(@Param('id') id: string) {
        return this.clubsiteService.deleteHistoryTimeline(id);
    }

    // ==================== Brand Stories ====================

    @ApiTags('Clubsite - Brand Stories')
    @Get('brand-stories')
    async getBrandStories(
        @Query('forum') forum: TForum,
        @Query('forumId') forumId: string,
    ) {
        if (!forum || !forumId) {
            throw new BadRequestException('Forum type and forum ID are required');
        }
        return this.clubsiteService.getBrandStories(forum, forumId);
    }

    @ApiTags('Clubsite - Brand Stories')
    @Put('brand-stories')
    @UseInterceptors(
        FilesInterceptor('images', 10, {
            storage: memoryStorage(),
        }),
    )
    async manageBrandStories(
        @Query('forum') forum: TForum,
        @Query('forumId') forumId: string,
        @UploadedFiles(
            new FileValidationPipe({
                images: {
                    maxSizeMB: 5,
                    allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png'],
                    required: false,
                },
            }),
        )
        images: Express.Multer.File[],
        @Body() body: {
            title: string;
            description: string;
            brandStoryId?: string;
            deletedFileUrl?: string[];
        },
    ) {
        if (!forum || !forumId) {
            throw new BadRequestException('Forum type and forum ID are required');
        }

        const updatedBody = {
            ...body,
            images: images,
        };
        return this.clubsiteService.manageBrandStories(forum, forumId, updatedBody);
    }

    // ==================== Management Team ====================

    @ApiTags('Clubsite - Management Team')
    @Get('management-team')
    async getManagementTeam(
        @Query('forum') forum: TForum,
        @Query('forumId') forumId: string,
    ) {
        if (!forum || !forumId) {
            throw new BadRequestException('Forum type and forum ID are required');
        }
        return this.clubsiteService.getManagementTeam(forum, forumId);
    }

    @ApiTags('Clubsite - Management Team')
    @Put('management-team')
    @UseInterceptors(
        FileInterceptor('image', {
            storage: memoryStorage(),
        }),
    )
    async manageManagementTeam(
        @Query('forum') forum: TForum,
        @Query('forumId') forumId: string,
        @UploadedFile(
            new FileValidationPipe({
                image: {
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
        image: Express.Multer.File,
        @Body() body: {
            name: string;
            title: string;
            description?: string;
            socialLinks?: string;
            memberId?: string;
            deletedFileUrl?: string;
        },
    ) {
        if (!forum || !forumId) {
            throw new BadRequestException('Forum type and forum ID are required');
        }

        const updatedBody = {
            ...body,
            image: image,
        };
        return this.clubsiteService.manageManagementTeam(forum, forumId, updatedBody);
    }

    @ApiTags('Clubsite - Management Team')
    @Delete('management-team/:memberId')
    async deleteManagementTeamMember(
        @Query('forum') forum: TForum,
        @Query('forumId') forumId: string,
        @Param('memberId') memberId: string,
    ) {
        if (!forum || !forumId) {
            throw new BadRequestException('Forum type and forum ID are required');
        }
        return this.clubsiteService.deleteManagementTeamMember(forum, forumId, memberId);
    }

    // ==================== Committee ====================

    @ApiTags('Clubsite - Committee')
    @Get('committees')
    async getCommittees(
        @Query('forum') forum: TForum,
        @Query('forumId') forumId: string,
    ) {
        if (!forum || !forumId) {
            throw new BadRequestException('Forum type and forum ID are required');
        }
        return this.clubsiteService.getCommittees(forum, forumId);
    }

    @ApiTags('Clubsite - Committee')
    @Put('committee')
    @UseInterceptors(
        FilesInterceptor('files', 10, {
            storage: memoryStorage(),
        }),
    )
    async manageCommittee(
        @Query('forum') forum: TForum,
        @Query('forumId') forumId: string,
        @UploadedFiles(
            new FileValidationPipe({
                files: {
                    maxSizeMB: 4,
                    allowedMimeTypes: [
                        'image/jpeg',
                        'image/jpg',
                        'image/png',
                        'application/pdf',
                    ],
                    required: false,
                },
            }),
        )
        files: Express.Multer.File[],
        @Body() body: any,
    ) {
        if (!forum || !forumId) {
            throw new BadRequestException('Forum type and forum ID are required');
        }

        const updatedBody = {
            ...body,
            files: files,
        };
        return this.clubsiteService.manageCommittee(forum, forumId, updatedBody);
    }

    @ApiTags('Clubsite - Committee')
    @Delete('committee/:committeeId')
    async deleteCommittee(
        @Query('forum') forum: TForum,
        @Query('forumId') forumId: string,
        @Param('committeeId') committeeId: string,
    ) {
        if (!forum || !forumId) {
            throw new BadRequestException('Forum type and forum ID are required');
        }
        return this.clubsiteService.deleteCommittee(forum, forumId, committeeId);
    }

    // ==================== Locations ====================

    @ApiTags('Clubsite - Locations')
    @Get('locations')
    async getLocations(
        @Query('forum') forum: TForum,
        @Query('forumId') forumId: string,
    ) {
        if (!forum || !forumId) {
            throw new BadRequestException('Forum type and forum ID are required');
        }
        return this.clubsiteService.getLocations(forum, forumId);
    }

    @ApiTags('Clubsite - Locations')
    @Put('locations')
    async manageLocations(
        @Query('forum') forum: TForum,
        @Query('forumId') forumId: string,
        @Body() body: {
            name: string;
            email: string;
            address: string;
            phoneNumber?: string;
            customerNumber?: string;
            complaintNumber?: string;
            isMainBranch?: boolean;
            branchId?: string;
            googleMapLink?: string;
        },
    ) {
        if (!forum || !forumId) {
            throw new BadRequestException('Forum type and forum ID are required');
        }
        return this.clubsiteService.manageLocations(forum, forumId, body);
    }

    @ApiTags('Clubsite - Locations')
    @Delete('locations/:locationId')
    async deleteLocation(
        @Query('forum') forum: TForum,
        @Query('forumId') forumId: string,
        @Param('locationId') locationId: string,
    ) {
        if (!forum || !forumId) {
            throw new BadRequestException('Forum type and forum ID are required');
        }
        return this.clubsiteService.deleteLocation(forum, forumId, locationId);
    }

    // ==================== Social Links ====================

    @ApiTags('Clubsite - Social Links')
    @Get('social-links')
    async getSocialLinks(
        @Query('forum') forum: TForum,
        @Query('forumId') forumId: string,
    ) {
        if (!forum || !forumId) {
            throw new BadRequestException('Forum type and forum ID are required');
        }
        return this.clubsiteService.getSocialLinks(forum, forumId);
    }

    @ApiTags('Clubsite - Social Links')
    @Put('social-links')
    async manageSocialLinks(
        @Query('forum') forum: TForum,
        @Query('forumId') forumId: string,
        @Body() body: { links: { name: string; link: string; title?: string }[] },
    ) {
        if (!forum || !forumId) {
            throw new BadRequestException('Forum type and forum ID are required');
        }
        return this.clubsiteService.manageSocialLinks(forum, forumId, body);
    }

    // ==================== Hierarchy ====================

    @ApiTags('Clubsite - Hierarchy')
    @Get('hierarchy')
    async getHierarchy(
        @Query('forum') forum: TForum,
        @Query('forumId') forumId: string,
    ) {
        if (!forum || !forumId) {
            throw new BadRequestException('Forum type and forum ID are required');
        }
        return this.clubsiteService.getHierarchy(forum, forumId);
    }

    @ApiTags('Clubsite - Hierarchy')
    @Put('hierarchy')
    @UseInterceptors(FileInterceptor('file'))
    async manageHierarchy(
        @Query('forum') forum: TForum,
        @Query('forumId') forumId: string,
        @UploadedFile(
            new FileValidationPipe({
                file: {
                    maxSizeMB: 4,
                    allowedMimeTypes: [
                        'image/jpeg',
                        'image/jpg',
                        'image/png',
                        'application/pdf',
                    ],
                    required: false,
                },
            }),
        )
        file: Express.Multer.File,
        @Body() body: any,
    ) {
        if (!forum || !forumId) {
            throw new BadRequestException('Forum type and forum ID are required');
        }

        const updatedBody = {
            ...body,
            file: file,
        };
        return this.clubsiteService.manageHierarchy(forum, forumId, updatedBody);
    }

    // ==================== Announcement ====================

    @ApiTags('Clubsite - Announcement')
    @Post('announcement')
    @UseInterceptors(
        FilesInterceptor('files', 1, {
            storage: memoryStorage(),
        }),
    )
    async createAnnouncement(
        @Req() req: Request,
        @UploadedFiles(
            new FileValidationPipe({
                file: {
                    maxSizeMB: 5,
                    allowedMimeTypes: [
                        'image/jpeg',
                        'image/jpg',
                        'image/png',
                        'image/gif',
                    ],
                    required: false,
                },
            }),
        )
        files: Express.Multer.File[],
        @Body() body: {
            title: string;
            description: string;
            forumType: 'club' | 'node';
            forumId: string;
            dates?: string;
        },
    ) {
        if (!body.forumType || !body.forumId) {
            throw new BadRequestException('Forum type and forum ID are required');
        }

        const updatedBody = {
            title: body.title,
            description: body.description,
            dates: body.dates,
            files: files,
            forum: body.forumType as TForum,
            forumId: body.forumId,
        };
        return this.clubsiteService.createAnnouncement(updatedBody, req.user._id);
    }

    @ApiTags('Clubsite - Announcement')
    @Get('announcement')
    async getAnnouncement(
        @Req() req: Request,
        @Query('forum') forum: TForum,
        @Query('forumId') forumId: string,
        @Query('limit') limit?: string,
        @Query('lastId') lastId?: string,
    ) {
        if (!forum || !forumId) {
            throw new BadRequestException('Forum type and forum ID are required');
        }

        const parsedLimit = limit ? parseInt(limit, 10) : 10;
        return this.clubsiteService.getAnnouncement(forum, forumId, req.user._id, parsedLimit, lastId);
    }

    @ApiTags('Clubsite - Announcement')
    @Delete('announcement/:dataId')
    async deleteAnnouncement(
        @Query('forum') forum: TForum,
        @Query('forumId') forumId: string,
        @Param('dataId') dataId: string,
    ) {
        if (!forum || !forumId) {
            throw new BadRequestException('Forum type and forum ID are required');
        }
        return this.clubsiteService.deleteAnnouncement(forum, forumId, dataId);
    }

    @ApiTags('Clubsite - Announcement')
    @Put('announcement/manage-follow')
    async manageAnnouncementFollow(
        @Req() req: Request,
        @Body() body: {
            forumType: 'club' | 'node';
            forumId: string;
            action: 'follow' | 'unfollow';
        },
    ) {
        if (!body.forumType || !body.forumId) {
            throw new BadRequestException('Forum type and forum ID are required');
        }
        return this.clubsiteService.manageAnnouncementFollow(
            body.forumType as TForum,
            body.forumId,
            body.action,
            req.user._id,
        );
    }

    // ==================== Showcases ====================

    @ApiTags('Clubsite - Showcases')
    @Get('showcases')
    async getShowcases(
        @Query('forum') forum: TForum,
        @Query('forumId') forumId: string,
        @Query('type') type?: string,
    ) {
        if (!forum || !forumId) {
            throw new BadRequestException('Forum type and forum ID are required');
        }
        return this.clubsiteService.getShowcases(forum, forumId, type);
    }

    @ApiTags('Clubsite - Showcases')
    @Put('showcases')
    @UseInterceptors(
        FilesInterceptor('showcaseImages', 5, {
            storage: memoryStorage(),
        }),
    )
    async manageShowcase(
        @Query('forum') forum: TForum,
        @Query('forumId') forumId: string,
        @UploadedFiles(
            new FileValidationPipe({
                showcaseImages: {
                    maxSizeMB: 4,
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
        @Body() body: {
            title: string;
            description: string;
            showcaseId?: string;
            existingImages?: string;
            deletedImageUrls?: string;
            type?: string;
        },
    ) {
        if (!forum || !forumId) {
            throw new BadRequestException('Forum type and forum ID are required');
        }

        const updatedBody = {
            ...body,
            showcaseImages: files,
        };
        return this.clubsiteService.manageShowcase(forum, forumId, updatedBody);
    }

    @ApiTags('Clubsite - Showcases')
    @Delete('showcases/:showcaseId')
    async deleteShowcase(
        @Query('forum') forum: TForum,
        @Query('forumId') forumId: string,
        @Param('showcaseId') showcaseId: string,
    ) {
        if (!forum || !forumId) {
            throw new BadRequestException('Forum type and forum ID are required');
        }
        return this.clubsiteService.deleteShowcase(forum, forumId, showcaseId);
    }

    // ==================== Campaigns ====================

    @ApiTags('Clubsite - Campaigns')
    @Post('campaigns')
    async createCampaign(
        @Req() req: Request,
        @Body() body: {
            title: string;
            description: string;
            forumType: 'club' | 'node';
            forumId: string;
            dates?: string;
        },
    ) {
        if (!body.forumType || !body.forumId) {
            throw new BadRequestException('Forum type and forum ID are required');
        }

        const updatedBody = {
            title: body.title,
            description: body.description,
            dates: body.dates,
            forum: body.forumType as TForum,
            forumId: body.forumId,
        };
        return this.clubsiteService.createCampaign(updatedBody, req.user._id);
    }

    @ApiTags('Clubsite - Campaigns')
    @Get('campaigns')
    async getCampaigns(
        @Req() req: Request,
        @Query('forum') forum: TForum,
        @Query('forumId') forumId: string,
        @Query('limit') limit?: string,
        @Query('lastId') lastId?: string,
    ) {
        if (!forum || !forumId) {
            throw new BadRequestException('Forum type and forum ID are required');
        }

        const parsedLimit = limit ? parseInt(limit, 10) : 10;
        return this.clubsiteService.getCampaigns(forum, forumId, req.user._id, parsedLimit, lastId);
    }

    @ApiTags('Clubsite - Campaigns')
    @Delete('campaigns/:dataId')
    async deleteCampaign(
        @Query('forum') forum: TForum,
        @Query('forumId') forumId: string,
        @Param('dataId') dataId: string,
    ) {
        if (!forum || !forumId) {
            throw new BadRequestException('Forum type and forum ID are required');
        }
        return this.clubsiteService.deleteCampaign(forum, forumId, dataId);
    }

    // ==================== FAQs ====================

    @ApiTags('Clubsite - FAQs')
    @Get('faqs')
    async getFaqs(
        @Req() req: Request,
        @Query('forum') forum: TForum,
        @Query('forumId') forumId: string,
    ) {
        if (!forum || !forumId) {
            throw new BadRequestException('Forum type and forum ID are required');
        }
        return this.clubsiteService.getFaqs(forum, forumId, req.user._id);
    }

    @ApiTags('Clubsite - FAQs')
    @Put('faqs')
    async manageFaqs(
        @Query('forum') forum: TForum,
        @Query('forumId') forumId: string,
        @Body() body: {
            question: string;
            answer: string;
            isPublic?: boolean;
            faqId?: string;
        },
    ) {
        if (!forum || !forumId) {
            throw new BadRequestException('Forum type and forum ID are required');
        }
        return this.clubsiteService.manageFaqs(forum, forumId, body);
    }

    @ApiTags('Clubsite - FAQs')
    @Delete('faqs/:faqId')
    async deleteFaq(
        @Query('forum') forum: TForum,
        @Query('forumId') forumId: string,
        @Param('faqId') faqId: string,
    ) {
        if (!forum || !forumId) {
            throw new BadRequestException('Forum type and forum ID are required');
        }
        return this.clubsiteService.deleteFaq(forum, forumId, faqId);
    }

    // ==================== Product Comparisons ====================

    @ApiTags('Clubsite - Product Comparisons')
    @Get('product-comparisons')
    async getProductComparisons(
        @Query('forum') forum: TForum,
        @Query('forumId') forumId: string,
    ) {
        if (!forum || !forumId) {
            throw new BadRequestException('Forum type and forum ID are required');
        }
        return this.clubsiteService.getProductComparisons(forum, forumId);
    }

    @ApiTags('Clubsite - Product Comparisons')
    @Put('product-comparisons')
    @UseInterceptors(
        FileInterceptor('file', {
            storage: memoryStorage(),
        }),
    )
    async manageProductComparisons(
        @Query('forum') forum: TForum,
        @Query('forumId') forumId: string,
        @UploadedFile(
            new FileValidationPipe({
                file: {
                    maxSizeMB: 5,
                    allowedMimeTypes: [
                        'image/jpeg',
                        'image/jpg',
                        'image/png',
                        'application/pdf',
                    ],
                    required: false,
                },
            }),
        )
        file: Express.Multer.File,
        @Body() body: {
            title: string;
            description: string;
            comparisonId?: string;
            deletedFileUrl?: string;
        },
    ) {
        if (!forum || !forumId) {
            throw new BadRequestException('Forum type and forum ID are required');
        }

        const updatedBody = {
            ...body,
            file: file,
        };
        return this.clubsiteService.manageProductComparisons(forum, forumId, updatedBody);
    }

    @ApiTags('Clubsite - Product Comparisons')
    @Delete('product-comparisons/:comparisonId')
    async deleteProductComparison(
        @Query('forum') forum: TForum,
        @Query('forumId') forumId: string,
        @Param('comparisonId') comparisonId: string,
    ) {
        if (!forum || !forumId) {
            throw new BadRequestException('Forum type and forum ID are required');
        }
        return this.clubsiteService.deleteProductComparison(forum, forumId, comparisonId);
    }
}
