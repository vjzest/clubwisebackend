import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseInterceptors,
  UploadedFiles,
  UsePipes,
  Put,
  BadRequestException,
  Req,
  Query,
  HttpStatus,
  ValidationPipe,
  UseGuards,
  UploadedFile,
} from '@nestjs/common';
import { NodeService } from './node.service';
import { FileFieldsInterceptor, FilesInterceptor, FileInterceptor } from '@nestjs/platform-express';
import { FileValidationPipe } from 'src/shared/pipes/file-validation.pipe';
import { User } from 'src/shared/entities/user.entity';
import { Types } from 'mongoose';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { SkipAuth } from 'src/decorators/skip-auth.decorator';
import {
  CreateGuidingPrinciples,
  UpdateGuidingPrinciples,
} from './dto/guiding-principle.dto';
import { Roles } from 'src/decorators/role.decorator';
import { NodeRoleGuard } from '../guards/node/node-role.guard';
import { TPlugins } from 'typings';
import { memoryStorage } from 'multer';

@ApiTags('Nodes')
@ApiBearerAuth()
@Controller('node')
export class NodeController {
  constructor(private readonly nodeService: NodeService) { }

  // -----------------------------CREATE NODE ---------------------------
  @Post()
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'profileImage', maxCount: 1 },
      { name: 'coverImage', maxCount: 1 },
    ]),
  )
  createNode(
    @Body()
    createNodeBody: {
      name: string;
      about: string;
      description: string;
      location: string;
      removeCoverImage: boolean;
      plugins: string;
      domain: string;
    },

    @Req() req: Request,
    @UploadedFiles(
      new FileValidationPipe({
        profileImage: {
          maxSizeMB: 5,
          allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png'],
          required: true,
        },
        coverImage: {
          maxSizeMB: 10,
          allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png'],
          required: false,
        },
      }),
    )
    files: {
      profileImage: Express.Multer.File[];
      coverImage: Express.Multer.File[];
    },
  ) {
    return this.nodeService.createNode(
      {
        ...createNodeBody,
        profileImage: files.profileImage[0],
        coverImage: files.coverImage?.[0],
        plugins: JSON.parse(createNodeBody.plugins),
        domain: JSON.parse(createNodeBody.domain),
      },
      req.user._id,
    );
  }

  // -----------------------------GET ALL NODE ---------------------------
  @SkipAuth()
  @Get()
  async findAllNode() {
    return await this.nodeService.findAllNode();
  }

  // -----------------------------GET ALL NODE OF USER ---------------------------
  @Get('user-nodes')
  async getAllNodesOfUser(@Req() req: Request) {
    const userId = new Types.ObjectId(req.user._id);
    return await this.nodeService.getAllNodesOfUser(userId);
  }

  // -----------------------------REQUEST TO JOIN NODE ---------------------------
  @Post('request-to-join/:nodeId')
  async requestToJoin(
    @Param('nodeId') nodeId: string,
    @Req() request: Request & { user: User },
    @Body() body: { requestNote: string },
  ) {
    const userId = new Types.ObjectId(request.user._id);
    return await this.nodeService.requestToJoin(
      new Types.ObjectId(nodeId),
      userId,
      request.user,
      body.requestNote,
    );
  }

  // ----------------------------- CANCEL JOIN REQUEST ---------------------------
  @Delete('cancel-join-request/:nodeId')
  async cancelJoinRequest(
    @Param('nodeId') nodeId: string,
    @Req() request: Request & { user: User },
  ) {
    const userId = new Types.ObjectId(request.user._id);
    return await this.nodeService.cancelJoinRequest(
      new Types.ObjectId(nodeId),
      userId,
    );
  }

  // -----------------------------GET ALL JOIN REQUESTS OF NODE ---------------------------
  @Get('join-requests/:nodeId')
  getAllJoinRequestsOfNode(@Param('nodeId') nodeId: string) {
    return this.nodeService.getAllJoinRequestsOfNode(
      new Types.ObjectId(nodeId),
    );
  }

  //-----------------------------GET ALL JOIN REQUESTS OF USER ---------------------------
  @Get('user-join-requests')
  getAllJoinRequestsOfUser(@Req() request: Request) {
    const userId = new Types.ObjectId(request.user._id);
    return this.nodeService.getAllJoinRequestsOfUser(userId);
  }

  // -----------------------------ACCEPT OR REJECT JOIN REQUEST ---------------------------
  @Post('handle-request')
  async acceptOrRejectRequest(
    @Body()
    requestBody: {
      nodeId: Types.ObjectId;
      requestId: Types.ObjectId;
      status: 'ACCEPTED' | 'REJECTED';
    },
    @Req() request: Request & { user: User },
  ) {
    let { nodeId, requestId, status } = requestBody;

    const userId = new Types.ObjectId(request.user._id);
    nodeId = new Types.ObjectId(nodeId);
    requestId = new Types.ObjectId(requestId);

    return await this.nodeService.acceptOrRejectRequest(
      nodeId,
      userId,
      requestId,
      status,
      request.user,
    );
  }

  // -----------------------------GET STATUS OF USER OF NODE ---------------------------
  @Get('check-status/:nodeId')
  @ApiOperation({ summary: 'Get user status for a specific node' })
  @ApiParam({
    name: 'nodeId',
    type: 'string',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns the user status for the specified node',
  })
  checkStatus(@Req() req: Request, @Param('nodeId') nodeId: string) {
    const userId = new Types.ObjectId(req.user._id);
    return this.nodeService.checkStatus(
      new Types.ObjectId(userId),
      new Types.ObjectId(nodeId),
    );
  }

  @Get('node-members/:nodeId')
  async getNodeMembers(@Param('nodeId') nodeId: string) {
    return await this.nodeService.getNodeMembers(new Types.ObjectId(nodeId));
  }

  // -----------------------------PIN NODE ---------------------------
  @Put('pin-node/:nodeId')
  async pinNode(
    @Param('nodeId') nodeId: string,
    @Req() request: Request & { user: User },
  ) {
    return await this.nodeService.pinNode(nodeId, request.user._id as string);
  }

  // -----------------------------UNPIN NODE ---------------------------
  @Put('unpin-node/:nodeId')
  async unpinNode(
    @Param('nodeId') nodeId: string,
    @Req() request: Request & { user: User },
  ) {
    return await this.nodeService.unpinNode(nodeId, request.user._id as string);
  }

  // -----------------------------LEAVE NODE ---------------------------
  @Delete('leave-node/:nodeId')
  leaveNode(@Req() req: Request, @Param('nodeId') nodeId: string) {
    const userId = new Types.ObjectId(req.user._id);
    return this.nodeService.leaveNode(new Types.ObjectId(nodeId), userId);
  }

  // -----------------------------ADD GUIDING PRINCIPLES ---------------------------
  @Roles('owner', 'admin')
  @UseGuards(NodeRoleGuard)
  @Put('guiding-principles')
  addGuidingPrinciples(
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
    )
    createGuidingPrinciples: CreateGuidingPrinciples,
  ) {
    const userId = req.user._id;
    return this.nodeService.addGuidingPrinciples(
      userId,
      createGuidingPrinciples,
    );
  }

  //-----------------------------UPDATE GUIDING PRINCIPLES ---------------------------
  @Roles('owner', 'admin')
  @UseGuards(NodeRoleGuard)
  @Put('guiding-principles/:guidingPrincipleId')
  updateGuidingPrinciples(
    @Req() req: Request,
    @Param('guidingPrincipleId') guidingPrincipleId: string,
    @Body(
      new ValidationPipe({
        transform: true, // Enable transformation
        transformOptions: {
          enableImplicitConversion: true, // Enable implicit conversions
        },
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    )
    updateGuidingPrinciples: UpdateGuidingPrinciples,
  ) {
    const userId = req.user._id;
    return this.nodeService.updateGuidingPrinciples(
      userId,
      guidingPrincipleId,
      updateGuidingPrinciples,
    );
  }

  //-----------------------------GET GUIDING PRINCIPLES ---------------------------
  @Get('guiding-principles/:nodeId')
  getGuidingPrinciples(@Req() req: Request, @Param('nodeId') nodeId: string) {
    return this.nodeService.getGuidingPrinciples(nodeId);
  }

  //------------------------------RETRIEVE NODE STATISTICS -------------------------

  @Roles('owner', 'admin', 'moderator', 'member')
  @UseGuards(NodeRoleGuard)
  @Get('node-statistics/:id')
  getNodeStatistics(@Param('id') nodeId: string) {
    return this.nodeService.getNodeStatistics(nodeId);
  }

  // @Post('plugins/:id')
  // async addPlugin(
  //   @Param('id') clubId: string,
  //   @Body() addPluginDto: { plugin: { plugin: TPlugins; createdAt: Date }[] },

  // ) {
  //   return await this.nodeService.addPlugin(clubId, addPluginDto.plugin);
  // }

  // @Patch('node-opened/:nodeId')
  // async nodeOpened(@Param('nodeId') nodeId: string, @Req() req: Request) {
  //   const userId = new Types.ObjectId(req.user._id);
  //   return await this.nodeService.nodeOpened(new Types.ObjectId(nodeId), userId);
  // }
  @Post('plugins/:nodeId')
  async addPlugin(
    @Param('nodeId') nodeId: string,
    @Body()
    addPluginDto: {
      plugin: {
        plugin: TPlugins;
        createdAt: Date;
        type: 'standard' | 'custom';
      };
    },
  ) {
    return await this.nodeService.addPlugin(nodeId, addPluginDto.plugin);
  }

  @Get('assets/:nodeId')
  async getAssetsByNodeWithDeadline(@Param('nodeId') nodeId: string) {
    return await this.nodeService.getAssetsByNodeWithDeadline(nodeId);
  }

  @Get('memory-usage/:nodeId')
  async getMemoryUsage(@Param('nodeId') nodeId: string) {
    return await this.nodeService.getMemoryUsage(nodeId);
  }

  @Get('archived-plugins/:nodeId')
  async getArchivedPlugins(@Param('nodeId') nodeId: string) {
    return await this.nodeService.getArchivedPlugins(nodeId);
  }

  @Roles('owner', 'admin')
  @UseGuards(NodeRoleGuard)
  @Put('manage-archive/:id')
  async manageArchive(@Body() body: { plugin: string, pluginType: 'standard' | 'custom', action: "archive" | "unarchive" }, @Param('id') nodeId: string) {
    return await this.nodeService.manageArchive(nodeId, body);
  }

  @Get('existing-plugins/:nodeId')
  async getExistingPlugins(@Param('nodeId') nodeId: string) {
    return await this.nodeService.getExistingPlugins(nodeId);
  }

  @Roles('owner', 'admin')
  @UseGuards(NodeRoleGuard)
  @Put('committee-event/:id')
  @UseInterceptors(
    FilesInterceptor('images', 25, {
      storage: memoryStorage(),
    }),
  )
  async manageCommitteeEvent(
    @UploadedFiles(
      new FileValidationPipe({
        images: {
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
    images: Express.Multer.File[],
    @Body() body: any,
    @Param('id') nodeId: string,
  ) {
    const updatedBody = {
      ...body,
      images: images,
    };
    return this.nodeService.manageCommitteeEvent(nodeId, updatedBody);
  }

  @Get('committee-events/:nodeId/:committeeId')
  getCommitteeEvents(
    @Param('nodeId') nodeId: string,
    @Param('committeeId') committeeId: string,
  ) {
    return this.nodeService.getCommitteeEvents(nodeId, committeeId);
  }

  // -----------------------------UPDATE NODE ---------------------------
  @Put(':nodeId')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'profileImage', maxCount: 1 },
      { name: 'coverImage', maxCount: 1 },
    ]),
  )
  @UsePipes(
    new FileValidationPipe({
      profileImage: {
        maxSizeMB: 2,
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/jpg'],
        required: false,
      },
      coverImage: {
        maxSizeMB: 2,
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/jpg'],
        required: false,
      },
    }),
  )
  updateNode(
    @Param('nodeId') nodeId: string,
    @UploadedFiles(
      new FileValidationPipe({
        profileImage: {
          maxSizeMB: 5,
          allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png'],
          required: false,
        },
        coverImage: {
          maxSizeMB: 10,
          allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png'],
          required: false,
        },
      }),
    )
    files: {
      profileImage?: Express.Multer.File[];
      coverImage?: Express.Multer.File[];
    },
    @Body()
    updateNodeBody: {
      name: string;
      about: string;
      description: string;
      location: string;
      removeCoverImage: boolean;
      domain: string;
      customColor: string;
    },
  ) {
    return this.nodeService.updateNode(new Types.ObjectId(nodeId), {
      ...updateNodeBody,
      profileImage: files?.profileImage?.[0],
      coverImage: files?.coverImage?.[0],
      customColor: updateNodeBody.customColor,
    });
  }

  // -------------------------------- MAKE IT BETTER --------------------------------

  @Post('make-it-better/:id')
  async submitMakeItBetter(
    @Body() body: { type: string; contactDetails?: string; description: string },
    @Param('id') nodeId: string,
  ) {
    return await this.nodeService.submitMakeItBetter(nodeId, body);
  }

  @Roles('owner', 'admin')
  @UseGuards(NodeRoleGuard)
  @Get('make-it-better/:id')
  async getMakeItBetter(@Param('id') nodeId: string) {
    return await this.nodeService.getMakeItBetter(nodeId);
  }

  @Roles('owner', 'admin')
  @UseGuards(NodeRoleGuard)
  @Delete('make-it-better/:id/:feedbackId')
  async deleteMakeItBetter(
    @Param('id') nodeId: string,
    @Param('feedbackId') feedbackId: string,
  ) {
    return await this.nodeService.deleteMakeItBetter(nodeId, feedbackId);
  }

  // -----------------------------GET ONE NODE -------------------------------------
  @Get(':nodeId')
  findOne(@Param('nodeId') id: string, @Req() req: Request) {
    return this.nodeService.findOne(id, req.user.isOnBoarded);
  }
}
