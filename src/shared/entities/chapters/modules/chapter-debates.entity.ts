import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Types } from "mongoose";
import { Chapter } from "../chapter.entity";
import { Debate } from "../../debate/debate.entity";

@Schema({
    timestamps: true
})
export class ChapterDebates {
    @Prop({ required: true, type: Types.ObjectId, ref: Chapter.name })
    chapter: Types.ObjectId

    @Prop({
        type: String,
        enum: ['published', 'inactive'],
        default: 'published'
    })
    publishedStatus: string;

    @Prop({ required: true, type: Types.ObjectId, ref: Debate.name })
    debate: Types.ObjectId
}

export const ChapterDebateSchema = SchemaFactory.createForClass(ChapterDebates)