import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Node_ } from './node.entity';
import { Club } from './club.entity';
import { Chapter } from './chapters/chapter.entity';
import { User } from './user.entity';
import { IRelevantAndView } from 'typings';


@Schema({ timestamps: true })
export class GenericPost extends Document {
    @Prop({ type: Types.ObjectId, ref: Node_.name, required: false })
    node: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: Club.name, required: false })
    club: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: Chapter.name, required: false })
    chapter: Types.ObjectId;

    @Prop({ type: String, required: true, maxLength: 5000 })
    content: string;

    @Prop({
        type: [
            {
                url: { type: String, required: true },
                originalname: { type: String, required: true },
                mimetype: { type: String, required: true },
                size: { type: Number, required: true },
            },
        ],
        default: [],
        _id: false,
    })
    files: {
        url: string;
        originalname: string;
        mimetype: string;
        size: number;
    }[];

    @Prop([
        {
            user: { type: Types.ObjectId, ref: User.name },
            date: { type: Date, default: Date.now },
        },
    ])
    views: IRelevantAndView[];

    @Prop([
        {
            user: { type: Types.ObjectId, ref: User.name },
            date: { type: Date, default: Date.now },
        },
    ])
    relevant: IRelevantAndView[];

    @Prop({ type: Types.ObjectId, ref: User.name, required: true })
    createdBy: Types.ObjectId;

    @Prop({ type: String, enum: ['thought', 'announcement'], default: 'thought' })
    genericType: 'thought' | 'announcement';

    @Prop({ type: Boolean, default: false })
    isDeleted: boolean;
}

export const GenericPostSchema = SchemaFactory.createForClass(GenericPost);
