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
import { Issues } from 'src/shared/entities/issues/issues.entity';
import { UploadService } from 'src/shared/upload/upload.service';
import { CreateIssuesDto } from './dto/create-issue.dto';
import { ClubMembers } from 'src/shared/entities/clubmembers.entity';
import { NodeMembers } from 'src/shared/entities/node-members.entity';
import { Node_ } from 'src/shared/entities/node.entity';
import { Club } from 'src/shared/entities/club.entity';
import { CreateSolutionDto, CreateSolutionsDto } from './dto/create-solution.dto';
import { IssuesAdoption } from 'src/shared/entities/issues/issues-adoption.entity';
import { IssueSolution } from 'src/shared/entities/issues/issue-solution.entity';
import { TCreationType, TForum, TIssueActionType } from 'typings';
import { ChapterIssues } from 'src/shared/entities/chapters/modules/chapter-issues.entity';
import { ChapterMember } from 'src/shared/entities/chapters/chapter-member.entity';
import { CommonService } from '../common/common.service';
import { Comment } from 'src/shared/entities/comment.entity';
import { Chapter } from 'src/shared/entities/chapters/chapter.entity';
import { AssetsService } from 'src/assets/assets.service';
interface FileObject {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

@Injectable()
export class IssuesService {
  constructor(
    @InjectModel(Issues.name)
    private readonly issuesModel: Model<Issues>,
    private readonly s3FileUpload: UploadService,
    @InjectModel(ClubMembers.name)
    private readonly clubMembersModel: Model<ClubMembers>,
    @InjectModel(NodeMembers.name)
    private readonly nodeMembersModel: Model<NodeMembers>,
    @InjectModel(ChapterMember.name) private chapterMembersModel: Model<ChapterMember>,
    @InjectModel(Node_.name)
    private readonly nodeModel: Model<Node_>,
    @InjectModel(Club.name)
    private readonly clubModel: Model<Club>,
    @InjectModel(Chapter.name)
    private readonly chapterModel: Model<Chapter>,
    @InjectModel(IssuesAdoption.name) private readonly issueAdoptionModel: Model<IssuesAdoption>,
    @InjectModel(ChapterIssues.name) private readonly chapterIssuesModel: Model<ChapterIssues>,
    @InjectModel(IssueSolution.name) private readonly solutionModel: Model<IssueSolution>,
    @InjectModel(Comment.name) private readonly commentModel: Model<Comment>,
    @InjectConnection() private connection: Connection,
    private readonly commonService: CommonService,
    private readonly assetsService: AssetsService,
  ) { }


  async getIssues({
    page = 1,
    limit = 10,
    search,
    forum,
    forumId,
    type = 'all',
    userId,
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
        isPublic = forumData.isPublic;
        const issuePlugin = forumData?.plugins?.find((plugin: any) => plugin.plugin === 'issues');
        isPluginArchived = issuePlugin?.isArchived || false;
      } else if (forum === 'node') {
        const forumData = await this.nodeModel.findOne({ _id: new Types.ObjectId(forumId) }).lean().exec();
        const issuePlugin = forumData?.plugins?.find((plugin: any) => plugin.plugin === 'issues');
        isPluginArchived = issuePlugin?.isArchived || false;
      }

      if (isPluginArchived) {
        throw new ForbiddenException('You are not authorized to access this resource');
      }

      let { isMember, role } = await this.commonService.getUserDetailsInForum({ forum, forumId, userId });
      if (!isMember && !isPublic && type !== 'global') throw new ForbiddenException('You are not authorized to access this resource');

      // let { isMember } = await this.commonService.getUserDetailsInForum({ forum, forumId, userId });
      // if (!isMember && type !== "global") throw new ForbiddenException('You are not authorized to access this resource');
      const validPage = Math.max(1, page);
      const validLimit = Math.max(1, limit);
      // const skip = (validPage - 1) * validLimit;

      // Base match conditions
      const baseMatch: any = { isDeleted: { $ne: true }, isArchived: { $ne: true } };

      // Add forum filter if provided
      if (forum && forumId) {
        baseMatch[forum] = new Types.ObjectId(forumId);
      }

      // Add type-based filters
      switch (type) {
        case 'all':
          // baseMatch.publishedStatus = { $in: ['published', 'inactive', 'rejected'] };
          if (['admin', 'owner']?.includes(role)) {
            baseMatch.publishedStatus = { $in: ['published', 'inactive', 'rejected', 'draft'] };
            delete baseMatch.isArchived;
          } else {
            baseMatch.$or = [
              { publishedStatus: { $in: ['published', 'inactive', 'rejected'] } },
              { $and: [{ publishedStatus: 'draft' }, { createdBy: userId }] },
            ];
          }
          break;
        case 'active':
          baseMatch.publishedStatus = 'published';
          baseMatch.isIssueResolved = { $ne: true };
          break;
        case 'proposed':
          baseMatch.publishedStatus = 'proposed';
          break;
        case 'global':
          baseMatch.publishedStatus = 'published';
          baseMatch.isPublic = true;
          delete baseMatch[forum];
          break;
      }

      // Add search conditions if provided
      if (search?.trim()) {
        baseMatch.$or = [
          { title: new RegExp(search, 'i') },
          { description: new RegExp(search, 'i') },
          { whereOrWho: new RegExp(search, 'i') },
          { significance: new RegExp(search, 'i') }
        ];
      }

      // Query Issues collection

      const issuesQuery = this.issuesModel.find(baseMatch)
        .sort({ createdAt: -1 })
        .populate({
          path: 'createdBy',
          select: 'userName firstName middleName lastName profileImage interests',
          strictPopulate: false
        }).populate({
          path: 'publishedBy',
          select: 'userName firstName middleName lastName profileImage interests',
          strictPopulate: false
        }).
        populate({
          path: 'node',
          model: this.nodeModel,
          select: 'name about domain profileImage coverImage ',
          strictPopulate: false
        }).
        populate({
          path: 'club',
          model: this.clubModel,
          select: 'name about domain profileImage coverImage isPublic ',
          strictPopulate: false
        }).
        populate({
          path: 'chapter',
          model: this.chapterModel,
          select: 'name about domain profileImage coverImage ',
          strictPopulate: false
        }).
        lean();

      // Query IssuesAdoption collection
      const issuesAdoptionQuery = this.issueAdoptionModel.find({
        ...baseMatch,
        [forum]: new Types.ObjectId(forumId),
        type: 'adopted',
        isArchived: false
      })
        .sort({ createdAt: -1 })
        .populate({
          path: 'issues',
          populate: [
            { path: 'createdBy', select: '-password' },
            { path: 'publishedBy', select: '-password' },
            { path: 'node', select: 'name about domain profileImage coverImage' },
            { path: 'club', select: 'name about domain profileImage coverImage isPublic' },
            { path: 'chapter', select: 'name about domain profileImage coverImage' },
          ],
          strictPopulate: false
        }).
        populate({
          model: this.nodeModel,
          path: 'node',
          select: 'name about domain profileImage coverImage ',
          strictPopulate: false
        }).
        populate({
          model: this.clubModel,
          path: 'club',
          select: 'name about domain profileImage coverImage isPublic ',
          strictPopulate: false
        }).
        populate({
          model: this.chapterModel,
          path: 'chapter',
          select: 'name about domain profileImage coverImage ',
          strictPopulate: false
        }).
        lean();

      // Execute queries
      const [issues, issuesAdoption] = await Promise.all([issuesQuery, issuesAdoptionQuery]);

      console.log({ issuesAdoption: JSON.stringify(issuesAdoption) });


      // Merge results and sort by createdAt
      const _mergedIssues = [...issues, ...issuesAdoption?.map(adoption => ({
        // ...(adoption?.issues as any)?.toObject(),
        ...(adoption?.issues as any),
        club: (adoption?.issues as any)?.club,
        node: (adoption?.issues as any)?.node,
        chapter: (adoption?.issues as any)?.chapter,
        isAdopted: true,
        sortDate: adoption?.createdAt,
        adoptedAt: adoption?.createdAt,
        adoptionId: adoption?._id,
        publishedStatus: adoption?.publishedStatus
      }))];

      const mergedIssues = _mergedIssues.map((issue) => {
        if (issue.isAnonymous) {
          delete issue.createdBy;
        }
        return issue;
      });


      mergedIssues.sort((a, b) => new Date(b.sortDate).getTime() - new Date(a.sortDate).getTime());

      // Pagination
      const totalCount = await this.issuesModel.countDocuments(baseMatch) + await this.issueAdoptionModel.countDocuments({ ...baseMatch, [forum]: new Types.ObjectId(forumId), type: 'adopted', isArchived: false });
      const totalPages = Math.ceil(totalCount / validLimit);

      return {
        issues: mergedIssues,
        pagination: {
          currentPage: validPage,
          totalPages,
          totalItems: totalCount,
          itemsPerPage: validLimit,
          hasNextPage: validPage < totalPages,
          hasPreviousPage: validPage > 1,
        },
      };
    } catch (error) {
      console.error({ error })
      if (error instanceof BadRequestException || error instanceof ForbiddenException) throw error;

      throw new InternalServerErrorException(
        'Error while getting issues and adoptions',
        error.message
      );
    }
  }

