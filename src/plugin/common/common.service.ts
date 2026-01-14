import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, ClientSession } from 'mongoose';
import { ChapterMember } from '../../shared/entities/chapters/chapter-member.entity';
import { Chapter } from '../../shared/entities/chapters/chapter.entity';
import { ClubMembers } from '../../shared/entities/clubmembers.entity';
import { NodeMembers } from '../../shared/entities/node-members.entity';
import { TForum } from 'typings';

interface CopyConfig {
    sourceModel: Model<any>;
    targetModel: Model<any>;
    referenceKey: string;
    statusKey?: string;
}

@Injectable()
export class CommonService {
    constructor(
        @InjectModel(Chapter.name) private readonly chapterModel: Model<any>,
        @InjectModel(NodeMembers.name) private readonly nodeMembersModel: Model<NodeMembers>,
        @InjectModel(ClubMembers.name) private readonly clubMembersModel: Model<ClubMembers>,
        @InjectModel(ChapterMember.name) private readonly chapterMembersModel: Model<ChapterMember>
    ) { }

    async copyAnAssetToAllClubChapters({
        clubId,
        assetId,
        config,
        session,
    }: {
        clubId: string | Types.ObjectId;
        assetId: string | Types.ObjectId;
        config: CopyConfig;
        session: ClientSession;
    }) {
        try {
            // Find all published chapters for the club
            const chapters = await this.chapterModel.find({
                club: new Types.ObjectId(clubId),
                status: 'published',
                isDeleted: false,
            }).session(session);

            if (!chapters.length) {
                return;
            }

            // Create chapter assets for each chapter
            const chapterAssetsToInsert = chapters.map(chapter => ({
                chapter: chapter._id,
                [config.referenceKey]: new Types.ObjectId(assetId),
                publishedStatus: 'published'
            }));

            // Insert the assets into the target model
            await config.targetModel.insertMany(chapterAssetsToInsert, { session });

            return chapters.length;
        } catch (error) {
            console.error('Error copying asset to chapters:', error);
            throw error;
        }
    }

    async getUserDetailsInForum({
        userId,
        forumId,
        forum,
    }: {
        userId: string;
        forumId: string;
        forum: TForum;
    }): Promise<{
        isMember: boolean;
        role?: 'owner' | 'admin' | 'moderator' | 'member',
        userDetails?: NodeMembers | ClubMembers | ChapterMember | null
    }> {
        try {
            let userDetails = null;

            switch (forum) {
                case 'node':
                    userDetails = await this.nodeMembersModel.findOne({
                        user: new Types.ObjectId(userId),
                        node: new Types.ObjectId(forumId),
                        status: 'MEMBER'
                    });
                    break;
                case 'club':
                    userDetails = await this.clubMembersModel.findOne({
                        user: new Types.ObjectId(userId),
                        club: new Types.ObjectId(forumId),
                        status: 'MEMBER'
                    });
                    break;
                case 'chapter':
                    userDetails = await this.chapterMembersModel.findOne({
                        user: new Types.ObjectId(userId),
                        chapter: new Types.ObjectId(forumId),
                        status: 'MEMBER'
                    });
                    break;
                default:
                    return { isMember: false };
            }

            return {
                isMember: !!userDetails,
                role: userDetails?.role || 'VISITOR',
                userDetails
            };
        } catch (error) {
            console.error('Error checking user authorization:', error);
            return { isMember: false };
        }
    }


    async togglePublicPrivate<T>({
        assetId,
        userId,
        isPublic,
        model,
        forumType,
        existingItem
    }: {
        assetId: string;
        userId: string;
        isPublic: boolean;
        model: Model<T>;
        forumType: 'club' | 'node' | 'chapter';
        existingItem?: any;
    }) {
        try {
            const { isMember, role } = await this.getUserDetailsInForum({
                forum: forumType,
                forumId: String(existingItem[`${forumType}`]),
                userId: String(userId)
            });

            console.log({ isMember, role, assetId, userId, isPublic, forumType, existingItem });

            if (!isMember || ['member', 'moderator'].includes(role)) {
                throw new Error('You are not authorized to update this item');
            }

            const updatedItem = await model.findByIdAndUpdate(
                assetId,
                {
                    $set: { isPublic },
                },
                { new: true }
            ).populate({
                path: 'createdBy',
                select: 'userName firstName middleName lastName profileImage interests'
            })

            return updatedItem;
        } catch (error) {
            console.log('Error toggling public/private:', error);
            throw error;
        }
    }

}
