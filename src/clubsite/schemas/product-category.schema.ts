import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";
import { Club } from "../../shared/entities/club.entity";
import { Node_ } from "../../shared/entities/node.entity";
import { Chapter } from "../../shared/entities/chapters/chapter.entity";

interface IForumType {
    forum: typeof Club.name | typeof Node_.name | typeof Chapter.name;
}

@Schema({
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
    collection: "product_categories"
})
export class ProductCategory extends Document {
    @Prop({
        required: true,
        type: String,
        index: true
    })
    title: string;

    @Prop({
        required: false,
        type: String,
    })
    image?: string;

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
    forumType: IForumType;

    @Prop({
        required: false,
        type: Number,
        default: 0
    })
    order?: number;
}

export const ProductCategorySchema = SchemaFactory.createForClass(ProductCategory);

ProductCategorySchema.index({ forum: 1, forumType: 1 });
