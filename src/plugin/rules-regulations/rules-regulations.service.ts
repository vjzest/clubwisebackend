import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotAcceptableException,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { RulesRegulations } from '../../shared/entities/rules/rules-regulations.entity';
import { UploadService } from '../../shared/upload/upload.service';
import { ClubMembers } from '../../shared/entities/clubmembers.entity';
import { NodeMembers } from '../../shared/entities/node-members.entity';
import { RulesOffenseReports } from '../../shared/entities/rules/report-offense.entity';
import { Club } from '../../shared/entities/club.entity';
import { Node_ } from '../../shared/entities/node.entity';
import { ProposeRulesAndRegulation } from '../../shared/entities/propose-rulesAndRegulations';
import { ChapterRuleRegulations } from '../../shared/entities/chapters/modules/chapter-rule-regulations.entity';
import { ChapterMember } from '../../shared/entities/chapters/chapter-member.entity';
import { ChapterModule } from '../../user/chapter/chapter.module';
import { TForum } from 'typings';
import { Comment } from '../../shared/entities/comment.entity';
import { Chapter } from '../../shared/entities/chapters/chapter.entity';
import { CommonService } from '../common/common.service';
import { AssetsService } from '../../assets/assets.service';
import { RulesAdoption } from '../../shared/entities/rules/rules-adoption.entity';

interface FileObject {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}
// Interface for the file object
export interface IFileObject {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}
@Injectable()
export class RulesRegulationsService {
  constructor(
    @InjectModel(RulesRegulations.name) private readonly rulesRegulationModel: Model<RulesRegulations>,
    @InjectModel(RulesAdoption.name) private readonly rulesAdoptionModel: Model<RulesAdoption>,
    private readonly s3FileUpload: UploadService,
    @InjectModel(ClubMembers.name) private readonly clubMembersModel: Model<ClubMembers>,
    @InjectModel(ChapterMember.name) private readonly chapterMembersModel: Model<ChapterModule>,
    @InjectModel(NodeMembers.name) private readonly nodeMembersModel: Model<NodeMembers>,
    @InjectModel(Club.name) private readonly clubModel: Model<Club>,
    @InjectModel(Node_.name) private readonly nodeModel: Model<Node_>,
    @InjectModel(RulesOffenseReports.name)
    private readonly rulesOffenseReportsModel: Model<RulesOffenseReports>,
    @InjectModel(ProposeRulesAndRegulation.name)
    private readonly ProposeRulesAndRegulationModel: Model<ProposeRulesAndRegulation>,
    @InjectModel(ChapterRuleRegulations.name)
    private readonly chapterRuleRegulationsModel: Model<ChapterRuleRegulations>,
    @InjectModel(Comment.name) private readonly commentModel: Model<Comment>,
    @InjectConnection() private connection: Connection,
    @InjectModel(Chapter.name) private readonly chapterModel: Model<Chapter>,
    private readonly commonService: CommonService,
    private readonly assetsService: AssetsService,
  ) { }

