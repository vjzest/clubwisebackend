import { Controller, Get, Post, Body, Patch, Param, Delete, Req, UsePipes, ValidationPipe, UseInterceptors, UploadedFiles, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { StdAssetsService } from './standard-assets.service';
import { Request } from 'express';
import { AuthorizationService } from '../../user/auth/authorization.service';
import { FilesInterceptor } from '@nestjs/platform-express';
import { FileValidationPipe } from '../../shared/pipes/file-validation.pipe';
import { memoryStorage } from 'multer';
import { CreateStdAssetDto } from './dto/create-standard-asset.dto';
import { Types } from 'mongoose';
import { TForum } from 'typings';
import { Club } from '../../shared/entities/club.entity';
import { SubmitCtaResponseDto } from './dto/submit-cta-response.dto';

@ApiTags('Standard Assets')
@ApiBearerAuth()
@Controller('user/std-plugins/assets')
export class StdAssetsController {
  constructor(private readonly standardAssetsService: StdAssetsService,
    private readonly authorizationService: AuthorizationService
  ) { }


  @UseInterceptors(
    FilesInterceptor('files', 5, {
      storage: memoryStorage(),
    }),
  )
  @Post()
  // @UsePipes(new ValidationPipe({
  //   transform: true,
  //   whitelist: true,
  //   forbidUnknownValues: true
  // }))
  async create(@Req() req: Request, @Body() createAssetData: any,

    @UploadedFiles(
      new FileValidationPipe({
        files: {
          maxSizeMB: 5,
          allowedMimeTypes: [
            'image/jpeg',
            'image/jpg',
            'image/png',
            'image/gif',
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          ],
          required: false,
        },
      }),
    )
    files: Express.Multer.File[],
  ) {
    // Conditionally validate
    if (createAssetData.publishedStatus !== "draft") {
      createAssetData = await new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidUnknownValues: true,
      }).transform(createAssetData, { type: 'body', metatype: CreateStdAssetDto });
    }
    return this.standardAssetsService.create(createAssetData, req?.user?._id, files);
  }

  // publish
  @Patch('/:assetId/publish')
  async publish(@Param('assetId') assetId: string, @Req() req: Request, @Query('type') type: 'adopted' | 'original') {
    return this.standardAssetsService.publish(assetId, req?.user?._id, type);
  }


  // get by slug
  @Get('/slug/:slug')
  async findBySlug(@Req() req: Request, @Param('slug') slug: string, @Query('adoptionId') adoptionId: string, @Query('chapterAlyId') chapterAlyId: string) {
    return this.standardAssetsService.findBySlug(slug, adoptionId, chapterAlyId, req?.user?._id);
  }

  // get asset counts for each type
  @Get('/asset-counts')
  async getAssetCounts(@Req() req: Request, @Query('forumId') forumId: Types.ObjectId, @Query('forum') forum: TForum, @Query('plugin') plugin: string) {
    return this.standardAssetsService.getAssetCounts(forum, forumId, plugin, req?.user?._id);
  }

  @Get('/:assetSlug/non-adopted-forums')
  async getNonAdoptedForums(@Req() req: Request, @Param('assetSlug') assetSlug: string) {
    return this.standardAssetsService.getNonAdoptedForums(assetSlug, req?.user?._id);
  }

  // adopt asset
  @Post('/:assetSlug/adopt-or-propose')
  async adoptStdAsset(@Param('assetSlug') assetSlug: string, @Body() body: any, @Req() req: Request) {
    return this.standardAssetsService.adoptStdAsset(assetSlug, req?.user?._id, body.club, body.node);
  }


  // toggle relevant
  @Patch('relevant/:assetSlug')
  async toggleRelevant(@Param('assetSlug') assetSlug: string, @Req() req: Request) {
    return this.standardAssetsService.toggleRelevant(assetSlug, req?.user?._id);
  }

  // toggle irrelevant
  @Patch('irrelevant/:assetSlug')
  async toggleIrrelevant(@Param('assetSlug') assetSlug: string, @Req() req: Request) {
    return this.standardAssetsService.toggleIrrelevant(assetSlug, req?.user?._id);
  }

  // Create Updates
  @UseInterceptors(FilesInterceptor('file', 1, { storage: memoryStorage() }))
  @Put('updates/:assetSlug')
  async createUpdate(@Param('assetSlug') assetSlug: string, @Body() updateAssetDto: any,
    @UploadedFiles(
      new FileValidationPipe({
        file: {
          maxSizeMB: 3,
          allowedMimeTypes: [
            'image/jpeg',
            'image/jpg',
            'image/png',
            'image/gif',
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          ],
          required: false,
        },
      }),
    )
    file: Express.Multer.File,
    @Req() req: Request
  ) {
    return this.standardAssetsService.createUpdate(assetSlug, updateAssetDto, file[0], req?.user?._id);
  }

  // delete update
  @Delete('updates/:assetSlug/:updateId')
  async deleteUpdate(@Param('assetSlug') assetSlug: string, @Param('updateId') updateId: string) {
    return this.standardAssetsService.deleteUpdate(assetSlug, updateId);
  }

  // get update
  @Get('updates/:assetSlug')
  async getUpdates(@Param('assetSlug') assetSlug: string) {
    return this.standardAssetsService.getUpdates(assetSlug);
  }

  // toggle subscribe updates
  @Patch('updates/subscribe/:assetSlug')
  async toggleSubscribeUpdates(@Param('assetSlug') assetSlug: string, @Req() req: Request) {
    return this.standardAssetsService.toggleSubscribeUpdates(assetSlug, req?.user?._id);
  }

  // get subscribers
  @Get('updates/subscribers/:assetSlug')
  async getSubscribers(@Param('assetSlug') assetSlug: string) {
    return this.standardAssetsService.getSubscribers(assetSlug);
  }

  // add view of user
  @Put('view/:assetSlug')
  async addView(@Param('assetSlug') assetSlug: string, @Req() req: Request) {
    return this.standardAssetsService.addView(assetSlug, req?.user?._id);
  }

  // make public
  @Patch('/:assetSlug/make-public')
  async makePublic(@Param('assetSlug') assetSlug: string, @Req() req: Request) {
    return this.standardAssetsService.makePublic(assetSlug, req?.user?._id);
  }

  // Archieve
  @Patch('/:assetId/archive')
  async archiveAsset(@Param('assetId') assetId: string, @Req() req: Request, @Query('type') type: 'adopted' | 'original') {
    return this.standardAssetsService.archiveAsset(assetId, type, req?.user?._id);
  }

  // Unarchive
  @Patch('/:assetId/unarchive')
  async unarchiveAsset(@Param('assetId') assetId: string, @Req() req: Request, @Query('type') type: 'adopted' | 'original') {
    return this.standardAssetsService.unarchiveAsset(assetId, type, req?.user?._id);
  }

  @Get('all')
  async getAllFeedAssetsByEntity(
    @Query('entity') entity: 'club' | 'node',
    @Query('entityId') entityId: string,
    @Query('page') page: number,
    @Query('limit') limit: number,
    @Req() req: Request) {
    return this.standardAssetsService.getAllFeedAssetsByEntity(entity, entityId, page, limit);
  }

  @Put('updates-faqs')
  async updateFaq(@Body() body: any, @Req() req: Request) {
    return this.standardAssetsService.updateFaq(body);
  }

  @Patch('delete-std-asset/:assetId')
  async deleteStdAsset(@Param('assetId') assetId: string, @Req() req: Request) {
    return this.standardAssetsService.deleteStdAsset(assetId, req?.user?._id);
  }

  @Patch('remove-std-asset-from-adoption/:adoptionId')
  async removeStdAssetFromAdoption(@Param('adoptionId') adoptionId: string, @Req() req: Request, @Query('action') action: 'removeadoption' | 're-adopt') {
    return this.standardAssetsService.removeStdAssetFromAdoption(adoptionId, req?.user?._id, action);
  }

  //  Get all
  @Get('/')
  async findAll(@Req() req: Request, @Query('forumId') forumId: Types.ObjectId, @Query('forum') forum: TForum, @Query('plugin') plugin: string, @Query('type') type: 'global' | 'all' | 'active' | 'proposed', @Query('page') page: number, @Query('limit') limit: number) {
    return this.standardAssetsService.findAll(forum, forumId, plugin, type, page, limit, req?.user?._id);
  }

  @Get('draft-assets/:id')
  async getDraftAssets(@Param('id') id: string, @Req() req: Request) {
    return this.standardAssetsService.getDraftAssets(id, req?.user?._id);
  }

}