  //------------------------------------------------------------------------------------------
  /**
   * Create a new issue. This function will also handle the upload of any files
   * associated with the issue.
   *
   * @param issueData - The create issue data
   * @returns The newly created issue
   */
  async createIssueV0(issueData: CreateIssuesDto) {
    const session = await this.connection.startSession();
    session.startTransaction();
    try {

      const { files: files, node, club, chapter, ...restData } = issueData;
      let fileObjects = null;
      if (files) {
        const uploadPromises = files.map((file: FileObject) =>
          this.uploadFile({
            buffer: file.buffer,
            originalname: file.originalname,
            mimetype: file.mimetype,
          } as Express.Multer.File),
        );

        const uploadedFiles = await Promise.all(uploadPromises);

        fileObjects = uploadedFiles.map((uploadedFile, index) => ({
          url: uploadedFile.url,
          originalname: files[index].originalname,
          mimetype: files[index].mimetype,
          size: files[index].size,
        }));
      }

      const dataToSave = {
        ...restData,
        isPublic: false,
        node: node ? new Types.ObjectId(node) : null,
        club: club ? new Types.ObjectId(club) : null,
        chapter: chapter ? new Types.ObjectId(chapter) : null,
        files: fileObjects,
      };

      const newIssue = new this.issuesModel(dataToSave);

      // copy the issue to chapters
      if (club && dataToSave?.publishedStatus === 'published') {
        await this.commonService.copyAnAssetToAllClubChapters({
          clubId: club,
          assetId: newIssue._id as string,
          config: {
            sourceModel: this.issuesModel,
            targetModel: this.chapterIssuesModel,
            referenceKey: 'issue'
          },
          session
        });
      }

      const response = await newIssue.save({ session });

      if (dataToSave?.publishedStatus === 'published') {
        this.assetsService.createFeed(
          response.club || response.node || response.chapter,
          response.club ? 'Club' : response.node ? 'Node' : 'Chapter',
          'Issues',
          response._id as any,
        )
      }


      await session.commitTransaction();

      return response;
    } catch (error) {
      console.error({ error })
      await session.abortTransaction()
      throw new InternalServerErrorException(
        'Error while creating issue',
        error,
      );
    } finally {
      session.endSession()
    }
  }

  async createIssue(issueData: CreateIssuesDto, userId: Types.ObjectId) {
    const session = await this.connection.startSession();
    session.startTransaction();
    try {

      console.log({ issueData })

      const { forum, forumId } = this.getForum(issueData);

      const { isMember, userDetails } =
        await this.commonService.getUserDetailsInForum({
          forum,
          forumId,
          userId: String(userId),
        });

      if (!isMember) throw new BadRequestException("Unauthorized");

      const publishedStatus = this.determinePublishedStatus(
        userDetails.role,
        issueData.publishedStatus,
      );

      if (publishedStatus === "published") {
        await this.assetsService.checkAndIncrement(userId, session);
      }

      // --- Draft Update Path ---
      if (issueData.issueId) {
        const draftRule = await this.updateDraft(issueData, publishedStatus, session);
        await session.commitTransaction();
        return {
          data: draftRule,
          success: true,
          message: "Issue draft saved successfully",
        };
      }

      // --- New Issue Creation Path ---
      const files = await this.processFiles(issueData.files);

      const savedIssue = await this.createNewIssue(
        issueData,
        userId,
        userDetails,
        publishedStatus,
        files,
        session,
      );

      // copy the issue to chapters
      if (issueData.club && savedIssue?.publishedStatus === 'published') {
        await this.commonService.copyAnAssetToAllClubChapters({
          clubId: issueData.club,
          assetId: savedIssue._id as string,
          config: {
            sourceModel: this.issuesModel,
            targetModel: this.chapterIssuesModel,
            referenceKey: 'issue'
          },
          session
        });
      }

      if (savedIssue?.publishedStatus === 'published') {
        this.assetsService.createFeed(
          savedIssue.club || savedIssue.node || savedIssue.chapter,
          savedIssue.club ? 'Club' : savedIssue.node ? 'Node' : 'Chapter',
          'Issues',
          savedIssue._id as any,
        )
      }

      await session.commitTransaction();

      return {
        data: savedIssue,
        success: true,
        message:
          userDetails.role === "member"
            ? "Successfully proposed issue"
            : "Issue created successfully",
      };
    } catch (error) {
      console.error({ error })
      await session.abortTransaction()
      if (error instanceof BadRequestException || error instanceof ForbiddenException) throw error;
      throw new InternalServerErrorException(
        'Error while creating issue',
        error,
      );
    } finally {
      session.endSession()
    }
  }

