import { Prop, SchemaFactory, Schema } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from './user.entity';
import { Node_ } from './node.entity';

@Schema({
  timestamps: true,
})
export class NodeJoinRequest extends Document {
  @Prop({ required: true, type: Types.ObjectId, ref: User.name })
  user: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: Node_.name })
  node: Types.ObjectId;

  @Prop({ required: true })
  status: 'REQUESTED' | 'ACCEPTED' | 'REJECTED';

  @Prop({ required: false, type: String })
  requestNote: string;

  rejectedDate: Date;

}

export const NodeJoinRequestSchema =
  SchemaFactory.createForClass(NodeJoinRequest);
