import { Injectable, NotFoundException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { LetsTalkSubmission, LetsTalkSubmissionDocument } from './schemas/lets-talk-submission.schema';
import { StrategicNeed, StrategicNeedDocument } from './schemas/strategic-need.schema';
import { ProductCategory } from './schemas/product-category.schema';
import { StdPluginAsset } from '../shared/entities/standard-plugin/std-plugin-asset.entity';
import { CreateLetsTalkDto } from './dto/create-lets-talk.dto';
import { CreateStrategicNeedDto } from './dto/create-strategic-need.dto';
import { UpdateStrategicNeedDto } from './dto/update-strategic-need.dto';
import { SubmitResponseDto } from './dto/submit-response.dto';
import { CreateProductCategoryDto, UpdateProductCategoryDto } from './dto/create-product-category.dto';
import { CreateHistoryTimelineDto } from './dto/create-history-timeline.dto';
import { UpdateHistoryTimelineDto } from './dto/update-history-timeline.dto';
import { CommonService } from '../plugin/common/common.service';
import { TForum } from 'typings';
import { ForumProfile } from '../shared/entities/forum-profile.entity';
import { Node_ } from '../shared/entities/node.entity';
import { Club } from '../shared/entities/club.entity';
import { Chapter } from '../shared/entities/chapters/chapter.entity';
import { UploadService } from '../shared/upload/upload.service';
import { HistoryTimeline } from '../shared/entities/history-timeline.entity';
import { ForumAchievements } from '../shared/entities/forum-achievements.entity';
import { ForumFaqs } from '../shared/entities/forum-faqs.entity';
import { CustomerConnect } from '../shared/entities/customer-connect.entity';
import { ForumCampaign } from '../shared/entities/forum-campaign.entity';
import { EmitCustomerConnectAnnouncementProps, NotificationEventsService } from '../notification/notification-events.service';

@Injectable()
export class ClubsiteService {
    constructor(
        @InjectModel(LetsTalkSubmission.name)
        private letsTalkSubmissionModel: Model<LetsTalkSubmissionDocument>,
        @InjectModel(StrategicNeed.name)
        private strategicNeedModel: Model<StrategicNeedDocument>,
        @InjectModel(ProductCategory.name)
        private productCategoryModel: Model<ProductCategory>,
        @InjectModel(StdPluginAsset.name)
        private stdPluginAssetModel: Model<StdPluginAsset>,
        @InjectModel(ForumProfile.name)
        private forumProfileModel: Model<ForumProfile>,
        @InjectModel(Node_.name)
        private nodeModel: Model<Node_>,
        @InjectModel(Club.name)
        private clubModel: Model<Club>,
        @InjectModel(Chapter.name)
        private chapterModel: Model<Chapter>,
        @InjectModel(HistoryTimeline.name)
        private historyTimelineModel: Model<HistoryTimeline>,
        @InjectModel(ForumAchievements.name)
        private forumAchievementsModel: Model<ForumAchievements>,
        @InjectModel(ForumFaqs.name)
        private forumFaqsModel: Model<ForumFaqs>,
        @InjectModel(CustomerConnect.name)
        private customerConnectModel: Model<CustomerConnect>,
        @InjectModel(ForumCampaign.name)
        private forumCampaignModel: Model<ForumCampaign>,
        private readonly commonService: CommonService,
        private readonly s3FileUpload: UploadService,
        private readonly notificationEventsService: NotificationEventsService,
    ) { }

    // ==================== Let's Talk ====================

    async createLetsTalk(createLetsTalkDto: CreateLetsTalkDto): Promise<LetsTalkSubmission> {
        const submissionData: any = {
            name: createLetsTalkDto.name,
            contactInfo: createLetsTalkDto.contactInfo,
            message: createLetsTalkDto.message,
        };

        if (createLetsTalkDto.node) {
            submissionData.node = new Types.ObjectId(createLetsTalkDto.node);
        }

        if (createLetsTalkDto.club) {
            submissionData.club = new Types.ObjectId(createLetsTalkDto.club);
        }

        const createdSubmission = new this.letsTalkSubmissionModel(submissionData);
        return createdSubmission.save();
    }

    async getAllLetsTalkByForum(
        userId: string,
        forum: TForum,
        forumId: string,
    ): Promise<LetsTalkSubmission[]> {
        const { isMember, role } = await this.commonService.getUserDetailsInForum({
            userId,
            forumId,
            forum,
        });

        if (!isMember || !['admin', 'owner'].includes(role)) {
            throw new UnauthorizedException(
                'Only admin or owner can access Let\'s Talk messages',
            );
        }

        const query: any = {};
        if (forum === 'node') {
            query.node = new Types.ObjectId(forumId);
        } else if (forum === 'club') {
            query.club = new Types.ObjectId(forumId);
        }

        const submissions = await this.letsTalkSubmissionModel
            .find(query)
            .sort({ createdAt: -1 })
            .exec();

        return submissions;
    }

    // ==================== Strategic Needs ====================

    async createStrategicNeed(
        userId: string,
        createDto: CreateStrategicNeedDto,
    ): Promise<StrategicNeed> {
        const forum: TForum = createDto.club ? 'club' : 'node';
        const forumId = createDto.club || createDto.node;

        const { isMember, role } = await this.commonService.getUserDetailsInForum({
            userId,
            forumId,
            forum,
        });

        if (!isMember || !['admin', 'owner'].includes(role)) {
            throw new UnauthorizedException(
                'Only admin or owner can create strategic needs',
            );
        }

        const needData: any = {
            type: createDto.type,
            description: createDto.description,
            responses: [],
        };

        if (createDto.node) {
            needData.node = new Types.ObjectId(createDto.node);
        }

        if (createDto.club) {
            needData.club = new Types.ObjectId(createDto.club);
        }

        const createdNeed = new this.strategicNeedModel(needData);
        return createdNeed.save();
    }

    async getAllStrategicNeedsByForum(
        forum: TForum,
        forumId: string,
    ): Promise<StrategicNeed[]> {
        const query: any = {};
        if (forum === 'node') {
            query.node = new Types.ObjectId(forumId);
        } else if (forum === 'club') {
            query.club = new Types.ObjectId(forumId);
        }

        return this.strategicNeedModel
            .find(query)
            .sort({ createdAt: -1 })
            .exec();
    }

    async getStrategicNeedById(id: string): Promise<StrategicNeed> {
        const need = await this.strategicNeedModel.findById(id).exec();
        if (!need) {
            throw new NotFoundException('Strategic need not found');
        }
        return need;
    }

    async updateStrategicNeed(
        userId: string,
        id: string,
        updateDto: UpdateStrategicNeedDto,
    ): Promise<StrategicNeed> {
        const need = await this.strategicNeedModel.findById(id).exec();
        if (!need) {
            throw new NotFoundException('Strategic need not found');
        }

        const forum: TForum = need.club ? 'club' : 'node';
        const forumId = need.club?.toString() || need.node?.toString();

        const { isMember, role } = await this.commonService.getUserDetailsInForum({
            userId,
            forumId,
            forum,
        });

        if (!isMember || !['admin', 'owner'].includes(role)) {
            throw new UnauthorizedException(
                'Only admin or owner can update strategic needs',
            );
        }

        const updatedNeed = await this.strategicNeedModel
            .findByIdAndUpdate(id, updateDto, { new: true })
            .exec();

        return updatedNeed;
    }

    async deleteStrategicNeed(userId: string, id: string): Promise<void> {
        const need = await this.strategicNeedModel.findById(id).exec();
        if (!need) {
            throw new NotFoundException('Strategic need not found');
        }

        const forum: TForum = need.club ? 'club' : 'node';
        const forumId = need.club?.toString() || need.node?.toString();

        const { isMember, role } = await this.commonService.getUserDetailsInForum({
            userId,
            forumId,
            forum,
        });

        if (!isMember || !['admin', 'owner'].includes(role)) {
            throw new UnauthorizedException(
                'Only admin or owner can delete strategic needs',
            );
        }

        await this.strategicNeedModel.findByIdAndDelete(id).exec();
    }

    async submitStrategicNeedResponse(submitDto: SubmitResponseDto): Promise<StrategicNeed> {
        const need = await this.strategicNeedModel
            .findById(submitDto.strategicNeedId)
            .exec();

        if (!need) {
            throw new NotFoundException('Strategic need not found');
        }

        const response = {
            contactInfo: submitDto.contactInfo,
            message: submitDto.message,
            submittedAt: new Date(),
        };

        need.responses.push(response);
        return need.save();
    }

    async getStrategicNeedResponses(
        userId: string,
        id: string,
    ): Promise<any[]> {
        const need = await this.strategicNeedModel.findById(id).exec();
        if (!need) {
            throw new NotFoundException('Strategic need not found');
        }

        const forum: TForum = need.club ? 'club' : 'node';
        const forumId = need.club?.toString() || need.node?.toString();

        const { isMember, role } = await this.commonService.getUserDetailsInForum({
            userId,
            forumId,
            forum,
        });

        if (!isMember || !['admin', 'owner'].includes(role)) {
            throw new UnauthorizedException(
                'Only admin or owner can view responses',
            );
        }

        return need.responses;
    }

    // ==================== Product Categories ====================

    async createProductCategory(createDto: CreateProductCategoryDto) {
        const { forumId, ...rest } = createDto;
        const newCategory = new this.productCategoryModel({
            ...rest,
            forum: new Types.ObjectId(forumId),
        });
        return newCategory.save();
    }

    async getAllProductCategories(forumId: string) {
        return this.productCategoryModel
            .find({ forum: new Types.ObjectId(forumId) })
            .sort({ createdAt: -1 })
            .exec();
    }

    async updateProductCategory(id: string, updateDto: UpdateProductCategoryDto) {
        const category = await this.productCategoryModel.findByIdAndUpdate(
            id,
            updateDto,
            { new: true },
        );
        if (!category) {
            throw new NotFoundException('Category not found');
        }
        return category;
    }

    async deleteProductCategory(id: string) {
        await this.stdPluginAssetModel.updateMany(
            { productCategory: new Types.ObjectId(id) },
            { $unset: { productCategory: '' } },
        );

        const category = await this.productCategoryModel.findByIdAndDelete(id);
        if (!category) {
            throw new NotFoundException('Category not found');
        }
        return category;
    }

    async assignProductToCategory(assetId: string, categoryId: string) {
        const asset = await this.stdPluginAssetModel.findByIdAndUpdate(
            assetId,
            { productCategory: categoryId === 'uncategorized' ? null : categoryId },
            { new: true },
        );
        if (!asset) {
            throw new NotFoundException('Product not found');
        }
        return asset;
    }

    async assignProductsToCategory(productIds: string[], categoryId: string) {
        const update = { productCategory: categoryId === 'uncategorized' ? null : categoryId };
        return this.stdPluginAssetModel.updateMany(
            { _id: { $in: productIds } },
            update,
        );
    }

    async getProductsByCategory(forumId: string, categoryId: string) {
        const query: any = {
            isDeleted: false,
            $or: [
                { club: new Types.ObjectId(forumId) },
                { node: new Types.ObjectId(forumId) },
            ],
        };

        if (categoryId === 'uncategorized') {
            query.productCategory = { $eq: null };
        } else if (categoryId) {
            query.productCategory = new Types.ObjectId(categoryId);
        }

        return this.stdPluginAssetModel
            .find(query)
            .populate('productCategory')
            .populate('createdBy', 'firstName lastName profileImage userName')
            .sort({ createdAt: -1 })
            .exec();
    }

    // ==================== About ====================

    async manageAbout(
        forum: TForum,
        forumId: string,
        body: {
            usp?: string;
            website?: string;
            specialization?: string;
            challenges?: string;
            headerImages?: Express.Multer.File[];
            testimonialImages?: Express.Multer.File[];
            attachments?: Express.Multer.File[];
            showcaseImages?: Express.Multer.File[];
            clientLogos?: Express.Multer.File[];
            deletedImageUrls?: string;
            deletedAttachmentUrls?: string;
            deletedShowcaseImageUrls?: string;
            newAttachmentTitles?: string;
            showcase?: string;
            updatedAttachments?: string;
            testimonials?: string;
            targetDomains?: string;
            ourClients?: string;
            deletedResourceIds?: string;
            newFolders?: string;
            updatedResources?: string;
            newAttachmentMeta?: string;
        },
    ) {
        try {
            // Validate forum exists
            if (forum === 'node') {
                const node = await this.nodeModel.findById(forumId);
                if (!node) {
                    throw new BadRequestException('Node not found');
                }
            } else {
                const club = await this.clubModel.findById(forumId);
                if (!club) {
                    throw new BadRequestException('Club not found');
                }
            }

            // Build query based on forum type
            const forumQuery = forum === 'node'
                ? { node: new Types.ObjectId(forumId) }
                : { club: new Types.ObjectId(forumId) };

            let forumProfile = await this.forumProfileModel.findOne(forumQuery);

            if (!forumProfile) {
                forumProfile = await this.forumProfileModel.create({
                    ...forumQuery,
                    about: {
                        headerImages: [],
                        usp: '',
                        website: '',
                        specialization: '',
                        challenges: '',
                        testimonials: [],
                        targetDomains: [],
                        attachments: [],
                        showcase: [],
                        ourClients: [],
                    },
                });
            }

            // Initialize about object if it doesn't exist
            if (!forumProfile.about) {
                forumProfile.about = {
                    headerImages: [],
                    usp: '',
                    website: '',
                    specialization: '',
                    challenges: '',
                    testimonials: [],
                    targetDomains: [],
                    attachments: [],
                    ourClients: [],
                };
            }

            // Handle deleted header images
            if (body.deletedImageUrls) {
                const urlsToDelete = JSON.parse(body.deletedImageUrls);
                if (urlsToDelete.length > 0) {
                    await this.deleteFiles(urlsToDelete);
                    forumProfile.about.headerImages = forumProfile.about.headerImages.filter(
                        (img: any) => !urlsToDelete.includes(img.url),
                    );
                }
            }

            // Handle new header image uploads
            if (body.headerImages && body.headerImages.length > 0) {
                const uploadedImages = await Promise.all(
                    body.headerImages.map(async (file) => {
                        const uploadResult = await this.uploadFile(file, forum);
                        return {
                            url: uploadResult.url,
                            originalname: file.originalname,
                            mimetype: file.mimetype,
                            size: file.size,
                        };
                    }),
                );
                forumProfile.about.headerImages.push(...uploadedImages);
            }

            // Handle Testimonials
            if (body.testimonials) {
                const testimonials = JSON.parse(body.testimonials);
                let imageIndex = 0;
                const processedTestimonials = [];

                for (const t of testimonials) {
                    if (t.hasNewImage && body.testimonialImages && body.testimonialImages[imageIndex]) {
                        const file = body.testimonialImages[imageIndex];
                        const uploadResult = await this.uploadFile(file, forum);
                        imageIndex++;
                        processedTestimonials.push({
                            ...t,
                            image: uploadResult.url,
                            hasNewImage: undefined,
                            imageIndex: undefined,
                        });
                    } else {
                        const { hasNewImage, imageIndex: idx, ...rest } = t;
                        processedTestimonials.push(rest);
                    }
                }

                forumProfile.about.testimonials = processedTestimonials;
            }

            // Handle Our Clients
            if (body.ourClients) {
                const ourClients = JSON.parse(body.ourClients);
                let logoIndex = 0;
                const processedClients = [];

                for (const client of ourClients) {
                    if (client.hasNewLogo && body.clientLogos && body.clientLogos[logoIndex]) {
                        const file = body.clientLogos[logoIndex];
                        const uploadResult = await this.uploadFile(file, forum);
                        logoIndex++;
                        processedClients.push({
                            ...client,
                            logo: uploadResult.url,
                            hasNewLogo: undefined,
                            logoIndex: undefined,
                        });
                    } else {
                        const { hasNewLogo, logoIndex: idx, ...rest } = client;
                        processedClients.push(rest);
                    }
                }

                forumProfile.about.ourClients = processedClients;
            }

            // Handle Target Domains
            if (body.targetDomains) {
                forumProfile.about.targetDomains = JSON.parse(body.targetDomains);
            }

            // Handle Attachments - Delete removed attachments
            if (body.deletedAttachmentUrls || body.deletedResourceIds) {
                const deletedIds: string[] = body.deletedResourceIds ? JSON.parse(body.deletedResourceIds) : [];
                const deletedUrls: string[] = body.deletedAttachmentUrls ? JSON.parse(body.deletedAttachmentUrls) : [];

                const allDeletedIds = new Set(deletedIds);

                if (forumProfile.about.attachments && (allDeletedIds.size > 0 || deletedUrls.length > 0)) {
                    const getDescendantIds = (parentId: string): string[] => {
                        const children = forumProfile.about.attachments.filter(
                            (att: any) => att.parentId === parentId
                        );
                        let ids: string[] = [];
                        for (const child of children) {
                            ids.push(child.uuid);
                            if (child.type === 'folder') {
                                ids = [...ids, ...getDescendantIds(child.uuid)];
                            }
                        }
                        return ids;
                    };

                    for (const id of deletedIds) {
                        const item = forumProfile.about.attachments.find((att: any) => att.uuid === id);
                        if (item?.type === 'folder') {
                            const descendantIds = getDescendantIds(id);
                            descendantIds.forEach((dId: string) => allDeletedIds.add(dId));
                        }
                    }

                    const attachmentsToDelete = forumProfile.about.attachments.filter(
                        (att: any) => allDeletedIds.has(att.uuid) || (att.url && deletedUrls.includes(att.url))
                    );

                    const urlsToDeleteFromStorage = attachmentsToDelete
                        .filter((att: any) => att.type !== 'folder' && att.url)
                        .map((att: any) => att.url);

                    if (urlsToDeleteFromStorage.length > 0) {
                        await this.deleteFiles(urlsToDeleteFromStorage);
                    }

                    forumProfile.about.attachments = forumProfile.about.attachments.filter(
                        (att: any) => !allDeletedIds.has(att.uuid) && (!att.url || !deletedUrls.includes(att.url))
                    );
                }
            }

            // Handle New Folders
            if (body.newFolders) {
                const folders = JSON.parse(body.newFolders);
                const folderObjects = folders.map((f: any) => {
                    const folderName = f.title || f.name;
                    return {
                        uuid: f.uuid,
                        name: folderName,
                        title: folderName,
                        type: 'folder',
                        parentId: f.parentId || null,
                        url: '',
                        originalname: folderName,
                        mimetype: 'application/vnd.google-apps.folder',
                        size: 0
                    };
                });

                if (!forumProfile.about.attachments) {
                    forumProfile.about.attachments = [];
                }
                forumProfile.about.attachments.push(...folderObjects);
            }

            // Update existing resources (rename / move)
            if (body.updatedResources) {
                const updates = JSON.parse(body.updatedResources);
                if (forumProfile.about.attachments) {
                    forumProfile.about.attachments = forumProfile.about.attachments.map((att: any) => {
                        const update = updates.find((u: any) => u.uuid === att.uuid);
                        if (update) {
                            const newTitle = update.title ?? update.name ?? att.title;
                            return {
                                ...att,
                                title: newTitle,
                                parentId: update.parentId !== undefined ? update.parentId : att.parentId
                            };
                        }
                        return att;
                    });
                }
            }

            // Backward compatibility for updatedAttachments
            if (body.updatedAttachments) {
                const updatedAttachments = JSON.parse(body.updatedAttachments);
                if (forumProfile.about.attachments) {
                    forumProfile.about.attachments = forumProfile.about.attachments.map((att: any) => {
                        const update = updatedAttachments.find((u: any) => u.url === att.url);
                        if (update) {
                            return { ...att, title: update.title };
                        }
                        return att;
                    });
                }
            }

            // Upload new attachments
            if (body.attachments && body.attachments.length > 0) {
                const newAttachmentTitles = body.newAttachmentTitles ? JSON.parse(body.newAttachmentTitles) : [];
                const newAttachmentMeta = body.newAttachmentMeta ? JSON.parse(body.newAttachmentMeta) : [];

                const uploadedAttachments = await Promise.all(
                    body.attachments.map(async (file, index) => {
                        const uploadResult = await this.uploadFile(file, forum);
                        const meta = newAttachmentMeta[index] || {};
                        const uuid = meta.uuid || new Types.ObjectId().toString();

                        return {
                            uuid: uuid,
                            url: uploadResult.url,
                            originalname: file.originalname,
                            mimetype: file.mimetype,
                            size: file.size,
                            title: newAttachmentTitles[index] || file.originalname,
                            type: 'file' as const,
                            parentId: meta.parentId || null
                        };
                    }),
                );

                if (!forumProfile.about.attachments) {
                    forumProfile.about.attachments = [];
                }
                forumProfile.about.attachments.push(...uploadedAttachments);
            }

            // Handle deleted showcase images
            if (body.deletedShowcaseImageUrls) {
                const deletedShowcaseImageUrls = JSON.parse(body.deletedShowcaseImageUrls);
                if (deletedShowcaseImageUrls.length > 0) {
                    await this.deleteFiles(deletedShowcaseImageUrls);
                }
            }

            // Handle Showcase
            if (body.showcase) {
                const showcaseItems = JSON.parse(body.showcase);
                let imageIndex = 0;

                const processedShowcase = await Promise.all(
                    showcaseItems.map(async (item: any) => {
                        const newImages = [];
                        if (item.newImageCount && item.newImageCount > 0) {
                            for (let i = 0; i < item.newImageCount; i++) {
                                if (body.showcaseImages && body.showcaseImages[imageIndex]) {
                                    const file = body.showcaseImages[imageIndex];
                                    const uploadResult = await this.uploadFile(file, forum);
                                    newImages.push(uploadResult.url);
                                    imageIndex++;
                                }
                            }
                        }

                        const existingImages = item.images || [];
                        const validExistingImages = existingImages.filter((url: string) => !url.startsWith('blob:'));

                        return {
                            title: item.title,
                            description: item.description,
                            images: [...validExistingImages, ...newImages],
                        };
                    }),
                );
                forumProfile.about.showcase = processedShowcase;
            }

            // Update text fields
            if (body.usp !== undefined) {
                forumProfile.about.usp = body.usp;
            }
            if (body.website !== undefined) {
                forumProfile.about.website = body.website;
            }
            if (body.specialization !== undefined) {
                forumProfile.about.specialization = body.specialization;
            }
            if (body.challenges !== undefined) {
                forumProfile.about.challenges = body.challenges;
            }

            forumProfile.markModified('about');
            await forumProfile.save();

            return {
                message: 'Forum about section updated successfully',
                data: forumProfile.about,
            };
        } catch (error) {
            console.log(error);
            throw error;
        }
    }

    async getAbout(forum: TForum, forumId: string) {
        try {
            const forumQuery = forum === 'node'
                ? { node: new Types.ObjectId(forumId) }
                : { club: new Types.ObjectId(forumId) };

            const forumProfile = await this.forumProfileModel.findOne(forumQuery);

            if (!forumProfile || !forumProfile.about) {
                return {
                    message: 'No about section found',
                    data: {
                        headerImages: [],
                        usp: '',
                        website: '',
                        specialization: '',
                        challenges: '',
                        testimonials: [],
                        targetDomains: [],
                        attachments: [],
                        ourClients: [],
                    },
                };
            }

            return {
                message: 'About section fetched successfully',
                data: forumProfile.about,
            };
        } catch (error) {
            console.log(error);
            throw error;
        }
    }

    // ==================== History Timeline ====================

    async createHistoryTimeline(dto: CreateHistoryTimelineDto) {
        try {
            const data = {
                ...dto,
                ...(dto.node && { node: new Types.ObjectId(dto.node) }),
                ...(dto.club && { club: new Types.ObjectId(dto.club) }),
                ...(dto.chapter && { chapter: new Types.ObjectId(dto.chapter) }),
            }
            const created = new this.historyTimelineModel(data);
            return created.save();
        } catch (error) {
            console.log(error);
            throw error;
        }
    }

    async getAllHistoryTimeline(filter: Partial<{ node: string; club: string; chapter: string }>) {
        try {
            const query: any = {};
            if (filter.node) query.node = new Types.ObjectId(filter.node);
            if (filter.club) query.club = new Types.ObjectId(filter.club);
            if (filter.chapter) query.chapter = new Types.ObjectId(filter.chapter);

            return this.historyTimelineModel.find(query).sort({ year: -1 }).exec();
        } catch (error) {
            console.log(error);
            throw error;
        }
    }

    async updateHistoryTimeline(id: string, dto: UpdateHistoryTimelineDto) {
        try {
            const data = {
                ...dto,
                ...(dto.node && { node: new Types.ObjectId(dto.node) }),
                ...(dto.club && { club: new Types.ObjectId(dto.club) }),
                ...(dto.chapter && { chapter: new Types.ObjectId(dto.chapter) }),
            }
            const updated = await this.historyTimelineModel.findByIdAndUpdate(id, data, { new: true });
            if (!updated) throw new NotFoundException('Timeline entry not found');
            return updated;
        } catch (error) {
            console.log(error);
            throw error;
        }
    }

    async deleteHistoryTimeline(id: string) {
        try {
            const deleted = await this.historyTimelineModel.findByIdAndDelete(id);
            if (!deleted) throw new NotFoundException('Timeline entry not found');
            return { message: 'Deleted successfully' };
        } catch (error) {
            console.log(error);
            throw error;
        }
    }

    // ==================== Achievements ====================

    async manageAchievements(
        forum: TForum,
        forumId: string,
        body: {
            title: string;
            category: string;
            description: string;
            date: Date;
            links: any;
            files: any[];
            achievementId?: string;
            deletedFileUrl?: string[];
        },
    ) {
        try {
            if (body?.achievementId) {
                // Future update logic
            }

            let fileObjects = [];
            if (body.files && body.files.length > 0) {
                const uploadPromises = body.files.map((file: any) =>
                    this.uploadFile(
                        {
                            buffer: file.buffer,
                            originalname: file.originalname,
                            mimetype: file.mimetype,
                        } as Express.Multer.File,
                        forum,
                    ),
                );
                const uploadedFiles = await Promise.all(uploadPromises);
                fileObjects = uploadedFiles.map((uploadedFile, index) => ({
                    url: uploadedFile.url,
                    originalname: body.files[index].originalname,
                    mimetype: body.files[index].mimetype,
                    size: body.files[index].size,
                }));
            }

            const achievementData: Record<string, any> = {
                title: body.title,
                category: body.category,
                description: body.description,
                date: body.date,
                links: JSON.parse(body?.links || '[]'),
                files: fileObjects,
            };

            if (forum === 'node') {
                achievementData.node = new Types.ObjectId(forumId);
            } else {
                achievementData.club = new Types.ObjectId(forumId);
            }

            const createdAchievement = await this.forumAchievementsModel.create(
                achievementData,
            );

            return {
                data: createdAchievement,
                success: true,
                message: 'Achievement created successfully',
            };
        } catch (error) {
            console.log(error);

            if (error.name === 'ValidationError') {
                const messages = Object.values(error.errors).map(
                    (err: any) => err.message,
                );
                throw new BadRequestException({
                    message: 'Validation failed',
                    errors: messages,
                });
            }

            if (error.code === 11000) {
                throw new BadRequestException(
                    'Duplicate key error: a record already exists',
                );
            }

            throw error;
        }
    }

    async getAchievements(forum: TForum, forumId: string) {
        try {
            const query =
                forum === 'node'
                    ? { node: new Types.ObjectId(forumId) }
                    : { club: new Types.ObjectId(forumId) };

            const achievements = await this.forumAchievementsModel
                .find(query)
                .lean();
            return {
                data: achievements,
                success: true,
                message: 'Achievements fetched successfully',
            };
        } catch (error) {
            console.log(error);
            throw error;
        }
    }

    // ==================== Brand Stories ====================

    async getBrandStories(forum: TForum, forumId: string) {
        try {
            const forumQuery = this.buildForumQuery(forum, forumId);
            const forumProfile = await this.forumProfileModel.findOne(forumQuery);
            return forumProfile?.brandStories || [];
        } catch (error) {
            console.log(error);
            throw error;
        }
    }

    async manageBrandStories(
        forum: TForum,
        forumId: string,
        body: {
            title: string;
            description: string;
            images?: Express.Multer.File[];
            brandStoryId?: string;
            deletedFileUrl?: string[];
        },
    ) {
        try {
            const { title, description, images, brandStoryId } = body;
            let { deletedFileUrl } = body;

            if (deletedFileUrl && !Array.isArray(deletedFileUrl)) {
                deletedFileUrl = [deletedFileUrl];
            }

            if (deletedFileUrl && deletedFileUrl.length > 0) {
                await this.deleteFiles(deletedFileUrl);
            }

            let uploadedImages = [];
            if (images && images.length > 0) {
                const uploadPromises = images.map((file) => this.uploadFile(file, forum));
                uploadedImages = await Promise.all(uploadPromises);
            }

            const forumQuery = this.buildForumQuery(forum, forumId);
            let forumProfile = await this.forumProfileModel.findOne(forumQuery);

            if (!forumProfile) {
                forumProfile = await this.forumProfileModel.create(forumQuery);
            }

            if (brandStoryId) {
                // Update existing brand story
                const storyIndex = forumProfile.brandStories.findIndex(
                    (s) => s._id.toString() === brandStoryId,
                );

                if (storyIndex === -1) {
                    throw new NotFoundException('Brand story not found');
                }

                const existingStory = forumProfile.brandStories[storyIndex];
                let updatedImages = existingStory.images || [];

                // Remove deleted images from the array
                if (deletedFileUrl && deletedFileUrl.length > 0) {
                    updatedImages = updatedImages.filter(
                        (img) => !deletedFileUrl.includes(img.url),
                    );
                }

                // Add new images
                if (uploadedImages.length > 0) {
                    updatedImages = [...updatedImages, ...uploadedImages];
                }

                // Check max 10 images
                if (updatedImages.length > 10) {
                    throw new BadRequestException('Maximum 10 images allowed');
                }

                forumProfile.brandStories[storyIndex].title = title;
                forumProfile.brandStories[storyIndex].description = description;
                forumProfile.brandStories[storyIndex].images = updatedImages;

                await forumProfile.save();
                return forumProfile.brandStories[storyIndex];
            } else {
                // Create new brand story
                const newStory = {
                    title,
                    description,
                    images: uploadedImages,
                };
                forumProfile.brandStories.push(newStory as any);
                await forumProfile.save();
                return forumProfile.brandStories[forumProfile.brandStories.length - 1];
            }
        } catch (error) {
            console.log(error);
            throw error;
        }
    }

    // ==================== Management Team ====================

    async getManagementTeam(forum: TForum, forumId: string) {
        try {
            const forumQuery = this.buildForumQuery(forum, forumId);
            const forumProfile = await this.forumProfileModel.findOne(forumQuery);

            if (!forumProfile) {
                return [];
            }

            return forumProfile.managementTeam || [];
        } catch (error) {
            console.log(error);
            throw error;
        }
    }

    async manageManagementTeam(
        forum: TForum,
        forumId: string,
        body: {
            name: string;
            title: string;
            description?: string;
            socialLinks?: string;
            memberId?: string;
            deletedFileUrl?: string | string[];
            image?: Express.Multer.File;
        },
    ) {
        try {
            const { name, title, description, socialLinks, memberId, image } = body;
            let deletedFileUrls: string[] = [];

            if (body.deletedFileUrl) {
                deletedFileUrls = Array.isArray(body.deletedFileUrl)
                    ? body.deletedFileUrl
                    : [body.deletedFileUrl];
            }

            if (deletedFileUrls.length > 0) {
                await this.deleteFiles(deletedFileUrls);
            }

            let uploadedImage = null;
            if (image) {
                uploadedImage = await this.uploadFile(image, forum);
            }

            const forumQuery = this.buildForumQuery(forum, forumId);
            let forumProfile = await this.forumProfileModel.findOne(forumQuery);

            if (!forumProfile) {
                forumProfile = await this.forumProfileModel.create(forumQuery);
            }

            // Parse socialLinks if it's a string
            let parsedSocialLinks = [];
            if (socialLinks) {
                parsedSocialLinks = typeof socialLinks === 'string' ? JSON.parse(socialLinks) : socialLinks;
            }

            if (memberId) {
                // Update existing team member
                const memberIndex = forumProfile.managementTeam.findIndex(
                    (m) => m._id.toString() === memberId,
                );

                if (memberIndex === -1) {
                    throw new NotFoundException('Team member not found');
                }

                forumProfile.managementTeam[memberIndex].name = name;
                forumProfile.managementTeam[memberIndex].title = title;
                forumProfile.managementTeam[memberIndex].description = description;
                forumProfile.managementTeam[memberIndex].socialLinks = parsedSocialLinks;

                // Update image if new one is provided
                if (uploadedImage) {
                    forumProfile.managementTeam[memberIndex].image = uploadedImage;
                } else if (deletedFileUrls.length > 0) {
                    // If image was deleted but no new one provided, clear the image
                    forumProfile.managementTeam[memberIndex].image = null;
                }

                await forumProfile.save();
                return forumProfile.managementTeam[memberIndex];
            } else {
                // Create new team member
                const newMember = {
                    name,
                    title,
                    description,
                    image: uploadedImage,
                    socialLinks: parsedSocialLinks,
                };
                forumProfile.managementTeam.push(newMember as any);
                await forumProfile.save();
                return forumProfile.managementTeam[forumProfile.managementTeam.length - 1];
            }
        } catch (error) {
            console.log(error);
            throw error;
        }
    }

    async deleteManagementTeamMember(forum: TForum, forumId: string, memberId: string) {
        try {
            const forumQuery = this.buildForumQuery(forum, forumId);
            const forumProfile = await this.forumProfileModel.findOne(forumQuery);

            if (!forumProfile) {
                throw new NotFoundException('Forum profile not found');
            }

            const memberIndex = forumProfile.managementTeam.findIndex(
                (m) => m._id.toString() === memberId,
            );

            if (memberIndex === -1) {
                throw new NotFoundException('Team member not found');
            }

            // Delete the image if exists
            const member = forumProfile.managementTeam[memberIndex];
            if (member.image?.url) {
                await this.deleteFiles([member.image.url]);
            }

            forumProfile.managementTeam.splice(memberIndex, 1);
            await forumProfile.save();

            return { message: 'Team member deleted successfully' };
        } catch (error) {
            console.log(error);
            throw error;
        }
    }

    // ==================== Private Helpers ====================

    private buildForumQuery(forum: TForum, forumId: string) {
        if (forum === 'node') {
            return { node: new Types.ObjectId(forumId) };
        } else if (forum === 'club') {
            return { club: new Types.ObjectId(forumId) };
        } else if (forum === 'chapter') {
            return { chapter: new Types.ObjectId(forumId) };
        }
        throw new BadRequestException('Invalid forum type');
    }

    private async uploadFile(file: Express.Multer.File, forum: TForum) {
        try {
            const folder = forum === 'node' ? 'node' : forum === 'chapter' ? 'chapter' : 'club';
            const response = await this.s3FileUpload.uploadFile(
                file.buffer,
                file.originalname,
                file.mimetype,
                folder,
            );
            return {
                url: response.url,
                filename: response.filename,
                originalname: file.originalname,
                mimetype: file.mimetype,
                size: file.size,
            };
        } catch (error) {
            throw new BadRequestException(
                'Failed to upload file. Please try again later.',
            );
        }
    }

    private async deleteFiles(urls: string[]) {
        try {
            const deletePromises = urls?.map((url: string) =>
                this.s3FileUpload.deleteFile(url)
            );
            const response = await Promise.all(deletePromises);
            return response;
        } catch (error) {
            console.log(error);
            throw new BadRequestException(
                'Failed to delete file. Please try again later.',
            );
        }
    }

    // ==================== Committee ====================

    async getCommittees(forum: TForum, forumId: string) {
        try {
            const forumQuery = this.buildForumQuery(forum, forumId);
            const forumProfile = await this.forumProfileModel
                .findOne(forumQuery)
                .select('committee')
                .lean();

            if (!forumProfile || !forumProfile?.committee?.length) {
                return { message: 'No committees found', data: [] };
            }

            return { message: 'Committees fetched successfully', data: forumProfile?.committee };
        } catch (error) {
            console.log(error);
            throw error;
        }
    }

    async manageCommittee(
        forum: TForum,
        forumId: string,
        body: {
            committeeId?: string;
            title: string;
            description: string;
            members: any;
            files?: any[];
            deletedFileUrls?: any;
        },
    ) {
        try {
            const parsedMembers = JSON.parse(body.members || '[]');

            if (parsedMembers.length === 0) {
                throw new BadRequestException('Members are required');
            }

            const forumQuery = this.buildForumQuery(forum, forumId);
            let forumProfile = await this.forumProfileModel.findOne(forumQuery);

            if (body?.committeeId) {
                const committeeIndex = forumProfile?.committee?.findIndex(
                    (c: any) => c._id?.toString() === body.committeeId,
                );

                if (committeeIndex === -1) {
                    throw new NotFoundException('Committee not found');
                }

                const existingFiles = forumProfile?.committee[committeeIndex]?.files || [];
                const deletedFileUrls = body?.deletedFileUrls || [];
                const filteredExistingFilesWithDeletedUrls = existingFiles.filter(
                    (file: any) => !deletedFileUrls.includes(file.url)
                );
                const combineFileLength = filteredExistingFilesWithDeletedUrls.length + (body?.files?.length || 0);
                if (combineFileLength > 10) {
                    throw new BadRequestException('You can upload maximum 10 files');
                }
            }

            let fileObjects = [];
            if (body.files && body.files.length > 0) {
                const uploadPromises = body.files.map((file: any) =>
                    this.uploadFile(
                        {
                            buffer: file.buffer,
                            originalname: file.originalname,
                            mimetype: file.mimetype,
                        } as Express.Multer.File,
                        forum,
                    ),
                );
                const uploadedFiles = await Promise.all(uploadPromises);
                fileObjects = uploadedFiles.map((uploadedFile, index) => ({
                    url: uploadedFile.url,
                    originalname: body.files[index].originalname,
                    mimetype: body.files[index].mimetype,
                    size: body.files[index].size,
                }));
            }

            // If no forum profile found, create one and attach the committee
            if (!forumProfile) {
                forumProfile = new this.forumProfileModel({
                    ...forumQuery,
                    committee: [
                        {
                            title: body.title,
                            description: body.description,
                            members: parsedMembers,
                            files: fileObjects || [],
                        },
                    ],
                });

                await forumProfile.save();
                return {
                    message: 'Forum profile created and committee added successfully',
                    data: forumProfile.committee,
                };
            }

            // Update existing committee if committeeId exists
            if (body.committeeId) {
                const committeeIndex = forumProfile.committee.findIndex(
                    (c: any) => c._id?.toString() === body?.committeeId,
                );

                if (committeeIndex === -1) {
                    throw new NotFoundException('Committee not found');
                }

                const existingFiles = forumProfile?.committee[committeeIndex]?.files || [];
                const deletedFileUrls = body?.deletedFileUrls || [];
                const filteredExistingFilesWithDeletedUrls = existingFiles.filter(
                    (file: any) => !deletedFileUrls.includes(file.url)
                );
                const updatedFiles = [...filteredExistingFilesWithDeletedUrls, ...fileObjects];

                // Update only specific fields to preserve other fields like events
                forumProfile.committee[committeeIndex].title = body.title;
                forumProfile.committee[committeeIndex].description = body.description;
                forumProfile.committee[committeeIndex].members = parsedMembers;
                forumProfile.committee[committeeIndex].files = updatedFiles || [];
            } else {
                // Otherwise, add a new committee
                forumProfile.committee.push({
                    title: body.title,
                    description: body.description,
                    members: parsedMembers,
                    files: fileObjects || [],
                });
            }

            await forumProfile.save();

            if (body?.deletedFileUrls?.length > 0) {
                await this.deleteFiles(JSON.parse(body?.deletedFileUrls || '[]'));
            }

            return {
                message: body?.committeeId
                    ? 'Committee updated successfully'
                    : 'Committee added successfully',
                data: forumProfile?.committee,
            };
        } catch (error) {
            console.log(error);
            if (error instanceof BadRequestException || error instanceof NotFoundException) {
                throw error;
            }
            throw error;
        }
    }

    async deleteCommittee(forum: TForum, forumId: string, committeeId: string) {
        try {
            const forumQuery = this.buildForumQuery(forum, forumId);
            const forumProfile = await this.forumProfileModel.findOne(forumQuery);

            if (!forumProfile) {
                throw new NotFoundException('Forum profile not found');
            }

            const committeeIndex = forumProfile.committee.findIndex(
                (c: any) => c._id?.toString() === committeeId,
            );

            if (committeeIndex === -1) {
                throw new NotFoundException('Committee not found');
            }

            // Delete associated files from storage
            const committee = forumProfile.committee[committeeIndex];
            if (committee.files && committee.files.length > 0) {
                const fileUrls = committee.files.map((f: any) => f.url);
                await this.deleteFiles(fileUrls);
            }

            // Remove the committee
            forumProfile.committee.splice(committeeIndex, 1);
            await forumProfile.save();

            return {
                success: true,
                message: 'Committee deleted successfully',
                data: forumProfile.committee,
            };
        } catch (error) {
            console.log(error);
            throw error;
        }
    }

    // ==================== Locations ====================

    async getLocations(forum: TForum, forumId: string) {
        try {
            const forumQuery = this.buildForumQuery(forum, forumId);
            const forumProfile = await this.forumProfileModel.findOne(forumQuery).lean();

            let branches = forumProfile?.branches || [];

            const sortedBranches = branches.sort((a: any, b: any) => {
                return b?._id - a?._id;
            });

            return {
                data: sortedBranches,
                success: true,
                message: "Locations fetched successfully",
            };
        } catch (error) {
            console.log(error);
            throw error;
        }
    }

    async manageLocations(
        forum: TForum,
        forumId: string,
        body: {
            name: string;
            email: string;
            address: string;
            phoneNumber?: string;
            customerNumber?: string;
            complaintNumber?: string;
            isMainBranch?: boolean;
            branchId?: string;
            googleMapLink?: string;
        }
    ) {
        try {
            const forumQuery = this.buildForumQuery(forum, forumId);
            const existingProfile = await this.forumProfileModel.findOne(forumQuery);

            const branchData = {
                name: body.name,
                email: body.email,
                address: body.address,
                phoneNumber: body.phoneNumber,
                customerNumber: body.customerNumber,
                complaintNumber: body.complaintNumber,
                isMainBranch: body.isMainBranch || false,
                googleMapLink: body.googleMapLink,
            };

            let updatedBranch: any;

            // CASE 1: Profile already exists
            if (existingProfile) {
                let existingBranch: any;

                // Try to find branch if ID provided
                if (body?.branchId) {
                    existingBranch = existingProfile.branches.find(
                        (branch: any) => branch._id.toString() === body.branchId
                    );
                }

                // If main branch toggled ON, unset all others
                if (body.isMainBranch) {
                    existingProfile.branches.forEach((branch: any) => {
                        branch.isMainBranch = false;
                    });
                }

                if (existingBranch) {
                    // CASE 1A: Branch exists → update it
                    Object.assign(existingBranch, branchData);
                    updatedBranch = existingBranch;
                } else {
                    // CASE 1B: Branch not found → create new
                    existingProfile.branches.push(branchData);
                    updatedBranch = existingProfile.branches[existingProfile.branches.length - 1];
                }

                await existingProfile.save();

                return {
                    success: true,
                    message: existingBranch
                        ? "Location updated successfully"
                        : "Location created successfully",
                    data: updatedBranch,
                };
            }

            // CASE 2: No profile yet → create new profile
            const createdProfile = await this.forumProfileModel.create({
                ...forumQuery,
                branches: [branchData],
            });

            updatedBranch = createdProfile.branches[0];

            return {
                success: true,
                message: "Location created successfully",
                data: updatedBranch,
            };
        } catch (error) {
            console.error(error);
            throw error;
        }
    }

    async deleteLocation(forum: TForum, forumId: string, locationId: string) {
        try {
            const forumQuery = this.buildForumQuery(forum, forumId);
            const forumProfile = await this.forumProfileModel.findOne(forumQuery);

            if (!forumProfile) {
                throw new NotFoundException('Forum profile not found');
            }

            const locationIndex = forumProfile.branches.findIndex(
                (branch: any) => branch._id.toString() === locationId
            );

            if (locationIndex === -1) {
                throw new NotFoundException('Location not found');
            }

            forumProfile.branches.splice(locationIndex, 1);
            await forumProfile.save();

            return {
                success: true,
                message: 'Location deleted successfully',
            };
        } catch (error) {
            console.log(error);
            throw error;
        }
    }

    // ==================== Social Links ====================

    async getSocialLinks(forum: TForum, forumId: string) {
        try {
            const forumQuery = this.buildForumQuery(forum, forumId);
            const forumProfile = await this.forumProfileModel.findOne(forumQuery).lean();

            if (!forumProfile) {
                return {
                    data: [],
                    success: true,
                    message: "Social links fetched successfully",
                };
            }

            const socialLinks = forumProfile?.socialLinks || [];

            return {
                data: socialLinks,
                success: true,
                message: "Social links fetched successfully",
            };
        } catch (error) {
            console.log(error);
            throw error;
        }
    }

    async manageSocialLinks(
        forum: TForum,
        forumId: string,
        body: { links: { name: string; link: string; title?: string }[] },
    ) {
        try {
            const forumQuery = this.buildForumQuery(forum, forumId);

            // Normalize input (replace null/undefined/empty with "")
            const cleanedLinks = body.links.map(link => ({
                name: link?.name?.trim() || '',
                link: link?.link?.trim() || '',
                title: link?.title?.trim() || '',
            }));

            // Find existing profile
            let forumProfile = await this.forumProfileModel.findOne(forumQuery);

            // If profile not found, create a new one
            if (!forumProfile) {
                const newProfile = await this.forumProfileModel.create({
                    ...forumQuery,
                    socialLinks: cleanedLinks,
                });

                return {
                    data: newProfile.socialLinks,
                    success: true,
                    message: 'Forum profile created and social links added successfully',
                };
            }

            // Save and return only `socialLinks`
            const updatedProfile = await this.forumProfileModel.findOneAndUpdate(
                forumQuery,
                { $set: { socialLinks: cleanedLinks } },
                { new: true, projection: { socialLinks: 1, _id: 0 } },
            );

            return {
                data: updatedProfile?.socialLinks || [],
                success: true,
                message: 'Social links updated successfully',
            };
        } catch (error) {
            console.error(error);
            throw error;
        }
    }

    // ==================== Hierarchy ====================

    async getHierarchy(forum: TForum, forumId: string) {
        try {
            const forumQuery = this.buildForumQuery(forum, forumId);
            const forumProfile = await this.forumProfileModel.findOne(forumQuery);
            return forumProfile?.hierarchy || null;
        } catch (error) {
            console.log(error);
            throw error;
        }
    }

    async manageHierarchy(
        forum: TForum,
        forumId: string,
        body: {
            file?: Express.Multer.File;
            deletedFileUrl?: string;
        },
    ) {
        try {
            const { file, deletedFileUrl } = body;

            const forumQuery = this.buildForumQuery(forum, forumId);
            let forumProfile = await this.forumProfileModel.findOne(forumQuery);

            if (!forumProfile) {
                forumProfile = await this.forumProfileModel.create(forumQuery);
            }

            if (deletedFileUrl) {
                if (
                    forumProfile.hierarchy &&
                    forumProfile.hierarchy.url === deletedFileUrl
                ) {
                    await this.deleteFiles([deletedFileUrl]);
                    forumProfile.hierarchy = undefined;
                }
            }

            if (file) {
                if (forumProfile.hierarchy && forumProfile.hierarchy.url) {
                    await this.deleteFiles([forumProfile.hierarchy.url]);
                }
                const uploadResult = await this.uploadFile(file, forum);
                forumProfile.hierarchy = {
                    url: uploadResult.url,
                    originalname: file.originalname,
                    mimetype: file.mimetype,
                    size: file.size,
                };
            }

            await forumProfile.save();

            return {
                message: 'Hierarchy updated successfully',
                data: forumProfile.hierarchy,
            };
        } catch (error) {
            console.log(error);
            throw error;
        }
    }

    // ==================== Announcement ====================

    async createAnnouncement(body: {
        title: string;
        description: string;
        dates?: string;
        files?: Express.Multer.File[];
        forum: TForum;
        forumId: string;
    }, userId: string) {
        try {
            let forumEntity;

            if (body.forum === 'club') {
                forumEntity = await this.clubModel.findById(body.forumId).lean().exec();
            } else if (body.forum === 'node') {
                forumEntity = await this.nodeModel.findById(body.forumId).lean().exec();
            }

            if (!forumEntity) {
                throw new NotFoundException(`${body.forum} not found`);
            }

            let fileObjects = [];
            if (body.files && body.files.length > 0) {
                const uploadPromises = body.files.map((file: any) =>
                    this.uploadFile({
                        buffer: file.buffer,
                        originalname: file.originalname,
                        mimetype: file.mimetype,
                    } as Express.Multer.File, body.forum),
                );
                const uploadedFiles = await Promise.all(uploadPromises);
                fileObjects = uploadedFiles.map((uploadedFile, index) => ({
                    url: uploadedFile.url,
                    originalname: body.files[index].originalname,
                    mimetype: body.files[index].mimetype,
                    size: body.files[index].size,
                }));
            }

            const postData: Record<string, any> = {
                title: body.title,
                description: body.description,
                ...(body.dates && { dates: body.dates }),
                createdBy: new Types.ObjectId(userId),
                createdAt: new Date(),
                files: fileObjects,
            };

            const query: Record<string, any> = {};

            if (body.forum === 'club') {
                query.club = forumEntity._id;
            } else if (body.forum === 'node') {
                query.node = forumEntity._id;
            }

            const existedAnnouncement = await this.customerConnectModel.findOne(query).lean().exec();

            let announcement;

            if (!existedAnnouncement) {
                announcement = await this.customerConnectModel.create({
                    data: postData,
                    ...(body.forum === 'club' && { club: forumEntity._id }),
                    ...(body.forum === 'node' && { node: forumEntity._id }),
                });
            } else {
                announcement = await this.customerConnectModel.findOneAndUpdate(query, { $push: { data: postData } }, { new: true });
            }

            const subscriberIds = announcement?.subscribers.map((subscriber) => subscriber.user.toString()) || [];
            const notificationMessage = `You have new announcement in`;
            const emitCustomerConnectAnnouncementProps: EmitCustomerConnectAnnouncementProps = {
                forum: {
                    type: body.forum,
                    id: forumEntity._id.toString(),
                },
                from: userId.toString(),
                message: notificationMessage,
                memberIds: subscriberIds,
            };

            await this.notificationEventsService.emitCustomerConnectAnnouncement(
                emitCustomerConnectAnnouncementProps,
            );

            return {
                data: announcement,
                message: 'Announcement created successfully',
                success: true,
            };
        } catch (error) {
            console.log({ error });

            if (error instanceof BadRequestException || error instanceof NotFoundException) {
                throw error;
            }
            throw error;
        }
    }

    async getAnnouncement(
        forum: TForum,
        forumId: string,
        userId: string,
        limit = 10,
        lastDataId?: string,
    ) {
        try {
            const filter: Record<string, any> = {};

            if (forum === 'club') {
                filter.club = new Types.ObjectId(forumId);
            } else if (forum === 'node') {
                filter.node = new Types.ObjectId(forumId);
            }

            const connect = await this.customerConnectModel
                .findOne(filter)
                .populate({
                    path: 'club',
                    select: 'name profileImage',
                    options: { lean: true },
                })
                .populate({
                    path: 'node',
                    select: 'name profileImage',
                    options: { lean: true },
                })
                .populate({
                    path: 'data.createdBy',
                    select: 'userName firstName lastName profileImage',
                    options: { lean: true },
                })
                .lean();

            if (!connect) {
                return {
                    connect: null,
                    hasMore: false,
                    lastId: null,
                    isUserSubscribed: false,
                };
            }

            const isUserSubscribed = connect.subscribers.some(
                (subscriber) => subscriber.user.toString() === userId.toString()
            );

            let sortedData = (connect.data || []).sort((a, b) => {
                const dateDiff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                if (dateDiff !== 0) return dateDiff;
                return b._id.toString().localeCompare(a._id.toString());
            });

            if (lastDataId) {
                const index = sortedData.findIndex(
                    (item) => item._id.toString() === lastDataId
                );
                if (index >= 0) sortedData = sortedData.slice(index + 1);
            }

            const paginatedData = sortedData.slice(0, limit);
            const lastId =
                paginatedData.length > 0
                    ? paginatedData[paginatedData.length - 1]._id
                    : null;

            const hasMore = sortedData.length > limit;

            const followersCount = connect.subscribers?.length || 0;

            connect.data = paginatedData;
            delete connect.subscribers;

            return {
                connect,
                hasMore,
                lastId,
                isUserSubscribed,
                followersCount,
            };
        } catch (error) {
            console.error('Error in getAnnouncement:', error);
            throw error;
        }
    }

    async deleteAnnouncement(
        forum: TForum,
        forumId: string,
        dataId: string,
    ) {
        try {
            const query: Record<string, any> = {};
            if (forum === 'club') query.club = new Types.ObjectId(forumId);
            else query.node = new Types.ObjectId(forumId);

            const updated = await this.customerConnectModel.findOneAndUpdate(
                query,
                { $pull: { data: { _id: new Types.ObjectId(dataId) } } },
                { new: true }
            );

            if (!updated) {
                throw new NotFoundException('Announcement not found for the given forum');
            }

            return {
                message: 'Announcement deleted successfully',
                success: true,
            };
        } catch (error) {
            console.error('Error in deleteAnnouncement:', error);
            throw error;
        }
    }

    async manageAnnouncementFollow(
        forum: TForum,
        forumId: string,
        action: 'follow' | 'unfollow',
        userId: string
    ) {
        try {
            const query: Record<string, any> = {};
            if (forum === 'club') query.club = new Types.ObjectId(forumId);
            else query.node = new Types.ObjectId(forumId);

            const userObjectId = new Types.ObjectId(userId);

            let customerConnect = await this.customerConnectModel.findOne(query);

            if (!customerConnect) {
                customerConnect = await this.customerConnectModel.create({
                    ...query,
                    subscribers: action === 'follow' ? [{ user: userObjectId, date: new Date() }] : [],
                });
                return {
                    message: 'Announcement created and followed successfully',
                    success: true,
                };
            }

            const isSubscribed = customerConnect.subscribers.some(
                (s) => s.user.toString() === userId.toString()
            );

            if (isSubscribed && action === 'unfollow') {
                await this.customerConnectModel.findOneAndUpdate(
                    query,
                    { $pull: { subscribers: { user: userObjectId } } },
                    { new: true }
                );
            } else if (!isSubscribed && action === 'follow') {
                await this.customerConnectModel.findOneAndUpdate(
                    query,
                    { $push: { subscribers: { user: userObjectId, date: new Date() } } },
                    { new: true }
                );
            } else {
                return {
                    message: `Already ${action}ed`,
                    success: false,
                };
            }

            return {
                message: `Announcement ${action}ed successfully`,
                success: true,
            };
        } catch (error) {
            console.error('Error in manageAnnouncementFollow:', error);
            throw error;
        }
    }

    // ==================== Campaigns ====================

    async createCampaign(body: {
        title: string;
        description: string;
        dates?: string;
        forum: TForum;
        forumId: string;
    }, userId: string) {
        try {
            let forumEntity;

            if (body.forum === 'club') {
                forumEntity = await this.clubModel.findById(body.forumId).lean().exec();
            } else if (body.forum === 'node') {
                forumEntity = await this.nodeModel.findById(body.forumId).lean().exec();
            }

            if (!forumEntity) {
                throw new NotFoundException(`${body.forum} not found`);
            }

            const postData: Record<string, any> = {
                title: body.title,
                description: body.description,
                ...(body.dates && { dates: body.dates }),
                createdBy: new Types.ObjectId(userId),
                createdAt: new Date(),
            };

            const query: Record<string, any> = {};

            if (body.forum === 'club') {
                query.club = forumEntity._id;
            } else if (body.forum === 'node') {
                query.node = forumEntity._id;
            }

            const existedCampaign = await this.forumCampaignModel.findOne(query).lean().exec();

            let campaign;

            if (!existedCampaign) {
                campaign = await this.forumCampaignModel.create({
                    data: postData,
                    ...(body.forum === 'club' && { club: forumEntity._id }),
                    ...(body.forum === 'node' && { node: forumEntity._id }),
                });
            } else {
                campaign = await this.forumCampaignModel.findOneAndUpdate(query, { $push: { data: postData } }, { new: true });
            }

            return {
                data: campaign,
                message: 'Campaign created successfully',
                success: true,
            };
        } catch (error) {
            console.log({ error });

            if (error instanceof BadRequestException || error instanceof NotFoundException) {
                throw error;
            }
            throw error;
        }
    }

    async getCampaigns(
        forum: TForum,
        forumId: string,
        userId: string,
        limit = 10,
        lastDataId?: string,
    ) {
        try {
            const filter: Record<string, any> = {};

            if (forum === 'club') {
                filter.club = new Types.ObjectId(forumId);
            } else if (forum === 'node') {
                filter.node = new Types.ObjectId(forumId);
            }

            const campaign = await this.forumCampaignModel
                .findOne(filter)
                .populate({
                    path: 'club',
                    select: 'name profileImage',
                    options: { lean: true },
                })
                .populate({
                    path: 'node',
                    select: 'name profileImage',
                    options: { lean: true },
                })
                .populate({
                    path: 'data.createdBy',
                    select: 'userName firstName lastName profileImage',
                    options: { lean: true },
                })
                .lean();

            if (!campaign) {
                return {
                    campaign: null,
                    hasMore: false,
                    lastId: null,
                };
            }

            let sortedData = (campaign.data || []).sort((a, b) => {
                const dateDiff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                if (dateDiff !== 0) return dateDiff;
                return b._id.toString().localeCompare(a._id.toString());
            });

            if (lastDataId) {
                const index = sortedData.findIndex(
                    (item) => item._id.toString() === lastDataId
                );
                if (index >= 0) sortedData = sortedData.slice(index + 1);
            }

            const paginatedData = sortedData.slice(0, limit);
            const lastId =
                paginatedData.length > 0
                    ? paginatedData[paginatedData.length - 1]._id
                    : null;

            const hasMore = sortedData.length > limit;

            campaign.data = paginatedData;

            return {
                campaign,
                hasMore,
                lastId,
            };
        } catch (error) {
            console.error('Error in getCampaigns:', error);
            throw error;
        }
    }

    async deleteCampaign(
        forum: TForum,
        forumId: string,
        dataId: string,
    ) {
        try {
            const query: Record<string, any> = {};
            if (forum === 'club') query.club = new Types.ObjectId(forumId);
            else query.node = new Types.ObjectId(forumId);

            const updated = await this.forumCampaignModel.findOneAndUpdate(
                query,
                { $pull: { data: { _id: new Types.ObjectId(dataId) } } },
                { new: true }
            );

            if (!updated) {
                throw new NotFoundException('Campaign not found for the given forum');
            }

            return {
                message: 'Campaign deleted successfully',
                success: true,
            };
        } catch (error) {
            console.error('Error in deleteCampaign:', error);
            throw error;
        }
    }

    // ==================== Showcases ====================

    async getShowcases(forum: TForum, forumId: string, type?: string) {
        try {
            const forumQuery = this.buildForumQuery(forum, forumId);
            const forumProfile = await this.forumProfileModel.findOne(forumQuery).lean();
            let showcases = forumProfile?.about?.showcase || [];

            // Filter by type if provided
            if (type) {
                showcases = showcases.filter((item: any) => item.type === type);
            }

            return {
                data: showcases,
                success: true,
                message: 'Showcases fetched successfully',
            };
        } catch (error) {
            console.log(error);
            throw error;
        }
    }

    async manageShowcase(
        forum: TForum,
        forumId: string,
        body: {
            title: string;
            description: string;
            showcaseId?: string;
            existingImages?: string;
            deletedImageUrls?: string;
            showcaseImages?: Express.Multer.File[];
            type?: string;
        },
    ) {
        try {
            const { title, description, showcaseId, existingImages, deletedImageUrls, showcaseImages, type } = body;

            if (!title?.trim()) {
                throw new BadRequestException('Title is required');
            }

            if (!description?.trim()) {
                throw new BadRequestException('Description is required');
            }

            // Get or create forum profile
            const forumQuery = this.buildForumQuery(forum, forumId);
            let forumProfile = await this.forumProfileModel.findOne(forumQuery);

            if (!forumProfile) {
                forumProfile = new this.forumProfileModel({
                    ...forumQuery,
                    about: {
                        headerImages: [],
                        usp: '',
                        website: '',
                        specialization: '',
                        challenges: '',
                        testimonials: [],
                        targetDomains: [],
                        attachments: [],
                        showcase: [],
                        ourClients: [],
                    },
                });
            }

            // Parse existing images
            const existingImageUrls = existingImages ? JSON.parse(existingImages) : [];

            // Upload new images
            let newImageUrls: string[] = [];
            if (showcaseImages && showcaseImages.length > 0) {
                const uploadPromises = showcaseImages.map((file: any) =>
                    this.uploadFile(
                        {
                            buffer: file.buffer,
                            originalname: file.originalname,
                            mimetype: file.mimetype,
                        } as Express.Multer.File,
                        forum,
                    ),
                );
                const uploadedFiles = await Promise.all(uploadPromises);
                newImageUrls = uploadedFiles.map((f) => f.url);
            }

            // Combine existing and new images
            const allImages = [...existingImageUrls, ...newImageUrls];

            // Delete removed images
            if (deletedImageUrls) {
                const urlsToDelete = JSON.parse(deletedImageUrls);
                if (urlsToDelete.length > 0) {
                    await this.deleteFiles(urlsToDelete);
                }
            }

            const showcaseData = {
                title: title.trim(),
                description: description.trim(),
                images: allImages,
                type: (type || 'others') as 'attachment' | 'works' | 'csr' | 'sustainability' | 'others',
            };

            // Update or create showcase item
            if (showcaseId) {
                // Find and update existing showcase item
                const showcaseIndex = forumProfile.about.showcase?.findIndex(
                    (item: any) => item._id?.toString() === showcaseId,
                );

                if (showcaseIndex === -1 || showcaseIndex === undefined) {
                    throw new NotFoundException('Showcase item not found');
                }

                forumProfile.about.showcase[showcaseIndex] = {
                    ...forumProfile.about.showcase[showcaseIndex],
                    ...showcaseData,
                };
            } else {
                // Add new showcase item
                if (!forumProfile.about.showcase) {
                    forumProfile.about.showcase = [];
                }
                forumProfile.about.showcase.push(showcaseData);
            }

            await forumProfile.save();

            const createdShowcase = showcaseId
                ? forumProfile.about.showcase.find((item: any) => item._id?.toString() === showcaseId)
                : forumProfile.about.showcase[forumProfile.about.showcase.length - 1];

            return {
                data: createdShowcase,
                success: true,
                message: showcaseId ? 'Showcase updated successfully' : 'Showcase created successfully',
            };
        } catch (error) {
            console.log(error);
            if (error instanceof BadRequestException || error instanceof NotFoundException) {
                throw error;
            }
            throw error;
        }
    }

    async deleteShowcase(forum: TForum, forumId: string, showcaseId: string) {
        try {
            const forumQuery = this.buildForumQuery(forum, forumId);
            const forumProfile = await this.forumProfileModel.findOne(forumQuery);

            if (!forumProfile) {
                throw new NotFoundException('Forum profile not found');
            }

            const showcaseIndex = forumProfile.about.showcase?.findIndex(
                (item: any) => item._id?.toString() === showcaseId,
            );

            if (showcaseIndex === -1 || showcaseIndex === undefined) {
                throw new NotFoundException('Showcase item not found');
            }

            // Get the showcase item to delete its images
            const showcaseItem = forumProfile.about.showcase[showcaseIndex];
            if (showcaseItem.images && showcaseItem.images.length > 0) {
                await this.deleteFiles(showcaseItem.images);
            }

            // Remove the showcase item
            forumProfile.about.showcase.splice(showcaseIndex, 1);
            await forumProfile.save();

            return {
                success: true,
                message: 'Showcase deleted successfully',
            };
        } catch (error) {
            console.log(error);
            if (error instanceof NotFoundException) {
                throw error;
            }
            throw error;
        }
    }

    // ==================== FAQs ====================

    async getFaqs(forum: TForum, forumId: string, userId: string) {
        try {
            const query: Record<string, any> = {};

            if (forum === 'node') {
                query.node = new Types.ObjectId(forumId);
            } else if (forum === 'club') {
                query.club = new Types.ObjectId(forumId);
            } else if (forum === 'chapter') {
                query.chapter = new Types.ObjectId(forumId);
            }

            // Check if user is a member to determine visibility
            const { isMember } = await this.commonService.getUserDetailsInForum({
                userId,
                forumId,
                forum,
            });

            // Non-members can only see public FAQs
            if (!isMember) {
                query.isPublic = true;
            }

            const faqs = await this.forumFaqsModel
                .find(query)
                .sort({ createdAt: -1 })
                .lean();

            return {
                data: faqs,
                success: true,
                message: 'FAQs fetched successfully',
            };
        } catch (error) {
            console.log(error);
            throw error;
        }
    }

    async manageFaqs(
        forum: TForum,
        forumId: string,
        body: {
            question: string;
            answer: string;
            isPublic?: boolean;
            faqId?: string;
        },
    ) {
        try {
            const { question, answer, isPublic = false, faqId } = body;

            // Update existing FAQ
            if (faqId) {
                const faqUpdateData: Record<string, any> = {
                    isPublic: isPublic,
                };
                if (question?.trim()) faqUpdateData.question = question;
                if (answer?.trim()) faqUpdateData.answer = answer;

                const updatedFaq = await this.forumFaqsModel.findByIdAndUpdate(
                    faqId,
                    faqUpdateData,
                    { new: true },
                );

                if (!updatedFaq) {
                    throw new NotFoundException('FAQ not found');
                }

                return {
                    data: updatedFaq,
                    success: true,
                    message: 'FAQ updated successfully',
                };
            }

            // Create new FAQ
            if (!question?.trim()) {
                throw new BadRequestException('Question is required');
            }

            if (!answer?.trim()) {
                throw new BadRequestException('Answer is required');
            }

            const faqData: Record<string, any> = {
                question,
                answer,
                isPublic,
            };

            if (forum === 'node') {
                faqData.node = new Types.ObjectId(forumId);
            } else if (forum === 'club') {
                faqData.club = new Types.ObjectId(forumId);
            } else if (forum === 'chapter') {
                faqData.chapter = new Types.ObjectId(forumId);
            }

            const newFaq = await this.forumFaqsModel.create(faqData);

            return {
                data: newFaq,
                success: true,
                message: 'FAQ created successfully',
            };
        } catch (error) {
            console.log(error);
            if (error instanceof BadRequestException || error instanceof NotFoundException) {
                throw error;
            }
            throw error;
        }
    }

    async deleteFaq(forum: TForum, forumId: string, faqId: string) {
        try {
            const query: Record<string, any> = { _id: new Types.ObjectId(faqId) };

            if (forum === 'node') {
                query.node = new Types.ObjectId(forumId);
            } else if (forum === 'club') {
                query.club = new Types.ObjectId(forumId);
            } else if (forum === 'chapter') {
                query.chapter = new Types.ObjectId(forumId);
            }

            const deletedFaq = await this.forumFaqsModel.findOneAndDelete(query);

            if (!deletedFaq) {
                throw new NotFoundException('FAQ not found');
            }

            return {
                success: true,
                message: 'FAQ deleted successfully',
            };
        } catch (error) {
            console.log(error);
            if (error instanceof NotFoundException) {
                throw error;
            }
            throw error;
        }
    }

    // ==================== Product Comparisons ====================

    async getProductComparisons(forum: TForum, forumId: string) {
        try {
            const forumQuery = this.buildForumQuery(forum, forumId);
            const forumProfile = await this.forumProfileModel.findOne(forumQuery);
            return forumProfile?.productComparisons || [];
        } catch (error) {
            console.log(error);
            throw error;
        }
    }

    async manageProductComparisons(
        forum: TForum,
        forumId: string,
        body: {
            title: string;
            description: string;
            file?: Express.Multer.File;
            comparisonId?: string;
            deletedFileUrl?: string;
        },
    ) {
        try {
            const { title, description, comparisonId } = body;
            let { deletedFileUrl, file } = body;

            if (deletedFileUrl && !Array.isArray(deletedFileUrl)) {
                deletedFileUrl = deletedFileUrl;
            }

            if (deletedFileUrl) {
                await this.deleteFiles([deletedFileUrl]);
            }

            let uploadedFile = null;
            if (file) {
                uploadedFile = await this.uploadFile(file, forum);
            }

            const forumQuery = this.buildForumQuery(forum, forumId);
            let forumProfile = await this.forumProfileModel.findOne(forumQuery);

            if (!forumProfile) {
                forumProfile = await this.forumProfileModel.create(forumQuery);
            }

            if (comparisonId) {
                // Update existing comparison
                const compIndex = forumProfile.productComparisons.findIndex(
                    (c) => c._id.toString() === comparisonId,
                );

                if (compIndex === -1) {
                    throw new NotFoundException('Product comparison not found');
                }

                forumProfile.productComparisons[compIndex].title = title;
                forumProfile.productComparisons[compIndex].description = description;

                if (uploadedFile) {
                    forumProfile.productComparisons[compIndex].file = uploadedFile;
                } else if (deletedFileUrl) {
                    // check if the deleted URL matches the current file
                    if (forumProfile.productComparisons[compIndex].file?.url === deletedFileUrl) {
                        forumProfile.productComparisons[compIndex].file = undefined;
                    }
                }

                await forumProfile.save();
                return {
                    message: 'Product comparison updated successfully',
                    data: forumProfile.productComparisons[compIndex],
                };
            } else {
                // Create new comparison
                const newComparison: any = {
                    title,
                    description,
                };

                if (uploadedFile) {
                    newComparison.file = uploadedFile;
                }

                forumProfile.productComparisons.push(newComparison);
                await forumProfile.save();

                return {
                    message: 'Product comparison created successfully',
                    data: forumProfile.productComparisons[forumProfile.productComparisons.length - 1],
                };
            }
        } catch (error) {
            console.log(error);
            if (error instanceof NotFoundException) {
                throw error;
            }
            throw error;
        }
    }

    async deleteProductComparison(forum: TForum, forumId: string, comparisonId: string) {
        try {
            const forumQuery = this.buildForumQuery(forum, forumId);
            const forumProfile = await this.forumProfileModel.findOne(forumQuery);

            if (!forumProfile) {
                throw new NotFoundException('Forum profile not found');
            }

            const compIndex = forumProfile.productComparisons.findIndex(
                (c) => c._id.toString() === comparisonId,
            );

            if (compIndex === -1) {
                throw new NotFoundException('Product comparison not found');
            }

            // Delete the file if exists
            const comparison = forumProfile.productComparisons[compIndex];
            if (comparison.file?.url) {
                await this.deleteFiles([comparison.file.url]);
            }

            // Remove the comparison
            forumProfile.productComparisons.splice(compIndex, 1);
            await forumProfile.save();

            return {
                success: true,
                message: 'Product comparison deleted successfully',
            };
        } catch (error) {
            console.log(error);
            if (error instanceof NotFoundException) {
                throw error;
            }
            throw error;
        }
    }
}
