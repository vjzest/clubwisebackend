import { Types } from 'mongoose';
import { User } from '../shared/entities/user.entity';

declare global {
  namespace Express {
    interface Request {
      user?: Document<unknown, {}, User> & User & { _id: Types.ObjectId };
      role?: string;
    }
  }
}
