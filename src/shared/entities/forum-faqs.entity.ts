import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";
import { Node_ } from "./node.entity";
import { Club } from "./club.entity";
import { Chapter } from "./chapters/chapter.entity";

@Schema({ timestamps: true })
export class ForumFaqs extends Document {
    @Prop({ type: Types.ObjectId, ref: Node_.name, required: false })
    node: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: Club.name, required: false })
    club: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: Chapter.name, required: false })
    chapter: Types.ObjectId;

    @Prop({ type: String, required: true })
    question: string;

    @Prop({ type: String, required: true })
    answer: string;

    @Prop({ type: Boolean, default: false })
    isPublic: boolean;
}

export const ForumFaqsSchema = SchemaFactory.createForClass(ForumFaqs);
