import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { User } from '../user.entity';
import { Club } from '../club.entity';
import { Node_ } from '../node.entity';
import { Issues } from './issues.entity';
import { Chapter } from '../chapters/chapter.entity';

@Schema({
    timestamps: true,
})
export class IssuesAdoption {
    @Prop({ required: true, type: Types.ObjectId, ref: User.name })
    proposedBy: Types.ObjectId

    @Prop({ required: false, type: Types.ObjectId, ref: User.name })
    acceptedBy: Types.ObjectId

    @Prop({ required: true, type: Types.ObjectId, ref: Issues.name })
    issues: Types.ObjectId

    @Prop({ required: false, type: Types.ObjectId, ref: Club.name })
    club: Types.ObjectId

    @Prop({ required: false, type: Types.ObjectId, ref: Node_.name })
    node: Types.ObjectId

    @Prop({ required: false, type: Types.ObjectId, ref: Chapter.name })
    chapter: Types.ObjectId

    @Prop({ type: String })
    message: string

    @Prop({
        type: String,
        enum: ['draft', 'published', 'proposed', 'rejected', 'inactive'],
        default: 'proposed',
    })
    publishedStatus: 'draft' | 'published' | 'proposed' | 'rejected' | 'inactive';

    @Prop({ default: false })
    isIssueResolved: boolean;

    @Prop({ default: false })
    isArchived: boolean;


    @Prop({ type: String, default: 'adopted' })
    type: string

    createdAt: Date;
}


export const IssuesAdoptionSchema = SchemaFactory.createForClass(IssuesAdoption)
