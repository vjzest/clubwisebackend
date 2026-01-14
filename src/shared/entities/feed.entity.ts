import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";
import { Club } from "./club.entity";
import { Node_ } from "./node.entity";
import { Chapter } from "./chapters/chapter.entity";
import { Projects } from "./projects/project.entity";
import { Issues } from "./issues/issues.entity";
import { Debate } from "./debate/debate.entity";
import { RulesRegulations } from "./rules/rules-regulations.entity";
import { StdPluginAsset } from "./standard-plugin/std-plugin-asset.entity";
import { IssuesAdoption } from "./issues/issues-adoption.entity";
import { ProjectAdoption } from "./projects/project-adoption.entity";
import { DebateAdoption } from "./debate/debate-adoption-entity";
import { StdAssetAdoption } from "./standard-plugin/std-asset-adoption.entity";
import { RulesAdoption } from "./rules/rules-adoption.entity";
import { GenericPost } from "./generic-post.entity";

interface IForumType {
    forum: typeof Club.name | typeof Node_.name | typeof Chapter.name;
}

interface IModuleType {
    module:
    | typeof Projects.name
    | typeof Issues.name
    | typeof Debate.name
    | typeof RulesRegulations.name
    | typeof StdPluginAsset.name
    | typeof GenericPost.name

}

interface IAssetAdoptionType {
    asset:
    | typeof RulesAdoption.name
    | typeof IssuesAdoption.name
    | typeof ProjectAdoption.name
    | typeof DebateAdoption.name
    | typeof StdAssetAdoption.name
}


@Schema({
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
})
export class Feed extends Document {
    @Prop({
        required: true,
        type: Types.ObjectId,
        refPath: "forumType",
        index: true
    })
    forum: Types.ObjectId;

    @Prop({
        required: true,
        type: String,
        index: true
    })
    forumType: IForumType; // club, node, chapter

    @Prop({
        required: true,
        type: String,
        index: true
    })
    moduleType: IModuleType; // project, debate, issue, rules, standard

    @Prop({
        required: true,
        type: Types.ObjectId,
        refPath: "moduleType",
        index: true,
    })
    assetId: Types.ObjectId;

    @Prop({
        required: false,
        type: String,
    })
    assetAdoptionType?: IAssetAdoptionType

    // adoptionId
    @Prop({
        required: false,
        type: Types.ObjectId,
        refPath: "assetAdoptionType",
        index: true
    })
    adoptionId?: Types.ObjectId;


    @Prop({
        required: true,
        type: String,
        enum: ['adopted', 'original'],
        index: true,
    })
    feedType: "adopted" | "original";

    @Prop({
        required: false,
        type: Number,
        default: 0,
        index: true
    })
    score?: number;

    @Prop({
        required: true,
        type: String,
        enum: ['published', 'archived', 'deleted'],
        index: true,
        default: "published"
    })
    status: "published" | "archived" | "deleted";

    @Prop({
        required: true,
        type: Date,
        default: Date.now,
        index: -1
    })
    createdAt: Date;

}

export const FeedSchema = SchemaFactory.createForClass(Feed);

FeedSchema.index({ forumType: 1, createdAt: -1 });
FeedSchema.index({ moduleType: 1, createdAt: -1 });
FeedSchema.index({ forum: 1, createdAt: -1 });


