import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from './user.entity';
import { Club } from './club.entity';
import { Node_ } from './node.entity';

@Schema({ timestamps: true })
class CustomerConnectData extends Document {
    @Prop({
        type: String,
        required: true,
        trim: true,
        min: 3,
        max: 30,
    })
    title: string;

    @Prop({
        type: String,
        required: true,
        trim: true,
        min: 10,
        max: 500,
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
    })
    files: { url: string; originalname: string; mimetype: string; size: number }[];

    @Prop({
        type: String,
        required: false,
    })
    dates: string;

    @Prop({
        type: Types.ObjectId,
        ref: User.name,
    })
    createdBy: Types.ObjectId;

    createdAt: Date;
}

export const CustomerConnectDataSchema =
    SchemaFactory.createForClass(CustomerConnectData);

@Schema({ timestamps: true })
export class CustomerConnect extends Document {

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
        type: [CustomerConnectDataSchema],
        default: [],
    })
    data: CustomerConnectData[];

    @Prop({
        type: [
            {
                user: { type: Types.ObjectId, ref: User.name, required: true },
                date: { type: Date, default: Date.now },
            },
        ],
        default: [],
    })
    subscribers: { user: Types.ObjectId; date: Date }[];

}

export const CustomerConnectSchema = SchemaFactory.createForClass(CustomerConnect);
