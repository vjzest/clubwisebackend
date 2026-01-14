import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types, Schema as MongooseSchema } from "mongoose";
import { Node_ } from "../node.entity";
import { Club } from "../club.entity";
import { Chapter } from "../chapters/chapter.entity";
import { User } from "../user.entity";
import { StdPlugin } from "../standard-plugin/std-plugin.entity";
import { StdPluginAsset } from "../standard-plugin/std-plugin-asset.entity";
import { GenericPost } from "../generic-post.entity";

// Common data structure for all notification types
@Schema()
class NotificationData {
    @Prop({ type: Types.ObjectId, ref: Node_.name })
    node?: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: Club.name })
    club?: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: Chapter.name })
    chapter?: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: User.name })
    from?: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: User.name })
    target?: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: User.name })
    approver?: Types.ObjectId;

    @Prop({ type: Types.ObjectId, refPath: 'assetModel' })
    asset?: Types.ObjectId;

    @Prop({ type: String, enum: [StdPluginAsset.name, GenericPost.name] })
    assetModel?: typeof StdPluginAsset.name | typeof GenericPost.name;

    @Prop({ type: Types.ObjectId, ref: StdPlugin.name })
    plugin?: Types.ObjectId;

    @Prop({ type: String, required: true })
    message: string;
}

export const NotificationDataSchema = SchemaFactory.createForClass(NotificationData);

// Base notification schema
@Schema({ timestamps: true })
export class Notification extends Document {
    @Prop({ type: Types.ObjectId, required: true, ref: User.name })
    user: Types.ObjectId;

    @Prop({ required: true, enum: ['invite', 'join-request', 'join-approved', 'join-rejected', 'std-module-asset-updates', 'generic-post-announcement', 'customer-connect-announcement'] })
    notificationType: 'invite' | 'join-request' | 'join-approved' | 'join-rejected' | 'std-module-asset-updates' | 'generic-post-announcement' | 'customer-connect-announcement';

    @Prop({ type: Boolean, required: true, default: false })
    read: boolean;

    @Prop({ type: Boolean, required: true, default: false })
    isDeleted: boolean;

    @Prop({ type: NotificationDataSchema })
    data: NotificationData;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);

// Add pre-save hook for validation based on notification type
NotificationSchema.pre('save', function (next) {
    const notification = this as any;
    const data = notification.data || {};

    // Common validation for all types
    if (!data.message) {
        return next(new Error('Message is required for all notification types'));
    }

    // Type-specific validation
    switch (notification.notificationType) {
        case 'invite':
            if (!data.from) return next(new Error('From field is required for invite notifications'));
            if (!data.target) return next(new Error('Target field is required for invite notifications'));
            break;

        case 'join-request':
            if (!data.from) return next(new Error('From field is required for join-request notifications'));
            break;

        case 'join-approved':
            if (!data.approver) return next(new Error('Approver field is required for join-approved notifications'));
            break;

        case 'join-rejected':
            if (!data.approver) return next(new Error('Approver field is required for join-rejected notifications'));
            break;

        case 'std-module-asset-updates':
            if (!data.from) return next(new Error('From field is required for std-module-asset-updates notifications'));
            if (!data.asset) return next(new Error('Asset ID field is required for std-module-asset-updates notifications'));
            if (!data.assetModel) return next(new Error('Asset model field is required for std-module-asset-updates notifications'));
            if (!data.plugin) return next(new Error('Plugin ID field is required for std-module-asset-updates notifications'));
            break;

        case 'generic-post-announcement':
            if (!data.from) return next(new Error('From field is required for generic-post-announcement notifications'));
            if (!data.asset) return next(new Error('Asset ID field is required for generic-post-announcement notifications'));
            if (!data.assetModel) return next(new Error('Asset model field is required for generic-post-announcement notifications'));
            break;

        case 'customer-connect-announcement':
            if (!data.from) return next(new Error('From field is required for customer-connect-announcement notifications'));
            break;

        default:
            return next(new Error('Invalid notification type'));
    }

    next();
});

// Define the function to create model in a NestJS module
export function getNotificationModel(connection: any) {
    return connection.model(Notification.name, NotificationSchema);
}

// TypeScript interfaces for type checking
export interface InviteNotificationData extends NotificationData {
    from: Types.ObjectId;
    target: Types.ObjectId;
}

export interface JoinRequestNotificationData extends NotificationData {
    from: Types.ObjectId;
}

export interface JoinApprovedNotificationData extends NotificationData {
    approver: Types.ObjectId;
}

export interface JoinRejectedNotificationData extends NotificationData {
    approver: Types.ObjectId;
}

export interface StdModuleAssetUpdatesNotificationData extends NotificationData {
    from: Types.ObjectId;
    asset: Types.ObjectId;
    assetModel: typeof StdPluginAsset.name;
    plugin: Types.ObjectId;
}

export interface GenericPostAnnouncementNotificationData extends NotificationData {
    from: Types.ObjectId;
    asset: Types.ObjectId;
    assetModel: typeof GenericPost.name;
}

export interface CustomerConnectAnnouncementNotificationData extends NotificationData {
    from: Types.ObjectId;
}

// Define typed notification interfaces
export interface BaseNotification extends Document {
    user: Types.ObjectId;
    notificationType: 'invite' | 'join-request' | 'join-approved' | 'join-rejected' | 'std-module-asset-updates' | 'generic-post-announcement' | 'customer-connect-announcement';
    read: boolean;
    isDeleted: boolean;
    createdAt: Date;
    updatedAt: Date;
    data: NotificationData;
}

export interface InviteNotification extends BaseNotification {
    notificationType: 'invite';
    data: InviteNotificationData;
}

export interface JoinRequestNotification extends BaseNotification {
    notificationType: 'join-request';
    data: JoinRequestNotificationData;
}

export interface JoinApprovedNotification extends BaseNotification {
    notificationType: 'join-approved';
    data: JoinApprovedNotificationData;
}

export interface JoinRejectedNotification extends BaseNotification {
    notificationType: 'join-rejected';
    data: JoinRejectedNotificationData;
}

export interface StdModuleAssetUpdatesNotification extends BaseNotification {
    notificationType: 'std-module-asset-updates';
    data: StdModuleAssetUpdatesNotificationData;
}

export interface GenericPostAnnouncementNotification extends BaseNotification {
    notificationType: 'generic-post-announcement';
    data: GenericPostAnnouncementNotificationData;
}

export interface CustomerConnectAnnouncementNotification extends BaseNotification {
    notificationType: 'customer-connect-announcement';
    data: CustomerConnectAnnouncementNotificationData;
}

export type NotificationDocument =
    | InviteNotification
    | JoinRequestNotification
    | JoinApprovedNotification
    | JoinRejectedNotification
    | StdModuleAssetUpdatesNotification
    | GenericPostAnnouncementNotification
    | CustomerConnectAnnouncementNotification;