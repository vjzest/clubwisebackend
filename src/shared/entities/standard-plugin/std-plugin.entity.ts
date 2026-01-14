import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { User } from '../user.entity';

// Define collection name as a constant to avoid circular dependency issues
export const StdPluginCollection = 'StdPlugin';

export type KeyType = "title" | "description" | "updates" | "type" | "totalBeneficiaries" | "totalBudget" | "qualifications" | "domain" | "tags" | "authenticityLink" | "faq" | "significance" | "deadline" | "howItHelps" | "pocDetails" | "cost" | "files" | "cta";

export type FieldType =
    | 'text'
    | 'textarea'
    | 'select'
    | 'number'
    | 'date'
    | 'file'
    | 'tags'
    | 'domain'
    | 'updates'
    | 'faq'
    | 'cta';

export class FieldOption {
    @Prop({ required: true })
    value: string;

    @Prop({ required: true })
    label: string;
}

export class StdPluginField {
    @Prop({ required: true })
    key: KeyType;

    @Prop({ required: true })
    label: string;

    @Prop({ required: true, enum: ['text', 'textarea', 'select', 'number', 'date', 'file', 'tags', 'domain', 'updates', 'faq', 'cta'] })
    type: FieldType;

    @Prop({ default: false })
    required?: boolean;

    @Prop()
    placeholder?: string;

    @Prop()
    minLength?: number;

    @Prop()
    maxLength?: number;

    @Prop()
    min?: number;

    @Prop()
    max?: number;

    @Prop()
    minDate?: Date;

    @Prop()
    maxDate?: Date;

    @Prop({ default: false })
    disablePast?: boolean;

    // @Prop({ default: false })
    // allowMultiple?: boolean;
    @Prop({ default: 0 })
    minAllowed?: number;

    @Prop({ default: 1 })
    maxAllowed?: number;

    @Prop({ type: [{ value: String, label: String }], default: [] })
    options?: FieldOption[];
}

@Schema({
    timestamps: true,
    // toJSON: { virtuals: true },
    // toObject: { virtuals: true }
})
export class StdPlugin extends Document {
    @Prop({ required: true, trim: true, index: true, unique: true, message: 'Name must be unique' })
    name: string;

    @Prop({ required: true, trim: true, index: true, unique: true, message: 'Slug must be unique' })
    slug: string;

    @Prop({ required: true, trim: true, index: true, unique: true, message: 'Safekey must be unique' })
    safekey: string;

    @Prop({ required: true, message: 'Logo is required' })
    logo: string;

    @Prop({ required: true, message: 'Description is required' })
    description: string;

    @Prop({ default: true })
    canBePublic: boolean;

    @Prop({ default: true })
    canBeAdopted: boolean;

    @Prop({ type: MongooseSchema.Types.ObjectId, ref: User.name, required: true })
    createdBy: User | MongooseSchema.Types.ObjectId;

    @Prop({ type: [Object], default: [] })
    fields: StdPluginField[];

    @Prop({ enum: ['draft', 'published'], default: 'draft' })
    status: 'draft' | 'published';

    @Prop({ default: true })
    isActive: boolean;
}

export const StdPluginSchema = SchemaFactory.createForClass(StdPlugin);

// Set up text index
StdPluginSchema.index({ name: 'text', description: 'text' });
StdPluginSchema.index({ createdBy: 1 });
StdPluginSchema.index({ isActive: 1 });
