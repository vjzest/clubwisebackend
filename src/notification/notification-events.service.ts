import { Injectable } from "@nestjs/common";
import { NotificationGateway } from "./notification.gateway";
import { TForum } from "typings";
import { Types } from "mongoose";
import { StdPluginAsset } from '../shared/entities/standard-plugin/std-plugin-asset.entity';
import { GenericPost } from '../shared/entities/generic-post.entity';

@Injectable()
export class NotificationEventsService {
    constructor(private notificationGateway: NotificationGateway) { }

    async emitInviteUser(emitInviteUserProps: EmitInviteUserProps) {
        const { memberIds, forum, from, message } = emitInviteUserProps;
        const notifications = [];

        for (const userId of memberIds) {
            const notification = await this.notificationGateway.sendNotification(userId, {
                user: new Types.ObjectId(userId),
                notificationType: 'invite',
                read: false,
                data: {
                    from: new Types.ObjectId(from),
                    target: new Types.ObjectId(userId),
                    message,
                    [forum.type]: new Types.ObjectId(forum.id),
                }
            })
            notifications.push(notification);
        }

        return notifications;
    }

    async emitUserJoinRequest(emitUserJoinRequestProps: EmitUserJoinRequestProps) {
        const { memberIds, forum, from, message } = emitUserJoinRequestProps;
        const notifications = [];

        for (const userId of memberIds) {
            const notification = await this.notificationGateway.sendNotification(userId, {
                user: new Types.ObjectId(userId),
                notificationType: 'join-request',
                read: false,
                data: {
                    from: new Types.ObjectId(from),
                    message,
                    [forum.type]: new Types.ObjectId(forum.id),
                }
            })
            notifications.push(notification);
        }

        return notifications;
    }

    async emitUserJoinApproved(emitUserJoinApprovedProps: EmitUserJoinApprovedProps) {
        const { memberIds, forum, approver, message } = emitUserJoinApprovedProps;
        const notifications = [];

        for (const userId of memberIds) {
            const notification = await this.notificationGateway.sendNotification(userId, {
                user: new Types.ObjectId(userId),
                notificationType: 'join-approved',
                read: false,
                data: {
                    approver: new Types.ObjectId(approver),
                    message,
                    [forum.type]: new Types.ObjectId(forum.id),
                }
            })
            notifications.push(notification);
        }

        return notifications;
    }

    async emitUserJoinRejected(emitUserJoinRejectedProps: EmitUserJoinRejectedProps) {
        const { memberIds, forum, approver, message } = emitUserJoinRejectedProps;
        const notifications = [];

        for (const userId of memberIds) {
            const notification = await this.notificationGateway.sendNotification(userId, {
                user: new Types.ObjectId(userId),
                notificationType: 'join-rejected',
                read: false,
                data: {
                    approver: new Types.ObjectId(approver),
                    message,
                    [forum.type]: new Types.ObjectId(forum.id),
                }
            })
            notifications.push(notification);
        }

        return notifications;
    }

    async emitStdModuleAssetUpdates(emitStdModuleAssetUpdatesProps: EmitStdModuleAssetUpdatesProps) {
        const { subscriberIds, forum, from, message, assetId, pluginId } = emitStdModuleAssetUpdatesProps;
        const notifications = [];

        for (const userId of subscriberIds) {
            const notification = await this.notificationGateway.sendNotification(userId, {
                user: new Types.ObjectId(userId),
                notificationType: 'std-module-asset-updates',
                read: false,
                data: {
                    from: new Types.ObjectId(from),
                    message,
                    [forum.type]: new Types.ObjectId(forum.id),
                    asset: new Types.ObjectId(assetId),
                    assetModel: StdPluginAsset.name,
                    plugin: new Types.ObjectId(pluginId),
                }
            })
            notifications.push(notification);
        }

        return notifications;
    }

    async emitGenericPostAnnouncement(emitGenericPostAnnouncementProps: EmitGenericPostAnnouncementProps) {
        const { memberIds, forum, from, message, assetId } = emitGenericPostAnnouncementProps;
        const notifications = [];

        for (const userId of memberIds) {
            const notification = await this.notificationGateway.sendNotification(userId, {
                user: new Types.ObjectId(userId),
                notificationType: 'generic-post-announcement',
                read: false,
                data: {
                    from: new Types.ObjectId(from),
                    message,
                    [forum.type]: new Types.ObjectId(forum.id),
                    asset: new Types.ObjectId(assetId),
                    assetModel: GenericPost.name,
                }
            })
            notifications.push(notification);
        }

        return notifications;
    }

    async emitCustomerConnectAnnouncement(emitCustomerConnectAnnouncementProps: EmitCustomerConnectAnnouncementProps) {
        const { memberIds, forum, from, message } = emitCustomerConnectAnnouncementProps;
        const notifications = [];

        for (const userId of memberIds) {
            const notification = await this.notificationGateway.sendNotification(userId, {
                user: new Types.ObjectId(userId),
                notificationType: 'customer-connect-announcement',
                read: false,
                data: {
                    from: new Types.ObjectId(from),
                    message,
                    [forum.type]: new Types.ObjectId(forum.id),
                }
            })
            notifications.push(notification);
        }

        return notifications;
    }

}

export interface EmitInviteUserProps {
    forum: {
        type: TForum,
        id: string
    }
    from: string,
    message: string,
    memberIds: string[]
}

export interface EmitUserJoinRequestProps {
    forum: {
        type: TForum,
        id: string
    }
    from: string,
    message: string,
    memberIds: string[]
}

export interface EmitUserJoinApprovedProps {
    forum: {
        type: TForum,
        id: string
    }
    approver: string,
    message: string,
    memberIds: string[]
}

export interface EmitUserJoinRejectedProps {
    forum: {
        type: TForum,
        id: string
    }
    approver: string,
    message: string,
    memberIds: string[]
}

export interface EmitStdModuleAssetUpdatesProps {
    forum: {
        type: TForum,
        id: string
    }
    from: string,
    message: string,
    subscriberIds: string[],
    pluginId: string,
    assetId: string,
}

export interface EmitGenericPostAnnouncementProps {
    forum: {
        type: TForum,
        id: string
    }
    from: string,
    message: string,
    memberIds: string[],
    assetId: string,
}

export interface EmitCustomerConnectAnnouncementProps {
    forum: {
        type: TForum,
        id: string
    }
    from: string,
    message: string,
    memberIds: string[],
}
