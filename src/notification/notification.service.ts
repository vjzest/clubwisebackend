import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Chapter } from 'src/shared/entities/chapters/chapter.entity';
import { Club } from 'src/shared/entities/club.entity';
import { Node_ } from 'src/shared/entities/node.entity';
import { Notification } from 'src/shared/entities/notification/notification.entity';
import { StdPluginAsset } from 'src/shared/entities/standard-plugin/std-plugin-asset.entity';
import { StdPlugin } from 'src/shared/entities/standard-plugin/std-plugin.entity';
import { User } from 'src/shared/entities/user.entity';

@Injectable()
export class NotificationService {
    constructor(
        @InjectModel(Notification.name) private notificationModel: Model<Notification>
    ) { }

    async storeNotification(userId: string, notification: any) {
        try {
            if (!userId || !notification) {
                throw new NotFoundException("Invalid data");
            }
            console.log('notification', notification)
            const newNotificationData = {
                ...notification,
            }

            const newNotification = new this.notificationModel(newNotificationData)

            const savedNotification = await newNotification.save();

            const savedNewNotification = await this.notificationModel.findById(savedNotification._id)
                .populate({
                    path: 'user',
                    model: User.name,
                    select: 'firstName lastName userName profileImage'
                })
                .populate({
                    path: 'data.from',
                    model: User.name,
                    select: 'firstName lastName userName profileImage'
                })
                .populate({
                    path: 'data.node',
                    model: Node_.name,
                    select: 'name profileImage'
                })
                .populate({
                    path: 'data.club',
                    model: Club.name,
                    select: 'name profileImage'
                })
                .populate({
                    path: 'data.chapter',
                    model: Chapter.name,
                    select: 'name profileImage'
                })
                .populate({
                    path: 'data.target',
                    model: User.name,
                    select: 'firstName lastName userName profileImage'
                })
                .populate({
                    path: 'data.approver',
                    model: User.name,
                    select: 'firstName lastName userName profileImage'
                })
                .populate({
                    path: 'data.plugin',
                    model: StdPlugin.name,
                    select: 'name slug'
                })
                .exec();

            if (savedNewNotification?.data?.asset && savedNewNotification?.data?.assetModel) {
                await this.notificationModel.populate(savedNewNotification, {
                    path: 'data.asset',
                    model: savedNewNotification?.data?.assetModel,
                    select: '_id slug name'
                });
            }

            return savedNewNotification;
        } catch (error) {
            console.log("Error saving notification", error);
            if (error instanceof NotFoundException) throw error;
            throw error;
        }
    }

    async getUnreadNotifications(userId: string) {
        try {
            if (!userId) {
                throw new NotFoundException("Invalid user id");
            }

            const notifications = await this.notificationModel
                .find({ user: new Types.ObjectId(userId), read: false, isDeleted: false })
                .sort({ createdAt: -1 })
                .populate({
                    path: 'user',
                    model: User.name,
                    select: 'firstName lastName userName profileImage'
                })
                .populate({
                    path: 'data.from',
                    model: User.name,
                    select: 'firstName lastName userName profileImage'
                })
                .populate({
                    path: 'data.node',
                    model: Node_.name,
                    select: 'name profileImage'
                })
                .populate({
                    path: 'data.club',
                    model: Club.name,
                    select: 'name profileImage'
                })
                .populate({
                    path: 'data.chapter',
                    model: Chapter.name,
                    select: 'name profileImage'
                })
                .populate({
                    path: 'data.target',
                    model: User.name,
                    select: 'firstName lastName userName profileImage'
                })
                .populate({
                    path: 'data.approver',
                    model: User.name,
                    select: 'firstName lastName userName profileImage'
                })
                .populate({
                    path: 'data.plugin',
                    model: StdPlugin.name,
                    select: 'name slug'
                })
                .exec();


            await Promise.all(
                notifications.map(notification =>
                    this.notificationModel.populate(notification, {
                        path: 'data.asset',
                        model: notification?.data?.assetModel,
                        select: '_id slug',
                    })
                )
            );

            return notifications;

        } catch (error) {
            console.log("Error getting notifications", error);
            if (error instanceof NotFoundException) throw error;
            throw error;
        }
    }

