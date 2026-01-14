import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from './user.entity';
import { Club } from './club.entity';
import { Node_ } from './node.entity';

@Schema({ timestamps: true })
class ForumCampaignData extends Document {
    @Prop({
        type: String,
        required: true,
        trim: true,
        min: 3,
        max: 30,
    })
    title: string;

    @Prop({
        type: String,
        required: true,
        trim: true,
        min: 10,
        max: 500,
    })
    description: string;

    @Prop({
        type: String,
        required: false,
    })
    dates: string;

    @Prop({
        type: Types.ObjectId,
        ref: User.name,
    })
    createdBy: Types.ObjectId;

    createdAt: Date;
}

export const ForumCampaignDataSchema =
    SchemaFactory.createForClass(ForumCampaignData);

@Schema({ timestamps: true })
export class ForumCampaign extends Document {

    @Prop({
        type: Types.ObjectId,
        ref: Club.name,
    })
    club: Types.ObjectId;

    @Prop({
        type: Types.ObjectId,
        ref: Node_.name,
    })
    node: Types.ObjectId;

    @Prop({
        type: [ForumCampaignDataSchema],
        default: [],
    })
    data: ForumCampaignData[];
}

export const ForumCampaignSchema = SchemaFactory.createForClass(ForumCampaign);
