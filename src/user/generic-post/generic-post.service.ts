import { BadRequestException, ForbiddenException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateGenericPostDto, FileDto } from './dto/create-generic-post.dto';
import { UpdateGenericPostDto } from './dto/update-generic-post.dto';
import { GenericPost } from 'src/shared/entities/generic-post.entity';
import { UploadService } from 'src/shared/upload/upload.service';
import { AssetsService } from 'src/assets/assets.service';
import { EmitGenericPostAnnouncementProps, NotificationEventsService } from 'src/notification/notification-events.service';
import { ClubMembers } from 'src/shared/entities/clubmembers.entity';
import { NodeMembers } from 'src/shared/entities/node-members.entity';
import { ChapterMember } from 'src/shared/entities/chapters/chapter-member.entity';
import { Connection } from 'mongoose';
import { CommonService } from 'src/plugin/common/common.service';

interface FileObject {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
    size: number;
}

@Injectable()
export class GenericPostService {
    constructor(
        @InjectModel(GenericPost.name) private readonly genericPostModel: Model<GenericPost>,
        @InjectModel(ClubMembers.name) private readonly clubMembersModel: Model<ClubMembers>,
        @InjectModel(NodeMembers.name) private readonly nodeMembersModel: Model<NodeMembers>,
        @InjectModel(ChapterMember.name) private readonly chapterMemberModel: Model<ChapterMember>,
        private readonly s3FileUpload: UploadService,
        private readonly assetsService: AssetsService,
        private readonly notificationEventsService: NotificationEventsService,
        private readonly commonService: CommonService,
        @InjectConnection() private readonly connection: Connection,
    ) { }

    async create(createPostDto: CreateGenericPostDto, userId: string) {
        const session = await this.connection.startSession();
        session.startTransaction();
        try {

            await this.assetsService.checkAndIncrement(new Types.ObjectId(userId), session);

            let fileObjects = null;
            if (createPostDto.files && createPostDto.files.length > 0) {
                const uploadPromises = createPostDto.files.map((file: any) =>
                    this.uploadFile({
                        buffer: file.buffer,
                        originalname: file.originalname,
                        mimetype: file.mimetype,
                    } as Express.Multer.File),
                );
                const uploadedFiles = await Promise.all(uploadPromises);
                fileObjects = uploadedFiles.map((uploadedFile, index) => ({
                    url: uploadedFile.url,
                    originalname: createPostDto.files[index].originalname,
                    mimetype: createPostDto.files[index].mimetype,
                    size: createPostDto.files[index].size,
                }));
            }

            const postData = {
                ...createPostDto,
                [createPostDto.forumType]: new Types.ObjectId(createPostDto.forumId),
                createdBy: new Types.ObjectId(userId),
                files: fileObjects,
            }


            // const genericPost = await this.genericPostModel.create(postData);
            const genericPost = new this.genericPostModel(postData);
            await genericPost.save({ session });

            await this.assetsService.createFeed(
                genericPost.club || genericPost.node || genericPost.chapter,
                genericPost.club ? 'Club' : genericPost.node ? 'Node' : 'Chapter',
                'Generic',
                genericPost._id as any,
            )

            if (genericPost?.genericType === "announcement") {
                const membersModels: Record<any, any> = {
                    club: this.clubMembersModel,
                    node: this.nodeMembersModel,
                    chapter: this.chapterMemberModel,
                }

                const notificationMessage = "published an announcement in";
                const forumType = genericPost.club ? 'club' : genericPost.node ? 'node' : 'chapter';
                const forumId = genericPost.club ? genericPost.club.toString() : genericPost.node ? genericPost.node.toString() : genericPost.chapter.toString();
                const membersModel = membersModels[forumType];
                const memberDocs = await membersModel.find({ [forumType]: new Types.ObjectId(forumId) }).select('user');

                const emitGenericPostAnnouncement: EmitGenericPostAnnouncementProps = {
                    forum: {
                        type: forumType,
                        id: genericPost.club ? genericPost.club.toString() : genericPost.node ? genericPost.node.toString() : genericPost.chapter.toString(),
                    },
                    from: userId,
                    message: notificationMessage,
                    assetId: genericPost._id.toString(),
                    memberIds: memberDocs.map((memberDoc: any) => memberDoc.user.toString()).filter((userId: string) => userId !== genericPost.createdBy.toString()),
                }

                await this.notificationEventsService.emitGenericPostAnnouncement(emitGenericPostAnnouncement)
            }

            await session.commitTransaction();
            return genericPost;
        } catch (error) {
            await session.abortTransaction();
            console.log(error);
            throw error;
        } finally {
            session.endSession();
        }
    }