  private getForum(dto: any): { forum: TForum, forumId: string } {
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


  private async updateDraft(dto: any, publishedStatus: string, session: any) {
    const existingDraft = await this.issuesModel.findOne({
      _id: dto.issueId,
      publishedStatus: "draft",
    });

    if (!existingDraft) throw new BadRequestException("Draft issue not found");

    const sanitizedDeletedUrls = JSON.parse(dto?.deletedImageUrls || "[]");

    if (sanitizedDeletedUrls.length > 0) {
      const existingFiles = existingDraft?.files || []
      const filteredFiles = existingFiles.filter((file: any) => !sanitizedDeletedUrls?.includes(file.url))
      const combineLength = filteredFiles?.length || 0 + dto?.files?.length || 0
      if (combineLength > 5) throw new BadRequestException("You can upload maximum 5 files")
    }

    const newFiles = await this.processFiles(dto?.files, sanitizedDeletedUrls);

    // Max 5 file check
    const combinedFiles = [
      ...(existingDraft?.files || []).filter(
        (f: any) => !sanitizedDeletedUrls?.includes(f.url),
      ),
      ...newFiles,
    ];

    // if (combinedFiles.length > 5)
    //   throw new BadRequestException("You can upload maximum 5 files");


    if (dto?.node) delete dto.node
    if (dto?.club) delete dto.club
    if (dto?.chapter) delete dto.chapter

    console.log({ publishedStatus })

    return await this.issuesModel.findByIdAndUpdate(
      dto.issueId,
      { ...dto, files: combinedFiles, publishedStatus },
      { new: true, session },
    );
  }

  private async createNewIssue(
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
      isActive: userDetails.role !== "member",
      files,
      publishedDate: publishedStatus === "published" ? new Date() : null,
    };

    const newIssue = new this.issuesModel(dataToSave);
    return await newIssue.save({ session });
  }

  //------------------------------------------------------------------------------------------


  /**
   * 
   * @param userId 
   * @param dataToSave 
   * @param updateFiles 
   * @returns 
   */
  async updateIssue(userId: Types.ObjectId, dataToSave: any, updateFiles) {
    try {
      const currentVersion = await this.issuesModel.findById(dataToSave._id);

      if (!currentVersion) {
        throw new Error('Document not found');
      }

      const { files, ...restData } = dataToSave;

      let fileObjects = null;
      let mergedFiles = [files];

      if (updateFiles) {
        // Handle file uploads
        const uploadedFiles = await Promise.all(
          updateFiles.map((singlefile) => this.uploadFile(singlefile)),
        );

        // Create file objects
        fileObjects = uploadedFiles.map((uploadedFile, index) => ({
          url: uploadedFile.url,
          originalname: uploadedFile.originalname,
          mimetype: uploadedFile.mimetype,
          size: uploadedFile.size,
        }));

        mergedFiles = [...fileObjects];
      }

      // If the document is a draft, update the document
      if (dataToSave.publishedStatus === 'draft') {
        const updateData = await this.issuesModel.findByIdAndUpdate(
          dataToSave._id,
          {
            $set: {
              ...restData,
              files: mergedFiles,
            },
          },
        );

        return updateData;
      }

      // Check if the user is an admin or not
      const memberRole = await this.getMemberRoles(userId, dataToSave);

      // If the user is not an admin or owner or moderator, update the document to proposed
      if (!['admin', 'owner', 'moderator']?.includes(memberRole)) {
        const updateData = await this.issuesModel.findByIdAndUpdate(
          dataToSave._id,
          {
            $set: {
              ...restData,
              files: mergedFiles,
              publishedStatus: 'proposed',
            },
          },
        );

        return updateData;
      }

      // If the user is an admin, update the document to published
      const versionObject = {
        ...currentVersion.toObject(),
        version: currentVersion.version || 1,
        files: mergedFiles,
        publishedStatus: 'olderversion',
      };

      const updatedDocument = await this.issuesModel.findByIdAndUpdate(
        dataToSave._id,
        {
          $set: {
            ...restData,
            version: (currentVersion.version || 1) + 1,
            publishedBy: userId,
            publishedAt: new Date(),
          },
          $push: {
            olderVersions: versionObject,
          },
        },
        { new: true, runValidators: true },
      );

      return updatedDocument;
    } catch (error) {
      throw new InternalServerErrorException(
        'Error while updating issue',
        error,
      );
    }
  }


