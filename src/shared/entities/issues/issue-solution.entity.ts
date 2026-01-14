import { Prop, SchemaFactory, Schema } from "@nestjs/mongoose"
import { Types } from "mongoose"
import { User } from "../user.entity"
import { Issues } from "./issues.entity"

@Schema({ timestamps: true })
export class IssueSolution {
    @Prop({ required: true, ref: User.name, type: Types.ObjectId })
    user: Types.ObjectId

    @Prop({ required: true, type: String })
    title: string

    @Prop({ required: true, type: String })
    description: string

    @Prop({ required: true, type: Types.ObjectId, ref: Issues.name })
    issue: Types.ObjectId

    @Prop([{
        url: { type: String, required: true },
        mimetype: { type: String, required: true }
    }])
    files: { url: string; mimetype: string }[]

    @Prop([{
        userId: { type: Types.ObjectId, ref: User.name, required: true },
        date: { type: Date, required: true, default: Date.now }
    }])
    relevant: { userId: Types.ObjectId; date: Date }[]

    @Prop([{
        userId: { type: Types.ObjectId, ref: User.name, required: true },
        date: { type: Date, required: true, default: Date.now }
    }])
    irrelevant: { userId: Types.ObjectId; date: Date }[]
}

export const issueSolutionSchema = SchemaFactory.createForClass(IssueSolution)