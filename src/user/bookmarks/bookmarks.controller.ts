import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { BookmarksService } from './bookmarks.service';
import { CreateFolderDto } from './dto/create-folder.dto';
import { Request } from 'express';

@ApiTags('Bookmarks')
@ApiBearerAuth()
@Controller('bookmarks')
export class BookmarksController {
    constructor(private readonly bookmarksService: BookmarksService) { }

    @Get('folders')
    fetchFolders(@Req() req: Request) {
        const userId = req.user._id
        return this.bookmarksService.fetchFolders(userId);
    }

    @Get('folders/:folderId')
    fetchFolder(
        @Param('folderId') folderId: string,
        @Query('limit') limit?: string,
        @Query('search') search?: string
    ) {
        const parsedLimit = limit ? parseInt(limit, 10) : 10;
        return this.bookmarksService.fetchFolder(folderId, parsedLimit, search);
    }

    @Post('create')
    createFolder(@Body() createFolderDto: CreateFolderDto, @Req() req: Request) {
        const userId = req.user._id;
        createFolderDto.user = userId;
        return this.bookmarksService.createFolder(createFolderDto);
    }

    @Post('add')
    addToBookmark(@Body() { entityType, entityId, folderIds }, @Req() req: Request) {
        const userId = req.user._id
        return this.bookmarksService.addToBookmark(folderIds, userId, entityId, entityType)
    }

    @Post('add/single')
    singleAddToBookmark(@Body() { entityType, entityId, folderId }, @Req() req: Request) {
        const userId = req.user._id
        return this.bookmarksService.singleAddToBookmark(folderId, userId, entityId, entityType)
    }

    @Patch(':folderId')
    updateFolderTitle(
        @Param('folderId') folderId: string,
        @Body() updateFolderDto: { title: string },
        @Req() req: Request,
    ) {
        const userId = req.user._id;
        return this.bookmarksService.updateFolderTitle(folderId, userId, updateFolderDto.title);
    }

    @Delete(':folderId')
    deleteFolder(@Param('folderId') folderId: string, @Req() req: Request) {
        const userId = req.user._id;
        return this.bookmarksService.deleteFolder(folderId, userId);
    }
}
