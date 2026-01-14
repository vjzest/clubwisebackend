import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ _id: false })
class DomainItem {
    @Prop({ required: true })
    value: string;

    @Prop({ required: true })
    label: string;
}

@Schema({ timestamps: true })
export class Domain extends Document {
    @Prop({ required: true, unique: true })
    label: string;

    @Prop({ type: [DomainItem], default: [] })
    items: {
        value: string;
        label: string;
    }[];

    @Prop({ type: String, default: 'active' })
    status: 'active' | 'inactive';

    createdAt: Date;
    updatedAt: Date;
}

export const DomainSchema = SchemaFactory.createForClass(Domain);