import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Configuration extends Document {
    @Prop({ type: Number, default: 0 })
    assetCreationCount: number;
}

export const ConfigurationSchema = SchemaFactory.createForClass(Configuration); 