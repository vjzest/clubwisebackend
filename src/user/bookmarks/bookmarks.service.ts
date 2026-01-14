import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { Bookmarks } from '../../shared/entities/bookmarks.entity';
import { Debate } from '../../shared/entities/debate/debate.entity';
import { GenericPost } from '../../shared/entities/generic-post.entity';
import { Issues } from '../../shared/entities/issues/issues.entity';
import { Projects } from '../../shared/entities/projects/project.entity';
import { RulesRegulations } from '../../shared/entities/rules/rules-regulations.entity';
import { StdPluginAsset } from '../../shared/entities/standard-plugin/std-plugin-asset.entity';
import { StdPlugin } from '../../shared/entities/standard-plugin/std-plugin.entity';
import { User } from '../../shared/entities/user.entity';


@Injectable()
export class BookmarksService {

    constructor(@InjectModel(Bookmarks.name) private readonly bookmarksModel) { }

    async createFolder(createFolderDto: any) {
        try {

            if (!createFolderDto.title) {
                throw new BadRequestException('Folder title is required');
            }

            if (!createFolderDto.user) {
                throw new BadRequestException('User id is required');
            }

            const createFolder = await this.bookmarksModel.create({
                title: createFolderDto.title,
                user: createFolderDto.user,
                posts: []
            })

            return {
                status: 'success',
                message: 'Folder created successfully',
                data: createFolder
            }

        } catch (error) {
            console.log({ error })
            throw error;
        }
    }

    async fetchFolders(userId: string) {
        try {

            const baseQuery = {
                user: userId
            };

            // If no folderId, fetch all folders for the user
            return await this.bookmarksModel.find(baseQuery)
                .populate({
                    path: 'posts.entity.entityId',
                    refPath: 'posts.entity.entityType',
                }).lean().sort({ createdAt: -1 });
        } catch (error) {
            console.error('Error in fetchFolders:', error);
            throw error; // Re-throw the error to be handled by the caller
        }
    }

    async fetchFolder(
        folderId: string,
        limit: number,
        search: string = ""
    ) {
        try {

            return await this.bookmarksModel.findOne({
                _id: folderId,
            })
                .sort({ createdAt: -1 })
                // .limit(limit)
                .populate({
                    path: 'posts.entity.entityId',
                    refPath: 'posts.entity.entityType',
                    populate: [
                        {
                            path: 'createdBy',
                            select: 'userName profileImage firstName lastName',
                            options: { lean: true }
                        },
                        {
                            path: 'plugin',
                            model: StdPlugin.name,
                            select: 'name slug',
                            options: {
                                lean: true,
                                match: { moduleType: StdPluginAsset.name },
                                strictPopulate: false
                            }
                        }
                    ]
                }).lean();
        } catch (error) {
            console.error('Error in fetchFolder:', error);
            throw error; // Re-throw the error to be handled by the caller
        }
    }