  async getMyIssues(
    userId: Types.ObjectId,
    entity: 'node' | 'club',
    entityId: Types.ObjectId,
    page: number = 1,
    limit: number = 10
  ) {
    try {
      // Ensure page and limit are positive numbers
      const validPage = Math.max(1, page);
      const validLimit = Math.max(1, limit);
      const skip = (validPage - 1) * validLimit;

      // Construct the query based on entity type
      const query = {
        createdBy: userId,
        [entity]: entityId,
      };

      // Get total count for pagination metadata
      const totalCount = await this.issuesModel.countDocuments(query);
      const totalPages = Math.ceil(totalCount / validLimit);

      // Get paginated results
      const issues = await this.issuesModel
        .find(query)
        .populate({
          path: 'node',
          select: 'name about domain profileImage coverImage isPublic '
        }).populate({
          path: 'club',
          select: 'name about domain profileImage coverImage isPublic '
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(validLimit)
        .exec();
      const transformedIssues = issues.map(issue => ({
        ...issue.toObject(),
        details: issue.club
          ? { type: "club", ...issue.club }
          : { type: "node", ...issue.node }
      }));

      // Return both the data and pagination metadata
      return {
        issues: transformedIssues,
        pagination: {
          currentPage: validPage,
          totalPages,
          totalItems: totalCount,
          itemsPerPage: validLimit,
          hasNextPage: validPage < totalPages,
          hasPreviousPage: validPage > 1
        }
      };
    } catch (error) {
      throw new InternalServerErrorException(
        'Error while getting active issue',
        error,
      );
    }
  }

  /**
   * 
   * @param issueId 
   * @returns 
   */
  async getIssue(issueId: Types.ObjectId, userId: string, requestFromForumId: Types.ObjectId, chapterAlyId?: string, adoptionId?: string) {
    try {
      let alyIssue;
      if (adoptionId || chapterAlyId) {
        alyIssue = await this.getAdaptedIssue(adoptionId, chapterAlyId);

        // Check if the user has access to the forum
        if (alyIssue) {
          const issueForumId = String(alyIssue?.node || alyIssue?.club || alyIssue?.chapter);
          if (issueForumId !== String(requestFromForumId)) {
            throw new ForbiddenException('You are not authorized to view this issue');
          }
        }
      }


      // Get the original issue with populated fields
      const issue = await this.getOriginalIssue(issueId);

      // Determine the forum ID and type
      const { forumId, forumType } = this.getForumDetails(alyIssue, issue);

      // Check if the issue is public or from the requesting forum
      if (String(forumId) !== String(requestFromForumId) && !issue.isPublic && !chapterAlyId) {
        throw new ForbiddenException('You are not authorized to view this issue');
      }

      // Get user details and role in the forum
      const { role } = await this.commonService.getUserDetailsInForum({
        userId: String(userId),
        forumId,
        forum: forumType
      });

      // Check if the issue is archived and restrict access
      if (issue.isArchived) {
        if (adoptionId || chapterAlyId) {
          throw new ForbiddenException('You cannot access archived adopted issues');
        }
        if (!['admin', 'owner'].includes(role) && String(issue?.createdBy?._id) !== String(userId)) {
          throw new ForbiddenException('You are not authorized to view this archived issue');
        }
      }

      // Count comments for this issue
      const commentCount = await this.commentModel.countDocuments({
        "entity.entityId": adoptionId || chapterAlyId || issueId,
        "entity.entityType": Issues.name,
        parent: null
      });

      // Prepare the final issue object with additional properties
      const enhancedIssue = this.enhanceIssueWithMetadata(issue, role, userId, adoptionId, alyIssue);

      // Remove createdBy if the issue is anonymous
      if (enhancedIssue?.isAnonymous) {
        delete enhancedIssue.createdBy;
      }

      return {
        issue: enhancedIssue,
        commentCount,
      };

    } catch (error) {
      if (error instanceof BadRequestException || error instanceof ForbiddenException || error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        'Error while getting specific issue',
        error,
      );
    }
  }

  // Helper methods
  private async getAdaptedIssue(adoptionId?: string, chapterAlyId?: string) {
    if (adoptionId) {
      return await this.issueAdoptionModel.findById(adoptionId)
        .populate({
          path: 'proposedBy',
          select: 'userName firstName middleName lastName profileImage interests',
          strictPopulate: false,
        })
        .lean();
    } else if (chapterAlyId) {
      return await this.chapterIssuesModel.findById(chapterAlyId).lean();
    }
  }

  private async getOriginalIssue(issueId: Types.ObjectId) {
    return await this.issuesModel
      .findById(issueId)
      .populate({
        path: 'createdBy',
        select: 'userName firstName middleName lastName profileImage interests'
      })
      .populate({
        path: 'whoShouldAddress',
        select: 'userName firstName middleName lastName profileImage interests'
      })
      .populate({
        path: 'club',
        select: 'name about domain profileImage coverImage isPublic'
      })
      .populate({
        path: 'node',
        select: 'name about domain profileImage coverImage isPublic'
      })
      .lean()
      .exec();
  }

  private getForumDetails(alyIssue: any, issue: any) {
    const forumId = (
      alyIssue?.chapter ||
      alyIssue?.node ||
      alyIssue?.club ||
      issue?.chapter?._id ||
      issue?.node?._id ||
      issue?.club?._id
    )?.toString();

    const forumType: TForum =
      alyIssue?.node ? 'node' :
        alyIssue?.club ? 'club' :
          alyIssue?.chapter ? 'chapter' :
            issue?.node ? 'node' :
              issue?.club ? 'club' :
                'chapter';

    return { forumId, forumType };
  }

  private enhanceIssueWithMetadata(issue: any, role: string, userId: string, adoptionId?: string, alyIssue?: any) {
    const enhancedIssue = {
      ...issue,
      currentUserRole: role,
      isOwnerOfAsset: String(issue.createdBy._id) === String(userId)
    };

    if (adoptionId && alyIssue) {
      enhancedIssue.adoptedBy = alyIssue.proposedBy;
      enhancedIssue.adoptedAt = alyIssue.createdAt;
      enhancedIssue.publishedStatus = alyIssue.publishedStatus;
    }

    return enhancedIssue;
  }
  /**
   * 
   * @param userId 
   * @param createIssuesData 
   * @returns 
   */
  async getMemberRoles(userId: Types.ObjectId, createIssuesData: any) {
    try {
      if (createIssuesData.node) {
        const memberInfo = await this.nodeMembersModel.findOne({
          node: new Types.ObjectId(createIssuesData.node),
          user: new Types.ObjectId(userId),
        });
        return memberInfo.role;
      } else if (createIssuesData.club) {
        const memberInfo = await this.clubMembersModel.findOne({
          club: new Types.ObjectId(createIssuesData.club),
          user: new Types.ObjectId(userId),
        });
        return memberInfo.role;
      } else if (createIssuesData.chapter) {
        const memberInfo = await this.chapterMembersModel.findOne({
          chapter: new Types.ObjectId(createIssuesData.chapter),
          user: new Types.ObjectId(userId),
        });
        return memberInfo.role;
      }

    } catch (error) {
      throw new InternalServerErrorException(
        'Error while getting user roles',
        error,
      );
    }
  }
  /**
   * 
   * @param userId 
   * @param adoptForumDto 
   * @returns 
   */
  async adoptIssueAndPropose(userId: Types.ObjectId, adoptForumDto
    : { issues: Types.ObjectId, node?: Types.ObjectId, club?: Types.ObjectId, proposalMessage: string }) {
    try {

      // Check if issue exists and is public
      const issue = await this.issuesModel.findById(adoptForumDto.issues);
      if (!issue) throw new NotFoundException('Issue not found');

      if (!issue.isPublic) throw new BadRequestException('You cannot adopt a private issue');

      let isAdopted;
      if (adoptForumDto.club) {
        isAdopted = await this.issueAdoptionModel.findOne({
          issues: new Types.ObjectId(adoptForumDto.issues),
          club: new Types.ObjectId(adoptForumDto.club)
        });
      } else if (adoptForumDto?.node) {
        isAdopted = await this.issueAdoptionModel.findOne({
          issues: new Types.ObjectId(adoptForumDto.issues),
          node: new Types.ObjectId(adoptForumDto.node)
        });
      }

      if (isAdopted) {
        const forumType = isAdopted.node ? 'node' : 'club';
        throw new BadRequestException(
          `Issue is already ${isAdopted.publishedStatus === 'published' ? 'adopted' : 'under proposal'} in this ${forumType}`
        );
      }

      if (adoptForumDto.club && adoptForumDto.node) {
        throw new BadRequestException(
          'Forum must be either club or node, not both',
        );
      }

      let userDetails;
      if (adoptForumDto.club) {
        userDetails = await this.clubMembersModel.findOne({
          user: new Types.ObjectId(userId),
          club: new Types.ObjectId(adoptForumDto.club),
        });

        // Add to adoptedClubs array when publishing
        if (userDetails?.role !== 'member') {
          await this.issuesModel.findByIdAndUpdate(
            adoptForumDto.issues,
            {
              $push: {
                adoptedClubs: {
                  club: new Types.ObjectId(adoptForumDto.club),
                  date: new Date()
                }
              }
            }
          );
        }
      } else if (adoptForumDto.node) {
        userDetails = await this.nodeMembersModel.findOne({
          user: new Types.ObjectId(userId),
          node: new Types.ObjectId(adoptForumDto.node),
        });

        // Add to adoptedNodes array when publishing 
        if (userDetails?.role !== 'member') {
          await this.issuesModel.findByIdAndUpdate(
            adoptForumDto.issues,
            {
              $push: {
                adoptedNodes: {
                  node: new Types.ObjectId(adoptForumDto.node),
                  date: new Date()
                }
              }
            }
          );
        }
      }

      if (!userDetails) throw new NotAcceptableException('User not found in the specified forum');

      const adoptionData = {

        issues: new Types.ObjectId(adoptForumDto.issues),

        proposedBy: new Types.ObjectId(userId),
        ...(userDetails.role !== 'member' && {
          acceptedBy: new Types.ObjectId(userId),
        }),

        ...(userDetails.role === 'member' && {
          message: adoptForumDto.proposalMessage,  // Add message for members
        }),

        publishedStatus: userDetails.role === 'member' ? 'proposed' : 'published',

        node: adoptForumDto.node
          ? new Types.ObjectId(adoptForumDto.node)
          : null,

        club: adoptForumDto.club
          ? new Types.ObjectId(adoptForumDto.club)
          : null,
      };

      // Create adoption record

      const adoptedIssue = await this.issueAdoptionModel.create(adoptionData);

      if (adoptedIssue.publishedStatus === 'published') {
        await this.assetsService.createFeed(
          adoptedIssue.club || adoptedIssue.node || adoptedIssue.chapter,
          adoptedIssue.club ? 'Club' : adoptedIssue.node ? 'Node' : 'Chapter',
          'Issues',
          adoptedIssue.issues,
          'IssuesAdoption',
          adoptedIssue._id,
        );
      }

      return {
        success: true,
        data: adoptedIssue,
        message: 'Issue adopted successfully',
      };
    } catch (error) {
      throw new BadRequestException(error);
    }

  }

  async publishOrRejectProposedIssue(
    userId: Types.ObjectId,
    issueId: Types.ObjectId,
    status: TIssueActionType,
    creationType: TCreationType
  ) {
    try {
      if (creationType === 'adopted' && ['archive', 'unarchive'].includes(status)) {
        throw new BadRequestException('Invalid action for adopted issue');
      }

      const issue = await this.getIssueByCreationType(String(issueId), creationType);

      const forumType = issue?.chapter ? 'chapter' : issue?.node ? 'node' : 'club';
      const forumId = String(issue?.chapter || issue.club || issue.node);

      await this.validateUserPermissions(String(userId), forumId, forumType);

      console.log({ status })
      if (['resolved', 'unresolved'].includes(status)) {
        await this.updateIssueResolutionStatus(String(issueId), status === 'resolved');
      }
      else if (['archive', 'unarchive'].includes(status)) {
        await this.updateIssueArchiveStatus(String(issueId), status === 'archive');
      }
      else {
        console.log("dise");
        await this.updateIssuePublishStatus(String(issueId), status, userId, creationType);
      }

      return {
        status: true,
        message: this.getStatusMessage(status),
        issues: issue,
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Error while ${this.getErrorMessage(status)} proposed issue`,
        error,
      );
    }
  }

  // Helper methods
  private async getIssueByCreationType(issueId: string, creationType: TCreationType) {
    const issue = creationType === 'adopted'
      ? await this.issueAdoptionModel.findById(issueId)
      : await this.issuesModel.findById(issueId);

    if (!issue) throw new NotFoundException('Issue not found');
    return issue;
  }

  private async validateUserPermissions(userId: string, forumId: string, forumType: TForum) {
    const { role } = await this.commonService.getUserDetailsInForum({
      userId: String(userId),
      forumId,
      forum: forumType
    });

    if (!['admin', 'owner'].includes(role)) {
      throw new ForbiddenException('You are not authorized to perform this action.');
    }
  }

  private async updateIssueResolutionStatus(issueId: string, isResolved: boolean) {
    await this.issuesModel.findByIdAndUpdate(issueId, { isIssueResolved: isResolved });
    await this.issueAdoptionModel.updateMany({ issues: issueId }, { isIssueResolved: isResolved });
  }

  private async updateIssueArchiveStatus(issueId: string, isArchived: boolean) {
    await this.issuesModel.findByIdAndUpdate(issueId, { isArchived });
    await this.issueAdoptionModel.updateMany({ issues: new Types.ObjectId(issueId) }, { isArchived });
    await this.assetsService.updateFeed(issueId, isArchived ? 'archived' : 'published');
  }

  private async updateIssuePublishStatus(issueId: string, status: TIssueActionType, userId: Types.ObjectId, creationType: TCreationType) {
    const publishedStatus =
      status === 'publish' ? 'published' :
        status === 'inactivate' ? 'inactive' : 'rejected';

    const publishData = status === 'publish' ? {
      publishedBy: userId,
      publishedDate: new Date()
    } : {};

    console.log({ publishedStatus })

    if (creationType === 'adopted') {
      const adoption = await this.issueAdoptionModel.findByIdAndUpdate(issueId, {
        publishedStatus,
        ...publishData
      }, { new: true });
      if (adoption?.club) {
        await this.issuesModel.findByIdAndUpdate(adoption?.issues, {
          $push: {
            adoptedClubs: {
              club: adoption?.club,
              date: new Date()
            }
          }
        });
      }
      else if (adoption?.node) {
        await this.issuesModel.findByIdAndUpdate(adoption?.issues, {
          $push: {
            adoptedNodes: {
              node: adoption?.node,
              date: new Date()
            }
          }
        });
      }

      console.log("before adoption");
      if (adoption?.publishedStatus === 'published') {
        console.log("adoption")
        await this.assetsService.createFeed(
          adoption.club || adoption.node || adoption.chapter,
          adoption.club ? 'Club' : adoption.node ? 'Node' : 'Chapter',
          'Issues',
          adoption.issues,
          'IssuesAdoption',
          adoption._id,
        );
      }
    } else {
      console.log("before issuesasdfawerwa", publishedStatus);
      const issues = await this.issuesModel.findByIdAndUpdate(issueId, {
        publishedStatus,
        ...publishData,
        isActive: status === 'publish'
      }, { new: true });


      // If inactivating, update all adoptions as well
      if (status === 'inactivate') {
        await this.issueAdoptionModel.updateMany({ issues: issueId }, {
          publishedStatus: 'inactive'
        });
      }

      console.log("before adqwoption", issues);

      if (issues?.publishedStatus === 'published') {
        console.log("adqwoption")
        this.assetsService.createFeed(
          issues.club || issues.node || issues.chapter,
          issues.club ? 'Club' : issues.node ? 'Node' : 'Chapter',
          'Issues',
          issues._id as any,
        )
      }
    }
  }

  private getStatusMessage(status: TIssueActionType): string {
    const actionMap = {
      'publish': 'published',
      'inactivate': 'inactivated',
      'reject': 'rejected',
      'archive': 'archived',
      'unarchive': 'unarchived',
      'resolved': 'resolved',
      'unresolved': 'unresolved'
    };

    return `Issue ${actionMap[status] || status} successfully`;
  }

  private getErrorMessage(status: TIssueActionType): string {
    const actionMap = {
      'publish': 'publishing',
      'inactivate': 'inactivating',
      'reject': 'rejecting',
      'archive': 'archiving',
      'unarchive': 'unarchiving',
      'resolved': 'resolving',
      'unresolved': 'unresolving'
    };

    return actionMap[status] || status;
  }
  /**
   * 
   * @param entity 
   * @param entityId 
   * @returns 
   */
  async getProposedIssues(entity, entityId: Types.ObjectId) {
    try {

      // First pipeline: Get direct proposed issues
      const directIssuesPipeline = [
        {
          $match: {
            [entity]: entityId,
            publishedStatus: 'proposed',
            isDeleted: { $ne: true }
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'createdBy',
            foreignField: '_id',
            pipeline: [
              {
                $project: {
                  password: 0
                }
              }
            ],
            as: 'createdBy'
          }
        },
        {
          $unwind: '$createdBy'
        },
        {
          $addFields: {
            source: 'direct'
          }
        }
      ];

      // Second pipeline: Get adopted proposals
      const adoptedIssuesPipeline = [
        {
          $match: {
            [entity]: entityId,
            publishedStatus: 'proposed'
          }
        },
        {
          // Join with issues collection
          $lookup: {
            from: 'issues',
            localField: 'issues',
            foreignField: '_id',
            pipeline: [
              {
                $match: {
                  isDeleted: { $ne: true }
                }
              }
            ],
            as: 'issueDetails'
          }
        },
        {
          $unwind: '$issueDetails'
        },
        {
          // Get proposedBy user details
          $lookup: {
            from: 'users',
            localField: 'proposedBy',
            foreignField: '_id',
            pipeline: [
              {
                $project: {
                  password: 0
                }
              }
            ],
            as: 'proposedByUser'
          }
        },
        {
          $unwind: '$proposedByUser'
        },
        {
          // Get original issue creator details
          $lookup: {
            from: 'users',
            localField: 'issueDetails.createdBy',
            foreignField: '_id',
            pipeline: [
              {
                $project: {
                  password: 0
                }
              }
            ],
            as: 'issueCreator'
          }
        },
        {
          $unwind: '$issueCreator'
        },
        {
          // Reshape document to match Issues structure
          $addFields: {
            adoptionDetails: {
              proposedBy: '$proposedByUser',
              message: '$message',
              adoptionId: '$_id',
              type: '$type'
            }
          }
        },
        {
          // Project final structure
          $replaceRoot: {
            newRoot: {
              $mergeObjects: [
                '$issueDetails',
                {
                  adoptionDetails: '$adoptionDetails',
                  source: 'adopted'
                }
              ]
            }
          }
        }
      ];

      // Execute both pipelines in parallel
      const [directIssues, adoptedIssues] = await Promise.all([
        this.issuesModel.aggregate(directIssuesPipeline),
        this.issueAdoptionModel.aggregate(adoptedIssuesPipeline)
      ]);

      // Combine and sort results
      const allIssues = [...directIssues, ...adoptedIssues].sort(
        (a, b) => b.createdAt - a.createdAt
      );

      return allIssues;

    } catch (error) {
      throw new InternalServerErrorException(
        'Error while getting proposed issues',
        error,
      );
    }
  }

  /**
   * Like an issue.
   * @param userId The id of the user to like the issue for
   * @param issueId The id of the issue to like
   * @throws `BadRequestException` if the issueId is invalid
   * @throws `NotFoundException` if the issue is not found
   * @throws `InternalServerErrorException` if there is an error while liking the issue
   * @returns The updated issue document
   */
  async likeIssue(userId: Types.ObjectId, issueId: Types.ObjectId) {
    try {
      if (!issueId) {
        throw new NotFoundException('Issue id not found');
      }

      const issue = await this.issuesModel.findById(issueId);
      if (!issue) {
        throw new NotFoundException('Issue not found');
      }

      const alreadyLiked = issue.relevant.some((like) =>
        like.user.equals(userId),
      );

      if (alreadyLiked) {
        return await this.issuesModel.findByIdAndUpdate(
          issueId,
          { $pull: { relevant: { user: userId } } },
          { new: true },
        );
      }

      return await this.issuesModel.findByIdAndUpdate(
        issueId,
        {
          $addToSet: { relevant: { user: userId, date: new Date() } },
          $pull: { irrelevant: { user: userId } },
        },
        { new: true },
      );
    } catch (error) {

      if (error instanceof NotFoundException) {
        throw error;
      }

      throw new InternalServerErrorException(
        'Error while adopting issue',
        error,
      );
    }
  }

  /**
   * Dislike an issue.
   * @param userId The id of the user to dislike the issue for
   * @param issueId The id of the issue to dislike
   * @throws `BadRequestException` if the issueId is invalid
   * @throws `NotFoundException` if the issue is not found
   * @throws `InternalServerErrorException` if there is an error while disliking the issue
   * @returns The updated issue document
   */
  async dislikeIssue(userId: Types.ObjectId, issueId: Types.ObjectId) {
    try {
      if (!issueId) {
        throw new NotFoundException('Issue id not found');
      }

      const issue = await this.issuesModel.findById(issueId);
      if (!issue) {
        throw new NotFoundException('Issue not found');
      }

      const alreadyDisliked = issue.irrelevant.some((dislike) =>
        dislike.user.equals(userId),
      );

      if (alreadyDisliked) {
        return await this.issuesModel.findByIdAndUpdate(
          issueId,
          { $pull: { irrelevant: { user: userId } } },
          { new: true },
        );
      }

      return await this.issuesModel.findByIdAndUpdate(
        issueId,
        {
          $addToSet: { irrelevant: { user: userId, date: new Date() } },
          $pull: { relevant: { user: userId } },
        },
        { new: true },
      );
    } catch (error) {

      if (error instanceof NotFoundException) {
        throw error;
      }

      throw new InternalServerErrorException(
        'Error while adopting issue',
        error,
      );
    }
  }
  /**
   * 
   * @param userId 
   * @param issueId 
   * @returns 
   */

  async getClubsNodesNotAdopted(
    userId: Types.ObjectId,
    issueId: Types.ObjectId,
  ) {
    try {
      if (!issueId) throw new NotFoundException('Issue id not found');

      const issue = await this.issuesModel.findById(new Types.ObjectId(issueId));
      if (!issue) throw new NotFoundException('Issue not found');
      if (!issue.isPublic) throw new BadRequestException({
        message: 'You cannot adopt a private issue',
      });

      // Nodes Aggregation Pipeline
      const nodesAggregation = [
        {
          $match: {
            user: userId,
          },
        },
        {
          $lookup: {
            from: 'node_',
            localField: 'node',
            foreignField: '_id',
            as: 'nodeDetails',
          },
        },
        {
          $unwind: '$nodeDetails',
        },
        // Check issuesadoptions collection
        {
          $lookup: {
            from: 'issuesadoptions',
            let: { nodeId: '$node' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$issues', new Types.ObjectId(issueId)] },
                      { $eq: ['$node', '$$nodeId'] },
                      { $in: ['$publishedStatus', ['published', 'proposed']] }
                    ]
                  }
                }
              }
            ],
            as: 'existingAdoptions',
          },
        },
        // Check if this node is the original forum of the issue
        {
          $lookup: {
            from: 'issues',
            let: { nodeId: '$node' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$_id', new Types.ObjectId(issueId)] },
                      {
                        $or: [
                          { $eq: ['$node', '$$nodeId'] },
                          { $in: ['$$nodeId', '$adoptedNodes.node'] }
                        ]
                      }
                    ]
                  }
                }
              }
            ],
            as: 'originalIssue',
          },
        },
        {
          $match: {
            $and: [
              { existingAdoptions: { $size: 0 } },
              { originalIssue: { $size: 0 } }
            ]
          }
        },
        {
          $addFields: {
            "nodeDetails.role": "$role"
          },
        },
        {
          $replaceRoot: {
            newRoot: '$nodeDetails',
          },
        },
      ];

      // Clubs Aggregation Pipeline
      const clubsAggregation = [
        {
          $match: {
            user: userId,
          },
        },
        {
          $lookup: {
            from: 'clubs',
            localField: 'club',
            foreignField: '_id',
            as: 'clubDetails',
          },
        },
        {
          $unwind: '$clubDetails',
        },
        // Check issuesadoptions collection
        {
          $lookup: {
            from: 'issuesadoptions',
            let: { clubId: '$club' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$issues', new Types.ObjectId(issueId)] },
                      { $eq: ['$club', '$$clubId'] },
                      { $in: ['$publishedStatus', ['published', 'proposed']] }
                    ]
                  }
                }
              }
            ],
            as: 'existingAdoptions',
          },
        },
        // Check if this club is the original forum of the issue
        {
          $lookup: {
            from: 'issues',
            let: { clubId: '$club' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$_id', new Types.ObjectId(issueId)] },
                      {
                        $or: [
                          { $eq: ['$club', '$$clubId'] },
                          { $in: ['$$clubId', '$adoptedClubs.club'] }
                        ]
                      }
                    ]
                  }
                }
              }
            ],
            as: 'originalIssue',
          },
        },
        {
          $match: {
            $and: [
              { existingAdoptions: { $size: 0 } },
              { originalIssue: { $size: 0 } }
            ]
          }
        },
        {
          $addFields: {
            "clubDetails.role": "$role"
          },
        },
        {
          $replaceRoot: {
            newRoot: '$clubDetails',
          },
        },
      ];

      const [memberNodes, memberClubs] = await Promise.all([
        this.nodeMembersModel.aggregate(nodesAggregation),
        this.clubMembersModel.aggregate(clubsAggregation),
      ]);

      return {
        clubs: memberClubs,
        nodes: memberNodes,
      };
    } catch (error) {
      console.error({ error })
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Error while getting clubs and nodes not adopted',
        error,
      );
    }
  }
  /**
   * 
   * @param userId 
   * @param createSolutionDto 
   * @returns 
   */
  async createSolution(userId: Types.ObjectId, createSolutionDto: CreateSolutionDto) {
    try {
      let isAdminOrModerator = null;

      // checking the user is admin or moderator
      if (createSolutionDto.forum === "node") {
        isAdminOrModerator = await this.nodeMembersModel.findOne({
          user: new Types.ObjectId(userId),
          status: 'MEMBER',
          node: createSolutionDto.forumId,
          role: { $in: ['admin', 'moderator'] }
        });
      } else if (createSolutionDto.forum === 'club') {
        isAdminOrModerator = await this.nodeMembersModel.findOne({
          user: new Types.ObjectId(userId),
          status: 'MEMBER',
          club: createSolutionDto.forumId,
          role: { $in: ['admin', 'moderator'] }
        });
      } else {
        throw new BadRequestException('Forum is required');
      }

      if (!isAdminOrModerator) {
        throw new ForbiddenException('Only admins and moderators can mark solutions');
      }

      const createdSolution = await this.issuesModel.findByIdAndUpdate(
        new Types.ObjectId(createSolutionDto.postId),
        {
          $push: {
            solutions: {
              comment: new Types.ObjectId(createSolutionDto.commentId),
              creator: userId,
              date: new Date()
            }
          }
        },
        { new: true }
      );

      if (!createdSolution) {
        throw new NotFoundException('Issue not found');
      }

      return { data: createdSolution, message: 'Solution created', success: true };
    } catch (error) {
      console.error({ error })
      throw new BadRequestException(error);
    }
  }

  async addSolution(solution: CreateSolutionsDto, userId: Types.ObjectId, files?: Express.Multer.File[]) {
    try {
      const { title, description, issueId } = solution;
      if (!issueId) throw new BadRequestException('Issue id is required');
      if (!description || !title) throw new BadRequestException('Title and description are required');

      let uploadedFiles: Array<{ url: string; mimetype: string }> = [];
      if (files?.length) {
        const filesWithUploads = await Promise.all(
          files.map(async (file) => {
            const { url } = await this.uploadFile(file);
            return {
              url,
              mimetype: file.mimetype,
              // filename: file.originalname
            };
          })
        );
        uploadedFiles = filesWithUploads;
      }
      const newSolution = await this.solutionModel.create({
        title,
        description,
        issue: new Types.ObjectId(issueId),
        user: new Types.ObjectId(userId),
        ...(uploadedFiles.length && { files: uploadedFiles })
      });

      return { message: 'Solution submitted successfully', solution: newSolution };
    } catch (error) {
      console.error({ error })
      if (error instanceof BadRequestException) throw error;
      if (error.name === 'ValidationError') throw new BadRequestException(error.message);
      if (error.name === 'CastError') throw new BadRequestException('Invalid id format');
      throw new InternalServerErrorException('Failed to create solution');
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
        'club',
      );
      return response;
    } catch (error) {
      throw new BadRequestException(
        'Failed to upload file. Please try again later.',
      );
    }
  }



  async getSolutionById(issueId: string) {
    try {
      const solution = await this.solutionModel
        .find({ issue: new Types.ObjectId(issueId) }).sort({ createdAt: -1 }).populate({
          path: 'user',
          select: 'userName firstName middleName lastName profileImage interests'
        })
        .populate('issue', 'title description')
        .lean();
      if (!solution) {
        throw new NotFoundException('Solution not found');
      }

      return solution;
    } catch (error) {
      if (error.name === 'CastError') {
        throw new BadRequestException('Invalid solution id format');
      }
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to fetch solution');
    }
  }


  async markSolutionRelevance(solutionId: string, userId: string, isRelevant: boolean) {
    const solution = await this.solutionModel.findById(solutionId);
    if (!solution) throw new NotFoundException('Solution not found');

    // Convert userId to ObjectId
    const userObjectId = new Types.ObjectId(userId);
    const currentDate = new Date();

    if (isRelevant) {
      // Remove from irrelevant if exists
      await this.solutionModel.updateOne(
        { _id: solutionId },
        { $pull: { irrelevant: { userId: userObjectId } } }
      );

      // Toggle relevant status
      const isAlreadyRelevant = solution.relevant?.some(r => r.userId.equals(userObjectId));
      if (isAlreadyRelevant) {
        await this.solutionModel.updateOne(
          { _id: solutionId },
          { $pull: { relevant: { userId: userObjectId } } }
        );
      } else {
        await this.solutionModel.updateOne(
          { _id: solutionId },
          { $push: { relevant: { userId: userObjectId, date: currentDate } } }
        );
      }
    } else {
      // Remove from relevant if exists
      await this.solutionModel.updateOne(
        { _id: solutionId },
        { $pull: { relevant: { userId: userObjectId } } }
      );

      // Toggle irrelevant status
      const isAlreadyIrrelevant = solution.irrelevant?.some(r => r.userId.equals(userObjectId));
      if (isAlreadyIrrelevant) {
        await this.solutionModel.updateOne(
          { _id: solutionId },
          { $pull: { irrelevant: { userId: userObjectId } } }
        );
      } else {
        await this.solutionModel.updateOne(
          { _id: solutionId },
          { $push: { irrelevant: { userId: userObjectId, date: currentDate } } }
        );
      }
    }

    return this.solutionModel.findById(solutionId);
  }

  async getSolutionDetailById(solutionId: Types.ObjectId) {

    try {
      if (!solutionId) {
        throw new BadRequestException('Solution id required!!!')
      }
      const solution = await this.solutionModel.findOne({
        _id: new Types.ObjectId(solutionId)
      }).populate({
        path: 'user',
        select: 'userName firstName middleName lastName profileImage interests'
      })

      const commentCount = await this.commentModel.countDocuments({
        "entity.entityId": solutionId,
        "entity.entityType": IssueSolution.name,
        parent: null
      });

      return {
        solution,
        commentCount
      }

    } catch (error) {
      throw error
    }

  }

  async createViewsForIssue(
    userId: Types.ObjectId,
    issueId: Types.ObjectId,
  ) {
    ({ userId });

    try {
      const issue = await this.issuesModel.findOne({
        _id: issueId,
        'views.user': userId
      });


      if (issue) {
        throw new BadRequestException(
          'User has already viewed this issue.',
        );
      }

      const updatedIssue = await this.issuesModel
        .findByIdAndUpdate(
          issueId,
          {
            $addToSet: { views: { user: userId } },
          },
          { new: true },
        )
        .exec();

      if (!updatedIssue) throw new NotFoundException('Issue not found');

      return { message: 'Issue viewed' };
    } catch (error) {
      throw new InternalServerErrorException(
        'Error while viewing issues',
        error,
      );
    }
  }

  async getAllClubIssuesWithChapterId(
    page: number,
    limit: number,
    isActive: boolean,
    search: string,
    chapterId?: Types.ObjectId,
  ): Promise<any> {
    try {
      let query: any = {};

      if (chapterId) {
        query.chapter = new Types.ObjectId(chapterId);
      }

      const skip = (page - 1) * limit;

      const chapterIssues = await this.chapterIssuesModel
        .find(query)
        .populate({
          path: 'issue',
          match: { isArchived: false, isDeleted: false, publishedStatus: 'published', isPublic: true },
          populate: [
            { path: 'node', select: 'name profileImage' },
            { path: 'club', select: 'name profileImage' },
            { path: 'createdBy', select: 'userName profileImage firstName lastName' }
          ]
        })
        .populate('chapter', 'name profileImage')
        .sort({ createdAt: -1 })
        .lean();

      if (!chapterIssues.length) {
        return {
          data: [],
          pagination: {
            total: 0,
            page,
            limit,
            totalPages: 0,
            hasNextPage: false,
            hasPrevPage: false
          }
        };
      }

      const filteredIssues = chapterIssues.filter(issue => issue.issue !== null);
      const total = filteredIssues.length;

      // Apply pagination to filtered issues
      const start = (page - 1) * limit;
      const paginatedIssues = filteredIssues.slice(start, start + limit);

      // Transform chapter Issues
      const transformedChapterIssues = paginatedIssues.map((cp: any) => ({
        ...cp.issue,
        chapter: cp.chapter,
        chapterIssueId: cp._id,
        type: "chapter",
        createdAt: cp.createdAt
      }));


      return {
        data: transformedChapterIssues,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
          hasNextPage: page < Math.ceil(total / limit),
          hasPrevPage: page > 1
        },
      };
    } catch (error) {
      console.error('chap err', { error });
      throw new BadRequestException(
        'Failed to get all club issues. Please try again later.',
      );
    }
  }

  async togglePublicPrivate(
    issueId: string,
    userId: string,
    isPublic: boolean
  ) {
    try {
      const existingIssue = await this.issuesModel.findOne({
        _id: issueId,
      });
      if (!existingIssue) throw new NotFoundException('Issue not found');

      const updatedIssue = await this.commonService.togglePublicPrivate({
        assetId: issueId,
        userId,
        isPublic,
        forumType: existingIssue?.club ? 'club' : existingIssue?.node ? 'node' : 'chapter',
        model: this.issuesModel,
        existingItem: existingIssue
      });

      return updatedIssue;
    } catch (error) {
      console.log('error', error);
      if (error instanceof ForbiddenException) throw error;
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        'Error while updating Issue',
        error,
      );
    }
  }

  async deleteIssue(issueId: string, userId: string) {
    try {
      const existingIssue = await this.issuesModel.findById(issueId);

      if (!existingIssue) throw new NotFoundException('Issue not found');

      if (existingIssue?.isPublic) {
        throw new BadRequestException('Public Issue is cannot be deleted');
      }

      const { isMember, role } = await this.commonService.getUserDetailsInForum({
        forum: existingIssue?.club ? 'club' : existingIssue?.node ? 'node' : 'chapter',
        forumId: String(existingIssue?.club || existingIssue?.node || existingIssue?.chapter),
        userId: String(userId)
      });

      if (!isMember || (['member', 'moderator'].includes(role) && existingIssue?.createdBy.toString() !== userId.toString())) {
        throw new ForbiddenException('You are not authorized to delete this issue');
      }

      // soft delete issue
      await this.issuesModel.findByIdAndUpdate(issueId, { $set: { isDeleted: true } });

      // update feed status to deleted
      await this.assetsService.updateFeed(issueId, 'deleted');

      return { status: true, message: 'Issue deleted successfully' };
    } catch (error) {
      console.error("Issue DELETE Error :: ", error);
      if (error instanceof ForbiddenException) throw error;
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        'Error while deleting Issue',
        error,
      );
    }
  }

  async getDraftIssues(issueId: string, userId: string) {
    try {
      const issue = await this.issuesModel.findOne({ _id: issueId, publishedStatus: "draft", createdBy: userId })
      if (!issue) {
        throw new NotFoundException('Issue not found')
      }
      return {
        success: true,
        data: issue,
        message: 'Issue fetched successfully'
      }
    } catch (error) {
      console.log('error', error)
      throw error
    }
  }
} 