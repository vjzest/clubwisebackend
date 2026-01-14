import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Node_ } from './node.entity';
import { User } from './user.entity';
import { Club } from './club.entity';

@Schema({ timestamps: true })
export class GuidingPrinciples extends Document {
    @Prop({
        type: Types.ObjectId,
        ref: Node_.name,
        required: false,
    })
    node: Types.ObjectId;

    @Prop({
        type: Types.ObjectId,
        ref: Club.name,
        required: false
    })
    club: Types.ObjectId;

    @Prop({
        type: String,
        required: true,
        trim: true,
    })
    title: string;

    @Prop({
        type: String,
        required: true,
        trim: true
    })
    content: string;

    @Prop({ type: Boolean, required: true })
    visibility: boolean;

    @Prop({
        type: Types.ObjectId,
        ref: User.name,
        required: true
    })
    createdBy: Types.ObjectId;

    @Prop({
        type: Types.ObjectId,
        required: false,
        ref: User.name
    })
    updatedBy: Types.ObjectId;
}

export const GuidingPrinciplesSchema = SchemaFactory.createForClass(GuidingPrinciples);

// Add compound index for common queries
GuidingPrinciplesSchema.index({ node: 1, title: 1 });