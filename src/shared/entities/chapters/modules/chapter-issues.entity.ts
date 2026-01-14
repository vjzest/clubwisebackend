import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Types } from "mongoose";
import { Chapter } from "../chapter.entity";
import { Issues } from "../../issues/issues.entity";

@Schema({
    timestamps: true
})
export class ChapterIssues {
    @Prop({ required: true, type: Types.ObjectId, ref: Chapter.name })
    chapter: Types.ObjectId

    @Prop({
        type: String,
        enum: ['published', 'inactive'],
        default: 'published'
    })
    publishedStatus: string;

    @Prop({ required: true, type: Types.ObjectId, ref: Issues.name })
    issue: Types.ObjectId
}

export const ChapterIssueSchema = SchemaFactory.createForClass(ChapterIssues)