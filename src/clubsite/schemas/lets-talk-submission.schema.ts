import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Club } from 'src/shared/entities/club.entity';
import { Node_ } from 'src/shared/entities/node.entity';

export type LetsTalkSubmissionDocument = LetsTalkSubmission & Document;

@Schema({ timestamps: true })
export class LetsTalkSubmission {
    @Prop({ required: true })
    name: string;

    @Prop({ required: true })
    contactInfo: string; // Email or Phone

    @Prop({ required: true })
    message: string;

    @Prop({ type: Types.ObjectId, ref: Node_.name, required: false })
    node: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: Club.name, required: false })
    club: Types.ObjectId;
}

export const LetsTalkSubmissionSchema =
    SchemaFactory.createForClass(LetsTalkSubmission);
