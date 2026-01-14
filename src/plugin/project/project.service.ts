import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotAcceptableException,
  NotFoundException,
} from '@nestjs/common';
import {
  CreateProjectDto,
  UpdateProjectDto,
} from './dto/create-update-project.dto';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { Projects } from 'src/shared/entities/projects/project.entity';
import { NodeMembers } from 'src/shared/entities/node-members.entity';
import { UploadService } from 'src/shared/upload/upload.service';
import { ProjectParameter } from 'src/shared/entities/projects/parameter.entity';
import { ClubMembers } from 'src/shared/entities/clubmembers.entity';
import { ProjectFaq } from 'src/shared/entities/projects/faq.enitity';
import { ProjectContribution } from 'src/shared/entities/projects/contribution.entity';
import { AnswerFaqDto, CreateDtoFaq } from './dto/faq.dto';
import { ProjectAdoption } from 'src/shared/entities/projects/project-adoption.entity';
import { ChapterProject } from 'src/shared/entities/chapters/modules/chapter-projects.entity';
import { Chapter } from 'src/shared/entities/chapters/chapter.entity';
import { ChapterMember } from 'src/shared/entities/chapters/chapter-member.entity';
import { TCreationType, TForum } from 'typings';
import { User } from 'src/shared/entities/user.entity';
import { CommonService } from '../common/common.service';
import { Comment } from 'src/shared/entities/comment.entity';
import { Club } from 'src/shared/entities/club.entity';
import { async } from 'rxjs';
import { AssetsService } from 'src/assets/assets.service';
import { Node_ } from 'src/shared/entities/node.entity';

/**
 * Service responsible for managing all project-related operations
 * Handles CRUD operations for projects, file uploads, and associated data like FAQs and parameters
 */