    async singleAddToBookmark(
        folderId: string,
        userId: string,
        entityId: string,
        entityType: string
    ) {
        try {
            console.log({ entityType })
            // Convert string IDs to ObjectId
            const bookmarkObjectId = new Types.ObjectId(folderId);
            const userObjectId = new Types.ObjectId(userId);
            const entityObjectId = new Types.ObjectId(entityId);

            // Find the bookmark and verify ownership
            const bookmark = await this.bookmarksModel.findOne({
                _id: bookmarkObjectId,
                user: userObjectId,
            });

            if (!bookmark) {
                throw new NotFoundException('Bookmark folder not found or unauthorized');
            }

            // Check if the entity already exists in the bookmark
            const existingPost = bookmark.posts.find(post =>
                post.entity.entityId.toString() === entityId &&
                post.entity.entityType === (
                    entityType === "project" ? Projects.name
                        : entityType === "issues" ? Issues.name
                            : entityType === "debate" ? Debate.name
                                : entityType === "rulesRegulations" ? RulesRegulations.name
                                    : entityType === "stdPluginAsset" ? StdPluginAsset.name
                                        : entityType === "GenericPost" ? GenericPost.name
                                            : entityType
                )
            );
            console.log({ existingPost })

            if (existingPost) {
                // Remove the post if it exists
                const updatedBookmark = await this.bookmarksModel.findByIdAndUpdate(
                    bookmarkObjectId,
                    {
                        $pull: {
                            posts: {
                                'entity.entityId': entityObjectId,

                            }
                        }
                    },
                    { new: true }
                );

                return {
                    message: `Successfully removed from ${bookmark.title}`,
                    bookmark: updatedBookmark,
                    action: 'removed'
                };
            }
            console.log({ entityType })
            // Add the new post to the bookmark if it doesn't exist
            const updatedBookmark = await this.bookmarksModel.findByIdAndUpdate(
                bookmarkObjectId,
                {
                    $push: {
                        posts: {
                            createdAt: new Date(),
                            entity: {
                                entityId: entityObjectId,
                                entityType: entityType === "project" ? Projects.name
                                    : entityType === "issues" ? Issues.name
                                        : entityType === "debate" ? Debate.name
                                            : entityType === "rulesRegulations" ? RulesRegulations.name
                                                : entityType === "stdPluginAsset" ? StdPluginAsset.name
                                                    : entityType === "GenericPost" ? GenericPost.name
                                                        : entityType,
                            },
                        },
                    },
                },
                { new: true }
            );

            console.log({ updatedBookmark })

            return {
                message: `Successfully added to ${bookmark.title}`,
                bookmark: updatedBookmark,
                action: 'added'
            };

        } catch (error) {
            if (error instanceof BadRequestException || error instanceof NotFoundException) {
                throw error;
            }
            if (error.name === 'BSONError' || error.name === 'CastError') {
                throw new BadRequestException('Invalid ID format');
            }
            throw new InternalServerErrorException('Error updating bookmark');
        }
    }

    async addToBookmark(
        folderIds: string[],
        userId: string,
        entityId: string,
        entityType: string
    ) {
        try {
            const bookmarkObjectIds = folderIds.map(id => new Types.ObjectId(id));
            const userObjectId = new Types.ObjectId(userId);
            const entityObjectId = new Types.ObjectId(entityId);

            // Normalize entityType
            const resolvedEntityType =
                entityType === "project" ? Projects.name
                    : entityType === "issues" ? Issues.name
                        : entityType === "debate" ? Debate.name
                            : entityType === "rulesRegulations" ? RulesRegulations.name
                                : entityType === "stdPluginAsset" ? StdPluginAsset.name
                                    : entityType;

            // First, fetch only folders that belong to the user (one query)
            const bookmarks = await this.bookmarksModel.find({
                _id: { $in: bookmarkObjectIds },
                user: userObjectId
            });

            if (!bookmarks.length) {
                throw new NotFoundException("No valid bookmark folders found or unauthorized");
            }

            const bulkOps = [];

            for (const bookmark of bookmarks) {
                const exists = bookmark.posts.some(
                    post =>
                        post.entity.entityId.toString() === entityId &&
                        post.entity.entityType === resolvedEntityType
                );

                if (exists) {
                    // Prepare remove op
                    bulkOps.push({
                        updateOne: {
                            filter: { _id: bookmark._id },
                            update: {
                                $pull: {
                                    posts: {
                                        'entity.entityId': entityObjectId,
                                        'entity.entityType': resolvedEntityType
                                    }
                                }
                            }
                        }
                    });
                } else {
                    // Prepare add op
                    bulkOps.push({
                        updateOne: {
                            filter: { _id: bookmark._id },
                            update: {
                                $push: {
                                    posts: {
                                        createdAt: new Date(),
                                        entity: {
                                            entityId: entityObjectId,
                                            entityType: resolvedEntityType
                                        }
                                    }
                                }
                            }
                        }
                    });
                }
            }

            // Execute all updates in one shot
            if (bulkOps.length > 0) {
                await this.bookmarksModel.bulkWrite(bulkOps);
            }

            return {
                message: "Bookmarks updated successfully",
                foldersProcessed: bookmarks.map((b: any) => b._id.toString()),
                totalFolders: bookmarks.length
            };
        } catch (error) {
            if (error instanceof BadRequestException || error instanceof NotFoundException) {
                throw error;
            }
            if (error.name === 'BSONError' || error.name === 'CastError') {
                throw new BadRequestException('Invalid ID format');
            }
            throw new InternalServerErrorException('Error updating bookmark');
        }
    }


