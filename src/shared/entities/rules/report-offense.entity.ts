import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from '../user.entity';
import { RulesRegulations } from '../rules/rules-regulations.entity';
import { Node_ } from '../node.entity';
import { Club } from '../club.entity';

// Create a mapping for model references
const MODEL_REFS = {
  [Node_.name]: Node_.name,
  [Club.name]: Club.name,
} as const;

export interface IRulesOffenseReports {
  offender: Types.ObjectId;
  reportedBy: Types.ObjectId;
  reason: string;
  rulesId?: Types.ObjectId;
  proof: {
    url: String;
    originalname: String;
    mimetype: String;
  };
  clubOrNode: typeof Node_.name | typeof Club.name;
  clubOrNodeId: Types.ObjectId;
  offenderName?: string
}

@Schema({ timestamps: true })
export class RulesOffenseReports extends Document implements IRulesOffenseReports {
  @Prop({ type: Types.ObjectId, ref: User.name, required: false })
  offender: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: User.name, required: true })
  reportedBy: Types.ObjectId;

  @Prop({ required: true, type: String })
  reason: string;

  @Prop({ required: true, type: Types.ObjectId, ref: RulesRegulations.name })
  rulesId?: Types.ObjectId | undefined;

  @Prop({
    required: false, type: {
      url: String,
      originalname: String,
      mimetype: String,
    }
  })
  proof: {
    url: String,
    originalname: String,
    mimetype: String,
  };

  @Prop({ required: true, type: String, enum: [Node_.name, Club.name] })
  clubOrNode: typeof Node_.name | typeof Club.name;

  @Prop({ required: false, type: String })
  offenderName?: string;

  @Prop({
    required: true,
    type: Types.ObjectId,
    ref: function (this: RulesOffenseReports) {
      return MODEL_REFS[this.clubOrNode];
    },
  })
  clubOrNodeId: Types.ObjectId;
}

export const RulesOffenseReportSchema = SchemaFactory.createForClass(RulesOffenseReports);

export type RulesOffenseReportDocument = RulesOffenseReports & Document;

//WANT TO CHECK THIS AM NOT SURE ABOUT THIS
RulesOffenseReportSchema.virtual('modelReference').get(function () {
  return MODEL_REFS[this.clubOrNode];
});