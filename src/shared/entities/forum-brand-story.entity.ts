import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Club } from './club.entity';
import { Node_ } from './node.entity';
import { Chapter } from './chapters/chapter.entity';

@Schema({ timestamps: true })
export class ForumBrandStory extends Document {
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
        type: Types.ObjectId,
        ref: Chapter.name
    })
    chapter: Types.ObjectId

    @Prop({
        type: String,
        required: true,
        min: 3,
        max: 100,
        trim: true,
    })
    title: string;

    @Prop({
        type: String,
        required: true,
        min: 10,
        max: 1000,
        trim: true,
    })
    description: string;

    @Prop({
        type: [
            {
                url: String,
                originalname: String,
                mimetype: String,
                size: Number,
            },
        ],
        validate: {
            validator: (arr: any[]) => arr.length <= 10,
            message: 'Maximum 10 images allowed',
        },
    })
    images: { url: string; originalname: string; mimetype: string; size: number }[];
}

export const ForumBrandStorySchema = SchemaFactory.createForClass(ForumBrandStory);
