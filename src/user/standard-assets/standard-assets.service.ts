import { BadRequestException, ConflictException, ForbiddenException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { StdPluginAsset, EPublishedStatus } from 'src/shared/entities/standard-plugin/std-plugin-asset.entity';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { ClientSession, model, Model, SortOrder, Types } from 'mongoose';
import { StdPlugin } from 'src/shared/entities/standard-plugin/std-plugin.entity';
import { CreateStdAssetDto } from './dto/create-standard-asset.dto';
import { generateSlug } from 'src/utils/slug.util';
import { UploadService } from 'src/shared/upload/upload.service';
import { EmitStdModuleAssetUpdatesProps, NotificationEventsService } from 'src/notification/notification-events.service';
import { ClubMembers } from 'src/shared/entities/clubmembers.entity';
import { NodeMembers } from 'src/shared/entities/node-members.entity';
import { StdAssetAdoption } from 'src/shared/entities/standard-plugin/std-asset-adoption.entity';
import { CommonService } from 'src/plugin/common/common.service';
import { Comment } from 'src/shared/entities/comment.entity';
import { User } from 'src/shared/entities/user.entity';
import { TForum } from 'typings';
import { Connection } from 'mongoose';
import { AssetsService } from 'src/assets/assets.service';
import { Node_ } from 'src/shared/entities/node.entity';
import { Club } from 'src/shared/entities/club.entity';
import { StdCtaResponse } from 'src/shared/entities/standard-plugin/std-cta-response.entity';
import { SubmitCtaResponseDto } from './dto/submit-cta-response.dto';

@Injectable()
export class StdAssetsService {
  constructor(
    @InjectModel(StdPluginAsset.name) private readonly standardAssetModel: Model<StdPluginAsset>,
    @InjectModel(StdPlugin.name) private readonly stdPluginModel: Model<StdPlugin>,
    @InjectModel(StdAssetAdoption.name) private readonly stdAssetAdoptionModel: Model<StdAssetAdoption>,
    @InjectModel(StdCtaResponse.name) private readonly stdCtaResponseModel: Model<StdCtaResponse>,
    private readonly s3FileUpload: UploadService,
    @InjectModel(ClubMembers.name)
    private readonly clubMembersModel: Model<ClubMembers>,
    @InjectModel(NodeMembers.name)
    private readonly nodeMembersModel: Model<NodeMembers>,
    private readonly commonService: CommonService,
    private readonly notificationEventsService: NotificationEventsService,
    @InjectModel(Comment.name)
    private readonly commentModel: Model<Comment>,
    @InjectModel(Club.name)
    private readonly clubModel: Model<Club>,
    @InjectModel(Node_.name)
    private readonly nodeModel: Model<Node_>,
    @InjectConnection() private readonly connection: Connection,
    private readonly assetsService: AssetsService,
  ) { }

  async createV0(createStdAssetDto: CreateStdAssetDto, userId: string, files: Express.Multer.File[]) {
    try {
      // Validate plugin exists
      const plugin = await this.stdPluginModel.findOne({ slug: createStdAssetDto.plugin });
      if (!plugin) throw new NotFoundException('Plugin not found');

      const forumId = createStdAssetDto.chapter || createStdAssetDto.node || createStdAssetDto.club;
      const forum = createStdAssetDto.chapter ? 'chapter' : createStdAssetDto.node ? 'node' : 'club';

      const { role, isMember } = await this.commonService.getUserDetailsInForum({ userId: userId.toString(), forumId: forumId?.toString(), forum: forum as TForum });

      if (!isMember) throw new ForbiddenException('You do not have permission to create this asset');

      const publishedStatus = role === 'owner' || role === 'admin' ? EPublishedStatus.PUBLISHED : EPublishedStatus.PROPOSED;

      if (files) {
        const uploadPromises = files.map((file: Express.Multer.File) =>
          this.uploadFile(file),
        );
        const uploadedFiles = await Promise.all(uploadPromises);
        (createStdAssetDto as any).files = uploadedFiles.map((uploadedFile, index) => ({
          url: uploadedFile.url,
          originalname: files[index].originalname,
          mimetype: files[index].mimetype,
          size: files[index].size,
        }));
      }

      // generate unique slug
      const slug = await this.generateUniqueSlug(createStdAssetDto.title);

      const assetData = {
        // ...createStdAssetDto,
        plugin: plugin._id,
        club: createStdAssetDto.club,
        node: createStdAssetDto.node,
        chapter: createStdAssetDto.chapter,
        createdBy: new Types.ObjectId(userId),
        publishedStatus: publishedStatus,
        statusHistory: [{
          status: publishedStatus,
          changedBy: new Types.ObjectId(userId),
          date: new Date(),
          notes: createStdAssetDto.statusNotes || 'Initial creation'
        }],
        slug: slug,
        data: new Map(Object.entries(createStdAssetDto))
      };

      // If status is PUBLISHED, add publishedBy and publishedDate
      if (assetData.publishedStatus === EPublishedStatus.PUBLISHED) {
        assetData['publishedBy'] = new Types.ObjectId(userId);
        assetData['publishedDate'] = new Date();
      }

      const asset = await this.standardAssetModel.create(assetData);

      if (asset?.publishedStatus === 'published') {
        const entity = asset.club || asset.node || asset.chapter;
        const entityId = (entity && typeof entity === 'object' && '_id' in entity)
          ? entity._id
          : entity;

        this.assetsService.createFeed(
          entityId as Types.ObjectId,
          asset.club ? 'Club' : asset.node ? 'Node' : 'Chapter',
          'StdPluginAsset',
          asset._id as any,
        )
      }

      return asset;
    } catch (error) {
      console.log('StdPluginAsset CREATE Error :: ', error);
      if (error instanceof BadRequestException ||
        error instanceof ConflictException ||
        error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to create plugin asset');
    }
  }

  async create(createStdAssetDto: CreateStdAssetDto, userId: string, files: Express.Multer.File[]) {
    const session = await this.connection.startSession();
    session.startTransaction();
    try {
      console.log({ createStdAssetDto })
      // Validate plugin exists
      const plugin = await this.stdPluginModel.findOne({ slug: createStdAssetDto.plugin }).session(session);
      if (!plugin) throw new NotFoundException('Plugin not found');

      const forumId = createStdAssetDto.chapter || createStdAssetDto.node || createStdAssetDto.club;
      const forum = createStdAssetDto.chapter ? 'chapter' : createStdAssetDto.node ? 'node' : 'club';

      const { role, isMember } = await this.commonService.getUserDetailsInForum({ userId: userId.toString(), forumId: forumId?.toString(), forum: forum as TForum });

      if (!isMember) throw new ForbiddenException('You do not have permission to create this asset');

      const publishedStatus = createStdAssetDto.publishedStatus === "draft" ? EPublishedStatus.DRAFT : role === 'owner' || role === 'admin' ? EPublishedStatus.PUBLISHED : EPublishedStatus.PROPOSED;
      if (publishedStatus === EPublishedStatus.PUBLISHED) {
        await this.assetsService.checkAndIncrement(new Types.ObjectId(userId));
      }

      if (createStdAssetDto?.stdAssetId) {
        const existedAsset = await this.standardAssetModel.findOne({ _id: createStdAssetDto.stdAssetId, publishedStatus: EPublishedStatus.DRAFT }).session(session);
        if (!existedAsset) throw new NotFoundException('Asset not found');

        const newFiles = await this.processFiles(files, createStdAssetDto.deletedImageUrls);
        // Max 5 file check
        const combinedFiles = [
          ...((existedAsset as any)?.data?.files || []).filter(
            (f: any) => !createStdAssetDto.deletedImageUrls?.includes(f.url),
          ),
          ...newFiles,
        ];
        if (combinedFiles.length > 5)
          throw new BadRequestException("You can upload maximum 5 files");

        const updatedAssetData = {
          publishedStatus,
        }

        if (publishedStatus === EPublishedStatus.PUBLISHED) {
          updatedAssetData['publishedBy'] = new Types.ObjectId(userId);
          updatedAssetData['publishedDate'] = new Date();
        }

        const updated = await this.standardAssetModel.findByIdAndUpdate(
          createStdAssetDto.stdAssetId,
          { ...updatedAssetData, data: { ...createStdAssetDto, files: combinedFiles } },
          { new: true, session }
        );

        await session.commitTransaction();
        session.endSession();
        return updated;
      }

      if (!createStdAssetDto.title) {
        throw new NotFoundException("Title is required");
      }

      const uploadedFiles = await this.processFiles(files);

      (createStdAssetDto as any).files = uploadedFiles;

      // generate unique slug
      const slug = await this.generateUniqueSlug(createStdAssetDto.title);

      const assetData = {
        // ...createStdAssetDto,
        plugin: plugin._id,
        club: createStdAssetDto.club,
        node: createStdAssetDto.node,
        chapter: createStdAssetDto.chapter,
        createdBy: new Types.ObjectId(userId),
        publishedStatus: publishedStatus,
        statusHistory: [{
          status: publishedStatus,
          changedBy: new Types.ObjectId(userId),
          date: new Date(),
          notes: createStdAssetDto.statusNotes || 'Initial creation'
        }],
        slug: slug,
        data: new Map(Object.entries(createStdAssetDto))
      };

      // If status is PUBLISHED, add publishedBy and publishedDate
      if (assetData.publishedStatus === EPublishedStatus.PUBLISHED) {
        assetData['publishedBy'] = new Types.ObjectId(userId);
        assetData['publishedDate'] = new Date();
      }

      // const asset = await this.standardAssetModel.create(assetData);
      const asset = new this.standardAssetModel(assetData);
      await asset.save({ session });

      if (asset?.publishedStatus === 'published') {
        const entity = asset.club || asset.node || asset.chapter;
        const entityId = (entity && typeof entity === 'object' && '_id' in entity)
          ? entity._id
          : entity;

        this.assetsService.createFeed(
          entityId as Types.ObjectId,
          asset.club ? 'Club' : asset.node ? 'Node' : 'Chapter',
          'StdPluginAsset',
          asset._id as any,
        )
      }

      await session.commitTransaction();
      return asset;
    } catch (error) {
      await session.abortTransaction();
      console.log('StdPluginAsset CREATE Error :: ', error);
      if (error instanceof BadRequestException ||
        error instanceof ConflictException ||
        error instanceof NotFoundException ||
        error instanceof ForbiddenException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to create plugin asset', error);
    } finally {
      session.endSession();
    }
  }

  private async processFiles(files: any[] = [], deletedUrls: string[] = []) {
    let fileObjects: any[] = [];

    if (files.length > 0) {
      const uploadedFiles = await Promise.all(
        files.map((file) =>
          this.uploadFile({
            buffer: file.buffer,
            originalname: file.originalname,
            mimetype: file.mimetype,
          } as Express.Multer.File),
        ),
      );

      fileObjects = uploadedFiles.map((uploadedFile, index) => ({
        url: uploadedFile.url,
        originalname: files[index].originalname,
        mimetype: files[index].mimetype,
        size: files[index].size,
      }));
    }

    if (deletedUrls.length > 0) {
      await this.deleteFiles(deletedUrls);
    }

    return fileObjects;
  }

  private async deleteFiles(urls: string[]) {
    try {
      //uploading file
      const deletePromises = urls.map((url: string) =>
        this.s3FileUpload.deleteFile(url)
      );
      const response = await Promise.all(deletePromises);
      return response;
    } catch (error) {
      throw new BadRequestException(
        'Failed to delete file. Please try again later.',
      );
    }
  }

  //handling file uploads
  private async uploadFile(file: Express.Multer.File) {
    try {
      //uploading file
      const response = await this.s3FileUpload.uploadFile(
        file.buffer,
        file.originalname,
        file.mimetype,
        'std-asset',
      );
      return response;
    } catch (error) {
      console.error('StdPluginAsset UPLOAD FILE Error :: ', error);
      throw new BadRequestException(
        'Failed to upload file. Please try again later.',
      );
    }
  }

  async findAll(
    forum: string,
    forumId: Types.ObjectId,
    plugin: string,
    type: 'global' | 'all' | 'active' | 'proposed',
    page: number = 1,
    limit: number = 10,
    userId: Types.ObjectId
  ) {
    const _plugin = await this.stdPluginModel.findOne({ slug: plugin });
    if (!_plugin) throw new NotFoundException('Plugin not found');

    let isPluginArchived = false
    if (forum === 'club') {
      const forumData = await this.clubModel.findById(forumId)
      const pluginData = forumData?.plugins?.find((p: any) => p?.plugin?.toString() === _plugin?._id?.toString())
      isPluginArchived = pluginData?.isArchived || false
    } else if (forum === 'node') {
      const forumData = await this.nodeModel.findById(forumId)
      const pluginData = forumData?.plugins?.find((p: any) => p?.plugin?.toString() === _plugin?._id?.toString())
      isPluginArchived = pluginData?.isArchived || false
    }

    if (isPluginArchived) {
      throw new ForbiddenException('Plugin is archived');
    }

    const { role } = await this.commonService.getUserDetailsInForum({ userId: userId.toString(), forumId: forumId.toString(), forum: forum as TForum });

    const query: any = { plugin: _plugin._id, isDeleted: false };
    const adoptedQuery: any = { plugin: _plugin._id };

    if (type === 'global') {
      query.isPublic = true;
      query.publishedStatus = 'published';
    } else {
      query[forum] = forumId;
      adoptedQuery[forum] = new Types.ObjectId(forumId);
    }

    if (type === 'active') {
      query.publishedStatus = 'published';
      adoptedQuery.publishedStatus = 'published';
    } else if (type === 'proposed') {
      query.publishedStatus = 'proposed';
      adoptedQuery.publishedStatus = 'proposed';
    } else if (type === 'all') {
      if (role === 'admin' || role === 'owner') {
        query.publishedStatus = { $in: ['published', 'archived', 'draft'] };
        adoptedQuery.publishedStatus = { $in: ['published'] };
      } else {
        // query.publishedStatus = 'published';
        query.$or = [
          { publishedStatus: 'published' },
          { $and: [{ publishedStatus: 'draft' }, { createdBy: userId }] },
        ];
        adoptedQuery.publishedStatus = 'published';
      }
    }

    const forumPopulateQuery = {
      path: forum,
      select: 'name slug profileImage',
      strictPopulate: false
    };

    try {
      // For global type, only get original assets
      if (type === 'global') {
        const skip = (page - 1) * limit;
        const [assets, total] = await Promise.all([
          this.standardAssetModel.find(query)
            .populate('createdBy', 'name userName profileImage firstName middleName lastName')
            .populate(forumPopulateQuery)
            .populate("plugin", "name slug logo fields")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit),
          this.standardAssetModel.countDocuments(query)
        ]);

        console.log("assets", assets);

        return {
          data: assets,
          pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            hasNextPage: page * limit < total,
            hasPreviousPage: page > 1
          }
        };
      }

      // For non-global types, get both collections without pagination first
      const [assets, adoptedAssets] = await Promise.all([
        this.standardAssetModel.find(query)
          .populate('createdBy', 'name userName profileImage firstName middleName lastName')
          .populate(forumPopulateQuery)
          .populate("plugin", "name slug logo fields")
          .sort({ createdAt: -1 }),
        this.stdAssetAdoptionModel.find(adoptedQuery)
          .populate({
            path: 'asset',
            populate: [{
              path: 'createdBy',
              select: 'name userName profileImage firstName middleName lastName'
            },
            {
              path: 'club',
              select: 'name slug profileImage',
              strictPopulate: false
            },
            {
              path: 'node',
              select: 'name slug profileImage',
              strictPopulate: false
            },
            {
              path: 'plugin',
              select: 'name slug logo fields',
              strictPopulate: false
            }
            ]
          })
          .sort({ createdAt: -1 })
          .lean()
      ]);

      // Transform adopted assets to merge with regular assets
      const transformedAdoptedAssets = adoptedAssets.map(adoptedAsset => {
        const assetData = adoptedAsset.asset;
        console.log("assetData", assetData);
        return {
          ...assetData,
          // Override with adopted asset specific fields
          createdAt: adoptedAsset.createdAt,
          updatedAt: adoptedAsset.updatedAt,
          proposedBy: adoptedAsset.proposedBy,
          // plugin: adoptedAsset.plugin,
          [forum]: assetData[forum],
          publishedStatus: adoptedAsset.publishedStatus,
          statusHistory: adoptedAsset.statusHistory,
          type: adoptedAsset.type,
          // Add a flag to identify adopted assets
          _isAdopted: true,
          _adoptedAssetId: adoptedAsset._id
        };
      });

      // Combine and sort by createdAt (descending)
      const combinedAssets = [...assets, ...transformedAdoptedAssets]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      // Apply pagination to combined results
      const total = combinedAssets.length;
      const skip = (page - 1) * limit;
      const paginatedAssets = combinedAssets.slice(skip, skip + limit);

      return {
        data: paginatedAssets,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
          hasNextPage: page * limit < total,
          hasPreviousPage: page > 1
        }
      };
    } catch (error) {
      console.log('StdPluginAsset FIND ALL Error :: ', error);
      if (error instanceof BadRequestException || error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to find plugin assets');
    }
  }

  async getAssetCounts(forum: string, forumId: Types.ObjectId, plugin: string, userId: string) {
    const _plugin = await this.stdPluginModel.findOne({ slug: plugin });
    if (!_plugin) throw new NotFoundException('Plugin not found');

    const { role } = await this.commonService.getUserDetailsInForum({ userId: userId.toString(), forumId: forumId.toString(), forum: forum as TForum });

    const additionalAllQuery: any = {};
    if (["admin", "owner"].includes(role)) {
      additionalAllQuery.publishedStatus = { $in: ['published', 'archived', 'draft'] };
    } else {
      additionalAllQuery.$or = [
        { publishedStatus: 'published' },
        { $and: [{ publishedStatus: 'draft' }, { createdBy: userId }] },
      ];
    }

    const query: any = { plugin: _plugin._id, isDeleted: false, ...additionalAllQuery };
    const adoptedQuery: any = { plugin: _plugin._id };

    query[forum] = forumId;
    adoptedQuery[forum] = new Types.ObjectId(forumId);

    const globalQuery = { plugin: _plugin._id, isDeleted: false, isPublic: true, publishedStatus: 'published' };

    try {
      const [
        // Regular assets counts
        all,
        active,
        proposed,
        global,
        // Adopted assets counts
        adoptedAll,
        adoptedActive,
        adoptedProposed,
      ] = await Promise.all([
        // Regular assets
        this.standardAssetModel.countDocuments(query),
        this.standardAssetModel.countDocuments({ ...query, publishedStatus: 'published' }),
        this.standardAssetModel.countDocuments({ ...query, publishedStatus: 'proposed' }),
        this.standardAssetModel.countDocuments(globalQuery),
        // Adopted assets
        this.stdAssetAdoptionModel.countDocuments({ ...adoptedQuery, publishedStatus: 'published' }),
        this.stdAssetAdoptionModel.countDocuments({ ...adoptedQuery, publishedStatus: 'published' }),
        this.stdAssetAdoptionModel.countDocuments({ ...adoptedQuery, publishedStatus: 'proposed' }),
      ]);

      return {
        all: all + adoptedAll,
        active: active + adoptedActive,
        proposed: proposed + adoptedProposed,
        global: global,
      };
    } catch (error) {
      console.log('StdPluginAsset GET ASSET COUNTS Error :: ', error);
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to get plugin asset counts');
    }
  }

  async findBySlug(slug: string, adoptionId: string, chapterAlyId: string, userId: string) {
    try {
      const forumPopulateSelect = 'name slug profileImage';
      const asset: any = await this.standardAssetModel.findOne({ slug }).populate('createdBy', 'name userName profileImage firstName middleName lastName').populate({ path: 'chapter', select: forumPopulateSelect }).populate({ path: 'node', select: forumPopulateSelect }).populate({ path: 'club', select: forumPopulateSelect }).lean();

      const commentCount = await this.commentModel.find({ 'entity.entityId': chapterAlyId || adoptionId || asset?._id, parent: null });

      let adoption;
      if (adoptionId) {
        adoption = await this.stdAssetAdoptionModel.findOne({ _id: adoptionId }).populate('asset proposedBy publishedBy');
        if (adoption) {
          (asset as any).publishedStatus = adoption.publishedStatus;
          (asset as any).type = 'adopted';
          (asset as any)._adoptedAssetId = adoptionId;
          (asset as any).adoptionProposedBy = adoption.proposedBy;
          (asset as any).adoptionDate = adoption.createdAt;
        }
      }

      const { forumId, forumType } = this.getForumTypeAndId({ asset, adoption, adoptionId });

      const { role } = await this.commonService.getUserDetailsInForum({
        userId: String(userId),
        forumId: forumId,
        forum: forumType
      });

      (asset as any).commentCount = commentCount.length;
      return this.enhanceAssetWithMetadata(asset, role, userId, adoptionId, adoption);
    } catch (error) {
      console.log('StdPluginAsset FIND BY SLUG Error :: ', error);
      if (error instanceof BadRequestException ||
        error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to find plugin asset by slug');
    }
  }

  private getForumTypeAndId({ asset, adoption, adoptionId }: { asset: any, adoption: any, adoptionId?: string }): { forumId: string | null; forumType: TForum } {
    const forumTypes = ['chapter', 'node', 'club'];

    if (adoptionId && adoption) {
      for (const type of forumTypes) {
        if (adoption.asset?.[type]) {
          return {
            forumId: adoption[type]?.toString() || adoption.asset[type].toString(),
            forumType: type as TForum
          };
        }
      }
    }

    for (const type of forumTypes) {
      if (asset?.[type]) {
        return {
          forumId: asset[type]._id?.toString(),
          forumType: type as TForum
        };
      }
    }

    return { forumId: null, forumType: null };
  }


  private enhanceAssetWithMetadata(asset: any, role: string, userId: string, adoptionId?: string, alyAsset?: any) {
    const enhancedAsset = {
      ...asset,
      currentUserRole: role,
      isOwnerOfAsset: String(asset.createdBy._id) === String(userId)
    };

    if (adoptionId && alyAsset) {
      enhancedAsset.adoptedBy = alyAsset.proposedBy;
      enhancedAsset.adoptedAt = alyAsset.createdAt;
      enhancedAsset.publishedStatus = alyAsset.publishedStatus;
    }

    return enhancedAsset;
  }

  async toggleRelevant(slug: string, userId: string) {
    try {
      const asset = await this.standardAssetModel.findOne({ slug });
      if (!asset) throw new NotFoundException('Asset not found');

      const userIdObj = new Types.ObjectId(userId);

      // Check if user is already in relevant
      const relevantIndex = asset.relevant.findIndex(item => item.user.equals(userIdObj));

      if (relevantIndex >= 0) {
        asset.relevant.splice(relevantIndex, 1);
      } else {
        const irrelevantIndex = asset.irrelevant.findIndex(item => item.user.equals(userIdObj));
        if (irrelevantIndex >= 0) {
          asset.irrelevant.splice(irrelevantIndex, 1);
        }

        asset.relevant.push({
          user: userIdObj,
          date: new Date(),
        });
      }

      await asset.save();
      return asset;
    } catch (error) {
      console.log('StdPluginAsset TOGGLE RELEVANT Error :: ', error);
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to toggle plugin asset relevance');
    }
  }

  async toggleIrrelevant(slug: string, userId: string) {
    try {
      const asset = await this.standardAssetModel.findOne({ slug });
      if (!asset) throw new NotFoundException('Asset not found');

      const userIdObj = new Types.ObjectId(userId);

      const irrelevantIndex = asset.irrelevant.findIndex(item => item.user.equals(userIdObj));

      if (irrelevantIndex >= 0) {
        asset.irrelevant.splice(irrelevantIndex, 1);
      } else {
        const relevantIndex = asset.relevant.findIndex(item => item.user.equals(userIdObj));
        if (relevantIndex >= 0) {
          asset.relevant.splice(relevantIndex, 1);
        }

        asset.irrelevant.push({
          user: userIdObj,
          date: new Date(),
        });
      }

      await asset.save();
      return asset;
    } catch (error) {
      console.log('StdPluginAsset TOGGLE IRRELEVANT Error :: ', error);
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to toggle plugin asset relevance');
    }
  }

  async createUpdate(slug: string, updateAssetDto: any, file: Express.Multer.File, userId: string) {
    try {
      const updateData: any = {
        _id: new Types.ObjectId(),
        message: updateAssetDto.message,
        createdBy: new Types.ObjectId(userId),
        createdAt: new Date()
      };

      console.log('userId :: ', userId);
      console.log('updateData :: ', updateData);

      if (file) {
        const uploadedFile = await this.s3FileUpload.uploadFile(
          file.buffer,
          file.originalname,
          file.mimetype,
          'std-asset',
        );
        updateData.file = { ...uploadedFile, mimetype: file.mimetype };
      }

      // First try to push to existing array
      let result = await this.standardAssetModel.findOneAndUpdate(
        { slug, 'data.updates': { $exists: true } },
        { $push: { 'data.updates': updateData } },
        { new: true }
      );

      // If array doesn't exist, create it
      if (!result) {
        result = await this.standardAssetModel.findOneAndUpdate(
          { slug },
          { $set: { 'data.updates': [updateData] } },
          { new: true }
        );
      }

      if (!result) throw new NotFoundException('Asset not found');

      const title = (result as any)?.data?.get('title');
      const notificationMessage = `${title} has new updates`;
      const emitStdModuleAssetUpdates: EmitStdModuleAssetUpdatesProps = {
        forum: {
          type: result?.node ? "node" : "club",
          id: result?.node ? result?.node.toString() : result?.club.toString(),
        },
        from: userId,
        message: notificationMessage,
        subscriberIds: result?.subscribers.map((subscriber: any) => subscriber.user.toString()),
        pluginId: result?.plugin.toString(),
        assetId: result._id.toString(),
      }

      await this.notificationEventsService.emitStdModuleAssetUpdates(emitStdModuleAssetUpdates)

      return result;
    } catch (error) {
      console.error('Detailed error:', error);
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Failed to create update');
    }
  }

  async deleteUpdate(slug: string, updateId: string) {
    try {
      const result: any = await this.standardAssetModel.findOneAndUpdate(
        { slug },
        { $pull: { 'data.updates': { _id: new Types.ObjectId(updateId) } } },
        { new: true }
      );

      if (!result) throw new NotFoundException('Asset not found');

      // Check if the specific update was actually deleted
      const updateExists = result.data?.updates?.some(
        (update: any) => update._id.toString() === updateId
      );

      if (updateExists) {
        throw new NotFoundException('Update not found in the asset');
      }

      return { success: true, message: 'Update deleted successfully' };
    } catch (error) {
      console.error('Error deleting update:', error);
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Failed to delete update');
    }
  }

  async getUpdates(slug: string) {
    try {
      const asset = await this.standardAssetModel.findOne({ slug })
        .populate({
          path: 'data.updates.createdBy',
          select: 'name userName profileImage firstName middleName lastName',
          model: User.name,
        })
        .lean();

      console.log('asset :: ', asset?.data?.updates);

      if (!asset) throw new NotFoundException('Asset not found');

      // Sort updates by createdAt in descending order
      asset.data.updates.sort((a: any, b: any) => b.createdAt - a.createdAt);

      return asset.data?.updates ?? [];
    } catch (error) {
      console.error('Error fetching updates:', error);
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Failed to fetch updates');
    }
  }

  async toggleSubscribeUpdates(slug: string, userId: string) {
    try {
      const asset = await this.checkAssetExists({ slug });
      if (!asset) throw new NotFoundException('Asset not found');

      const existingSubscriptionIndex = asset.subscribers.findIndex(
        sub => sub.user?.toString() === userId?.toString()
      );

      console.log('existingSubscriptionIndex :: ', existingSubscriptionIndex, userId);

      let message: string;
      let updatedAsset;

      if (existingSubscriptionIndex >= 0) {
        // Unsubscribe - remove the user from subscribers array
        updatedAsset = await this.standardAssetModel.findOneAndUpdate(
          { slug },
          { $pull: { subscribers: { user: new Types.ObjectId(userId) } } },
          { new: true }
        );
        message = 'Unsubscribed from updates successfully';
      } else {
        // Subscribe - add the user to subscribers array
        updatedAsset = await this.standardAssetModel.findOneAndUpdate(
          { slug },
          {
            $push: {
              subscribers: {
                user: new Types.ObjectId(userId),
                createdAt: new Date()
              }
            }
          },
          { new: true }
        );
        message = 'Subscribed to updates successfully';
      }

      return {
        success: true,
        message,
        isSubscribed: existingSubscriptionIndex < 0, // returns new subscription state
        subscribersCount: updatedAsset.subscribers.length
      };

    } catch (error) {
      console.error('Error toggling subscription:', error);
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Failed to toggle subscription');
    }
  }

  async getSubscribers(assetSlug: string) {
    try {
      const asset = await this.standardAssetModel.findOne({ slug: assetSlug })
        .populate({
          path: 'subscribers.user',
          select: 'name userName profileImage firstName lastName'
        })
        .lean();

      if (!asset) {
        throw new NotFoundException('Asset not found');
      }

      return asset.subscribers || [];
    } catch (error) {
      console.error('Error fetching subscribers:', error);
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Failed to fetch subscribers');
    }
  }

  async addView(slug: string, userId: string) {
    try {
      const asset = await this.checkAssetExists({ slug });
      if (!asset) throw new NotFoundException('Asset not found');

      const userIdObj = new Types.ObjectId(userId);

      const viewsIndex = asset.views.findIndex(item => item.user.equals(userIdObj));

      if (viewsIndex === -1) {
        asset.views.push({
          user: userIdObj,
          date: new Date(),
        });
      }

      await asset.save();
      return asset;
    } catch (error) {
      console.log('StdAsset ADD VIEW Error :: ', error);
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to add view');
    }
  }

  // ADOPTION
  async getNonAdoptedForums(slug: string, userId: string) {
    try {
      const asset = await this.standardAssetModel.findOne({ slug });
      if (!asset) throw new NotFoundException('Asset not found');

      const { club, node } = asset;

      let userClubs = await this.clubMembersModel.find({
        user: new Types.ObjectId(userId),
        club: { $ne: club }
      }).populate('club', 'name slug description profileImage').select('-user').lean();

      let userNodes = await this.nodeMembersModel.find({
        user: new Types.ObjectId(userId),
        node: { $ne: node }
      }).populate('node', 'name slug description profileImage').select('-user').lean();


      const joinedClubsId = userClubs.map(clubMember => clubMember.club._id);
      const joinedNodesId = userNodes.map(nodeMember => nodeMember.node._id);

      const alreadyAdoptedClubs = await this.stdAssetAdoptionModel.find({
        asset: asset._id,
        club: { $in: joinedClubsId }
      }).lean();

      const alreadyAdoptedNodes = await this.stdAssetAdoptionModel.find({
        asset: asset._id,
        node: { $in: joinedNodesId }
      }).lean();

      userClubs = userClubs?.filter(clubMember => !alreadyAdoptedClubs?.some(adoption => adoption.club.toString() === clubMember.club._id.toString()));

      userNodes = userNodes?.filter(nodeMember => !alreadyAdoptedNodes?.some(adoption => adoption.node.toString() === nodeMember.node._id.toString()));


      const transformedClubs = userClubs?.map(clubMember => ({
        ...clubMember.club,
        role: clubMember.role,
        status: clubMember.status,
      }));

      const transformedNodes = userNodes?.map(nodeMember => ({
        ...nodeMember.node,
        role: nodeMember.role,
        status: nodeMember.status,
      }));

      return {
        clubs: transformedClubs,
        nodes: transformedNodes,
      };
    } catch (error) {
      console.log('StdPluginAsset GET NOT ADOPTED FORUMS Error :: ', error);
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to get not adopted forums');
    }
  }

  async adoptStdAsset(assetSlug: string, userId: string, club?: string, node?: string) {
    try {
      if (!assetSlug) throw new BadRequestException('Invalid asset slug');
      if (!club && !node) throw new BadRequestException('Club or node is required');

      // check user validation


      const asset = await this.standardAssetModel.findOne({ slug: assetSlug })
      if (!asset) throw new NotFoundException('Asset not found');

      const userData = await this.commonService.getUserDetailsInForum({
        userId,
        forumId: club || node,
        forum: club ? 'club' : 'node',
      });

      if (!userData?.isMember) throw new ForbiddenException('You are not a member of this forum');

      let publishedStatus = ['owner', 'admin'].includes(userData?.role) ? 'published' : 'proposed';


      const existingAdoption = await this.stdAssetAdoptionModel.findOne({
        asset: asset._id,
        [club ? 'club' : 'node']: new Types.ObjectId(club || node),
      });

      if (existingAdoption) throw new ConflictException('Asset already adopted');

      if (publishedStatus === 'published' && club) {
        asset.adoptedClubs.push({
          club: new Types.ObjectId(club),
          date: new Date(),
        });
      } else if (publishedStatus === 'published' && node) {
        asset.adoptedNodes.push({
          node: new Types.ObjectId(node),
          date: new Date(),
        });
      }

      const adoption = await this.stdAssetAdoptionModel.create({
        proposedBy: new Types.ObjectId(userId),
        ...(publishedStatus === 'published' && {
          publishedBy: new Types.ObjectId(userId),
          publishedDate: new Date(),
        }),
        asset: asset._id,
        plugin: asset.plugin,
        [club ? 'club' : 'node']: new Types.ObjectId(club || node),
        publishedStatus,
        statusHistory: [{
          status: publishedStatus,
          changedBy: new Types.ObjectId(userId),
          date: new Date(),
          notes: 'Initial creation'
        }],
      });

      asset.save();

      if (adoption?.publishedStatus === 'published') {
        this.assetsService.createFeed(
          adoption?.club || adoption?.node || adoption?.chapter,
          adoption?.club ? 'Club' : adoption?.node ? 'Node' : 'Chapter',
          'StdPluginAsset',
          adoption?.asset,
          'StdAssetAdoption',
          adoption?._id,
        )
      }


      return adoption;
    } catch (error) {
      console.log('StdPluginAsset ADOPT STD ASSET Error :: ', error);
      if (error instanceof BadRequestException || error instanceof NotFoundException || error instanceof ConflictException || error instanceof ForbiddenException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to adopt plugin asset');
    }
  }

  async getAllFeedAssetsByEntity(
    entity: 'club' | 'node',
    entityId: string,
    page: number = 1,
    limit: number = 10
  ) {
    try {

      const publishedFilter = { publishedStatus: EPublishedStatus.PUBLISHED };
      const skip = (page - 1) * limit;
      console.log('skip :: ', skip);
      const objectId = new Types.ObjectId(entityId);
      const sortOptions = { createdAt: -1 as SortOrder }; // Always newest first

      // 1. Get counts in parallel
      const [directCount, adoptedCount] = await Promise.all([
        this.standardAssetModel.countDocuments({
          ...publishedFilter,
          [entity]: objectId
        }),
        this.stdAssetAdoptionModel.countDocuments({
          publishedStatus: 'published',
          [entity]: objectId,
          isArchived: false
        })
      ]);

      console.log('directCount :: ', directCount);
      console.log('adoptedCount :: ', adoptedCount);

      // 2. Calculate dynamic limits
      const directAvailable = Math.max(0, directCount - skip);
      const adoptedAvailable = Math.max(0, adoptedCount - skip);

      let directLimit = Math.min(Math.ceil(limit / 2), directAvailable);
      let adoptedLimit = Math.min(limit - directLimit, adoptedAvailable);

      // Adjust limits if one source is insufficient
      if (directLimit + adoptedLimit < limit) {
        if (directAvailable > directLimit) {
          directLimit = Math.min(directAvailable, limit - adoptedLimit);
        } else {
          adoptedLimit = Math.min(adoptedAvailable, limit - directLimit);
        }
      }

      console.log('directLimit :: ', directLimit);
      console.log('adoptedLimit :: ', adoptedLimit);

      // 3. Execute optimized parallel queries with forced sorting
      const [directAssets, adoptedAssets] = await Promise.all([
        directLimit > 0 ? this.standardAssetModel.find({
          ...publishedFilter,
          [entity]: objectId
        })
          .sort(sortOptions)
          .skip(skip)
          .limit(directLimit)
          .lean() : Promise.resolve([]),

        adoptedLimit > 0 ? this.stdAssetAdoptionModel.find({
          publishedStatus: 'published',
          [entity]: objectId,
          isArchived: false
        })
          .populate({
            path: 'asset',
            match: { ...publishedFilter },
            options: {
              sort: sortOptions, // Sorts populated assets
              limit: adoptedLimit // Respects our pagination
            },
          })
          .sort(sortOptions) // Sorts adoption records
          .skip(skip)
          .limit(adoptedLimit)
          .lean() : Promise.resolve([])
      ]);

      // 4. Process and merge results
      const processedDirectAssets = directAssets.map(asset => ({
        ...asset,
        type: "std",
        sortTimestamp: asset.createdAt.getTime()
      }));

      const processedAdoptedAssets = adoptedAssets
        .filter(adopt => adopt.asset)
        .map(adopt => ({
          ...adopt.asset,
          type: "std",
          adoptionId: adopt._id,
          sortTimestamp: adopt.asset.createdAt.getTime()
        }));

      // Final merge with secondary sort
      const allResults = [...processedDirectAssets, ...processedAdoptedAssets]
        .sort((a, b) => b.sortTimestamp - a.sortTimestamp) // Newest first
        .slice(0, limit);

      // Clean up temporary field
      allResults.forEach(item => delete item.sortTimestamp);

      return {
        items: allResults,
        total: directCount + adoptedCount,
        page: Number(page),
        limit: Number(limit),
        hasMore: skip + limit < (directCount + adoptedCount)
      };

    } catch (error) {
      console.log('StdPluginAsset GET ALL STD ASSET Error :: ', error);
      if (error instanceof BadRequestException || error instanceof NotFoundException || error instanceof ConflictException || error instanceof ForbiddenException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to get all plugin assets');
    }
  }

  // MAKE PUBLIC
  async makePublic(slug: string, userId: string) {
    try {
      const asset = await this.standardAssetModel.findOne({ slug });
      if (!asset) throw new NotFoundException('Asset not found');

      await this.validateAccess(asset, userId, ['owner', 'admin']);

      asset.isPublic = true;
      asset.save();

      return asset;
    } catch (error) {
      console.log('StdPluginAsset MAKE PUBLIC Error :: ', error);
      if (error instanceof BadRequestException || error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to make plugin asset public');
    }
  }

  async archiveAsset(assetId: string, type: 'adopted' | 'original', userId: string) {
    try {
      const asset = await this.standardAssetModel.findOne({ _id: assetId });
      if (!asset) throw new NotFoundException('Asset not found');
      if (asset.createdBy.toString() !== userId)
        await this.validateAccess(asset, userId, ['owner', 'admin']);


      asset.publishedStatus = EPublishedStatus.ARCHIVED;
      asset.save();

      await this.stdAssetAdoptionModel.updateMany({ asset: asset._id }, { publishedStatus: EPublishedStatus.ARCHIVED })

      await this.assetsService.updateFeed(
        asset?._id?.toString(),
        EPublishedStatus.ARCHIVED,
        undefined,
        "standard"
      );

      return {
        message: 'Asset archived successfully',
        asset
      };
    } catch (error) {
      console.log('StdPluginAsset ARCHIVE Error :: ', error);
      if (error instanceof BadRequestException || error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to archive plugin asset');
    }
  }

  async unarchiveAsset(assetId: string, type: 'adopted' | 'original', userId: string) {
    try {
      const asset = await this.standardAssetModel.findOne({ _id: assetId });
      if (!asset) throw new NotFoundException('Asset not found');

      if (asset.createdBy.toString() !== userId)
        await this.validateAccess(asset, userId, ['owner', 'admin']);

      asset.publishedStatus = EPublishedStatus.PUBLISHED;
      asset.save();

      await this.stdAssetAdoptionModel.updateMany({ asset: asset._id }, { publishedStatus: EPublishedStatus.PUBLISHED });

      await this.assetsService.updateFeed(
        asset?._id?.toString(),
        EPublishedStatus.PUBLISHED,
        undefined,
        "standard"
      );

      return {
        message: 'Asset unarchived successfully',
        asset
      };
    } catch (error) {
      console.log('StdPluginAsset UNARCHIVE Error :: ', error);
      if (error instanceof BadRequestException || error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to unarchive plugin asset');
    }
  }

  // publish
  async publish(assetId: string, userId: string, type: 'adopted' | 'original') {
    const session = await this.connection.startSession();
    try {
      let asset: any;
      session.startTransaction();
      if (type === 'adopted') {
        asset = await this.stdAssetAdoptionModel.findOne({ _id: assetId }).populate('asset')
        if (!asset) throw new NotFoundException('Asset not found');

        await this.validateAccess(asset as StdPluginAsset, userId, ['owner', 'admin']);

        const originalAsset = await this.standardAssetModel.findOne({ _id: asset.asset._id });

        if (asset.club) {
          const alreadyAdopted = originalAsset.adoptedClubs.find((club) => club.club.toString() === asset.club.toString());

          if (!alreadyAdopted) {
            originalAsset.adoptedClubs.push({
              club: new Types.ObjectId(asset?.club),
              date: new Date(),
            });
          }
        } else if (asset.node) {
          const alreadyAdopted = originalAsset.adoptedNodes.find((node) => node.node.toString() === asset.node.toString());
          if (!alreadyAdopted) {
            originalAsset.adoptedNodes.push({
              node: new Types.ObjectId(asset?.node),
              date: new Date(),
            });
          }
        }

        await originalAsset.save({ session });
      } else {
        asset = await this.standardAssetModel.findOne({ _id: assetId });
        if (!asset) throw new NotFoundException('Asset not found');

        if (asset.createdBy.toString() !== userId)
          await this.validateAccess(asset, userId, ['owner', 'admin']);
      }

      asset.publishedStatus = EPublishedStatus.PUBLISHED;
      asset.publishedBy = userId;
      asset.statusHistory = [
        ...asset.statusHistory,
        {
          status: EPublishedStatus.PUBLISHED,
          changedBy: userId,
          date: new Date(),
          notes: 'Published'
        }
      ];

      const savedAsset = await asset.save({ session });
      console.log('savedAsset :: ', savedAsset);

      await session.commitTransaction();

      return savedAsset;
    } catch (error) {
      console.log('StdPluginAsset PUBLISH Error :: ', error);
      if (error instanceof BadRequestException || error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      await session.abortTransaction();
      throw new InternalServerErrorException('Failed to publish plugin asset');
    }
  }


  // PRIVATE HELPER METHODS
  private async checkAssetExists({ slug, _id }: { slug?: string, _id?: Types.ObjectId }) {
    if (slug) return this.standardAssetModel.findOne({ slug });
    if (_id) return this.standardAssetModel.findOne({ _id });
    return null;
  }

  private async generateUniqueSlug(title: string): Promise<string> {
    let slug = generateSlug(title); // Start without a random suffix
    let assetExists = await this.standardAssetModel.findOne({ slug });

    while (assetExists) {
      slug = generateSlug(title, true); // Add random 4-char hash
      assetExists = await this.standardAssetModel.findOne({ slug });
    }

    return slug;
  }

  private async validateAccess(
    asset: StdPluginAsset,
    userId: string,
    allowedRoles: ('owner' | 'admin' | 'member' | 'author' | 'moderator')[]
  ) {
    const forumId = asset?.chapter?.toString() || asset?.club?.toString() || asset?.node?.toString();
    const forumType = asset?.chapter ? 'chapter' : asset?.club ? 'club' : 'node';

    const { isMember, role } = await this.commonService.getUserDetailsInForum({
      userId,
      forumId,
      forum: forumType,
    });

    if (!isMember) throw new ForbiddenException('You are not a member of this forum');

    const isAuthor = asset?.createdBy?.toString() === userId;
    const hasAllowedRole = allowedRoles.includes(role) || (allowedRoles.includes('author') && isAuthor);

    if (!hasAllowedRole) {
      throw new ForbiddenException('You are not authorized to make this asset public');
    }

    return true;
  }

  async updateFaq(body: any) {
    try {
      const asset = await this.standardAssetModel.findById(body._id);
      if (!asset) {
        throw new NotFoundException("Asset not found");
      }

      const newFaqs = Array.isArray(body.faq)
        ? body.faq
        : [
          {
            question: body.question,
            answer: body.answer,
          },
        ];

      const updatedAsset = await this.standardAssetModel.findByIdAndUpdate(
        body._id,
        { $push: { "data.faq": { $each: newFaqs } } },
        { new: true } // return updated doc
      );

      return updatedAsset;
    } catch (error) {
      console.error("StdPluginAsset UPDATE FAQ Error :: ", error);

      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException("Failed to update plugin asset");
    }
  }

  async deleteStdAsset(assetId: string, userId: string) {
    try {
      const asset = await this.standardAssetModel.findById(assetId);

      if (!asset) throw new NotFoundException("Asset not found");
      if (asset?.isPublic) throw new ForbiddenException("You are not authorized to delete this asset");

      const { role, isMember } = await this.commonService.getUserDetailsInForum({
        userId,
        forum: asset?.chapter ? 'chapter' : asset?.node ? 'node' : 'club',
        forumId: String(asset?.chapter || asset?.node || asset?.club)
      });

      if (!isMember || (['member', 'moderator'].includes(role) && asset?.createdBy.toString() !== userId.toString())) {
        throw new ForbiddenException("You are not authorized to delete this asset");
      }

      // soft delete asset
      await this.standardAssetModel.findByIdAndUpdate(assetId, { $set: { isDeleted: true } });

      // update feed status to deleted
      await this.assetsService.updateFeed(
        assetId,
        "deleted",
        undefined,
        "standard"
      );

      return { success: true, message: "Asset deleted successfully" };
    } catch (error) {
      console.error("StdPluginAsset DELETE Error :: ", error);
      if (error instanceof ForbiddenException) throw error;
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        'Error while deleting Standard Asset',
        error,
      );
    }
  }

  async removeStdAssetFromAdoption(adoptionId: string, userId: string, action: 'removeadoption' | 're-adopt') {
    try {
      const adoption = await this.stdAssetAdoptionModel.findById(adoptionId);
      if (!adoption) throw new NotFoundException("Adoption not found");

      const { role, isMember } = await this.commonService.getUserDetailsInForum({
        userId,
        forum: adoption?.club ? 'club' : adoption?.node ? 'node' : 'chapter',
        forumId: String(adoption?.club || adoption?.node || adoption?.chapter)
      });

      if (!isMember || ['member', 'moderator'].includes(role)) {
        throw new ForbiddenException("You are not authorized to remove this adoption");
      }

      // soft delete adoption
      const updatedAdoption = await this.stdAssetAdoptionModel.findByIdAndUpdate(adoptionId, {
        publishedStatus: action === 're-adopt' ? 'published' : 'rejected'
      }, { new: true });

      // update feed status to deleted
      await this.assetsService.updateFeed(
        updatedAdoption?.asset.toString(),
        action === 'removeadoption' ? 'deleted' : 'published',
        undefined,
        'standard',
        adoptionId
      );

      return { status: true, message: 'Adoption removed successfully' };
    } catch (error) {
      console.error("Adoption DELETE Error :: ", error);
      if (error instanceof ForbiddenException) throw error;
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        'Error while removing adoption',
        error,
      );
    }
  }

  async getDraftAssets(id: string, userId: string) {
    try {
      const asset = await this.standardAssetModel.findOne({ _id: id, publishedStatus: EPublishedStatus.DRAFT, createdBy: userId });
      if (!asset) throw new NotFoundException("Asset not found");

      return {
        success: true,
        data: asset,
        message: "Draft asset fetched successfully"
      };
    } catch (error) {
      console.error("StdPluginAsset GET Error :: ", error);
      throw error
    }
  }

  async submitCtaResponse(submitCtaResponseDto: SubmitCtaResponseDto, userId: string, files?: Express.Multer.File[]) {
    try {

      // Validate asset exists
      const asset = await this.standardAssetModel.findById(submitCtaResponseDto.assetId);
      if (!asset) throw new NotFoundException('Asset not found');

      // Check if user has already submitted a response for this asset in this specific forum
      const existingResponseQuery: any = {
        asset: submitCtaResponseDto.assetId,
        user: userId
      };

      // Add forum-specific check
      if (submitCtaResponseDto.forum === 'club') {
        existingResponseQuery.club = submitCtaResponseDto.forumId;
      } else if (submitCtaResponseDto.forum === 'chapter') {
        existingResponseQuery.chapter = submitCtaResponseDto.forumId;
      } else if (submitCtaResponseDto.forum === 'node') {
        existingResponseQuery.node = submitCtaResponseDto.forumId;
      }

      const existingResponse = await this.stdCtaResponseModel.findOne(existingResponseQuery);

      if (existingResponse) {
        throw new ConflictException('You have already submitted an application for this asset in this forum');
      }

      // Convert asset.data to plain object if it's a Map
      const assetData = asset.data instanceof Map ? Object.fromEntries(asset.data) : asset.data;

      // Convert to plain object to handle nested Maps (Mongoose returns nested Maps)
      const assetDataPlain = JSON.parse(JSON.stringify(assetData));

      // Validate that the asset has CTA form data
      if (!assetDataPlain?.cta || assetDataPlain.cta.type !== 'form' || !assetDataPlain.cta.form?.questions) {
        throw new BadRequestException('This asset does not have a CTA form');
      }

      // Validate all required questions are answered
      const questions = assetDataPlain.cta.form.questions;
      const responseMap = new Map(
        submitCtaResponseDto.responses.map(r => [r.questionId, r])
      );

      const missingRequiredQuestions: string[] = [];
      questions.forEach((question: any) => {
        if (question.isRequired) {
          const response = responseMap.get(question.id);
          if (!response || response.answer === undefined || response.answer === null || response.answer === '') {
            missingRequiredQuestions.push(question.questionText);
          }
        }
      });

      if (missingRequiredQuestions.length > 0) {
        throw new BadRequestException(
          `The following required questions must be answered: ${missingRequiredQuestions.join(', ')}`
        );
      }

      // Validate plugin exists - check if it's an ObjectId or slug
      let plugin;
      if (Types.ObjectId.isValid(submitCtaResponseDto.pluginId)) {
        plugin = await this.stdPluginModel.findById(submitCtaResponseDto.pluginId);
      } else {
        // It's a slug, look up by slug
        plugin = await this.stdPluginModel.findOne({ slug: submitCtaResponseDto.pluginId });
      }
      if (!plugin) throw new NotFoundException('Plugin not found');

      // Handle file uploads for file type questions
      if (files && files.length > 0) {
        // Create a map of files by their originalname (which contains questionId)
        const fileMap = new Map<string, Express.Multer.File>();
        files.forEach(file => {
          // The originalname contains the questionId
          fileMap.set(file.originalname, file);
        });

        // Process each response and upload files if needed
        for (const response of submitCtaResponseDto.responses) {
          if (response.responseType === 'file') {
            const file = fileMap.get(response.questionId);
            if (file) {
              // Upload file to S3
              const uploadResult = await this.s3FileUpload.uploadFile(
                file.buffer,
                file.originalname,
                file.mimetype,
                'std-asset'
              );

              // Update response with file metadata
              const fileUrlObj = new URL(uploadResult.url);
              const fileMetadata = {
                url: fileUrlObj.pathname, // Store relative path (e.g., /std-asset/...)
                originalname: file.originalname,
                mimetype: file.mimetype,
                size: file.size
              };
              response.fileUrl = uploadResult.url;
              response.fileName = file.originalname;
              response.fileSize = file.size;
              response.answer = fileMetadata; // Set answer to the file metadata object
            }
          }
        }
      }

      // Build CTA response object with conditional forum field
      const ctaResponseData: any = {
        asset: new Types.ObjectId(submitCtaResponseDto.assetId),
        plugin: plugin._id, // Use the actual ObjectId from the plugin document
        user: new Types.ObjectId(userId),
        responses: submitCtaResponseDto.responses,
        submittedAt: new Date()
      };

      // Add the appropriate forum field based on forum type (convert to ObjectId)
      if (submitCtaResponseDto.forum === 'club') {
        ctaResponseData.club = new Types.ObjectId(submitCtaResponseDto.forumId);
      } else if (submitCtaResponseDto.forum === 'chapter') {
        ctaResponseData.chapter = new Types.ObjectId(submitCtaResponseDto.forumId);
      } else if (submitCtaResponseDto.forum === 'node') {
        ctaResponseData.node = new Types.ObjectId(submitCtaResponseDto.forumId);
      }

      // Create CTA response
      const ctaResponse = new this.stdCtaResponseModel(ctaResponseData);

      console.log('About to save CTA response with data:', {
        asset: ctaResponse.asset,
        user: ctaResponse.user,
        plugin: ctaResponse.plugin
      });

      await ctaResponse.save();

      console.log('CTA response saved successfully with ID:', ctaResponse._id);
      console.log('=== CTA SUBMISSION END ===');

      return {
        success: true,
        data: ctaResponse,
        message: 'Application submitted successfully'
      };
    } catch (error) {
      console.error('CTA Response Submission Error :: ', error);
      throw error;
    }
  }

  async getCtaResponsesByAsset(assetId: string, userId: string) {
    try {
      // Verify user has permission to view responses (e.g., asset creator)
      const asset = await this.standardAssetModel.findById(assetId);
      if (!asset) throw new NotFoundException('Asset not found');

      // Only asset creator can view responses
      if (asset.createdBy.toString() !== userId) {
        throw new ForbiddenException('You do not have permission to view these responses');
      }

      const responses = await this.stdCtaResponseModel
        .find({ asset: assetId })
        .populate('user', 'firstName lastName email profileImage')
        .populate('club', 'name profileImage')
        .populate('chapter', 'name profileImage')
        .populate('node', 'name profileImage')
        .sort({ submittedAt: -1 });

      return {
        success: true,
        data: responses,
        message: 'CTA responses fetched successfully'
      };
    } catch (error) {
      console.error('Get CTA Responses Error :: ', error);
      throw error;
    }
  }
}