import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { User } from '../user.entity';
import { StdPluginAsset } from './std-plugin-asset.entity';
import { Club } from '../club.entity';
import { Node_ } from '../node.entity';
import { IsString } from 'class-validator';
import { StdPlugin } from './std-plugin.entity';
import { Chapter } from '../chapters/chapter.entity';

@Schema({
    timestamps: true,
})
export class StdAssetAdoption {
    @Prop({ required: true, type: Types.ObjectId, ref: User.name })
    proposedBy: Types.ObjectId

    @Prop({ required: false, type: Types.ObjectId, ref: User.name })
    publishedBy: Types.ObjectId

    @Prop({ required: true, type: Types.ObjectId, ref: StdPluginAsset.name })
    asset: Types.ObjectId

    @Prop({ required: false, type: Types.ObjectId, ref: StdPlugin.name })
    plugin: Types.ObjectId

    @Prop({ required: false, type: Types.ObjectId, ref: Club.name })
    club: Types.ObjectId

    @Prop({ required: false, type: Types.ObjectId, ref: Node_.name })
    node: Types.ObjectId

    @Prop({ required: false, type: Types.ObjectId, ref: Chapter.name })
    chapter: Types.ObjectId

    @Prop({ type: String })
    message: string

    @IsString()
    @Prop({
        type: String,
        enum: ['published', 'proposed', 'rejected', 'archived'],
        default: 'proposed',
    })
    publishedStatus: string;

    @Prop({ type: Array })
    statusHistory: {
        status: string;
        changedBy: Types.ObjectId;
        date: Date;
        notes: string;
    }[]

    @Prop({ type: String, default: 'adopted' })
    type: string

    @Prop({ type: Boolean, default: false })
    isDeleted: boolean

    createdAt: Date

    updatedAt: Date

}


export const StdAssetAdoptionSchema = SchemaFactory.createForClass(StdAssetAdoption)