import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { User } from '../user.entity';
import { Debate } from '../debate/debate.entity';
import { Club } from '../club.entity';
import { Node_ } from '../node.entity';
import { Chapter } from '../chapters/chapter.entity';
import { IsString } from 'class-validator';

@Schema({
    timestamps: true,
})
export class DebateAdoption {
    @Prop({ required: true, type: Types.ObjectId, ref: User.name })
    proposedBy: Types.ObjectId

    @Prop({ required: false, type: Types.ObjectId, ref: User.name })
    acceptedBy: Types.ObjectId

    @Prop({ required: true, type: Types.ObjectId, ref: Debate.name })
    debate: Types.ObjectId

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
        enum: ['draft', 'published', 'proposed', 'rejected', 'inactive'],
        default: 'proposed',
    })
    publishedStatus: string;

    @Prop({ type: String, default: 'adopted' })
    type: string

    createdAt: Date


    @Prop({ type: Boolean, default: false })
    isArchived: boolean;

    @Prop({ default: 0 })
    pinnedSupportCount: number;

    @Prop({ default: 0 })
    pinnedAgainstCount: number;
}


export const DebateAdoptionSchema = SchemaFactory.createForClass(DebateAdoption)