    async findGenericPostById(id: string, userId: string) {
        const genericPost = await this.genericPostModel.findById(id)
            .populate('createdBy', 'userName firstName lastName profileImage')
            .lean()
        const { role } = await this.commonService.getUserDetailsInForum({
            userId: String(userId),
            forumId: String(genericPost?.chapter?._id || genericPost?.club?._id || genericPost?.node?._id),
            forum: genericPost?.club ? 'club' : genericPost?.node ? 'node' : 'chapter',
        });

        return { ...genericPost, currentUserRole: role };
    }


    async likeGenericPost(postId: string, userId: string) {
        try {
            const genericPost = await this.genericPostModel.findById(postId);
            if (!genericPost) {
                throw new NotFoundException('Generic Post not found');
            }

            const alreadyLiked = genericPost.relevant.some((like) =>
                like.user.equals(userId),
            );

            if (alreadyLiked) {
                return await this.genericPostModel.findByIdAndUpdate(
                    postId,
                    { $pull: { relevant: { user: userId } } },
                    { new: true },
                );
            }

            return await this.genericPostModel.findByIdAndUpdate(
                postId,
                {
                    $addToSet: { relevant: { user: userId, date: new Date() } },
                },
                { new: true },
            );
        } catch (error) {
            console.log(error);
            throw error;
        }
    }

    async viewGenericPost(postId: string, userId: string) {
        try {
            const rulesRegulation = await this.genericPostModel.findOne({
                _id: postId,
                'views.user': userId
            });


            if (rulesRegulation) {
                return { message: 'User has already viewed this generic post' };
            }

            const updatedRulesRegulation = await this.genericPostModel
                .findByIdAndUpdate(
                    postId,
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
            console.log(error);
            throw error;
        }
    }

    async deleteGenericPost(postId: string, userId: string) {
        try {
            const genericPost = await this.genericPostModel.findById(postId);

            if (!genericPost) throw new NotFoundException('Generic Post not found');

            const { role, isMember } = await this.commonService.getUserDetailsInForum({
                userId,
                forum: genericPost?.chapter ? 'chapter' : genericPost?.node ? 'node' : 'club',
                forumId: String(genericPost?.chapter || genericPost?.node || genericPost?.club)
            });

            if (!isMember || (['member', 'moderator'].includes(role) && genericPost?.createdBy?.toString() !== userId.toString())) {
                throw new ForbiddenException("You are not authorized to delete this generic post");
            }

            // soft delete generic post
            await this.genericPostModel.findByIdAndUpdate(postId, { $set: { isDeleted: true } });

            // update feed status to deleted
            await this.assetsService.updateFeed(
                postId,
                "deleted"
            );

            return { success: true, message: 'Deleted successfully' };
        } catch (error) {
            console.error("GenericPost DELETE Error :: ", error);
            if (error instanceof ForbiddenException) throw error;
            if (error instanceof NotFoundException) throw error;
            throw new InternalServerErrorException(
                'Error while deleting Generic Post',
                error,
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
                'generic',
            );
            return response;
        } catch (error) {
            throw new BadRequestException(
                'Failed to upload file. Please try again later.',
            );
        }
    }
}
