import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";
import { User } from "./user.entity";
import { RulesRegulations } from "./rules/rules-regulations.entity";
import { Issues } from "./issues/issues.entity";
import { Projects } from "./projects/project.entity";
import { Debate } from "./debate/debate.entity";
import { StdPluginAsset } from "./standard-plugin/std-plugin-asset.entity";

interface IEntity {
    entityId: Types.ObjectId;
    entityType:
    | typeof RulesRegulations.name
    | typeof Issues.name
    | typeof Projects.name
    | typeof Debate.name
    | typeof StdPluginAsset.name;
}

@Schema({ timestamps: true })
export class Bookmarks extends Document {
    @Prop({ required: true })
    title: string;

    @Prop({ required: true, type: Types.ObjectId, ref: User.name })
    user: Types.ObjectId;

    @Prop({
        type: [
            {
                createdAt: { type: Date, default: Date.now },
                entity: {
                    entityId: {
                        type: Types.ObjectId,
                        required: true,
                        refPath: 'posts.entity.entityType',
                    },
                    entityType: {
                        type: String,
                        enum: [
                            Debate.name,
                            Issues.name,
                            Projects.name,
                            RulesRegulations.name,
                            StdPluginAsset.name
                        ],
                        required: true,
                    },
                }
            }
        ]
    })
    posts: {
        createdAt: Date;
        entity: IEntity;
    }[];
}

export const BookmarksSchema = SchemaFactory.createForClass(Bookmarks);