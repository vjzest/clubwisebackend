import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";
import { GroupChat } from "./group-chat.entity";
import { User } from '../../../user/auth/signup/entities/user.entity';

@Schema({ timestamps: true })
export class ChatMessage extends Document {
    @Prop({ required: true, type: Types.ObjectId, ref: GroupChat.name })
    group: Types.ObjectId

    @Prop({ required: true, type: String })
    content: string;

    @Prop({ required: true, type: Types.ObjectId, ref: User.name })
    sender: Types.ObjectId;

    @Prop({ required: true, enum: ['club', 'chapter'] })
    origin: 'club' | 'chapter';

    @Prop({ type: [{ type: Types.ObjectId, ref: User.name }] })
    readBy: Types.ObjectId[];

    @Prop({
        type: {
            url: String,
            originalname: String,
            mimetype: String,
            size: Number,
        },
    })
    file?: { url: string; originalname: string; mimetype: string; size: number };

    @Prop({ default: null })
    deletedAt: Date;

    @Prop({ set: (isDeleted: boolean) => (isDeleted ? new Date() : null) })
    set isDeleted(value: boolean) {
        this._isDeleted = value;
        if (value) {
            this.deletedAt = new Date();
        } else {
            this.deletedAt = null;
        }
    }

    get isDeleted(): boolean {
        return this._isDeleted;
    }
    private _isDeleted: boolean;
}

export const ChatMessageSchema = SchemaFactory.createForClass(ChatMessage);

ChatMessageSchema.virtual("displayContent").get(function () {
    return this.isDeleted ? "This message has been deleted" : this.content;
})