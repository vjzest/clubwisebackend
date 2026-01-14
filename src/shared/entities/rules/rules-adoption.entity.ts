import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { RulesRegulations } from './rules-regulations.entity';
import { User } from '../user.entity';
import { Club } from '../club.entity';
import { Node_ } from '../node.entity';
import { Chapter } from '../chapters/chapter.entity';

@Schema({
    timestamps: true,
})
export class RulesAdoption {
    @Prop({ required: true, type: Types.ObjectId, ref: RulesRegulations.name })
    rule: Types.ObjectId

    @Prop({ required: false, type: Types.ObjectId, ref: Club.name })
    club: Types.ObjectId

    @Prop({ required: false, type: Types.ObjectId, ref: Node_.name })
    node: Types.ObjectId

    @Prop({ required: false, type: Types.ObjectId, ref: Chapter.name })
    chapter: Types.ObjectId

    @Prop({ required: true, type: Types.ObjectId, ref: User.name })
    proposedBy: Types.ObjectId

    @Prop({ required: false, type: Types.ObjectId, ref: User.name })
    acceptedBy: Types.ObjectId

    @Prop({ type: String })
    message: string

    @Prop({
        type: String,
        enum: ['draft', 'published', 'proposed', 'rejected', 'archived'],
        default: 'proposed',
    })
    publishedStatus: 'draft' | 'published' | 'proposed' | 'rejected' | 'archived';

    @Prop({ type: Array })
    statusHistory: {
        status: string;
        changedBy: Types.ObjectId;
        date: Date;
        notes: string;
    }[]

    @Prop({ type: String, default: 'adopted' })
    type: string

    createdAt: Date;
}


export const RulesAdoptionSchema = SchemaFactory.createForClass(RulesAdoption)