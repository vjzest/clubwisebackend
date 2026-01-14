import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, SchemaTypes, Types } from "mongoose";
import { User } from '../../../user/auth/signup/entities/user.entity';
import { Chapter } from "../chapters/chapter.entity";
import { Club } from "../club.entity";

@Schema({ timestamps: true })
export class GroupChat extends Document {
    @Prop({ required: true, type: Types.ObjectId, ref: Chapter.name, unique: true })
    chapter: Types.ObjectId

    @Prop({ required: true, type: Types.ObjectId, ref: Club.name })
    club: Types.ObjectId

    @Prop({ required: true, type: String })
    name: string

    @Prop([{
        _id: false,
        user: { type: Types.ObjectId, ref: User.name },
        isClub: { type: Boolean, default: false },
        isChapter: { type: Boolean, default: false }
    }])
    members: Array<{
        user: Types.ObjectId;
        isClub: boolean;
        isChapter: boolean;
    }>;

    @Prop({
        type: {
            filename: { type: SchemaTypes.String, required: true },
            url: { type: SchemaTypes.String, required: true },
        },
        _id: false,
        required: true,
    })
    profileImage: {
        filename: string;
        url: string;
    };

    @Prop({
        type: {
            filename: { type: SchemaTypes.String, required: true },
            url: { type: SchemaTypes.String, required: true },
        },
        _id: false,
        required: false,
    })
    coverImage: {
        filename: string;
        url: string;
    };

    @Prop({ type: Boolean, default: false })
    isDeleted: boolean
}

export const GroupChatSchema = SchemaFactory.createForClass(GroupChat);
