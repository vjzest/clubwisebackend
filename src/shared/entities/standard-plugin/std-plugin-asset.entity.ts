import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';
import { User } from '../user.entity';
import { StdPlugin } from './std-plugin.entity';
import { IAdoptedClub, IAdoptedNode, IRelevantAndView } from 'typings';
import { Club } from '../club.entity';
import { Node_ } from '../node.entity';
import { Chapter } from '../chapters/chapter.entity';
import { ProductCategory } from '../../../clubsite/schemas/product-category.schema';

interface IStatusHistory {
    status: EPublishedStatus;
    changedBy: Types.ObjectId;
    date: Date;
    notes?: string;
}

export enum EPublishedStatus {
    PROPOSED = 'proposed',
    PUBLISHED = 'published',
    DRAFT = 'draft',
    ARCHIVED = 'archived',
    REJECTED = 'rejected',
}
@Schema({
    timestamps: true,
    strict: false,
})
export class StdPluginAsset extends Document {
    @Prop({
        type: MongooseSchema.Types.ObjectId,
        ref: StdPlugin.name,
        required: true,
        index: true
    })
    plugin: StdPlugin | MongooseSchema.Types.ObjectId;

    @Prop({ type: Map, of: MongooseSchema.Types.Mixed, default: {} })
    data: Map<string, any>;

    @Prop({
        type: MongooseSchema.Types.ObjectId,
        ref: Club.name,
        required: false,
        index: true
    })
    club: Club | MongooseSchema.Types.ObjectId;

    @Prop({
        type: MongooseSchema.Types.ObjectId,
        ref: Node_.name,
        required: false,
        index: true
    })
    node: Node_ | MongooseSchema.Types.ObjectId;

    @Prop({
        type: MongooseSchema.Types.ObjectId,
        ref: Chapter.name,
        required: false,
        index: true
    })
    chapter: Chapter | MongooseSchema.Types.ObjectId;

    @Prop({
        type: MongooseSchema.Types.ObjectId,
        ref: ProductCategory.name,
        required: false,
        index: true
    })
    productCategory: ProductCategory | MongooseSchema.Types.ObjectId;

    @Prop({ type: String, index: true, unique: true })
    slug: string;

    @Prop([{
        club: { type: Types.ObjectId, ref: Club.name },
        date: { type: Date, default: Date.now },
    }])
    adoptedClubs: IAdoptedClub[];

    @Prop([{
        node: { type: Types.ObjectId, ref: Node_.name },
        date: { type: Date, default: Date.now },
    }])
    adoptedNodes: IAdoptedNode[];

    @Prop([{
        user: { type: Types.ObjectId, ref: User.name },
        date: { type: Date, default: Date.now },
    }])
    views: IRelevantAndView[];

    @Prop([{
        user: { type: Types.ObjectId, ref: User.name },
        date: { type: Date, default: Date.now },
    }])
    relevant: IRelevantAndView[];

    @Prop([{
        user: { type: Types.ObjectId, ref: User.name },
        date: { type: Date, default: Date.now },
    }])
    irrelevant: IRelevantAndView[];

    @Prop([{
        user: { type: Types.ObjectId, ref: User.name },
        createdAt: { type: Date, default: Date.now }
    }])
    subscribers: IRelevantAndView[];

    @Prop({ type: String, enum: EPublishedStatus, default: EPublishedStatus.PUBLISHED })
    publishedStatus: EPublishedStatus;

    @Prop([{
        status: { type: String, enum: EPublishedStatus, required: true },
        changedBy: { type: Types.ObjectId, ref: User.name, required: true },
        date: { type: Date, default: Date.now },
        notes: { type: String }
    }])
    statusHistory: IStatusHistory[];

    @Prop({
        type: MongooseSchema.Types.ObjectId,
        ref: User.name,
        required: true,
        index: true
    })
    createdBy: User | MongooseSchema.Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: User.name })
    publishedBy: User | MongooseSchema.Types.ObjectId;

    @Prop({ default: false })
    isPublic: boolean;

    createdAt: Date;
    publishedDate: Date;

    @Prop({
        type: [
            {
                user: { type: Types.ObjectId, ref: User.name, required: true },
                seconds: { type: Number, required: true },
                date: { type: Date, required: true },
                _id: false
            }
        ],
        required: false
    })
    timeSpent: {
        user: Types.ObjectId;
        seconds: number;
        date: Date;
    }[];

    @Prop({ default: false })
    isDeleted: boolean;
}

export const StdPluginAssetSchema = SchemaFactory.createForClass(StdPluginAsset);

StdPluginAssetSchema.index({ 'data.title': 'text' });
StdPluginAssetSchema.index({ standardPluginId: 1, club: 1, node: 1, chapter: 1 });