@Injectable()
export class ProjectService {
  constructor(
    @InjectModel(Projects.name) private readonly projectModel: Model<Projects>,
    @InjectModel(ProjectAdoption.name) private readonly projectAdoptionModel: Model<ProjectAdoption>,
    @InjectModel(Chapter.name) private readonly chapterModel: Model<Chapter>,
    @InjectModel(ClubMembers.name) private readonly clubMembersModel: Model<ClubMembers>,
    @InjectModel(NodeMembers.name) private readonly nodeMembersModel: Model<NodeMembers>,
    @InjectModel(Club.name) private readonly clubModel: Model<Club>,
    @InjectModel(Node_.name) private readonly nodeModel: Model<Node_>,
    @InjectModel(ChapterMember.name) private readonly chapterMembersModel: Model<ChapterMember>,
    @InjectModel(ProjectFaq.name) private readonly faqModel: Model<ProjectFaq>,
    @InjectModel(ProjectParameter.name) private readonly parameterModel: Model<ProjectParameter>,
    @InjectModel(ProjectContribution.name)
    private readonly contributionModel: Model<ProjectContribution>,
    private readonly s3FileUpload: UploadService,
    @InjectConnection() private connection: Connection,
    @InjectModel(ChapterProject.name) private readonly chapterProjectModel: Model<ChapterProject>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Comment.name) private readonly commentModel: Model<Comment>,
    private readonly commonService: CommonService,
    private readonly assetsService: AssetsService,
  ) { }

  //--------------------------------------------------------------------------
  /**
   * Creates a new project with all associated data and files
   * Handles file uploads, permission checks, and data validation in a single transaction
   *
   * @param createProjectDto - Contains all project details like title, budget, etc
   * @param userId - ID of the user creating the project
   * @param documentFiles - Array of project-related documents to be uploaded
   * @param bannerImage - Project banner image file (optional)
   * @returns Newly created project with all associated data
   * @throws Error if validation fails or user lacks permissions
   */
  async createV0(
    createProjectDto: CreateProjectDto,
    userId: Types.ObjectId,
    documentFiles: Express.Multer.File[],
    bannerImage: Express.Multer.File | null,
  ) {

    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      // Extract all fields from the DTO for easier access
      const {
        club,
        node,
        chapter,
        title,
        region,
        budget,
        deadline,
        significance,
        solution,
        committees,
        champions,
        aboutPromoters,
        fundingDetails,
        faqs,
        keyTakeaways,
        risksAndChallenges,
        parameters,
        relatedEvent,
        closingRemark,
        howToTakePart
      } = createProjectDto;
      const transformedChampions = JSON.parse(champions as any).map((champ) => ({ user: new Types.ObjectId(champ.user) }))
      // Ensure required fields are present
      if (!title || (!club && !node && !chapter)) {
        throw new BadRequestException('Missing required project details');
      }

      // Handle file uploads concurrently for better performance
      const [uploadedBannerImage, uploadedDocumentFiles] = await Promise.all([
        bannerImage ? this.uploadFile(bannerImage) : null,
        Promise.all(documentFiles.map((file) => this.uploadFile(file))),
      ]);

      // Create standardized file objects with metadata
      const fileObjects = uploadedDocumentFiles.map((file, index) => ({
        url: file.url,
        originalname: documentFiles[index].originalname,
        mimetype: documentFiles[index].mimetype,
        size: documentFiles[index].size,
      }));

      // Process banner image if provided
      const uploadedBannerImageObject = bannerImage
        ? {
          url: uploadedBannerImage.url,
          originalname: bannerImage.originalname,
          mimetype: bannerImage.mimetype,
          size: bannerImage.size,
        }
        : null;

      // Construct core project data
      const baseProjectData = {
        title,
        region,
        budget: JSON.parse(budget),
        deadline,
        significance,
        solution,
        committees: JSON.parse(committees as any),
        champions: transformedChampions,
        faqs: JSON.parse(faqs as any),
        aboutPromoters,
        fundingDetails,
        keyTakeaways,
        risksAndChallenges,
        bannerImage: uploadedBannerImageObject,
        files: fileObjects,
        relatedEvent,
        closingRemark,
        howToTakePart,
        isPublic: false
      };

      // Determine membership type and verify permissions
      let membershipModel = null;
      let membershipIdentifier = null;

      if (club) {
        membershipModel = this.clubMembersModel;
        membershipIdentifier = { club: new Types.ObjectId(club) };
      } else if (node) {
        membershipModel = this.nodeMembersModel;
        membershipIdentifier = { node: new Types.ObjectId(node) };
      } else if (chapter) {
        membershipModel = this.chapterMembersModel;
        membershipIdentifier = { chapter: new Types.ObjectId(chapter) }
      }


      // Verify user's membership and role
      let membership = null;
      if (membershipModel) {
        membership = await membershipModel.findOne({
          ...membershipIdentifier,
          user: new Types.ObjectId(userId),
        });
        if (!membership || !membership.role) {
          throw new BadRequestException('You are not a member of this forum');
        }
      }

      const publishedStatus = membershipModel ? membership.role === 'member' ? 'proposed' : 'published' : 'draft';

      // Set project status based on user's role
      const projectData = {
        ...baseProjectData,
        ...(club ? { club: new Types.ObjectId(club) } : {}),
        ...(node ? { node: new Types.ObjectId(node) } : {}),
        ...(chapter ? { chapter: new Types.ObjectId(chapter) } : {}),
        publishedStatus: publishedStatus,
        createdBy: new Types.ObjectId(userId),
        publishedBy: membership.role !== 'member' ? new Types.ObjectId(userId) : null,
      };


      // Create and save the project
      const newProject = new this.projectModel(projectData);
      const savedProject = await newProject.save({ session });

      console.log({ savedProject })

      // Handle parameters if provided
      if (
        JSON.parse(parameters as any) &&
        JSON.parse(parameters as any).length > 0
      ) {
        const parametersToCreate = JSON.parse(parameters as any).map(
          (param) => {
            return {
              project: savedProject._id,
              ...param,
            };
          },
        );
        console.log({ parametersToCreate })
        try {
          const parameterValue = await this.parameterModel.insertMany(
            parametersToCreate,
            { session, ordered: true }
          );
          console.log({ parameterValue });
        } catch (error) {
          throw new BadRequestException('Failed to create project parameters');
        }
      }

      // Handle FAQs if provided
      if (JSON.parse(faqs as any) && JSON.parse(faqs.length as any) > 0) {
        const faqsToCreate = JSON.parse(faqs as any).map((faq) => ({
          ...faq,
          project: savedProject._id,
          askedBy: userId,
          answeredBy: userId,
          status: 'approved',
          Date: new Date(),
        }));
        console.log({ faqsToCreate })
        try {
          const faqValue = await this.faqModel.insertMany(
            faqsToCreate,
            { session, ordered: true }
          );
          console.log({ faqValue });
        } catch (error) {
          throw new BadRequestException('Failed to create project FAQs');
        }
      }

      if (club && publishedStatus === 'published') {
        await this.commonService.copyAnAssetToAllClubChapters({
          clubId: club,
          assetId: savedProject._id as string,
          config: {
            sourceModel: this.projectModel,
            targetModel: this.chapterProjectModel,
            referenceKey: 'project'
          },
          session
        });
      }

      if (savedProject?.publishedStatus === 'published') {
        this.assetsService.createFeed(
          savedProject.club || savedProject.node || savedProject.chapter,
          savedProject.club ? 'Club' : savedProject.node ? 'Node' : 'Chapter',
          'Projects',
          savedProject._id as any,
        )
      }

      // Commit all changes
      await session.commitTransaction();
      return savedProject;
    } catch (error) {
      // Rollback all changes if any operation fails
      console.log({ error })
      await session.abortTransaction();
      if (error instanceof BadRequestException) throw new BadRequestException(error.message);
      if (error.name === 'ValidationError') throw new BadRequestException(error.message);
      throw new InternalServerErrorException('An unexpected error occurred', error.message);
    } finally {
      // Clean up database session
      session.endSession();
    }
  }

  async create(
    dto: CreateProjectDto,
    userId: Types.ObjectId,
    documentFiles: Express.Multer.File[],
    bannerImage: Express.Multer.File | null,
  ) {
    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      // --- Forum / Membership Validation ---
      const { membershipModel, membershipIdentifier } = this.getMembershipModel(dto);

      let membership = null;
      if (membershipModel) {
        membership = await membershipModel.findOne({
          ...membershipIdentifier,
          user: new Types.ObjectId(userId),
        });
        if (!membership || !membership.role) {
          throw new BadRequestException("You are not a member of this forum");
        }
      }

      const publishedStatus = dto.publishedStatus === "draft" ? "draft" : this.determinePublishedStatus(membership?.role, membershipModel);

      if (publishedStatus === "published") {
        await this.assetsService.checkAndIncrement(userId, session);
      }

      // --- File Handling ---
      const [uploadedBannerImage, uploadedDocumentFiles] = await Promise.all([
        bannerImage ? this.uploadFile(bannerImage) : null,
        Promise.all(documentFiles.map((file) => this.uploadFile(file))),
      ]);

      const fileObjects = this.buildFileObjects(uploadedDocumentFiles, documentFiles);
      const bannerObject = this.buildBannerObject(uploadedBannerImage, bannerImage);

      // --- Project Data ---
      // const publishedStatus = dto.publishedStatus === "draft" ? "draft" : this.determinePublishedStatus(membership?.role, membershipModel);
      const transformedChampions = JSON.parse(dto.champions as any).map((champ) => ({
        user: new Types.ObjectId(champ.user),
      }));

      if (dto.projectId) {
        const draftProject = await this.updateDraft(dto, fileObjects, bannerObject, transformedChampions, session)
        await session.commitTransaction();
        return {
          data: draftProject,
          success: true,
          message: "Project draft saved successfully",
        };
      }

      const baseProjectData = this.buildBaseProjectData(dto, fileObjects, bannerObject, transformedChampions);

      const projectData = {
        ...baseProjectData,
        ...(dto.club ? { club: new Types.ObjectId(dto.club) } : {}),
        ...(dto.node ? { node: new Types.ObjectId(dto.node) } : {}),
        ...(dto.chapter ? { chapter: new Types.ObjectId(dto.chapter) } : {}),
        publishedStatus,
        createdBy: new Types.ObjectId(userId),
        publishedBy: membership?.role !== "member" ? new Types.ObjectId(userId) : null,
      };

      // --- Save Project ---
      const newProject = new this.projectModel(projectData);
      const savedProject = await newProject.save({ session });

      // --- Handle Parameters ---
      await this.handleParameters(dto.parameters, savedProject, session);

      // --- Handle FAQs ---
      await this.handleFaqs(dto.faqs, savedProject, userId, session);

      // --- Propagation ---
      if (dto.club && publishedStatus === "published") {
        await this.commonService.copyAnAssetToAllClubChapters({
          clubId: dto.club,
          assetId: savedProject._id as string,
          config: {
            sourceModel: this.projectModel,
            targetModel: this.chapterProjectModel,
            referenceKey: "project",
          },
          session,
        });
      }

      // --- Feed Creation ---
      if (savedProject?.publishedStatus === "published") {
        await this.assetsService.createFeed(
          savedProject.club || savedProject.node || savedProject.chapter,
          savedProject.club ? "Club" : savedProject.node ? "Node" : "Chapter",
          "Projects",
          savedProject._id as any,
        );
      }

      await session.commitTransaction();
      return savedProject;
    } catch (err) {
      await session.abortTransaction();
      if (err instanceof BadRequestException || err instanceof ForbiddenException) throw err;
      if (err.name === "ValidationError") throw new BadRequestException(err.message);
      throw new InternalServerErrorException("An unexpected error occurred", err.message);
    } finally {
      session.endSession();
    }
  }

  /* ------------------------- Helper Methods ------------------------- */

  private getMembershipModel(dto: CreateProjectDto): { membershipModel: Model<any>, membershipIdentifier: any } {
    if (dto.club) return { membershipModel: this.clubMembersModel, membershipIdentifier: { club: new Types.ObjectId(dto.club) } };
    if (dto.node) return { membershipModel: this.nodeMembersModel, membershipIdentifier: { node: new Types.ObjectId(dto.node) } };
    if (dto.chapter) return { membershipModel: this.chapterMembersModel, membershipIdentifier: { chapter: new Types.ObjectId(dto.chapter) } };
    return { membershipModel: null, membershipIdentifier: null };
  }

  private determinePublishedStatus(role?: string, membershipModel?: any) {
    if (!membershipModel) return "draft";
    return role === "member" ? "proposed" : "published";
  }

  private buildFileObjects(uploadedFiles: any[], originalFiles: Express.Multer.File[]) {
    return uploadedFiles.map((file, index) => ({
      url: file.url,
      originalname: originalFiles[index].originalname,
      mimetype: originalFiles[index].mimetype,
      size: originalFiles[index].size,
    }));
  }

  private buildBannerObject(uploadedBanner: any, bannerImage: Express.Multer.File | null) {
    return bannerImage
      ? {
        url: uploadedBanner.url,
        originalname: bannerImage.originalname,
        mimetype: bannerImage.mimetype,
        size: bannerImage.size,
      }
      : null;
  }

  private buildBaseProjectData(dto: CreateProjectDto, files: any[], bannerImage: any, champions: any[]) {
    return {
      title: dto.title,
      region: dto.region,
      budget: JSON.parse(dto.budget),
      deadline: dto.deadline,
      significance: dto.significance,
      solution: dto.solution,
      committees: JSON.parse(dto.committees as any),
      champions,
      faqs: JSON.parse(dto.faqs as any),
      aboutPromoters: dto.aboutPromoters,
      fundingDetails: dto.fundingDetails,
      keyTakeaways: dto.keyTakeaways,
      risksAndChallenges: dto.risksAndChallenges,
      bannerImage,
      files,
      relatedEvent: dto.relatedEvent,
      closingRemark: dto.closingRemark,
      howToTakePart: dto.howToTakePart,
      isPublic: false,
    };
  }

  private async handleParameters(parameters: any, savedProject: any, session: any) {
    if (!parameters) return;

    const parsedParams = JSON.parse(parameters as any);
    if (parsedParams.length === 0) return;

    const parametersToCreate = parsedParams.map((param) => ({
      project: savedProject._id,
      ...param,
    }));

    await this.parameterModel.insertMany(parametersToCreate, { session, ordered: true });
  }

  private async handleParametersUpdate(parameters: any, savedProject: any, deletedParams: any[], session: any) {
    if (!parameters) return;

    const parsedParams = JSON.parse(parameters as any);
    if (parsedParams.length === 0) return;

    const parametersToCreate = parsedParams.map((param) => ({
      project: savedProject._id,
      ...param,
    }));

    await this.parameterModel.insertMany(parametersToCreate, { session, ordered: true });

    await this.parameterModel.deleteMany({ project: savedProject._id, _id: { $in: deletedParams } }, { session });
  }

  private async handleFaqs(faqs: any, savedProject: any, userId: Types.ObjectId, session: any) {
    if (!faqs) return;

    const parsedFaqs = JSON.parse(faqs as any);
    if (parsedFaqs.length === 0) return;

    const faqsToCreate = parsedFaqs.map((faq) => ({
      ...faq,
      project: savedProject._id,
      askedBy: userId,
      answeredBy: userId,
      status: "approved",
      Date: new Date(),
    }));

    await this.faqModel.insertMany(faqsToCreate, { session, ordered: true });
  }

  private async handleFaqsUpdate(faqs: any, savedProject: any, userId: Types.ObjectId, deletedFaqs: any[], session: any) {
    if (!faqs) return;

    const parsedFaqs = JSON.parse(faqs as any);
    if (parsedFaqs.length === 0) return;

    const faqsToCreate = parsedFaqs.map((faq) => ({
      ...faq,
      project: savedProject._id,
      askedBy: userId,
      answeredBy: userId,
      status: "approved",
      Date: new Date(),
    }));

    await this.faqModel.insertMany(faqsToCreate, { session, ordered: true });
    await this.faqModel.deleteMany({ project: savedProject._id, _id: { $in: deletedFaqs } }, { session });
  }

  private async updateDraft(dto: any, fileObjects: any[], bannerObject: any, champions: any[], session: any) {
    const baseProjectData = this.buildBaseProjectData(dto, fileObjects, bannerObject, champions);
    const existingDraft = await this.projectModel.findOne({
      _id: dto.projectId,
      publishedStatus: "draft",
    });

    // Max 5 file check
    const combinedFiles = [
      ...(existingDraft.files || []).filter(
        (f: any) => !dto.deletedImageUrls?.includes(f.url),
      ),
      ...fileObjects,
    ];
    if (combinedFiles.length > 5)
      throw new BadRequestException("You can upload maximum 5 files");

    const updatedProject = await this.projectModel.findByIdAndUpdate(
      dto.projectId,
      { ...baseProjectData, files: combinedFiles, $inc: { version: 1 } },
      { new: true, session },
    );

    if (dto?.deletedImageUrls?.length > 0) {
      await this.deleteFiles(dto.deletedImageUrls);
    }

    await this.handleParametersUpdate(dto.parameters, updatedProject, dto.deletedParameters, session);

    await this.handleFaqsUpdate(dto.faqs, updatedProject, dto.userId, dto.deletedFaqs, session);

    return updatedProject;
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

  //----------------------------------------------------------------------------

  async getProjects2({
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
        const issuePlugin = forumData?.plugins?.find((plugin: any) => plugin.plugin === 'projects');
        isPluginArchived = issuePlugin?.isArchived || false;
      } else if (forum === 'node') {
        const forumData = await this.nodeModel.findOne({ _id: new Types.ObjectId(forumId) }).lean().exec();
        const issuePlugin = forumData?.plugins?.find((plugin: any) => plugin.plugin === 'projects');
        isPluginArchived = issuePlugin?.isArchived || false;
      }

      if (isPluginArchived) {
        throw new ForbiddenException('You are not authorized to access this resource');
      }

      let { isMember, role } = await this.commonService.getUserDetailsInForum({ forum, forumId, userId });
      if (!isMember && !isPublic && type !== 'global') throw new ForbiddenException('You are not authorized to access this resource');

      // Check if user is member of the forum
      // let { isMember } = await this.commonService.getUserDetailsInForum({ forum, forumId, userId });
      // if (!isMember && type !== "global")
      //   throw new BadRequestException('You are not authorized to access this resource');

      // Validate pagination parameters
      const validPage = Math.max(1, page);
      const validLimit = Math.max(1, limit);
      const skip = (validPage - 1) * validLimit;

      // Base match conditions
      const baseMatch: any = { isDeleted: { $ne: true }, isArchived: { $ne: true } };

      // Add forum filter if provided
      if (forum && forumId) {
        baseMatch[forum] = new Types.ObjectId(forumId);
      }

      // Add type-based filters
      switch (type) {
        case 'all':
          baseMatch.publishedStatus = { $in: ['published', 'inactive'] };
          if (['admin', 'owner']?.includes(role)) delete baseMatch.isArchived;
          break;
        case 'active':
          baseMatch.publishedStatus = 'published';
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

      if (search?.trim()) {
        baseMatch.$or = [
          { title: new RegExp(search, 'i') },
          { significance: new RegExp(search, 'i') },
          { solution: new RegExp(search, 'i') },
          { aboutPromoters: new RegExp(search, 'i') }
        ];
      }

      if (type === 'global') {
        const projects = await this.projectModel.find(baseMatch)
          .skip(skip)
          .limit(validLimit)
          .sort({ createdAt: -1 })
          .populate({
            path: 'createdBy',
            select: 'userName firstName middleName lastName profileImage interests'
          }).populate({
            path: 'publishedBy',
            select: 'userName firstName middleName lastName profileImage interests'
          })
          .populate({
            path: 'club',
            select: 'name about domain profileImage coverImage isPublic '
          }).populate({
            path: 'node',
            select: 'name about domain profileImage coverImage isPublic '
          }).populate({
            path: 'chapter',
            select: 'name about domain profileImage coverImage'
          })

        // Count for pagination
        const totalCount = await this.projectModel.countDocuments(baseMatch);
        const totalPages = Math.ceil(totalCount / validLimit);

        // Format projects
        const formattedProjects = projects.map(project => {
          const projectObj = project.toObject();
          return {
            ...projectObj,
            type: 'creation',
            adoptionCount: 0,
            adoptionId: null
          };
        });

        return {
          projects: formattedProjects,
          pagination: {
            currentPage: validPage,
            totalPages,
            totalItems: totalCount,
            itemsPerPage: validLimit,
            hasNextPage: validPage < totalPages,
            hasPreviousPage: validPage > 1,
          },
        };
      }

      // For other types, count total items first for pagination info
      const [totalProjectCount, totalAdoptionCount] = await Promise.all([
        this.projectModel.countDocuments(baseMatch),
        this.projectAdoptionModel.countDocuments({
          ...baseMatch,
          [forum]: new Types.ObjectId(forumId),
          type: 'adopted',
          isArchived: false
        })
      ]);

      const totalCount = totalProjectCount + totalAdoptionCount;
      const totalPages = Math.ceil(totalCount / validLimit);

      // Query Projects collection
      const projectsQuery = this.projectModel.find(baseMatch)
        .skip(skip)
        .limit(validLimit)
        .sort({ createdAt: -1 })
        .populate({
          path: 'createdBy',
          select: 'userName firstName middleName lastName profileImage interests'
        }).populate({
          path: 'publishedBy',
          select: 'userName firstName middleName lastName profileImage interests'
        })
        .populate({
          path: 'node',
          select: 'name about domain profileImage coverImage'
        }).populate({
          path: 'club',
          select: 'name about domain profileImage coverImage isPublic '
        }).populate({
          path: 'chapter',
          select: 'name about domain profileImage coverImage'
        })
      // Query ProjectAdoption collection
      const projectAdoptionQuery = this.projectAdoptionModel.find({
        ...baseMatch,
        [forum]: new Types.ObjectId(forumId),
        type: 'adopted',
        isArchived: false
      })
        .skip(skip)
        .limit(validLimit)
        .sort({ createdAt: -1 })
        .populate({
          path: 'project',
          populate: [
            { path: 'createdBy', select: 'userName firstName middleName lastName profileImage interests' },
            { path: 'publishedBy', select: 'userName firstName middleName lastName profileImage interests' },
            { path: 'club', select: 'name about domain profileImage coverImage isPublic ', strictPopulate: false },
            { path: 'node', select: 'name about domain profileImage coverImage ', strictPopulate: false },
            { path: 'chapter', select: 'name about domain profileImage coverImage ', strictPopulate: false }
          ],
        })
        .populate({
          path: 'proposedBy',
          select: 'userName firstName middleName lastName profileImage interests'
        })
        .populate({
          path: 'club',
          select: 'name about domain profileImage coverImage isPublic '
        }).populate({
          path: 'node',
          select: 'name about domain profileImage coverImage '
        }).populate({
          path: 'chapter',
          select: 'name about domain profileImage coverImage  '
        })

      // Execute queries
      const [projects, projectAdoptions] = await Promise.all([
        projectsQuery,
        projectAdoptionQuery
      ]);

      // Get adoption counts for projects
      const projectIds = projects.map(p => p._id);
      const adoptionCounts = await this.projectAdoptionModel.aggregate([
        { $match: { project: { $in: projectIds } } },
        { $group: { _id: '$project', count: { $sum: 1 } } }
      ]);

      // Create a map of project ID to adoption count
      const adoptionCountMap = new Map();
      adoptionCounts.forEach(item => {
        adoptionCountMap.set(item._id.toString(), item.count);
      });

      // Format projects from Projects collection
      const formattedProjects = projects.map(project => {
        const projectObj = project.toObject();
        return {
          ...projectObj,
          type: 'creation',
          adoptionCount: adoptionCountMap.get(project._id.toString()) || 0,
          adoptionId: null
        };
      });

      // Format projects from ProjectAdoption collection
      const adoptedProjects = projectAdoptions.map(adoption => {
        const projectData = (adoption?.project as any).toObject();
        return {
          ...projectData,
          _id: projectData._id, // original project ID
          type: 'adopted',
          adoptionId: adoption._id,
          proposedBy: adoption.proposedBy,
          club: projectData.club,
          node: projectData.node,
          chapter: projectData.chapter,
          createdAt: adoption.createdAt,
          adoptionCount: 1,
          ...(adoption.message && { message: adoption.message })
        };
      });

      // Merge and sort by createdAt
      const mergedProjects = [...formattedProjects, ...adoptedProjects];
      mergedProjects.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      // Take the first 'limit' items after sorting
      const paginatedProjects = mergedProjects.slice(0, validLimit);

      return {
        projects: paginatedProjects,
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
      console.error({ error });
      if (error instanceof BadRequestException || error instanceof ForbiddenException) throw error;

      throw new InternalServerErrorException(
        'Error while getting projects and adoptions',
        error.message
      );
    }
  }

  /**
   * Saves a project as draft with all associated data
   * Similar to create but specifically handles draft status and updates
   *
   * @param updateProjectDto - Contains all project details to be updated
   * @param userId - ID of the user saving the draft
   * @param documentFiles - Array of project-related documents
   * @param prevBannerImage - Previous banner image if exists
   * @returns Saved draft project
   * @throws Error if validation fails or user lacks permissions
   */
  async saveDraftProject(
    updateProjectDto: UpdateProjectDto,
    userId: Types.ObjectId,
    documentFiles: Express.Multer.File[],
    prevBannerImage: Express.Multer.File | null,
  ) {
    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      // Extract all fields from the update DTO
      const {
        club,
        node,
        chapter,
        title,
        region,
        budget,
        deadline,
        significance,
        solution,
        committees,
        champions,
        aboutPromoters,
        fundingDetails,
        keyTakeaways,
        risksAndChallenges,
        bannerImage,
        files,
        faqs,
        parameters,
        relatedEvent
      } = updateProjectDto;

      // Validate required fields
      if (!title || (!club && !node && !chapter)) {
        throw new Error('Missing required project details');
      }

      // Process file uploads concurrently
      const [uploadedBannerImage, uploadedDocumentFiles] = await Promise.all([
        this.uploadFile(prevBannerImage),
        Promise.all(documentFiles.map((file) => this.uploadFile(file))),
      ]);

      // Create standardized file objects
      const fileObjects = uploadedDocumentFiles.map((file, index) => ({
        url: file.url,
        originalname: documentFiles[index].originalname,
        mimetype: documentFiles[index].mimetype,
        size: documentFiles[index].size,
      }));

      // Process banner image if provided
      const uploadedBannerImageObject = prevBannerImage
        ? {
          url: uploadedBannerImage.url,
          originalname: prevBannerImage.originalname,
          mimetype: prevBannerImage.mimetype,
          size: prevBannerImage.size,
        }
        : null;

      // Construct base project data
      const baseProjectData = {
        title,
        region,
        budget,
        deadline,
        significance,
        solution,
        committees,
        champions,
        aboutPromoters,
        fundingDetails,
        keyTakeaways,
        risksAndChallenges,
        bannerImage: bannerImage ?? uploadedBannerImageObject,
        files: [...files, ...fileObjects],
        createdBy: new Types.ObjectId(userId),
        relatedEvent
      };

      // Determine membership type
      let membershipModel = null;
      let membershipIdentifier = null;

      if (club) {
        membershipModel = this.clubMembersModel;
        membershipIdentifier = { club: new Types.ObjectId(club) };
      } else if (node) {
        membershipModel = this.nodeMembersModel;
        membershipIdentifier = { node: new Types.ObjectId(node) };
      } else if (chapter) {
        membershipModel = this.nodeMembersModel;
        membershipIdentifier = { chapter: new Types.ObjectId(chapter) }
      }

      // Verify user membership and handle project creation
      if (membershipModel) {
        const membership = await membershipModel.findOne({
          ...membershipIdentifier,
          member: new Types.ObjectId(userId),
        });

        if (!membership || !membership.role) {
          throw new Error('You are not a member of this group');
        }

        // Create project with membership data
        const projectData = {
          ...baseProjectData,
          ...(club ? { club } : { node }),
          publishedStatus: 'draft',
        };

        const newProject = new this.projectModel(projectData);
        const savedProject = await newProject.save({ session });

        // Handle parameters if provided
        if (parameters && parameters.length > 0) {
          const parametersToCreate = parameters.map((param) => ({
            ...param,
            project: savedProject._id,
          }));

          await this.parameterModel.create(parametersToCreate, { session });
        }

        // Handle FAQs if provided
        if (faqs && faqs.length > 0) {
          const faqsToCreate = faqs.map((faq) => ({
            ...faq,
            project: savedProject._id,
            askedBy: userId,
            status: 'proposed',
            Date: new Date(),
          }));

          await this.faqModel.create(faqsToCreate, { session });
        }

        await session.commitTransaction();
        return savedProject;
      }

      // Handle project creation without membership
      const newProject = new this.projectModel({
        ...baseProjectData,
        publishedStatus: 'draft',
      });

      const savedProject = await newProject.save({ session });

      // Handle parameters if provided
      if (parameters && parameters.length > 0) {
        const parametersToCreate = parameters.map((param) => ({
          ...param,
          project: savedProject._id,
        }));

        await this.parameterModel.create(parametersToCreate, { session });
      }

      // Handle FAQs if provided
      if (faqs && faqs.length > 0) {
        const faqsToCreate = faqs.map((faq) => ({
          ...faq,
          project: savedProject._id,
          askedBy: userId,
          status: 'proposed',
          Date: new Date(),
        }));

        await this.faqModel.create(faqsToCreate, { session });
      }

      await session.commitTransaction();
      return savedProject;
    } catch (error) {
      await session.abortTransaction();
      console.error('Project creation error:', error);
      throw new Error(`Failed to create project: ${error.message}`);
    } finally {
      session.endSession();
    }
  }

  /**
   * Updates an existing project with new data and files
   * Handles permission checks, file uploads, and associated data updates
   *
   * @param id - ID of the project to update
   * @param updateProjectDto - Contains all project details to be updated
   * @param userId - ID of the user making the update
   * @param documentFiles - New document files to be uploaded
   * @param bannerImage - New banner image if provided
   * @returns Updated project with all changes
   * @throws Error if project not found or user lacks permissions
   */
  async update(
    id: string,
    updateProjectDto: UpdateProjectDto,
    userId: Types.ObjectId,
    documentFiles: Express.Multer.File[],
    bannerImage: Express.Multer.File | null,
  ) {
    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      // Verify project exists
      const project = await this.projectModel.findById(id);
      if (!project) {
        throw new NotFoundException('Project not found');
      }

      // Determine membership type
      let membershipModel = null;
      let membershipIdentifier = null;

      if (project.club) {
        membershipModel = this.clubMembersModel;
        membershipIdentifier = { club: project.club };
      } else if (project.node) {
        membershipModel = this.nodeMembersModel;
        membershipIdentifier = { node: project.node };
      }

      // Verify user permissions
      let membership = null;
      if (membershipModel) {
        membership = await membershipModel.findOne({
          ...membershipIdentifier,
          user: userId,
        });

        if (!membership) {
          throw new Error('You are not a member of this group');
        }
      }

      // Extract update fields
      const {
        title,
        region,
        budget,
        deadline,
        significance,
        solution,
        committees,
        champions,
        aboutPromoters,
        fundingDetails,
        keyTakeaways,
        risksAndChallenges,
        status,
        faqs,
        createdBy,
        parameters,
      } = updateProjectDto;

      // Handle status changes based on permissions
      let finalStatus = project.publishedStatus;
      if (status) {
        const isAdmin = membership?.role === 'admin';
        if (isAdmin) {
          finalStatus = status;
        } else if (status !== 'publish') {
          finalStatus = status;
        } else {
          throw new Error(
            'You do not have permission to change project status',
          );
        }
      }

      // Process file uploads
      const [uploadedBannerImage, uploadedDocumentFiles] = await Promise.all([
        this.uploadFile(bannerImage),
        Promise.all(documentFiles.map((file) => this.uploadFile(file))),
      ]);

      // Create file objects with metadata
      const fileObjects = uploadedDocumentFiles.map((file, index) => ({
        url: file.url,
        originalname: documentFiles[index].originalname,
        mimetype: documentFiles[index].mimetype,
        size: documentFiles[index].size,
      }));

      // Process banner image
      const uploadedBannerImageObject = bannerImage
        ? {
          url: uploadedBannerImage.url,
          originalname: bannerImage.originalname,
          mimetype: bannerImage.mimetype,
          size: bannerImage.size,
        }
        : null;

      // Prepare update data
      const updateData = {
        title,
        region,
        budget,
        deadline,
        significance,
        solution,
        committees,
        champions,
        aboutPromoters,
        fundingDetails,
        keyTakeaways,
        risksAndChallenges,
        status: finalStatus,
        publishedBy:
          membership.role !== 'member' && finalStatus === 'published'
            ? new Types.ObjectId(userId)
            : null,

        bannerImage: uploadedBannerImageObject || project.bannerImage,
        files: [...(project.files || []), ...fileObjects],
        createdBy,
      };

      // Update project document
      const updatedProject = await this.projectModel.findByIdAndUpdate(
        id,
        updateData,
        { new: true, session },
      );

      // Handle parameter updates
      if (parameters) {
        await this.parameterModel.deleteMany(
          { project: project._id },
          { session },
        );

        if (JSON.parse(parameters as any).length > 0) {
          const parametersToCreate = JSON.parse(parameters as any).map(
            (param) => ({
              ...param,
              project: project._id,
            }),
          );

          await this.parameterModel.create(parametersToCreate, { session });
        }
      }

      // Handle FAQ updates
      if (faqs) {
        await this.faqModel.deleteMany({ project: project._id }, { session });

        if (faqs.length > 0) {
          const faqsToCreate = faqs.map((faq) => ({
            ...faq,
            project: project._id,
            askedBy: userId,
            status: faq.status || 'proposed',
            Date: new Date(),
          }));

          await this.faqModel.create(faqsToCreate, { session });
        }
      }

      await session.commitTransaction();
      return updatedProject;
    } catch (error) {
      await session.abortTransaction();
      console.error('Project update error:', error);
      throw new Error(`Failed to update project: ${error.message}`);
    } finally {
      session.endSession();
    }
  }

  /**
   * Retrieves a single project with its associated FAQs and parameters
   * Implements pagination for FAQs and parameters
   *
   * @param id - Project ID to retrieve
   * @param page - Page number for pagination
   * @param limit - Number of items per page
   * @returns Project with paginated FAQs and parameters
   * @throws NotFoundException if project not found
   */

  async getSingleProject(id: string | Types.ObjectId, userId: string, requestFromForumId: Types.ObjectId, chapterAlyId: string, adoptionId: string) {
    try {

      let alyProject;
      if (adoptionId || chapterAlyId) {
        alyProject = await this.getAdoptedProject(adoptionId, chapterAlyId);

        // Check if the user has access to the forum
        if (alyProject) {
          const projectForumId = String(alyProject?.node || alyProject?.club || alyProject?.chapter);
          console.log("projectForumId", projectForumId)
          if (projectForumId !== String(requestFromForumId) && !chapterAlyId) {
            throw new ForbiddenException('You are not authorized to view this project');
          }
        }
      }


      const projectId = typeof id === 'string' ? new Types.ObjectId(id) : id;

      const _adoptions = await this.projectAdoptionModel.find({ project: projectId, publishedStatus: 'published' })
      const _adoptedClubs = _adoptions.filter(project => project.club)
      const _adoptedNodes = _adoptions.filter(project => project.node)

      const result = await this.projectModel.aggregate([
        {
          $match: {
            _id: projectId
          }
        },
        // Lookup creator details
        {
          $lookup: {
            from: 'users',
            localField: 'createdBy',
            foreignField: '_id',
            as: 'creatorDetails',
            pipeline: [
              {
                $project: {
                  userName: 1,
                  firstName: 1,
                  lastName: 1,
                  profileImage: 1,
                  email: 1
                }
              }
            ]
          }
        },
        {
          $unwind: {
            path: '$creatorDetails',
            preserveNullAndEmptyArrays: true
          }
        },
        // Lookup champions details
        {
          $lookup: {
            from: 'users',
            localField: 'champions.user',
            foreignField: '_id',
            as: 'championUsers',
            pipeline: [
              {
                $project: {
                  _id: 1,
                  userName: 1,
                  firstName: 1,
                  lastName: 1,
                  profileImage: 1
                }
              }
            ]
          }
        },
        {
          $addFields: {
            champions: '$championUsers'
          }
        },
        // Lookup committee members details
        {
          $lookup: {
            from: 'users',
            localField: 'committees.userIds.userId',
            foreignField: '_id',
            as: 'committeeUsers',
            pipeline: [
              {
                $project: {
                  _id: 1,
                  userName: 1,
                  firstName: 1,
                  lastName: 1,
                  profileImage: 1
                }
              }
            ]
          }
        },
        // Restructure committees with populated user data
        {
          $addFields: {
            committees: {
              $map: {
                input: '$committees',
                as: 'committee',
                in: {
                  designation: '$$committee.designation',
                  users: {
                    $filter: {
                      input: '$committeeUsers',
                      as: 'user',
                      cond: {
                        $in: ['$$user._id', '$$committee.userIds.userId']
                      }
                    }
                  }
                }
              }
            }
          }
        },
        // Lookup parameters
        {
          $lookup: {
            from: 'projectparameters',
            localField: '_id',
            foreignField: 'project',
            as: 'parameters'
          }
        },
        // Get only accepted contributions
        {
          $lookup: {
            from: 'projectcontributions',
            let: { paramIds: '$parameters._id' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $in: ['$parameter', '$$paramIds'] },
                      { $eq: ['$status', 'accepted'] }
                    ]
                  }
                }
              },
              // Join with parameters
              {
                $lookup: {
                  from: 'projectparameters',
                  localField: 'parameter',
                  foreignField: '_id',
                  as: 'parameterDetails'
                }
              },
              // Join with users
              {
                $lookup: {
                  from: 'users',
                  localField: 'user',
                  foreignField: '_id',
                  as: 'contributorDetails'
                }
              },
              // Join with clubs
              {
                $lookup: {
                  from: 'clubs',
                  localField: 'club',
                  foreignField: '_id',
                  as: 'clubDetails'
                }
              },
              // Unwind arrays
              {
                $unwind: {
                  path: '$parameterDetails',
                  preserveNullAndEmptyArrays: true
                }
              },
              {
                $unwind: {
                  path: '$contributorDetails',
                  preserveNullAndEmptyArrays: true
                }
              },
              {
                $unwind: {
                  path: '$clubDetails',
                  preserveNullAndEmptyArrays: true
                }
              },
              // Project needed fields
              {
                $project: {
                  _id: 1,
                  parameter: 1,
                  value: 1,
                  files: 1,
                  createdAt: 1,
                  parameterDetails: {
                    _id: 1,
                    title: 1,
                    value: 1
                  },
                  contributorDetails: {
                    _id: 1,
                    userName: 1,
                    profileImage: 1
                  },
                  clubDetails: {
                    _id: 1,
                    name: 1,
                    logo: 1
                  },
                  node: 1,
                  rootProject: 1,
                  views: 1,
                }
              }
            ],
            as: 'contributions'
          }
        },
        // Calculate totals
        {
          $addFields: {
            totalParameters: { $size: '$parameters' },
            hasParameters: { $gt: [{ $size: '$parameters' }, 0] },
            totalContributors: {
              $size: {
                $setUnion: '$contributions.contributorDetails._id'
              }
            },
            totalAcceptedValue: {
              $reduce: {
                input: '$contributions',
                initialValue: 0,
                in: { $add: ['$$value', '$$this.value'] }
              }
            }
          }
        },
        // Final projection
        {
          $project: {
            title: 1,
            region: 1,
            budget: 1,
            deadline: 1,
            significance: 1,
            solution: 1,
            committees: 1,
            champions: 1,
            aboutPromoters: 1,
            fundingDetails: 1,
            keyTakeaways: 1,
            risksAndChallenges: 1,
            bannerImage: 1,
            relatedEvent: 1,
            files: 1,
            status: 1,
            createdBy: '$creatorDetails',
            publishedBy: 1,
            parameters: 1,
            contributions: 1,
            totalParameters: 1,
            hasParameters: 1,
            totalContributors: 1,
            totalAcceptedValue: 1,
            relevant: 1,
            irrelevant: 1,
            createdAt: 1,
            updatedAt: 1,
            views: 1,
            adoptedNodes: 1,
            adoptedClubs: 1,
            node: 1,
            club: 1,
            chapter: 1,
            isPublic: 1,
            closingRemark: 1,
            howToTakePart: 1,
            publishedStatus: 1,
            isArchived: 1,
            isDeleted: 1,
            timeSpent: 1,
          }
        }
      ]);

      if (!result || result.length === 0) throw new NotFoundException('Project not found');

      const { node, club, chapter, isPublic } = result[0];
      const forum = alyProject?.chapter ? 'chapter' : alyProject?.club ? 'club' : alyProject?.node ? 'node' : chapter ? 'chapter' : node ? 'node' : club ? 'club' : null;
      const forumId = (alyProject?.node || alyProject?.club || alyProject?.chapter || node || club || chapter)?.toString();

      let { isMember, role } = await this.commonService.getUserDetailsInForum({ forum, forumId: String(forumId), userId });


      // Check if the project is archived and restrict access
      if (result[0].isArchived) {
        if (adoptionId || chapterAlyId) { // if request is from other forums then straight away
          throw new ForbiddenException('You cannot access archived adopted projects');
        }
        if (!['admin', 'owner'].includes(role) && String(result[0]?.createdBy?._id) !== String(userId)) {
          throw new ForbiddenException('You are not authorized to view this archived project');
        }
      }

      // Prevent Other forums to access an asset that is not public
      if (String(forumId) !== String(requestFromForumId) && !isPublic) {
        throw new ForbiddenException('You are not authorized to view this project');
      }

      const commentCount = await this.commentModel.countDocuments({
        "entity.entityId": chapterAlyId || adoptionId || projectId,
        "entity.entityType": Projects.name,
        parent: null
      })

      const _project = {
        ...result[0], publishedStatus: adoptionId ? alyProject?.publishedStatus : result[0].publishedStatus, currentUserRole: role,
        isOwnerOfAsset: String(result[0].createdBy._id) === String(userId), adoptedClubs: _adoptedClubs, adoptedNodes: _adoptedNodes
      }

      if (adoptionId) { _project.adoptedBy = alyProject?.proposedBy; _project.adoptedAt = alyProject?.createdAt; _project.publishedStatus = alyProject?.publishedStatus }

      return {
        project: _project,
        commentCount
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException || error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException('Error while getting project', error);
    }
  }

  private async getAdoptedProject(adoptionId?: string, chapterAlyId?: string) {
    if (adoptionId) {
      return await this.projectAdoptionModel.findById(adoptionId)
        .populate({
          path: 'proposedBy',
          select: 'userName firstName middleName lastName profileImage interests',
          strictPopulate: false,
        })
        .lean();
    } else if (chapterAlyId) {
      return await this.chapterProjectModel.findById(chapterAlyId).lean();
    }
  }


  /**
   * Retrieves all projects in the system
   * @returns Array of all projects
   * @throws BadRequestException if query fails
   */
  /**
   * Retrieves a paginated list of projects based on provided filters
   * @param status - Filter projects by status ('proposed' or 'published')
   * @param page - Page number for pagination
   * @param limit - Number of items per page
   * @param isActive - Filter by project active status
   * @param search - Optional search term to filter projects by title, region or significance
   * @param node - Optional node ID to filter projects by node
   * @param club - Optional club ID to filter projects by club
   * @returns Object containing paginated projects list and pagination metadata
   * @throws BadRequestException if query fails
   */
  async getAllProjects(
    publishedStatus: 'proposed' | 'published',
    page: number,
    limit: number,
    isActive: boolean,
    search: string,
    node?: Types.ObjectId,
    club?: Types.ObjectId,
  ) {
    try {
      // Base query for regular projects
      const projectQuery: any = {
        publishedStatus,
      };

      // Base query for adopted/proposed projects
      const adoptionQuery: any = {
        publishedStatus: 'proposed',
      };

      // Add search conditions if they exist
      if (search) {
        projectQuery.$or = [
          { title: { $regex: search, $options: 'i' } },
          { region: { $regex: search, $options: 'i' } },
          { significance: { $regex: search, $options: 'i' } },
        ];
      }

      // Add node or club filters to both queries
      if (node) {
        const nodeId = new Types.ObjectId(node);
        projectQuery.node = nodeId;
        adoptionQuery.node = nodeId;
      }
      if (club) {
        const clubId = new Types.ObjectId(club);
        projectQuery.club = clubId;
        adoptionQuery.club = clubId;
      }

      // Get total count from both collections
      const projectsTotal = await this.projectModel.countDocuments(projectQuery);
      const adoptionsTotal = await this.projectAdoptionModel.countDocuments(adoptionQuery);
      const total = projectsTotal + adoptionsTotal;

      // Calculate pagination
      const skipAmount = (page - 1) * limit;

      // Get published projects
      const projects = await this.projectModel.aggregate([
        { $match: projectQuery },
        { $sort: { createdAt: -1 } },
        { $skip: skipAmount },
        { $limit: limit },
        {
          $lookup: {
            from: 'projectadoptions',
            localField: '_id',
            foreignField: 'project',
            as: 'adoptions'
          }
        },
        {
          $addFields: {
            adoptionCount: { $size: '$adoptions' }
          }
        },
        {
          $lookup: {
            from: 'node_',
            localField: 'node',
            foreignField: '_id',
            as: 'node'
          }
        },
        {
          $lookup: {
            from: 'clubs',
            localField: 'club',
            foreignField: '_id',
            as: 'club'
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'createdBy',
            foreignField: '_id',
            as: 'createdBy'
          }
        },
        {
          $unwind: {
            path: '$node',
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $unwind: {
            path: '$club',
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $unwind: {
            path: '$createdBy',
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $project: {
            'node.name': 1,
            'node.profileImage': 1,
            'club.name': 1,
            'club.profileImage': 1,
            'createdBy.userName': 1,
            'createdBy.profileImage': 1,
            'createdBy.firstName': 1,
            'createdBy.lastName': 1,
            adoptionCount: 1,
            title: 1,
            region: 1,
            significance: 1,
            solution: 1,
            publishedStatus: 1,
            createdAt: 1,
            isProposed: { $literal: false }
          }
        }
      ]);

      // Get proposed projects
      const adoptedProjects = await this.projectAdoptionModel.aggregate([
        { $match: adoptionQuery },
        { $sort: { createdAt: -1 } },
        { $skip: skipAmount },
        { $limit: limit },
        {
          $lookup: {
            from: 'projects',
            localField: 'project',
            foreignField: '_id',
            as: 'projectDetails'
          }
        },
        {
          $unwind: {
            path: '$projectDetails',
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $lookup: {
            from: 'node_',
            localField: 'node',
            foreignField: '_id',
            as: 'node'
          }
        },
        {
          $lookup: {
            from: 'clubs',
            localField: 'club',
            foreignField: '_id',
            as: 'club'
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'proposedBy',
            foreignField: '_id',
            as: 'proposedBy'
          }
        },
        {
          $unwind: {
            path: '$node',
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $unwind: {
            path: '$club',
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $unwind: {
            path: '$proposedBy',
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $project: {
            '_id': 1,
            'node.name': 1,
            'node.profileImage': 1,
            'club.name': 1,
            'club.profileImage': 1,
            'proposedBy.userName': 1,
            'proposedBy.profileImage': 1,
            'proposedBy.firstName': 1,
            'proposedBy.lastName': 1,
            title: '$projectDetails.title',
            region: '$projectDetails.region',
            significance: '$projectDetails.significance',
            solution: '$projectDetails.solution',
            publishedStatus: 1,
            message: 1,
            createdAt: 1,
            project: 1,
            relevant: 1,
            irrelevant: 1,
            isProposed: { $literal: true }
          }
        }
      ]);

      // Combine and sort all results by createdAt
      const allProjects = [...projects, ...adoptedProjects].sort((a, b) =>
        b.createdAt.getTime() - a.createdAt.getTime()
      );

      return {
        projects: allProjects,
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      };

    } catch (error) {
      console.error('Error in getAllProjects:', error);
      throw new BadRequestException(
        'Failed to get all projects. Please try again later.',
      );
    }
  }

  async getAllClubProjectsByChapterId(
    publishedStatus: 'proposed' | 'published',
    page: number,
    limit: number,
    isActive: boolean,
    search: string,
    chapter?: Types.ObjectId,
  ): Promise<any> {
    try {
      let query: any = {};

      if (chapter) {
        query.chapter = new Types.ObjectId(chapter);
      }

      const chapterProjects = await this.chapterProjectModel
        .find(query)
        .populate({
          path: 'project',
          populate: [
            { path: 'node', select: 'name profileImage' },
            { path: 'club', select: 'name profileImage' },
            { path: 'createdBy', select: 'userName profileImage firstName lastName' }
          ],
          match: {
            publishedStatus: "published",
            isArchived: { $ne: true },
            isDeleted: { $ne: true },
            isPublic: true
          }
        })
        .populate('chapter', 'name profileImage')
        .sort({ createdAt: -1 })
        .lean();


      const filteredChapterProjects = chapterProjects.filter(p => p.project !== null);
      const total = filteredChapterProjects.length;
      const start = (page - 1) * limit;
      const paginatedChapterProjects = filteredChapterProjects.slice(start, start + limit);

      // Transform chapter projects
      const transformedChapterProjects = paginatedChapterProjects.map((cp: any) => ({
        ...cp.project,
        chapter: cp.chapter,
        chapterProjectId: cp._id,
        createdAt: cp.createdAt
      }));

      return {
        data: transformedChapterProjects,
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
      throw new BadRequestException(
        'Failed to get all projects. Please try again later.',
      );
    }
  }

  async getChapterAllProjects(
    publishedStatus: 'proposed' | 'published',
    page: number,
    limit: number,
    isActive: boolean,
    search: string,
    chapter?: Types.ObjectId,
  ): Promise<any> {
    try {
      const query: any = { publishedStatus };

      if (chapter) query.chapter = new Types.ObjectId(chapter);

      if (search) {
        query.$or = [
          { title: { $regex: search, $options: 'i' } },
          { region: { $regex: search, $options: 'i' } },
          { significance: { $regex: search, $options: 'i' } },
        ];
      }

      // Get direct projects
      const projects = await this.projectModel
        .find()
        .sort({ createdAt: -1 })
        .populate('node', 'name profileImage')
        .populate('club', 'name profileImage')
        .populate('chapter', 'name profileImage')
        .populate({
          path: 'createdBy',
          select: 'userName firstName middleName lastName profileImage interests'
        })
        .lean(); // Use lean() to get plain JavaScript objects

      // Get chapter projects
      const chapterProjects = await this.chapterProjectModel
        .find(query)
        .populate({
          path: 'project',
          populate: [
            { path: 'node', select: 'name profileImage' },
            { path: 'club', select: 'name profileImage' },
            { path: 'createdBy', select: 'userName profileImage firstName lastName' }
          ]
        })
        .populate('chapter', 'name profileImage')
        .lean(); // Use lean() to get plain JavaScript objects

      // Transform chapter projects
      const transformedChapterProjects = chapterProjects.map((cp: any) => ({
        ...cp.project,
        chapter: cp.chapter,
        chapterProjectId: cp._id,
        createdAt: (cp as any).createdAt
      }));

      // Merge and sort
      const allProjects = [...projects, ...transformedChapterProjects]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      // Calculate pagination
      const total = allProjects.length;
      const startIndex = (page - 1) * limit;
      const paginatedProjects = allProjects.slice(startIndex, startIndex + limit);
      return {
        projects: paginatedProjects,
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      throw new BadRequestException(
        'Failed to get all projects. Please try again later.',
      );
    }
  }

  async getAllClubProjectsWithChapterId(
    page: number,
    limit: number,
    isActive: boolean,
    search: string,
    chapter?: Types.ObjectId,
  ): Promise<any> {
    try {
      let query: any = {};

      if (chapter) {
        query.chapter = new Types.ObjectId(chapter);
      }


      // Get total count first using countDocuments
      const total = await this.chapterProjectModel.countDocuments(query);

      // Calculate skip value for pagination
      const skip = (page - 1) * limit;

      // Get paginated results
      const chapterProjects = await this.chapterProjectModel
        .find(query)
        .populate({
          path: 'project',
          populate: [
            { path: 'node', select: 'name profileImage' },
            { path: 'club', select: 'name profileImage' },
            { path: 'createdBy', select: 'userName profileImage firstName lastName' }
          ]
        })
        .populate('chapter', 'name profileImage')
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 }) // Add sorting if needed
        .lean();


      // Transform chapter projects
      const transformedChapterProjects = chapterProjects.map((cp: any) => ({
        ...cp.project,
        chapter: cp.chapter,
        chapterProjectId: cp._id,
        createdAt: cp.createdAt
      }));

      return {
        projects: transformedChapterProjects,
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1
      };
    } catch (error) {
      console.log('chap err', { error });
      throw new BadRequestException(
        'Failed to get all projects. Please try again later.',
      );
    }
  }
  /**
   * Retrieves all projects where the user is listed as a champion
   * @param userId - ID of the user to find projects for
   * @returns Array of projects where user is a champion
   */
  async getMyProjects(
    userId: Types.ObjectId,
    page: number,
    limit: number,
    node?: Types.ObjectId,
    club?: Types.ObjectId,
  ) {
    try {
      const query: any = {
        createdBy: userId,
      };

      if (node) query.node = node;
      else if (club) query.club = club;

      const projects = await this.projectModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('node', 'name profileImage')
        .populate('club', 'name profileImage')
        .populate('chapter', 'name profileImage')
        .populate({
          path: 'createdBy',
          select: 'userName firstName middleName lastName profileImage interests'
        })

      const total = await this.projectModel.countDocuments(query);

      delete query.createdBy;
      query.proposedBy = userId;
      if (node) query.node = new Types.ObjectId(node);
      else if (club) query.club = new Types.ObjectId(club);

      const adoptedProjects = await this.projectAdoptionModel
        .find(query)
        .populate('node', 'name profileImage')
        .populate('club', 'name profileImage')
        .populate('chapter', 'name profileImage')
        .populate('proposedBy', 'userName profileImage firstName lastName')
        .populate(
          'project',
          '-club -node -publishedStatus -proposedBy -acceptedBy -createdAt -updatedAt',
        );

      return {
        projects,
        adoptedProjects,
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      throw new BadRequestException(
        'Failed to get my projects. Please try again later.',
      );
    }
  }

  /**
   *
   * @param page
   * @param limit
   * @returns
   */
  async getGlobalProjects(page: number, limit: number) {
    try {
      const projects = await this.projectModel
        .find({ publishedStatus: 'published' })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('node', 'name profileImage')
        .populate('club', 'name profileImage')
        .populate('chapter', 'name profileImage')
        .populate({
          path: 'createdBy',
          select: 'userName firstName middleName lastName profileImage interests'
        })

      const total = await this.projectModel.countDocuments({
        publishedStatus: 'published',
      });

      return {
        projects,
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      throw new BadRequestException(
        'Failed to get my projects. Please try again later.',
      );
    }
  }

  /**
   *Retrieves all contributions and parameter of Project
   * @param user - id of the user
   * @param projectId - id of the project
   * @returns  single project with all parametes and contributions with total accepted contibution and pending contribution field
   */

  async getContributions(
    userId: Types.ObjectId,
    projectId: Types.ObjectId,
    status: 'accepted' | 'pending' | 'rejected',
  ) {
    try {

      const query = [
        {
          $match: {
            _id: new Types.ObjectId(projectId),
          },
        },
        {
          $lookup: {
            from: 'projectparameters',
            localField: '_id',
            foreignField: 'project',
            as: 'parameters',
          },
        },
        {
          $unwind: '$parameters',
        },
        {
          $lookup: {
            from: 'projectcontributions',
            let: {
              parameterId: '$parameters._id',
              userId: new Types.ObjectId(userId),
            },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$parameter', '$$parameterId'] },
                      { $eq: ['$status', status] },
                    ],
                  },
                },
              },
              {
                $group: {
                  _id: '$parameter',
                  contributions: { $push: '$$ROOT' },
                  totalValue: { $sum: '$value' },
                  contributionCount: { $sum: 1 },
                },
              },
              {
                $lookup: {
                  from: 'users',
                  localField: 'contributions.user',
                  foreignField: '_id',
                  as: 'userDetails',
                },
              },
            ],
            as: 'contributions',
          },
        },
      ];


      const data = await this.projectModel.aggregate(query);

      return data;
    } catch (error) {

      throw new BadRequestException(
        `Error while trying to fetch contributions: ${error?.message}`,
      );

    }
  }

  /**
   * Accepts pending contributions
   * @param  userId- id of the user
   * @param contributionId  - id of the contribution
   * @returns  updated contributions
   *
   */
  async acceptOrRejectContributions(
    userId: Types.ObjectId,
    contributionId: Types.ObjectId,
    type: boolean,
  ) {
    try {
      // Properly typed population
      const contributionDetails: any = await this.contributionModel
        .findById(contributionId)
        .populate('project', 'createdBy')
        .lean();
      // Check if contribution exists
      if (!contributionDetails) throw new NotAcceptableException('Contribution not found');

      // Check if the user is the project creator
      if (
        !contributionDetails.project ||
        contributionDetails?.project?.createdBy.toString() !== userId.toString()
      ) {
        throw new ForbiddenException(
          'You are not authorized to accept this contribution',
        );
      }

      // Update contribution status in a single operation
      const result = await this.contributionModel.findByIdAndUpdate(
        contributionId,
        {
          status: type ? 'accepted' : 'rejected',
          publishedBy: userId,
        },
        { new: true },
      );

      return {
        status: true,
        message: 'Contribution accepted',
        data: result,
      };
    } catch (error) {
      throw new BadRequestException(
        'Error while accepting contributions',
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  /**
   *
   * @param userID
   * @param projectId
   * @param type
   * @returns
   */
  async acceptOrRejectProposedProjectInForum(
    userID: Types.ObjectId,
    projectId: Types.ObjectId,
    type: 'accept' | 'reject',
    creationType: 'adopt-proposal' | 'create-proposal',
    club?: Types.ObjectId,
    node?: Types.ObjectId
  ) {
    if (!club && !node) throw new BadRequestException('Club or Node is required');

    const { isMember, role } = await this.commonService.getUserDetailsInForum({
      userId: userID.toString(),
      forumId: club?.toString() || node?.toString(),
      forum: club ? 'club' : 'node',
    });

    if (!isMember) throw new ForbiddenException('You are not a member of this forum');
    if (!['owner', 'admin'].includes(role)) throw new ForbiddenException('You are not authorized to perform this action');

    try {
      if (creationType == 'create-proposal') {
        return await this.projectModel.findByIdAndUpdate(
          new Types.ObjectId(projectId),
          {
            publishedStatus: type === 'accept' ? 'published' : 'rejected',
            publishedBy: userID,
          },
        );
      } else {

        const query = {
          project: new Types.ObjectId(projectId),
          ...(club ? { club: new Types.ObjectId(club) } : {}),
          ...(node ? { node: new Types.ObjectId(node) } : {})
        };

        const adoption = await this.projectAdoptionModel.findOneAndUpdate(
          query,
          {
            $set: {
              publishedStatus: type === 'accept' ? 'published' : 'rejected',
              publishedBy: userID,
            },
          }
        );

        if (type === 'accept') {
          const updateField = club ? 'adoptedClubs' : 'adoptedNodes';
          const updateValue = club
            ? { club: new Types.ObjectId(club), date: new Date() }
            : { node: new Types.ObjectId(node), date: new Date() };

          await this.projectModel.findByIdAndUpdate(
            new Types.ObjectId(projectId),
            { $push: { [updateField]: updateValue } }
          );
        }
        return { adoption };
      }
    } catch (error) {
      throw new BadRequestException('Error while accepting project', error);
    }
  }



  // Archive project
  async archiveProject(projectId: string, userId: Types.ObjectId, action: 'archive' | 'unarchive') {
    try {
      const project = await this.projectModel.findByIdAndUpdate(
        new Types.ObjectId(projectId),
        { isArchived: action === 'archive' },
        { new: true }
      );

      const projectAdoption = await this.projectAdoptionModel.updateMany(
        { project: new Types.ObjectId(projectId) },
        { isArchived: action === 'archive' }
      );

      if (project) {
        await this.assetsService.updateFeed(project?._id.toString(), project?.isArchived ? "archived" : "published")
      }

      return { status: true, message: 'Project archived successfully', data: project };
    } catch (error) {
      throw new BadRequestException('Error while archiving project', error);
    }
  }

  /**
   *
   * @param userId
   * @param createFaqDto
   * @returns
   */
  async askFaq(userId: Types.ObjectId, createFaqDto: CreateDtoFaq) {
    try {
      if (!userId && !createFaqDto.projectId) {
        throw new BadRequestException('User and project id not found');
      }

      //creating faq
      const createdFaq = await this.faqModel.create({
        Date: new Date(),
        status: 'proposed',
        askedBy: new Types.ObjectId(userId),
        question: createFaqDto.question,
        project: createFaqDto.projectId,
      });

      return {
        status: 'success',
        data: createdFaq,
        message: 'Faq created successfully',
      };
    } catch (error) {
      throw new BadRequestException(error);
    }
  }

  /**
   *
   * @param projectId
   * @returns
   */
  async getQuestionFaq(projectId: Types.ObjectId) {
    try {
      const getAllFaqQuestions = await this.faqModel
        .find({ project: new Types.ObjectId(projectId), status: 'approved' })
        .populate({ path: 'askedBy', select: 'userName email profilePicture' });

      return {
        message: 'Data fetched successfully',
        data: getAllFaqQuestions,
        status: true,
      };
    } catch (error) {
      throw new BadRequestException(error);
    }
  }

  /**
   *
   * @param userId
   * @param answerFaqDto
   * @returns
   */

  async answerFaq(userId: Types.ObjectId, answerFaqDto: AnswerFaqDto) {
    try {
      //checking if the user is the creator
      const isCreater = await this.projectModel.find({
        _id: new Types.ObjectId(answerFaqDto.project),
        createdBy: userId,
      });
      if (!isCreater) {
        throw new ForbiddenException(
          'Your are not authorized to answer this faq',
        );
      }
      //answering faq
      const answeredFaq = await this.faqModel.findByIdAndUpdate(
        new Types.ObjectId(answerFaqDto.faq),
        { answer: answerFaqDto.answer, status: answerFaqDto.status },
      );

      return { data: answeredFaq, status: false, message: 'Faq answered' };
    } catch (error) {
      throw new BadRequestException(error);
    }
  }

  /**
   * Handles file upload to S3 storage
   * @param file - File to be uploaded
   * @returns Upload response with file URL and metadata
   * @throws BadRequestException if upload fails
   */
  private async uploadFile(file: Express.Multer.File) {
    try {
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


  async reactToPost(postId: string, userId: string, action: 'like' | 'dislike') {
    if (!['like', 'dislike'].includes(action)) {
      throw new BadRequestException('Invalid action. Use "like" or "dislike".');
    }

    const userObjectId = new Types.ObjectId(userId);

    // First, ensure the document exists and initialize arrays if needed
    const existingPost = await this.projectModel.findByIdAndUpdate(
      postId,
      {
        $setOnInsert: {
          relevant: [],
          irrelevant: []
        }
      },
      {
        new: true,
        upsert: true
      }
    );

    if (!existingPost) {
      throw new BadRequestException('Post not found.');
    }

    // Now perform the reaction update in a separate operation
    let updateQuery;

    if (action === 'like') {
      const isLiked = existingPost.relevant?.some(entry => entry?.user?.equals(userObjectId));

      if (isLiked) {
        // Remove like
        updateQuery = {
          $pull: {
            relevant: { user: userObjectId }
          }
        };
      } else {
        // Add like and remove from irrelevant
        updateQuery = {
          $addToSet: {
            relevant: {
              user: userObjectId,
              date: new Date()
            }
          },
          $pull: {
            irrelevant: { user: userObjectId }
          }
        };
      }
    } else {
      const isDisliked = existingPost.irrelevant?.some(entry => entry?.user?.equals(userObjectId));

      if (isDisliked) {
        // Remove dislike
        updateQuery = {
          $pull: {
            irrelevant: { user: userObjectId }
          }
        };
      } else {
        // Add dislike and remove from relevant
        updateQuery = {
          $addToSet: {
            irrelevant: {
              user: userObjectId,
              date: new Date()
            }
          },
          $pull: {
            relevant: { user: userObjectId }
          }
        };
      }
    }

    // Execute the update
    const updatedPost = await this.projectModel.findByIdAndUpdate(
      postId,
      updateQuery,
      { new: true }
    );

    return {
      message: `Post has been ${action}d successfully.`,
      data: updatedPost
    };
  }
  async createFaq({
    projectId,
    question,
    answer,
    userId,
  }) {
    try {
      // Input validation
      if (!question?.trim())
        throw new BadRequestException('Question cannot be empty.');
      if (!answer?.trim())
        throw new BadRequestException('Answer cannot be empty.');

      const projectObjectId = new Types.ObjectId(projectId);
      const userObjectId = new Types.ObjectId(userId);
      // Find project and validate
      const project = await this.projectModel.findById(projectObjectId);
      if (!project) {
        throw new NotFoundException('Project not found');
      }

      // Find user and validate
      const user = await this.userModel.findById(userObjectId);
      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Initialize permission flags
      let hasPermission = false;
      let isHighLevelAccess = false;

      // Check if user is project creator
      if (project.createdBy.equals(userObjectId)) {
        hasPermission = true;
        isHighLevelAccess = true;
      } else {
        // Check node membership if project belongs to a node
        if (project.node) {
          const nodeMember = await this.nodeMembersModel.findOne({
            node: project.node,
            user: userObjectId,
            status: 'MEMBER',
          });

          if (nodeMember) {
            hasPermission = true;
            isHighLevelAccess = ['owner', 'admin'].includes(nodeMember.role);
          }
        }

        // Check club membership if project belongs to a club
        if (!hasPermission && project.club) {
          const clubMember = await this.clubMembersModel.findOne({
            club: project.club,
            user: userObjectId,
            status: 'MEMBER',
          });

          if (clubMember) {
            hasPermission = true;
            isHighLevelAccess = ['owner', 'admin'].includes(clubMember.role);
          }
        }
      }

      // Check final permission
      if (!hasPermission) {
        throw new ForbiddenException(
          'You must be a member of the project\'s node or club to create FAQs'
        );
      }

      // Additional validation for answer
      if (answer && !isHighLevelAccess) {
        throw new ForbiddenException(
          'Only project creators, admins, moderators, or owners can provide answers'
        );
      }

      // Create FAQ with appropriate status
      const faq = new this.faqModel({
        project: projectObjectId,
        question: question.trim(),
        answer: answer?.trim(),
        askedBy: userObjectId,
        answeredBy: answer ? userObjectId : null,
        status: isHighLevelAccess ? 'approved' : 'proposed',
        Date: new Date()
      });

      await faq.save();

      return {
        status: 'success',
        message: isHighLevelAccess
          ? 'FAQ created successfully'
          : 'FAQ submitted for approval successfully'
      };

    } catch (error) {
      // Handle known errors
      if (error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof ForbiddenException) {
        throw error
      }

      // Handle unexpected errors
      throw error
    }
  }

  async createViewsForProjects(
    userId: Types.ObjectId,
    projectId: Types.ObjectId,
  ) {

    try {
      const projects = await this.projectModel.findOne({
        _id: projectId,
        'views.user': userId
      });


      if (projects) {
        throw new BadRequestException(
          'User has already viewed this project',
        );
      }

      const updatedProjects = await this.projectModel
        .findByIdAndUpdate(
          projectId,
          {
            $addToSet: { views: { user: userId } },
          },
          { new: true },
        )
        .exec();

      if (!updatedProjects) {
        throw new NotFoundException('Project not found');
      }

      return { message: 'Viewed successfully' };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) return error
      throw new InternalServerErrorException(
        'Error while viewing Project',
        error,
      );
    }
  }

  async togglePublicPrivate(
    projectId: string,
    userId: string,
    isPublic: boolean
  ) {
    try {
      const existingProject = await this.projectModel.findOne({
        _id: projectId,
      });
      if (!existingProject) throw new NotFoundException('Project not found');

      const updatedProject = await this.commonService.togglePublicPrivate({
        assetId: projectId,
        userId,
        isPublic,
        forumType: existingProject?.club ? 'club' : existingProject?.node ? 'node' : 'chapter',
        model: this.projectModel,
        existingItem: existingProject
      });

      return updatedProject;
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        'Error while updating Project',
        error,
      );
    }
  }

  async toggleRemoveAdoptAndReadopt(
    projectId: string,
    userId: string,
    action: 're-adopt' | 'removeadoption'
  ) {
    try {
      const existingProject = await this.projectAdoptionModel.findOne({
        _id: projectId,
      });
      if (!existingProject) throw new NotFoundException('Project not found');

      const { role, isMember } = await this.commonService.getUserDetailsInForum({
        userId,
        forum: existingProject?.chapter ? 'chapter' : existingProject?.node ? 'node' : 'club',
        forumId: String(existingProject?.chapter || existingProject?.node || existingProject?.club)
      });

      if (!isMember || !['admin', 'owner']?.includes(role)) throw new ForbiddenException('You are not authorized to perform this action');

      const updatedProject = await this.projectAdoptionModel.findByIdAndUpdate(projectId, {
        publishedStatus: action === 're-adopt' ? 'published' : 'rejected'
      }, { new: true });

      return { message: 'Project adoption status updated successfully', data: updatedProject };
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        'Error while updating Project',
        error,
      );
    }
  }

  async deleteProject(projectId: string, userId: string) {
    try {
      const existingProject = await this.projectModel.findById(projectId);
      if (!existingProject) throw new NotFoundException('Project not found');
      if (existingProject?.isPublic) throw new ForbiddenException('Public Project is cannot be deleted');

      const { role, isMember } = await this.commonService.getUserDetailsInForum({
        userId,
        forum: existingProject?.chapter ? 'chapter' : existingProject?.node ? 'node' : 'club',
        forumId: String(existingProject?.chapter || existingProject?.node || existingProject?.club)
      });

      if (!isMember || (['member', 'moderator'].includes(role) && existingProject?.createdBy.toString() !== userId.toString())) {
        throw new ForbiddenException('You are not authorized to delete this project');
      }

      // soft delete project
      await this.projectModel.findByIdAndUpdate(projectId, {
        $set: { isDeleted: true }
      });

      // update feed status to deleted
      await this.assetsService.updateFeed(projectId, 'deleted');

      return { success: true, message: 'Project deleted successfully' };
    } catch (error) {
      console.error("Project DELETE Error :: ", error);
      if (error instanceof ForbiddenException) throw error;
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        'Error while deleting Project',
        error,
      );
    }
  }
}