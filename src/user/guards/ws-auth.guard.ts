import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { WsException } from '@nestjs/websockets';
import { verify, JwtPayload } from 'jsonwebtoken';
import { Model } from 'mongoose';
import { Socket } from 'socket.io';
import { User } from '../../shared/entities/user.entity';
import { ENV } from '../../utils/config/env.config';

@Injectable()
export class WsAuthGuard implements CanActivate {
    constructor(
        @InjectModel(User.name) private usersModel: Model<User>,
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        try {
            console.log("hai")
            const client: Socket = context.switchToWs().getClient()
            const token = client.handshake.headers.authorization?.split(' ')[1];

            if (!token) {
                throw new WsException('Unauthorized');
            }

            const payload = verify(token, ENV.JWT_SECRET) as JwtPayload;
            const userId = payload.id;

            const user = await this.usersModel.findById(userId);
            if (!user) {
                throw new WsException('User not found');
            }

            (client as any).user = user;

            return true
        } catch (error) {
            throw new WsException('Unauthorized' + error.message);
        }
    }
}