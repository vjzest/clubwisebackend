import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Req, UploadedFiles, UploadedFile, UseGuards, UseInterceptors, ValidationPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { CreateChapterDto, DeleteChapterDto, JoinUserChapterDto, LeaveUserChapterDto, RemoveUserChapterDto, RoleAccessDto, UpdateChapterStatusDto } from './dto/chapter.dto';
import { ChapterService } from './chapter.service';
import { Types } from 'mongoose';
import { Roles } from 'src/decorators/role.decorator';
import { NodeRoleGuard } from '../guards/node/node-role.guard';
import { ChapterRoleGuard } from '../guards/chapter-role.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { FileValidationPipe } from 'src/shared/pipes/file-validation.pipe';

@ApiTags('Chapters')
@ApiBearerAuth()
@Controller('chapters')
export class ChapterController {
    constructor(private readonly chapterService: ChapterService) { }

    //----------------CREATE CHAPTER----------------

    @Roles('owner', 'admin', 'moderator', 'member')
    @UseGuards(NodeRoleGuard)
    @Post()
    async createChapter(
        @Req() req: Request,
        @Body(
            new ValidationPipe({
                transform: true, // Enable transformation
                transformOptions: {
                    enableImplicitConversion: true, // Enable implicit conversions
                },
                whitelist: true,
                forbidNonWhitelisted: true,
            }),
        ) createChapterDto: CreateChapterDto
    ) {
        const chapterUserData = {
            userRole: req.role,
            userId: new Types.ObjectId(req.user._id)
        }
        return await this.chapterService.createChapter(createChapterDto, chapterUserData);
    }

    //----------------DELETE CHAPTER----------------

    @Roles('owner', 'admin')
    @UseGuards(NodeRoleGuard)
    @Put()
    async deleteChapter(
        @Req() req: Request,
        @Body(
            new ValidationPipe({
                transform: true,
                transformOptions: {
                    enableImplicitConversion: true,
                },
                whitelist: true,
                forbidNonWhitelisted: true,
            }),
        ) deleteChapterDto: DeleteChapterDto
    ) {
        return await this.chapterService.deleteChapter(deleteChapterDto);
    }

    //----------------GET PUBLISHED CHAPTERS----------------

    @Get('get-published')
    async getPublishedChaptersOfNode(@Req() req: Request, @Query('nodeId') node: string) {
        const nodeId = new Types.ObjectId(node);
        return await this.chapterService.getPublishedChaptersOfNode(nodeId);
    }

    //----------------GET PUBLIC CLUBS----------------

    @Get('get-public-clubs')
    async getPublicClubs(@Req() req: Request, @Query('nodeId') node: string, @Query('term') term: string) {
        const nodeId = new Types.ObjectId(node);
        return await this.chapterService.getPublicClubs(nodeId, term);
    }

    //----------------GET PROPOSED CHAPTERS----------------

    @Get('get-proposed')
    async getProposedChaptersOfNode(@Req() req: Request, @Query('nodeId') node: string) {
        const nodeId = new Types.ObjectId(node);
        return await this.chapterService.getProposedChaptersOfNode(nodeId);
    }

    //----------------GET REJECTED CHAPTERS----------------

    @Get('get-rejected')
    async getRejectedChaptersOfNode(@Req() req: Request, @Query('nodeId') node: string) {
        const nodeId = new Types.ObjectId(node);
        return await this.chapterService.getRejectedChaptersOfNode(nodeId);
    }

    //----------------UPDATE CHAPTER STATUS REJECTED OR PUBLISHED----------------

    @Roles('owner', 'admin', 'moderator')
    @UseGuards(NodeRoleGuard)
    @Put('publish-or-reject')
    async publishOrRejectChapter(
        @Req() req: Request,
        @Body(
            new ValidationPipe({
                transform: true, // Enable transformation
                transformOptions: {
                    enableImplicitConversion: true, // Enable implicit conversions
                },
                whitelist: true,
                forbidNonWhitelisted: true,
            }),
        ) updateChapterStatusDto: UpdateChapterStatusDto
    ) {
        const chapterUserData = {
            userRole: req.role,
            userId: new Types.ObjectId(req.user._id),
        }

        return await this.chapterService.publishOrRejectChapter(chapterUserData, updateChapterStatusDto);
    }

    //----------------JOIN CHAPTER----------------

    @Roles('owner', 'admin', 'moderator', 'member')
    @UseGuards(NodeRoleGuard)
    @Put('join-user')
    async joinChapter(
        @Req() req: Request,
        @Body(
            new ValidationPipe({
                transform: true, // Enable transformation
                transformOptions: {
                    enableImplicitConversion: true, // Enable implicit conversions
                },
                whitelist: true,
                forbidNonWhitelisted: true,
            }),
        ) joinUserChapterDto: JoinUserChapterDto
    ) {
        const userData = {
            userId: new Types.ObjectId(req.user._id),
            userRole: req.role,
        }
        return await this.chapterService.joinChapter(userData, joinUserChapterDto);
    }

