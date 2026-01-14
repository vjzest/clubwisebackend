import { Types } from 'mongoose';
import { User } from '../../shared/entities/user.entity';

export type UserWithoutPassword = Omit<User, 'password'> & {
  _id: Types.ObjectId;
};