    async getAllNotifications(userId: string) {
        try {
            if (!userId) {
                throw new NotFoundException("Invalid user id");
            }

            const notifications = await this.notificationModel
                .find({ user: new Types.ObjectId(userId), isDeleted: false })
                .sort({ createdAt: -1 })
                .populate({
                    path: 'user',
                    model: User.name,
                    select: 'firstName lastName userName profileImage'
                })
                .populate({
                    path: 'data.from',
                    model: User.name,
                    select: 'firstName lastName userName profileImage'
                })
                .populate({
                    path: 'data.node',
                    model: Node_.name,
                    select: 'name profileImage'
                })
                .populate({
                    path: 'data.club',
                    model: Club.name,
                    select: 'name profileImage'
                })
                .populate({
                    path: 'data.chapter',
                    model: Chapter.name,
                    select: 'name profileImage'
                })
                .populate({
                    path: 'data.target',
                    model: User.name,
                    select: 'firstName lastName userName profileImage'
                })
                .populate({
                    path: 'data.approver',
                    model: User.name,
                    select: 'firstName lastName userName profileImage'
                })

                .populate({
                    path: 'data.plugin',
                    model: StdPlugin.name,
                    select: 'name slug'
                })
                .exec();


            await Promise.all(
                notifications.map(notification =>
                    this.notificationModel.populate(notification, {
                        path: 'data.asset',
                        model: notification?.data?.assetModel,
                        select: '_id slug',
                    })
                )
            );

            return notifications;


        } catch (error) {
            console.log("Error getting notifications", error);
            if (error instanceof NotFoundException) throw error;
            throw error;
        }
    }

    async markAsRead(userId: string, notificationIds: string[]) {
        try {
            if (!userId) {
                throw new NotFoundException("Invalid user id");
            }

            await this.notificationModel.updateMany(
                {
                    user: new Types.ObjectId(userId),
                    _id: { $in: notificationIds }
                },
                {
                    $set: { read: true }
                }
            );

        } catch (error) {
            console.log("Error marking notifications as read", error);
            if (error instanceof NotFoundException) throw error;
            throw error;
        }
    }

    async markAllAsRead(userId: string) {
        try {
            if (!userId) {
                throw new NotFoundException("Invalid user id");
            }

            await this.notificationModel.updateMany(
                { user: new Types.ObjectId(userId), read: false },
                { $set: { read: true } }
            );

        } catch (error) {
            console.log("Error marking all notifications as read", error);
            if (error instanceof NotFoundException) throw error;
            throw error;
        }
    }

    async deleteNotification(userId: string, notificationId: string) {
        try {
            if (!userId || !notificationId) {
                throw new NotFoundException("Invalid data");
            }

            await this.notificationModel.deleteOne({ user: new Types.ObjectId(userId), _id: notificationId });

        } catch (error) {
            console.log("Error marking all notifications as deleted", error);
            if (error instanceof NotFoundException) throw error;
            throw error;
        }
    }

    async getUnreadCount(userId: string) {
        try {
            if (!userId) {
                throw new NotFoundException("Invalid user id");
            }

            return this.notificationModel.countDocuments({ user: new Types.ObjectId(userId), read: false, isDeleted: false });
        } catch (error) {
            console.log("Error getting unread notifications count", error);
            if (error instanceof NotFoundException) throw error;
            throw error;
        }
    }

    async clearAllNotifications(userId: string) {
        try {
            if (!userId) {
                throw new NotFoundException("Invalid user id");
            }

            await this.notificationModel.updateMany(
                { user: new Types.ObjectId(userId), isDeleted: false },
                { $set: { isDeleted: true } }
            );

        } catch (error) {
            console.log("Error marking all notifications as read", error);
            if (error instanceof NotFoundException) throw error;
            throw error;
        }
    }

}