    //----------------REMOVE USER FROM CHAPTER----------------

    @Put('remove-member')
    async removeUserFromChapter(
        @Req() req: Request,
        @Body(
            new ValidationPipe({
                transform: true, // Enable transformation
                transformOptions: {
                    enableImplicitConversion: true, // Enable implicit conversions
                },
                whitelist: true,
                forbidNonWhitelisted: true,
            }),
        ) removeUserChapterDto: RemoveUserChapterDto
    ) {
        const userId = new Types.ObjectId(req.user._id);
        return await this.chapterService.removeUserFromChapter(userId, removeUserChapterDto);
    }

    //----------------LEAVE USER FROM CHAPTER----------------

    @Roles('owner', 'admin', 'moderator', 'member')
    @UseGuards(ChapterRoleGuard)
    @Put('leave-user')
    async leaveUserFromChapter(
        @Req() req: Request,
        @Body(
            new ValidationPipe({
                transform: true, // Enable transformation
                transformOptions: {
                    enableImplicitConversion: true, // Enable implicit conversions
                },
                whitelist: true,
                forbidNonWhitelisted: true,
            }),
        ) leaveUserChapterDto: LeaveUserChapterDto
    ) {
        const chapterUserData = {
            userRole: req.role,
            userId: new Types.ObjectId(req.user._id),
        }


        return await this.chapterService.leaveUserFromChapter(chapterUserData, leaveUserChapterDto);
    }

    //----------------UPVOTE PROPOSED CHAPTER----------------

    @Put('upvote-proposed')
    async upvoteProposedChapter(@Req() req: Request, @Body('chapter') chapterId: string) {
        return await this.chapterService.upvoteProposedChapter(chapterId, req.user._id);
    }

    //----------------DOWNVOTE PROPOSED CHAPTER----------------

    @Put('downvote-proposed')
    async downvoteProposedChapter(@Req() req: Request, @Body('chapter') chapterId: string) {
        return await this.chapterService.downvoteProposedChapter(chapterId, req.user._id);
    }

    //----------------GET CHAPTER MEMBER STATUS----------------

    @Get('check-status')
    async getChapterMemberStatus(@Req() req: Request, @Query('chapter') chapterId: string) {
        return await this.chapterService.getChapterMemberStatus(req.user._id, chapterId);
    }

    @Get('groups/:id')
    async getChapterGroup(@Param('id') id: string) {
        return await this.chapterService.getChapterGroup(id);
    }

    @Roles('admin')
    @UseGuards(ChapterRoleGuard)
    @Put('make-admin')
    async makeAdmin(
        @Req() req: Request,
        @Body(
            new ValidationPipe({
                transform: true, // Enable transformation
                transformOptions: {
                    enableImplicitConversion: true, // Enable implicit conversions
                },
                whitelist: true,
                forbidNonWhitelisted: true,
            }),
        ) roleAccessDto: RoleAccessDto
    ) {
        return await this.chapterService.makeAdmin(roleAccessDto);
    }

    @Roles('admin')
    @UseGuards(ChapterRoleGuard)
    @Put('make-moderator')
    async makeModerator(
        @Req() req: Request,
        @Body(
            new ValidationPipe({
                transform: true, // Enable transformation
                transformOptions: {
                    enableImplicitConversion: true, // Enable implicit conversions
                },
                whitelist: true,
                forbidNonWhitelisted: true,
            }),
        ) roleAccessDto: RoleAccessDto
    ) {
        return await this.chapterService.makeModerator(roleAccessDto);
    }

    @Roles('admin')
    @UseGuards(ChapterRoleGuard)
    @Put('make-member')
    async makeMember(
        @Req() req: Request,
        @Body(
            new ValidationPipe({
                transform: true, // Enable transformation
                transformOptions: {
                    enableImplicitConversion: true, // Enable implicit conversions
                },
                whitelist: true,
                forbidNonWhitelisted: true,
            }),
        ) roleAccessDto: RoleAccessDto
    ) {
        return await this.chapterService.makeMember(roleAccessDto);
    }

    //----------------RETRIEVE CHAPTER STATISTICS----------------

    @Roles("admin", "moderator", "member")
    @UseGuards(ChapterRoleGuard)
    @Get('chapter-statistics/:id')
    async getChapterStatistics(@Param('id') chapterId: string) {
        return await this.chapterService.getChapterStatistics(chapterId);
    }

    //----------------GET CHAPTER----------------

    @Get(':id')
    async getChapter(@Param('id') id: string) {
        const chapterId = new Types.ObjectId(id);
        return await this.chapterService.getChapter(chapterId);
    }

    @Patch(':id')
    async updateDisplayName(
        @Param('id') id: string,
        @Body() updateDto: { displayName: string }
    ) {
        return await this.chapterService.addCustomName(updateDto.displayName, id);
    }
}