@Controller('user/std-plugins')
export class StdCtaResponsesController {
  constructor(
    private readonly standardAssetsService: StdAssetsService,
    private readonly authorizationService: AuthorizationService
  ) { }

  @UseInterceptors(
    FilesInterceptor('files', 10, {
      storage: memoryStorage(),
    }),
  )
  @Post('cta-responses')
  async submitCtaResponse(
    @Req() req: Request,
    @Body() body: any,
    @UploadedFiles(
      new FileValidationPipe({
        files: {
          maxSizeMB: 5,
          allowedMimeTypes: [
            'image/jpeg',
            'image/jpg',
            'image/png',
            'image/gif',
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          ],
          required: false,
        },
      }),
    )
    files: Express.Multer.File[],
  ) {
    // Parse responses if it's a string (from FormData)
    let submitCtaResponseDto: SubmitCtaResponseDto;
    if (typeof body.responses === 'string') {
      submitCtaResponseDto = {
        ...body,
        responses: JSON.parse(body.responses),
      };
    } else {
      submitCtaResponseDto = body;
    }

    // Validate the DTO
    const validatedDto = await new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidUnknownValues: true,
    }).transform(submitCtaResponseDto, { type: 'body', metatype: SubmitCtaResponseDto });

    return this.standardAssetsService.submitCtaResponse(validatedDto, req?.user?._id, files);
  }

  @Get('cta-responses/:assetId')
  async getCtaResponsesByAsset(@Param('assetId') assetId: string, @Req() req: Request) {
    return this.standardAssetsService.getCtaResponsesByAsset(assetId, req?.user?._id);
  }
}
