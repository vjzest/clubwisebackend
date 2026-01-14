import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Club } from 'src/shared/entities/club.entity';
import { Node_ } from 'src/shared/entities/node.entity';

export type StrategicNeedDocument = StrategicNeed & Document;

@Schema({ timestamps: true })
export class StrategicNeedResponse {
    @Prop({ required: true })
    contactInfo: string;

    @Prop({ required: true })
    message: string;

    @Prop({ type: Date, default: Date.now })
    submittedAt: Date;
}

export const StrategicNeedResponseSchema = SchemaFactory.createForClass(StrategicNeedResponse);

@Schema({ timestamps: true })
export class StrategicNeed {
    @Prop({ required: true })
    type: string;

    @Prop({ required: true })
    description: string;

    @Prop({ type: Types.ObjectId, ref: Node_.name, required: false })
    node: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: Club.name, required: false })
    club: Types.ObjectId;

    @Prop({ type: [StrategicNeedResponseSchema], default: [] })
    responses: StrategicNeedResponse[];
}

export const StrategicNeedSchema = SchemaFactory.createForClass(StrategicNeed);