    async checkBookmarkStatus(userId: string, entities: Array<{ id: string; type: string }>) {
        if (!userId || !entities.length) {
            return [];
        }
        // Convert string ID to ObjectId
        const userObjectId = new Types.ObjectId(userId);

        // Find all bookmarks for the user
        const userBookmarks = await this.bookmarksModel.find({
            user: userObjectId,
            'posts.entity.entityId': {
                $in: entities.map(entity => new Types.ObjectId(entity.id)),
            },
        });

        // Create a map of bookmarked entities
        const bookmarkedMap = entities.map(entity => {
            const isBookmarked = userBookmarks.some(bookmark =>
                bookmark.posts.some(
                    post =>
                        post.entity.entityId.toString() === entity.id &&
                        post.entity.entityType === (
                            entity.type === "project" ? Projects.name :
                                entity.type === "issues" ? Issues.name :
                                    entity.type === "debate" ? Debate.name :
                                        entity.type
                        )
                )
            );
            return {
                entityId: entity.id,
                entityType: entity.type,
                isBookmarked,
            };
        });
        return bookmarkedMap;
    }




    async updateFolderTitle(folderId: string, userId: string, title: string) {
        try {
            console.log({ folderId })
            // Convert string IDs to ObjectId
            const folderObjectId = new Types.ObjectId(folderId);
            const userObjectId = new Types.ObjectId(userId);

            // Find the folder and verify ownership
            const folder = await this.bookmarksModel.findOne({
                _id: folderObjectId,
                user: userObjectId,
            });

            if (!folder) {
                throw new NotFoundException('Folder not found or unauthorized');
            }

            // Update the folder title
            const updatedFolder = await this.bookmarksModel.findByIdAndUpdate(
                folderObjectId,
                { title },
                { new: true } // Return the updated document
            );

            return {
                status: 'success',
                message: 'Folder title updated successfully',
                data: updatedFolder
            };

        } catch (error) {
            if (error instanceof NotFoundException) {
                throw error;
            }
            if (error.name === 'BSONError' || error.name === 'CastError') {
                throw new BadRequestException('Invalid id format');
            }
            console.error('Error in updateFolderTitle:', error);
            throw new InternalServerErrorException('Error updating folder title');
        }
    }


    async deleteFolder(folderId: string, userId: string) {
        try {
            // Convert string IDs to ObjectId
            const folderObjectId = new Types.ObjectId(folderId);
            const userObjectId = new Types.ObjectId(userId);

            // Find the folder and verify ownership
            const folder = await this.bookmarksModel.findOne({
                _id: folderObjectId,
                user: userObjectId,
            });

            if (!folder) {
                throw new NotFoundException('Folder not found or unauthorized');
            }

            // Delete the folder
            await this.bookmarksModel.findByIdAndDelete(folderObjectId);

            return {
                status: 'success',
                message: 'Folder deleted successfully'
            };

        } catch (error) {
            if (error instanceof NotFoundException) {
                throw error;
            }
            if (error.name === 'BSONError' || error.name === 'CastError') {
                throw new BadRequestException('Invalid id format');
            }
            console.error('Error in deleteFolder:', error);
            throw new InternalServerErrorException('Error deleting folder');
        }
    }

}
