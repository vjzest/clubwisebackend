import { Controller, Get, Param, Delete, Req, Query, NotFoundException, BadRequestException } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminStdAssetsService } from './std-assets.service';
import { Request } from 'express';
import { Types } from 'mongoose';

@ApiTags('Admin - Standard Assets')
@ApiBearerAuth()
@Controller('admin/std-assets')
export class AdminStdAssetsController {
  constructor(private readonly stdAssetsService: AdminStdAssetsService) { }


  @Get()
  async findAll(@Query('plugin') plugin?: string, @Query('club') club?: string) {
    return this.stdAssetsService.findAll(plugin, club);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: Request) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid asset ID');
    }

    const asset = await this.stdAssetsService.findOne(id, req?.user?._id);
    if (!asset) {
      throw new NotFoundException('Asset not found');
    }

    return asset;
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: Request) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid asset ID');
    }

    return this.stdAssetsService.remove(id, req?.user?._id);
  }
}
