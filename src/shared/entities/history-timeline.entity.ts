import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Node_ } from './node.entity';
import { Club } from './club.entity';
import { Chapter } from './chapters/chapter.entity';

const CURRENT_YEAR = new Date().getFullYear();

@Schema({ timestamps: true })
export class HistoryTimeline extends Document {
    @Prop({
        required: true,
        type: Number,
        min: CURRENT_YEAR - 100,
        max: CURRENT_YEAR,
    })
    year: number;

    @Prop({ required: true, trim: true, maxlength: 30 })
    title: string;

    @Prop({ required: true, trim: true, maxlength: 500 })
    description: string;

    @Prop({ type: Types.ObjectId, ref: Node_.name, required: false })
    node?: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: Club.name, required: false })
    club?: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: Chapter.name, required: false })
    chapter?: Types.ObjectId;

    createdAt: Date;
    updatedAt: Date;
}

export const HistoryTimelineSchema =
    SchemaFactory.createForClass(HistoryTimeline);
