import { IsEmpty, IsEnum, IsMongoId, IsString } from 'class-validator';
import { Types } from 'mongoose';

export class CreateInvitationDto {
  @IsMongoId()
  entityId: Types.ObjectId;

  @IsMongoId()
  userId: Types.ObjectId;

  @IsEmpty()
  @IsString()
  @IsEnum(['node', 'club'], { message: 'Invalid type' })
  type: 'node' | 'club';
}
