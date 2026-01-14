import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Club } from './club.entity';
import { Node_ } from './node.entity';
import { Chapter } from './chapters/chapter.entity';

@Schema({ timestamps: true })
export class ForumAchievements extends Document {
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
        max: 30,
        trim: true,
    })
    title: string;

    @Prop({
        type: String,
        required: true,
        min: 3,
        max: 30,
        trim: true,
    })
    category: string;

    @Prop({
        type: String,
        required: true,
        min: 10,
        max: 500,
        trim: true,
    })
    description: string;

    @Prop({
        type: Date,
        required: true,
    })
    date: Date;

    @Prop({
        type: [String],
        validate: {
            validator: (arr: string[]) => arr.length > 0,
            message: 'Each link must be a valid URL and at least one link is required',
        },
    })
    links: string[];

    @Prop({
        type: [
            {
                url: String,
                originalname: String,
                mimetype: String,
                size: Number,
            },
        ],
    })
    files: { url: string; originalname: string; mimetype: string; size: number }[];
}

export const ForumAchievementsSchema = SchemaFactory.createForClass(ForumAchievements);