  async getRules({
    page = 1,
    limit = 10,
    search,
    forum,
    forumId,
    type,
    userId
  }: {
    page?: number;
    limit?: number;
    search?: string;
    forum?: TForum;
    forumId?: string;
    type?: 'all' | 'active' | 'proposed' | 'global';
    userId: string;
  }) {
    try {
      let isPublic = false;
      let isPluginArchived = false;
      if (forum === 'club') {
        const forumData = await this.clubModel.findOne({ _id: new Types.ObjectId(forumId) }).lean().exec();
        isPublic = forumData?.isPublic || false;
        const rulePlugin = forumData?.plugins?.find((plugin: any) => plugin.plugin === 'rules');
        isPluginArchived = rulePlugin?.isArchived || false;
      } else if (forum === 'node') {
        const forumData = await this.nodeModel.findOne({ _id: new Types.ObjectId(forumId) }).lean().exec();
        const rulePlugin = forumData?.plugins?.find((plugin: any) => plugin.plugin === 'rules');
        isPluginArchived = rulePlugin?.isArchived || false;
      }

      if (isPluginArchived) {
        throw new ForbiddenException('You are not authorized to access this resource');
      }

      const { isMember, role } = await this.commonService.getUserDetailsInForum({ forum, forumId, userId });
      if (!isMember && !isPublic && type !== 'global') {
        throw new ForbiddenException('You are not authorized to access this resource');
      }

      const skip = (page - 1) * limit;
      const baseQuery: any = { isDeleted: false, isArchived: { $ne: true } };
      const adoptedQuery: any = {};

      if (forum && forumId) {
        baseQuery[forum] = new Types.ObjectId(forumId);
        adoptedQuery[forum] = new Types.ObjectId(forumId);
      }

      // Common population options
      const userPopulate = {
        path: 'createdBy',
        select: '_id email firstName lastName profileImage isAdmin userName',
        strictPopulate: false
      };

      const chapterPopulate = {
        path: 'chapter',
        select: 'name about domain profileImage coverImage',
        strictPopulate: false
      };

      const clubPopulate = {
        path: 'club',
        select: 'name about domain profileImage coverImage isPublic',
        strictPopulate: false
      };

      const nodePopulate = {
        path: 'node',
        select: 'name about domain profileImage coverImage',
        strictPopulate: false
      };

      switch (type) {
        case 'all':
          // baseQuery.publishedStatus = { $in: ['published', 'inactive'] };
          // baseQuery.$or = [
          //   { publishedStatus: { $in: ['published', 'inactive'] } },
          //   { $and: [{ publishedStatus: 'draft' }, { createdBy: userId }] },
          // ];
          adoptedQuery.publishedStatus = { $in: ['published', 'archived'] };
          if (['admin', 'owner']?.includes(role)) {
            baseQuery.publishedStatus = { $in: ['published', 'inactive', 'draft'] };
            delete baseQuery?.isArchived;
            adoptedQuery.publishedStatus = { $in: ['published', 'archived', 'proposed'] };
          } else {
            baseQuery.$or = [
              { publishedStatus: { $in: ['published', 'inactive'] } },
              { $and: [{ publishedStatus: 'draft' }, { createdBy: userId }] },
            ];
          }
          break;
        case 'active':
          baseQuery.publishedStatus = 'published';
          adoptedQuery.publishedStatus = 'published';
          break;
        case 'proposed':
          baseQuery.publishedStatus = 'proposed';
          adoptedQuery.publishedStatus = 'proposed';
          break;
        case 'global':
          baseQuery.publishedStatus = 'published';
          baseQuery.isPublic = true;
          delete baseQuery[forum];
          baseQuery.rootParent = { $exists: false };
          baseQuery.creationType = { $ne: 'adopted' };

          const [data, total] = await Promise.all([
            this.rulesRegulationModel.find(baseQuery)
              .populate(userPopulate)
              .populate(clubPopulate)
              .populate(nodePopulate)
              .populate(chapterPopulate)
              .sort({ createdAt: -1 })
              .skip(skip)
              .limit(limit)
              .lean(),
            this.rulesRegulationModel.countDocuments(baseQuery)
          ]);

          const transformedData = data.map(rule => this.transformRule(rule));
          return {
            data: transformedData,
            pagination: {
              total,
              page: Number(page),
              limit: Number(limit),
              totalPages: Math.ceil(total / limit),
              hasNextPage: page * limit < total,
              hasPreviousPage: page > 1
            }
          };
      }

      if (search?.trim()) {
        const searchRegex = new RegExp(search, 'i');
        baseQuery.$or = [
          { title: searchRegex },
          { description: searchRegex },
          { category: searchRegex },
          { significance: searchRegex },
          { tags: searchRegex }
        ];
      }

      // Fetch both original and adopted rules
      const [originalRules, adoptedRules] = await Promise.all([
        this.rulesRegulationModel.find(baseQuery)
          .populate(userPopulate)
          .populate(clubPopulate)
          .populate(nodePopulate)
          .populate(chapterPopulate)
          .sort({ createdAt: -1 })
          .lean(),
        this.rulesAdoptionModel.find(adoptedQuery)
          .populate({
            path: 'rule',
            match: { isDeleted: false, isArchived: { $ne: true } },
            populate: [userPopulate, clubPopulate, nodePopulate, chapterPopulate]
          })
          .populate({
            path: 'proposedBy acceptedBy',
            // select: '_id email firstName lastName profileImage isAdmin username'
            select: userPopulate.select
          })
          .sort({ createdAt: -1 })
          .lean()
      ]);

      // Process adopted rules
      const validAdoptedRules = adoptedRules
        .filter((ar: any) => ar.rule)
        .map((adoptedRule: any) => {
          const rule = adoptedRule.rule;
          return {
            ...rule,
            createdAt: adoptedRule.createdAt,
            updatedAt: adoptedRule.updatedAt,
            proposedBy: adoptedRule.proposedBy,
            acceptedBy: adoptedRule.acceptedBy,
            publishedStatus: adoptedRule.publishedStatus,
            [forum]: adoptedRule[forum],
            _isAdopted: true,
            _adoptionId: adoptedRule._id,
            _adoptionData: {
              message: adoptedRule.message,
              statusHistory: adoptedRule.statusHistory
            }
          };
        });

      // Combine and sort all rules
      const allRules = [...originalRules, ...validAdoptedRules]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      // Apply pagination
      const total = allRules.length;
      const paginatedRules = allRules.slice(skip, skip + limit);

      // Transform the final results
      const transformedData = paginatedRules.map(rule => this.transformRule(rule));

      return {
        data: transformedData,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(total / limit),
          hasNextPage: page * limit < total,
          hasPreviousPage: page > 1
        }
      };
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof ForbiddenException) {
        throw error;
      }
      console.error('Error in getRules:', error);
      throw new InternalServerErrorException('Failed to get rules and regulations');
    }
  }

  private transformRule(rule: any) {
    const ruleObj = rule?.toObject ? rule.toObject() : rule;
    return {
      ...ruleObj
    };
  }



  async getAllChapterRules(
    page: number = 1,
    limit: number = 10,
    search: string = '',
    chapter: Types.ObjectId,
    userId: string
  ) {
    try {
      let { isMember } = await this.commonService.getUserDetailsInForum({ forum: "chapter", forumId: String(chapter), userId });
      if (!isMember) throw new BadRequestException('You are not authorized to access this resource');

      const skip = (page - 1) * limit;

      // Build base query
      const baseQuery: any = {
        chapter: new Types.ObjectId(chapter)  // First filter by chapter
      };

      // Add search conditions if search string is provided
      if (search && search.trim()) {
        const searchRegex = new RegExp(search.trim(), 'i');
        baseQuery.$or = [
          { title: searchRegex },
          { description: searchRegex },
          { category: searchRegex },
          { significance: searchRegex },
          { tags: searchRegex }
        ];
      }

      // Execute query for data
      const data = await this.rulesRegulationModel
        .find(baseQuery).populate({
          path: 'createdBy',
          select: '-password',
        }).populate({
          path: 'node',
          select: 'name about domain profileImage coverImage  '
        }).populate({
          path: 'club',
          select: 'name about domain profileImage coverImage isPublic '
        }).populate({
          path: 'chapter',
          select: 'name about domain profileImage coverImage '
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec();

      // Get total count for pagination
      const total = await this.rulesRegulationModel
        .countDocuments(baseQuery);

      return {
        data,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      throw new BadRequestException(
        'Error while fetching rules and regulations',
        error,
      );
    }
  }


  async getAllClubRulesWithChapterId(
    page: number,
    limit: number,
    isActive: boolean,
    search: string,
    userId: string,
    chapterId?: Types.ObjectId
  ): Promise<any> {
    try {

      let { isMember } = await this.commonService.getUserDetailsInForum({ forum: "chapter", forumId: String(chapterId), userId: String(userId) });
      if (!isMember) throw new ForbiddenException('You are not authorized to access this resource');


      // Build the base query
      let query: any = {};
      if (chapterId) {
        query.chapter = new Types.ObjectId(chapterId);
      }

      // Add search conditions to the rules regulations match
      let rulesMatch: any = { publishedStatus: 'published', isArchived: false, isDeleted: false, isPublic: true };
      if (search?.trim()) {
        const searchRegex = new RegExp(search.trim(), 'i');
        rulesMatch.$or = [
          { title: searchRegex },
          { description: searchRegex },
          { category: searchRegex },
          { significance: searchRegex },
          { tags: searchRegex }
        ];
      }

      // Get all matching documents first (without pagination)
      const allChapterRules = await this.chapterRuleRegulationsModel
        .find(query)
        .populate({
          path: 'rulesRegulation',
          match: rulesMatch,
          strictPopulate: false,
          populate: [
            {
              path: 'node', select: 'name profileImage',
              strictPopulate: false
            },
            {
              path: 'club', select: 'name profileImage',
              strictPopulate: false
            },
            {
              path: 'createdBy', select: 'userName profileImage firstName lastName',
              strictPopulate: false
            }
          ]
        })
        .populate('chapter', 'name profileImage')
        .sort({ createdAt: -1 })
        .lean()

      // Filter out nulls and get actual total
      const filteredRules = allChapterRules.filter(rule => rule.rulesRegulation !== null);
      const total = filteredRules.length;

      // Apply pagination to filtered rules
      const start = (page - 1) * limit;
      const paginatedRules = filteredRules.slice(start, start + limit);

      // Transform chapter Rules
      const transformedChapterRules = paginatedRules.map((cp: any) => ({
        ...cp.rulesRegulation,
        chapter: cp.chapter,
        chapterRuleId: cp._id,
        type: "chapter",
        createdAt: cp.createdAt
      }));

      return {
        data: transformedChapterRules,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
          hasNextPage: page < Math.ceil(total / limit),
          hasPrevPage: page > 1
        }
      };
    } catch (error) {
      console.error('chap err', { error });
      if (error instanceof BadRequestException) throw error
      throw new BadRequestException(
        'Failed to get all club rules. Please try again later.',
      );
    }
  }

  async createRulesRegulations(dto: any, userId: Types.ObjectId) {
    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      const { forum, forumId } = this.getForumDetails(dto);

      const { isMember, userDetails } =
        await this.commonService.getUserDetailsInForum({
          forum,
          forumId,
          userId: String(userId),
        });

      if (!isMember) throw new BadRequestException("Unauthorized");

      const publishedStatus = this.determinePublishedStatus(
        userDetails.role,
        dto.publishedStatus,
      );

      if (publishedStatus === "published") {
        await this.assetsService.checkAndIncrement(userId, session);
      }

      // --- Draft Update Path ---
      if (dto.ruleId) {
        const draftRule = await this.updateDraft(dto, publishedStatus, session);
        await session.commitTransaction();
        return {
          data: draftRule,
          success: true,
          message: "Rules & Regulations draft saved successfully",
        };
      }

      // --- New Rule Creation Path ---
      const files = await this.processFiles(dto.files);

      const savedRule = await this.createNewRule(
        dto,
        userId,
        userDetails,
        publishedStatus,
        files,
        session,
      );

      // Propagate to chapters if club rule is published
      if (dto.club && savedRule.publishedStatus !== "draft") {
        await this.propagateToChapters(dto.club, savedRule, session);
      }

      // Create feed if published
      if (savedRule.publishedStatus === "published") {
        await this.assetsService.createFeed(
          savedRule.club || savedRule.node || savedRule.chapter,
          savedRule.club ? "Club" : savedRule.node ? "Node" : "Chapter",
          "RulesRegulations",
          savedRule._id as any,
        );
      }

      await session.commitTransaction();
      return {
        data: savedRule,
        success: true,
        message:
          userDetails.role === "member"
            ? "Successfully proposed rules and regulations"
            : "Rules & Regulations created successfully",
      };
    } catch (err) {
      console.log(err)
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  }

  private getForumDetails(dto: any): { forum: TForum, forumId: string } {
    if (dto.node) return { forum: "node", forumId: dto.node };
    if (dto.club) return { forum: "club", forumId: dto.club };
    return { forum: "chapter", forumId: dto.chapter };
  }

  private determinePublishedStatus(userRole: string, requestedStatus?: string) {
    if (requestedStatus === "draft") return "draft";
    if (userRole === "member") return "proposed";
    return "published";
  }

  private async processFiles(files: FileObject[] = [], deletedUrls: string[] = []) {
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

  private async updateDraft(dto: any, publishedStatus: string, session: any) {
    const existingDraft = await this.rulesRegulationModel.findOne({
      _id: dto.ruleId,
      publishedStatus: "draft",
    });

    if (!existingDraft) throw new BadRequestException("Draft rule not found");

    const sanitizedDeletedUrls = JSON.parse(dto?.deletedImageUrls || "[]");

    if (sanitizedDeletedUrls.length > 0) {
      const existingFiles = existingDraft?.files || []
      const filteredFiles = existingFiles.filter((file: any) => !sanitizedDeletedUrls?.includes(file.url))
      const combineLength = filteredFiles?.length || 0 + dto?.files?.length || 0
      if (combineLength > 5) throw new BadRequestException("You can upload maximum 5 files")
    }

    const newFiles = await this.processFiles(dto.files, sanitizedDeletedUrls);

    // Max 5 file check
    const combinedFiles = [
      ...(existingDraft.files || []).filter(
        (f: any) => !sanitizedDeletedUrls?.includes(f.url),
      ),
      ...newFiles,
    ];
    // if (combinedFiles.length > 5)
    //   throw new BadRequestException("You can upload maximum 5 files");


    if (dto?.node) delete dto.node
    if (dto?.club) delete dto.club
    if (dto?.chapter) delete dto.chapter

    return await this.rulesRegulationModel.findByIdAndUpdate(
      new Types.ObjectId(dto.ruleId),
      {
        ...dto,
        files: combinedFiles,
        tags: JSON.parse(dto.tags || "[]"),
        domain: JSON.parse(dto.domain || "[]"),
        publishedStatus,
      },
      { new: true, session },
    );
  }

  private async createNewRule(
    dto: any,
    userId: Types.ObjectId,
    userDetails: any,
    publishedStatus: string,
    files: any[],
    session: any,
  ) {
    const dataToSave = {
      ...dto,
      createdBy: userId,
      publishedStatus,
      node: dto.node ? new Types.ObjectId(dto.node) : null,
      club: dto.club ? new Types.ObjectId(dto.club) : null,
      chapter: dto.chapter ? new Types.ObjectId(dto.chapter) : null,
      tags: JSON.parse(dto.tags || "[]"),
      domain: JSON.parse(dto.domain || "[]"),
      isActive: userDetails.role !== "member",
      files,
      publishedDate: publishedStatus === "published" ? new Date() : null,
    };

    const newRule = new this.rulesRegulationModel(dataToSave);
    return await newRule.save({ session });
  }

  private async propagateToChapters(clubId: Types.ObjectId, savedRule: any, session: any) {
    const chapters = await this.chapterModel
      .find({
        club: new Types.ObjectId(clubId),
        status: "published",
        isDeleted: false,
      })
      .session(session);

    if (chapters.length > 0) {
      const chapterRules = chapters.map((chapter) => ({
        chapter: chapter._id,
        rulesRegulation: savedRule._id,
        publishedStatus: "published",
      }));

      await this.chapterRuleRegulationsModel.insertMany(chapterRules, { session });
    }
  }

  //-----------------------------------------------------------

  /*-----------------SAVE TO DRAFT RULES AND RUGULATIONS*/
  async saveToDraft(createRulesRegulationsDto) {
    const { files: files, node, club, ...restData } = createRulesRegulationsDto;

    //creating promises to upload to S3 bucket
    const uploadPromises = files.map((file: FileObject) =>
      this.uploadFile({
        buffer: file.buffer,
        originalname: file.originalname,
        mimetype: file.mimetype,
      } as Express.Multer.File),
    );
    // calling all promises and storing
    const uploadedFiles = await Promise.all(uploadPromises);

    //creating file object to store it in the db with proper type
    const fileObjects = uploadedFiles.map((uploadedFile, index) => ({
      url: uploadedFile.url,
      originalname: files[index].originalname,
      mimetype: files[index].mimetype,
      size: files[index].size,
    }));

    try {
      //creating rules and regulations -DB
      const newRulesRegulations = new this.rulesRegulationModel({
        ...restData,
        node: node ? new Types.ObjectId(node) : null,
        club: club ? new Types.ObjectId(club) : null,
        files: fileObjects,
      });

      const response = await newRulesRegulations.save();
      return { data: response, message: 'Saved to draft', success: true }
    } catch (error) {
      ({ error });
      throw new InternalServerErrorException(
        'Error while creating rules-regulations',
        error,
      );
    }
  }
  /* ---------------------UPDATE RULES AND REGULATIONS
  @Params :updateRulesRegulationDto
  @return :UpdatedRulesRegulations */

  async updateRulesRegulations(
    dataToSave: any,
    userId: Types.ObjectId,
    updateFiles,
  ) {
    try {
      // Find the current version
      const currentVersion = await this.rulesRegulationModel.findById(
        dataToSave._id,
      );

      if (!currentVersion) {
        throw new Error('Document not found');
      }

      const { tags, files, ...restData } = dataToSave;

      // Parse and validate `tags`
      let parsedTags = tags;
      if (typeof tags === 'string') {
        try {
          parsedTags = JSON.parse(tags); // Parse if tags is a JSON string
        } catch (error) {
          console.error('Error parsing tags:', error);
          throw new BadRequestException('Invalid format for tags');
        }
      }

      if (!Array.isArray(parsedTags)) {
        throw new BadRequestException('Tags must be an array');
      }

      // Handle file uploads
      const uploadedFiles = await Promise.all(
        updateFiles.map((singlefile) => this.uploadFile(singlefile)),
      );

      // Create file objects
      const fileObjects = uploadedFiles.map((uploadedFile, index) => ({
        url: uploadedFile.url,
        originalname: uploadedFile.originalname,
        mimetype: uploadedFile.mimetype,
        size: uploadedFile.size,
      }));

      // Merging older files with new files
      const mergedFiles = [...(files ?? []), ...fileObjects];

      if (currentVersion.publishedStatus === 'draft') {
        const updateData = await this.rulesRegulationModel.findByIdAndUpdate(
          dataToSave._id,
          {
            $set: {
              tags: parsedTags, // Ensure tags is saved as an array
              ...restData, // Spread the rest of the data
              files: mergedFiles,
            },
          },
          { new: true, runValidators: true },
        );
        return updateData;
      } else {
        // Create a version object from the current document
        const versionObject = {
          ...currentVersion.toObject(),
          version: currentVersion.version || 1,
          files: mergedFiles,
        };

        // Update the current document with new data
        const updatedDocument =
          await this.rulesRegulationModel.findByIdAndUpdate(
            dataToSave._id,
            {
              $set: {
                ...restData,
                tags: parsedTags, // Ensure tags is saved as an array
                version: (currentVersion.version || 1) + 1,
                publishedBy: userId,
                updatedDate: new Date(),
              },
              $push: {
                olderVersions: versionObject,
              },
            },
            { new: true, runValidators: true },
          );

        return updatedDocument;
      }
    } catch (error) {
      throw new InternalServerErrorException(
        'Error while updating rules-regulations',
        error,
      );
    }
  }


  /**
   * 
   * @param userId 
   * @param rulesId 
   * @param forumId 
   * @param forum 
   */
  async acceptProposedRulesAndRegulations(
    userId: Types.ObjectId,
    rulesId: Types.ObjectId,
    forumId: Types.ObjectId,
    forum: TForum,
    acceptOrReject: 'accept' | 'reject'
  ) {
    try {
      if (!userId || !rulesId || !forumId) {
        throw new BadRequestException('Missing required parameters');
      }

      const { isMember, role } = await this.commonService.getUserDetailsInForum({
        userId: userId.toString(),
        forumId: forumId.toString(),
        forum
      })

      // Check if user has membership
      if (!isMember) {
        throw new ForbiddenException(
          `User is not a member of this ${forum}`
        );
      }

      // Verify user has appropriate role
      if (!['admin', 'owner'].includes(role)) {
        throw new ForbiddenException(
          `Only 'admin' and 'owner' can accept rules and regulations`
        );
      }

      // Update rules status
      const updatedRules = await this.rulesRegulationModel.findByIdAndUpdate(
        rulesId,
        {
          publishedStatus: acceptOrReject === 'accept' ? 'published' : 'rejected',
          publishedBy: userId,
          updatedAt: new Date(),
          isActive: true
        },
        { new: true }
      );

      if (!updatedRules) {
        throw new BadRequestException('Rule not found');
      }

      // if(updatedRules?.publishedStatus === "published"){
      //   this.assetsService.createFeed(

      //   )
      // }

      return {
        success: true,
        message: `Rule ${acceptOrReject === 'accept' ? 'published' : 'rejected'} successfully for ${forum}`,
        data: updatedRules
      };
    } catch (error) {
      // Proper error handling with specific error types
      if (error instanceof BadRequestException ||
        error instanceof ForbiddenException) {
        throw error;
      }

      // Log unexpected errors
      console.error('Error in acceptProposedRulesAndRegulations:', error);
      throw new BadRequestException('Failed to accept rules and regulations');
    }
  }
  /*-------------------------GET ALL RULES AND REGULATION OF SINGLE CLUB OR NODE */


  async getAllActiveRulesRegulations(
    type: string,
    ID: Types.ObjectId,
    pageNumber: number = 1,
    limitNumber: number = 10,
    search: string
  ) {
    try {
      const forId = new Types.ObjectId(ID);
      const page = parseInt(pageNumber as any) || 1;
      const limit = parseInt(limitNumber as any) || 10;
      const skip = (page - 1) * limit;

      // Build the base query
      const baseQuery: any = { isActive: true };

      // Add type-specific condition
      if (type === 'club') {
        baseQuery.club = forId;
      } else if (type === 'node') {
        baseQuery.node = forId;
      }

      // Add search conditions if search string is provided
      if (search && search.trim()) {
        const searchRegex = new RegExp(search.trim(), 'i');
        baseQuery.$or = [
          { title: searchRegex },
          { description: searchRegex },
          { category: searchRegex },
          { significance: searchRegex },
          { tags: searchRegex }
        ];
      }

      // Execute query for data
      const query = this.rulesRegulationModel.find(baseQuery).populate({
        path: 'createdBy',
        select: '-password',
      });



      const response = await query
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec();

      // Get total count for pagination
      const total = await this.rulesRegulationModel
        .countDocuments(baseQuery);

      return {
        data: response,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      throw new InternalServerErrorException(
        'Error while getting active rules-regulations',
        error,
      );
    }
  }


  /*-------------------GET MY RULES
   @Req:user_id
   @eturn:RulesRegulations */
  async getMyRules(
    userId: Types.ObjectId,
    type: 'node' | 'club',
    entity: Types.ObjectId,
    page: number = 1,
    limit: number = 10,
    search: string = ''
  ) {
    try {
      const skip = (page - 1) * limit;

      // Build base query
      const baseQuery: any = {
        createdBy: userId,
        [type === 'club' ? 'club' : 'node']: new Types.ObjectId(entity)
      };

      // Add search conditions if search string is provided
      if (search && search.trim()) {
        const searchRegex = new RegExp(search.trim(), 'i');
        baseQuery.$or = [
          { title: searchRegex },
          { description: searchRegex },
          { category: searchRegex },
          { significance: searchRegex },
          { tags: searchRegex }
        ];
      }

      // Execute query for data
      const data = await this.rulesRegulationModel
        .find(baseQuery)
        .populate({
          path: 'createdBy',
          select: '-password',
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec();

      // Get total count for pagination
      const total = await this.rulesRegulationModel
        .countDocuments(baseQuery);

      return {
        data,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      throw new InternalServerErrorException(
        'Error while getting active rules-regulations',
        error,
      );
    }
  }

  async adoptRules(
    userId: Types.ObjectId,
    adoptForumDto: { rulesId: Types.ObjectId, node?: Types.ObjectId, club?: Types.ObjectId, proposalMessage: string }
  ) {
    const session = await this.connection.startSession();
    try {
      session.startTransaction();

      // Check if rule exists and is public
      const rule = await this.rulesRegulationModel.findById(adoptForumDto.rulesId).session(session);
      if (!rule) throw new NotFoundException('Rule not found');
      if (!rule.isPublic) throw new BadRequestException('You cannot adopt a private rule');

      // Validate forum type
      if ((adoptForumDto.club && adoptForumDto.node) || (!adoptForumDto.club && !adoptForumDto.node)) {
        throw new BadRequestException('Not a valid forum');
      }

      // Check if rule is already adopted
      const query = {
        rule: new Types.ObjectId(adoptForumDto.rulesId),
        [adoptForumDto.club ? 'club' : 'node']: new Types.ObjectId(adoptForumDto.club || adoptForumDto.node)
      };
      const isAdopted = await this.rulesAdoptionModel.findOne(query).session(session);
      if (isAdopted) {
        throw new BadRequestException(
          `Rule is already ${isAdopted.publishedStatus === 'published' ? 'adopted' : 'under proposal'} for this forum.`
        );
      }

      const { role, isMember } = await this.commonService.getUserDetailsInForum({
        userId: userId.toString(),
        forumId: (adoptForumDto.club || adoptForumDto.node).toString(),
        forum: adoptForumDto.club ? 'club' : 'node'
      });
      if (!isMember) throw new NotAcceptableException('You do not have permission to publish this action');

      const publishedStatus = ['admin', 'owner'].includes(role) ? 'published' : 'proposed';

      const adoptionData = {
        rule: new Types.ObjectId(adoptForumDto.rulesId),
        proposedBy: new Types.ObjectId(userId),
        ...(role !== 'member' && { acceptedBy: new Types.ObjectId(userId) }),
        ...(role === 'member' && { message: adoptForumDto.proposalMessage }),
        publishedStatus,
        node: adoptForumDto.node ? new Types.ObjectId(adoptForumDto.node) : null,
        club: adoptForumDto.club ? new Types.ObjectId(adoptForumDto.club) : null,
      };

      // Update adopted clubs or nodes
      const updateField = adoptForumDto.club ? 'adoptedClubs' : 'adoptedNodes';
      const updateValue = {
        [adoptForumDto.club ? 'club' : 'node']: new Types.ObjectId(adoptForumDto.club || adoptForumDto.node),
        date: new Date()
      };

      await this.rulesRegulationModel.findByIdAndUpdate(
        adoptForumDto.rulesId,
        { $push: { [updateField]: updateValue } },
        { session }
      );

      const adoptedRule = await this.rulesAdoptionModel.create([adoptionData], { session });

      if (adoptedRule[0].publishedStatus === 'published') {
        await this.assetsService.createFeed(
          adoptedRule[0].club || adoptedRule[0].node || adoptedRule[0].chapter,
          adoptedRule[0].club ? 'Club' : adoptedRule[0].node ? 'Node' : 'Chapter',
          'RulesRegulations',
          adoptedRule[0].rule,
          'RulesRegulationsAdoption',
          adoptedRule[0]._id,
        );
      }

      await session.commitTransaction();
      return {
        success: true,
        data: adoptedRule,
        message: 'Rule adopted successfully',
      };
    } catch (error) {
      await session.abortTransaction();
      console.log("RULE ADOPT Error :: ", error);
      throw new BadRequestException(error.message || 'Failed to adopt rule');
    } finally {
      session.endSession();
    }
  }

  async getClubsNodesNotAdopted(userId: Types.ObjectId, rulesId: Types.ObjectId) {
    try {
      // Check if rule exists
      const rule = await this.rulesRegulationModel.findById(rulesId);
      if (!rule) throw new NotFoundException('Rule not found');

      // Get original club/node/chapter that created the rule
      const createdInClub = rule.club?.toString();
      const createdInNode = rule.node?.toString();

      // Get all clubs and nodes where the user is a member (parallel execution)
      const [clubMemberships, nodeMemberships] = await Promise.all([
        this.clubMembersModel.find({
          user: userId,
          status: 'MEMBER'
        }).populate({
          path: 'club',
          select: 'name about domain profileImage coverImage isPublic',
          strictPopulate: false
        }).lean(),
        this.nodeMembersModel.find({
          user: userId,
          status: 'MEMBER'
        }).populate({
          path: 'node',
          select: 'name about domain profileImage coverImage',
          strictPopulate: false
        }).lean()
      ]);

      // Get all forums (clubs/nodes) that have already adopted this rule (parallel execution)
      const [adoptedClubs, adoptedNodes] = await Promise.all([
        this.rulesAdoptionModel.distinct('club', { rule: rulesId }).lean(),
        this.rulesAdoptionModel.distinct('node', { rule: rulesId }).lean()
      ]);

      // Convert to string IDs for easier comparison
      const adoptedClubIds = new Set(adoptedClubs.map(id => id?.toString()));
      const adoptedNodeIds = new Set(adoptedNodes.map(id => id?.toString()));

      // Filter and transform results
      const availableClubs = clubMemberships
        .filter(membership => membership.club && !adoptedClubIds.has(membership.club._id.toString()) && membership?.club?._id.toString() !== createdInClub)
        .map(({ club, role }) => ({ ...club, role }));

      const availableNodes = nodeMemberships
        .filter(membership => membership.node && !adoptedNodeIds.has(membership.node._id.toString()) && membership?.node?._id.toString() !== createdInNode)
        .map(({ node, role }) => ({ ...node, role }));

      return {
        nodes: availableNodes,
        clubs: availableClubs
      };
    } catch (error) {
      console.error('Error fetching available forums for rule:', error);
      throw error;
    }
  }

  // localhost:3000/node/6858fd3933134d6048934e59/chapters/686383c5266106e82e8273bd/rules/68429481916eeb6bea6b3792/view?type=adopted&adoptionld=686383c5266106e82e8273ca

  async getRule(ruleId: Types.ObjectId, requestFromForum: Types.ObjectId, forum: TForum, userId: Types.ObjectId, adoptionId: Types.ObjectId): Promise<{ commentCount: number; rule: any }> {
    try {

      let adoptedRule;
      if (adoptionId) {
        adoptedRule = await this.getAdaptedRule(String(adoptionId));

        if (adoptedRule) {
          const ruleForumId = String(adoptedRule?.node || adoptedRule?.club || adoptedRule?.chapter);
          if (ruleForumId !== String(requestFromForum)) {
            throw new ForbiddenException('You are not authorized to view this rule');
          }
        }
      }

      const rule = await this.rulesRegulationModel.findById(ruleId).populate({
        path: 'createdBy',
        select: 'userName firstName middleName lastName profileImage interests',
        strictPopulate: false
      }).populate({
        path: 'adoptedBy',
        select: 'userName firstName middleName lastName profileImage interests',
        strictPopulate: false
      }).populate({
        path: 'club',
        select: 'name about domain profileImage coverImage isPublic ',
        strictPopulate: false
      }).populate({
        path: 'node',
        select: 'name about domain profileImage coverImage isPublic ',
        strictPopulate: false
      }).populate({
        path: 'chapter',
        select: 'name about domain profileImage coverImage isPublic ',
        strictPopulate: false
      }).lean()


      // Prevent Other forums to access an asset that is not public
      const ruleForumId = rule?.chapter?._id || rule?.node?._id || rule?.club?._id;
      // console.log("ruleForumId", ruleForumId)
      // console.log("requestFromForum", requestFromForum)
      // console.log("rule.isPublic", rule.isPublic)
      if (String(ruleForumId) !== String(requestFromForum) && !rule.isPublic && !adoptionId) {
        throw new ForbiddenException('You are not authorized to view this rule');
      }

      const commentCount = await this.commentModel.countDocuments({
        "entity.entityId": adoptionId || ruleId,
        "entity.entityType": RulesRegulations.name,
        parent: null
      });


      const { isMember } = await this.commonService.getUserDetailsInForum({
        userId: String(userId),
        forumId: requestFromForum.toString(),
        forum
      });
      const { role } = await this.commonService.getUserDetailsInForum({
        userId: String(userId),
        forumId: String(rule?.chapter?._id || rule?.club?._id || rule?.node?._id),
        forum
      });

      let isForumPublic = false;
      if (forum === 'club') {
        const forumData = await this.clubModel.findById(requestFromForum);
        isForumPublic = forumData.isPublic;
      }

      if (rule.isArchived) {
        if (!['admin', 'owner'].includes(role) && String(rule?.createdBy?._id) !== String(userId)) {
          throw new ForbiddenException('You are not authorized to view this archived rule');
        }
      }

      if (!isMember && !isForumPublic) throw new ForbiddenException('You are not a member of this forum');
      let _rule = { ...rule, currentUserRole: role, isOwnerOfAsset: String(rule.createdBy._id) === String(userId) };

      return {
        commentCount,
        rule: _rule,
      }
    } catch (error) {
      throw error
    }
  }

  private async getAdaptedRule(adoptionId?: string) {
    if (adoptionId) {
      return await this.rulesAdoptionModel.findById(adoptionId)
        .populate({
          path: 'proposedBy',
          select: 'userName firstName middleName lastName profileImage interests',
          strictPopulate: false,
        })
        .lean();
    }
  }

  /*------------------LIKE RULES AND REGULATIONS
   */
  async likeRulesRegulations(
    userId: Types.ObjectId,
    rulesRegulationId: Types.ObjectId
  ) {
    try {
      // Check if the user has already liked it using MongoDB's query
      const existingEntry = await this.rulesRegulationModel.findOne({
        _id: rulesRegulationId,
        "relevant.user": userId, // Directly check if user exists in relevant array
      });

      if (existingEntry) {
        // If the user already liked it, remove their like
        await this.rulesRegulationModel.updateOne(
          { _id: rulesRegulationId },
          {
            $pull: { relevant: { user: userId } }, // Remove the user from relevant
          }
        );
        return { message: "Like removed successfully" };
      }

      // Add the user to relevant array without checking manually
      await this.rulesRegulationModel.updateOne(
        { _id: rulesRegulationId },
        {
          $push: { relevant: { user: userId, date: new Date() } }, // Push new entry
          $pull: { irrelevant: { user: userId } }, // Ensure they are removed from irrelevant
        }
      );

      return { message: "Liked successfully" };
    } catch (error) {
      throw new InternalServerErrorException(
        "Error while liking rules-regulations",
        error
      );
    }
  }


  //--------------UNLIKE RULES AND REGULATIONS
  async unlikeRulesRegulations(
    userId: Types.ObjectId,
    rulesRegulationId: Types.ObjectId
  ) {
    try {
      // Check if the user has already unliked using MongoDB's query
      const existingEntry = await this.rulesRegulationModel.findOne({
        _id: rulesRegulationId,
        "irrelevant.user": userId, // Check if user exists in irrelevant array
      });

      if (existingEntry) {
        // If the user already unliked it, remove their unlike
        await this.rulesRegulationModel.updateOne(
          { _id: rulesRegulationId },
          {
            $pull: { irrelevant: { user: userId } }, // Remove the user from irrelevant
          }
        );
        return { message: "Unlike removed successfully" };
      }

      // Add the user to irrelevant array with timestamp, and remove from relevant if exists
      await this.rulesRegulationModel.updateOne(
        { _id: rulesRegulationId },
        {
          $push: { irrelevant: { user: userId, date: new Date() } }, // Push new unlike
          $pull: { relevant: { user: userId } }, // Ensure they are removed from relevant
        }
      );

      return { message: "Unliked successfully" };
    } catch (error) {
      throw new InternalServerErrorException(
        "Error while unliking rules-regulations",
        error
      );
    }
  }


  //-----SOFT DELETE RULES AND REGULATIONS
  async softDeleteRulesRegulations(
    userId: Types.ObjectId,
    rulesRegulationId: Types.ObjectId,
  ) {
    try {
      // Check if the user is the admin
      const isAdmin = await this.rulesRegulationModel.findOne({
        _id: rulesRegulationId,
        createdBy: userId,
      });

      if (!isAdmin) {
        throw new BadRequestException(
          'You are not authorized to delete this rule',
        );
      }
      const response = await this.rulesRegulationModel.findByIdAndUpdate(
        rulesRegulationId,
        {
          $set: { isDeleted: true },
        },
        { new: true },
      );
      if (!response) {
        throw new NotFoundException('Rules regulation not found');
      }
      return { message: 'Rules deleted successfully', status: true };
    } catch (error) {
      throw new InternalServerErrorException(
        'Error while unliking rules-regulations',
        error,
      );
    }
  }

  //------------------REPORTS OFFENSE
  async reportOffense(
    userId: Types.ObjectId,
    reportData: {
      type: string;
      typeId: Types.ObjectId;
      reason: string;
      rulesID: Types.ObjectId;
      offenderID: string;
      offenderName: string
    },
    file: Express.Multer.File,
  ) {
    try {
      let proof
      if (file) {
        const uploadedFile = await this.uploadFile(file);
        proof = {
          url: uploadedFile.url,
          originalname: uploadedFile.filename,
          mimetype: file.mimetype,
        }
      }

      const newOffense = new this.rulesOffenseReportsModel({
        offender: reportData.offenderID ? new Types.ObjectId(reportData.offenderID) : undefined,
        reportedBy: userId,
        reason: reportData.reason,
        rulesId: new Types.ObjectId(reportData.rulesID),
        proof,
        clubOrNode: reportData.type === 'club' ? Club.name : Node_.name,
        clubOrNodeId: new Types.ObjectId(reportData.typeId),
        offenderName: reportData.offenderName
      });
      return await newOffense.save();
    } catch (error) {
      console.error({ error })
      throw new InternalServerErrorException(
        'Error while reporting offense',
        error,
      );
    }
  }

  //---------------GET ALL REPORTS
  async getAllReportOffence(
    clubId: Types.ObjectId,
    type: TForum,
    page: number = 1,
    limit: number = 10,
    userId: string,
  ) {
    try {
      let { isMember } = await this.commonService.getUserDetailsInForum({ forum: type, forumId: String(clubId), userId });
      if (!isMember) throw new BadRequestException('You are not authorized to access this resource');

      const skip = (page - 1) * limit;

      const [results, total] = await Promise.all([
        this.rulesOffenseReportsModel
          .find({
            clubOrNode: type === 'club' ? Club.name : Node_.name,
            clubOrNodeId: new Types.ObjectId(clubId),
          })
          .populate({
            path: 'offender',
            select: 'userName firstName middleName lastName profileImage interests',
            strictPopulate: false
          })
          .populate({
            path: 'reportedBy',
            select: 'userName firstName middleName lastName profileImage interests',
            strictPopulate: false
          })
          .populate('rulesId')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),

        this.rulesOffenseReportsModel.countDocuments({
          clubOrNode: type === 'club' ? Club.name : Node_.name,
          clubOrNodeId: new Types.ObjectId(clubId),
        })
      ]);

      return {
        results,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          // itemsPerPage: limit,
          // hasNextPage: page < Math.ceil(total / limit),
          // hasPreviousPage: page > 1
        }
      };
    } catch (error) {
      if (error instanceof BadRequestException)
        throw error;
      else throw new InternalServerErrorException(
        'Error while getting all reports',
        error,
      );
    }
  }

  /* -------------CRATE VIEWS FOR THE RULES AND REGULATIONS */
  async createViewsForRulesAndRegulations(
    userId: Types.ObjectId,
    rulesRegulationId: Types.ObjectId,
  ) {

    try {
      const rulesRegulation = await this.rulesRegulationModel.findOne({
        _id: rulesRegulationId,
        'views.user': userId
      });


      if (rulesRegulation) {
        throw new BadRequestException(
          'User has already viewed this rules regulation',
        );
      }

      const updatedRulesRegulation = await this.rulesRegulationModel
        .findByIdAndUpdate(
          rulesRegulationId,
          {
            $addToSet: { views: { user: userId } },
          },
          { new: true },
        )
        .exec();

      if (!updatedRulesRegulation) {
        throw new NotFoundException('Rules regulation not found');
      }

      return { message: 'Viewed successfully' };
    } catch (error) {
      throw new InternalServerErrorException(
        'Error while viewing rules-regulations',
        error,
      );
    }
  }

  /**
   * Propose rules for the club
   * @param req - Express request object
   * @param commentId - ID of the comment to delete
   * @returns Promise containing the result of comment deletion
   */

  async proposeRules(userId: string, data): Promise<ProposeRulesAndRegulation> {
    try {
      // Validate required fields
      if (!userId || !data.club || !data.rulesAndRegulation) {
        throw new BadRequestException('Required fields are missing');
      }

      // Convert string IDs to ObjectId
      const clubId =
        typeof data.club === 'string'
          ? new Types.ObjectId(data.club)
          : data.club;
      const rulesId =
        typeof data.rulesAndRegulation === 'string'
          ? new Types.ObjectId(data.rulesAndRegulation)
          : data.rulesAndRegulation;
      const userObjectId =
        typeof userId === 'string' ? new Types.ObjectId(userId) : userId;

      // Create new proposal
      const newProposal = await this.ProposeRulesAndRegulationModel.create({
        club: clubId,
        proposedBy: userObjectId,
        rulesAndRegulation: rulesId,
        status: 'pending',
      });

      // returning newly created proposal
      const populatedProposal = await newProposal.populate([
        { path: 'club' },
        { path: 'proposedBy' },
        { path: 'rulesAndRegulation' },
      ]);

      return populatedProposal;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      if (error.name === 'ValidationError') {
        throw new BadRequestException(error.message);
      }
      if (error.name === 'CastError') {
        throw new BadRequestException('Invalid id format');
      }
      throw new Error(`Failed to propose rules: ${error.message}`);
    }
  }

  /**
   * Get all the clubs and node of the user with role of the user
   * @returns Promise containing the result of the data
   */
  async getAllClubsAndNodesWithRole(userId: Types.ObjectId) {
    try {
      const clubResponse = await this.clubMembersModel
        .find({ user: userId, status: 'MEMBER' })
        .populate(Club.name);

      const nodeResponse = await this.nodeMembersModel
        .find({ user: userId })
        .populate(Node.name);

      return {
        data: { clubResponse, nodeResponse },
        status: true,
        message: 'Club fetched successfully',
      };
    } catch (error) {
      throw new BadRequestException('Something went wrong');
    }
  }

  async getChapterAllClubRules(chapterId: string) {
    try {
      if (!chapterId) {
        throw new BadRequestException('Chapter id is required');
      }

      const rulesByChapter = await this.ProposeRulesAndRegulationModel.aggregate([
        {
          $match: {
            chapter: new Types.ObjectId(chapterId)
          }
        },
        {
          $lookup: {
            from: 'rulesregulations',
            localField: 'rulesRegulation',
            foreignField: '_id',
            as: 'rule'
          }
        },
        {
          $unwind: '$rule'
        },
        {
          $replaceRoot: {
            newRoot: '$rule'
          }
        }
      ]);

      return rulesByChapter;

    } catch (error) {
      console.error('error in get chapter all club rules', error);
      if (error instanceof BadRequestException) throw error
      throw new Error('Something went wrong');
    }
  }

  //------------------------
  //handling file uploads
  private async uploadFile(file: Express.Multer.File) {
    try {
      //uploading file
      const response = await this.s3FileUpload.uploadFile(
        file.buffer,
        file.originalname,
        file.mimetype,
        'club',
      );
      return response;
    } catch (error) {
      throw new BadRequestException(
        'Failed to upload file. Please try again later.',
      );
    }
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

  async togglePublicPrivate(
    rulesId: string,
    userId: string,
    isPublic: boolean
  ) {
    try {
      const existingRule = await this.rulesRegulationModel.findOne({
        _id: rulesId,
      });
      const { isMember, role } = await this.commonService.getUserDetailsInForum({
        forum: existingRule?.club ? 'club' : existingRule?.node ? 'node' : 'chapter',
        forumId: String(existingRule?.club || existingRule?.node || existingRule?.chapter),
        userId: String(userId)
      });

      if (!existingRule || !isMember || ['member', 'moderator'].includes(role)) {
        throw new ForbiddenException('You are not authorized to update this rule');
      }

      const updatedRule = await this.rulesRegulationModel.findByIdAndUpdate(
        rulesId,
        {
          $set: { isPublic },
        },
        { new: true }
      ).populate({
        path: 'createdBy',
        select: 'userName firstName middleName lastName profileImage interests',
        strictPopulate: false
      })

      return updatedRule;
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      throw new InternalServerErrorException(
        'Error while updating rules-regulations',
        error,
      );
    }
  }

  async archiveRule(ruleId: string, userId: Types.ObjectId, action: 'archive' | 'unarchive') {
    try {
      const rule = await this.rulesRegulationModel.findByIdAndUpdate(
        new Types.ObjectId(ruleId),
        { isArchived: action === 'archive' },
        { new: true }
      );

      if (rule) {
        await this.assetsService.updateFeed(rule._id.toString(), rule?.isArchived ? 'archived' : 'published')
      }


      return { status: true, message: 'Rule archived successfully', data: rule };
    } catch (error) {
      throw new BadRequestException('Error while archiving rule', error);
    }
  }

  async viewRule(ruleId: string, userId: Types.ObjectId) {
    try {
      const rule = await this.rulesRegulationModel.findById(ruleId);
      if (!rule) {
        throw new NotFoundException('Rule not found');
      }
      return rule;
    } catch (error) {
      throw new BadRequestException('Error while viewing rule', error);
    }
  }

  async deleteRule(ruleId: string, userId: Types.ObjectId) {
    try {
      const rule = await this.rulesRegulationModel.findById(ruleId);
      if (!rule) {
        throw new NotFoundException('Rule not found');
      }

      if (rule?.isPublic) {
        throw new BadRequestException('Public Rule is cannot be deleted');
      }

      const { isMember, role } = await this.commonService.getUserDetailsInForum({
        forum: rule?.club ? 'club' : rule?.node ? 'node' : 'chapter',
        forumId: String(rule?.club || rule?.node || rule?.chapter),
        userId: String(userId)
      });

      if (!isMember || (['member', 'moderator'].includes(role) && rule?.createdBy.toString() !== userId.toString())) {
        throw new ForbiddenException('You are not authorized to delete this rule');
      }

      // soft delete rule
      await this.rulesRegulationModel.findByIdAndUpdate(ruleId, { $set: { isDeleted: true } });

      // update feed status to deleted
      await this.assetsService.updateFeed(ruleId, 'deleted');

      return { status: true, message: 'Rule deleted successfully' };
    } catch (error) {
      console.error("Rule DELETE Error :: ", error);
      if (error instanceof ForbiddenException) throw error;
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        'Error while deleting Rule',
        error,
      );
    }
  }

  async removeAdoption(adoptionId: string, action: 'removeadoption' | 're-adopt', userId: Types.ObjectId) {
    try {
      const adoption = await this.rulesAdoptionModel.findById(adoptionId);
      if (!adoption) {
        throw new NotFoundException('Adoption not found');
      }

      const { isMember, role } = await this.commonService.getUserDetailsInForum({
        forum: adoption?.club ? 'club' : adoption?.node ? 'node' : 'chapter',
        forumId: String(adoption?.club || adoption?.node || adoption?.chapter),
        userId: String(userId)
      });

      if (!isMember || ['member', 'moderator'].includes(role)) {
        throw new ForbiddenException('You are not authorized to remove this adoption');
      }

      // soft delete adoption
      const updatedAdoption = await this.rulesAdoptionModel.findByIdAndUpdate(adoptionId, {
        publishedStatus: action === 're-adopt' ? 'published' : 'rejected'
      }, { new: true });

      // update feed status to deleted
      await this.assetsService.updateFeed(
        updatedAdoption?.rule.toString(),
        action === 'removeadoption' ? 'deleted' : 'published',
        undefined,
        'custom',
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

  async getDraftRules(ruleId: string, userId: Types.ObjectId) {
    try {
      const rule = await this.rulesRegulationModel.findOne({ _id: ruleId, publishedStatus: "draft", createdBy: userId });
      if (!rule) {
        throw new NotFoundException('Rule not found');
      }
      return {
        status: true,
        message: 'Rule found',
        data: rule
      };
    } catch (error) {
      throw new BadRequestException('Error while viewing rule', error);
    }
  }
}