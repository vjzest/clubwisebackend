import { UseGuards, ExecutionContext } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConnectedSocket, MessageBody, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Model, Types } from 'mongoose';
import { Server, Socket } from 'socket.io';
import { ChatMessage } from '../shared/entities/chat/chat-message.entity';
import { GroupChat } from '../shared/entities/chat/group-chat.entity';
import { User } from '../shared/entities/user.entity';
import { WsAuthGuard } from '../user/guards/ws-auth.guard';
import { ENV } from '../utils/config/env.config';
import { verify, JwtPayload } from 'jsonwebtoken'

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/chat',
})
// @UseGuards(WsAuthGuard)
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    @InjectModel(ChatMessage.name) private readonly chatMessageModel: Model<ChatMessage>,
    @InjectModel(GroupChat.name) private readonly groupChatModel: Model<GroupChat>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
  ) { }

  afterInit(server: Server) {
    const middleware = this.createAuthMiddleware();
    server.use(middleware);
  }

  private createAuthMiddleware() {
    return async (socket: Socket, next) => {
      try {
        const token = socket.handshake.headers.authorization;

        if (!token) {
          return next(new Error('Authentication token missing'));
        }

        const payload = verify(token, ENV.JWT_SECRET) as JwtPayload;
        const userId = payload.id;

        const user = await this.userModel.findById(userId);
        if (!user) {
          return next(new Error('User not found'));
        }

        (socket as any).user = user;
        next();
      } catch (error) {
        console.log("Auth error:", error.message);
        next(new Error('Authentication failed: ' + error.message));
      }
    };
  }

  @SubscribeMessage('joinGroup')
  async handleJoinGroup(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { groupId: string }
  ) {
    try {
      const group = await this.groupChatModel.findById(new Types.ObjectId(data.groupId));

      if (!group) {
        throw new Error('Group not found');
      }

      await client.join(data.groupId);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('sendMessage')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { groupId: string; origin: "club" | "chapter"; content: string; file?: any[] },
  ) {
    // add file pending
    const message = await this.chatMessageModel.create({
      group: new Types.ObjectId(data.groupId),
      content: data.content,
      origin: data.origin,
      sender: new Types.ObjectId((client as any).user._id),
      readBy: [new Types.ObjectId((client as any).user._id)],
    })

    const populatedMessage = await message.populate('sender', 'userName firstName lastName middleName profileImage');
    this.server.to(data.groupId).emit('newMessage', populatedMessage);
    return populatedMessage;
  }

  @SubscribeMessage('deleteMessage')
  async handleDeleteMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { messageId: string },
  ) {
    const message = await this.chatMessageModel.findById(new Types.ObjectId(data.messageId));

    if (
      message.sender.toString() !== (client as any).user._id.toString()
    ) throw new Error('You are not authorized to delete this message');

    await this.chatMessageModel.findByIdAndUpdate(
      new Types.ObjectId(data.messageId), {
      isDeleted: true
    })

    this.server.to(message.group.toString()).emit('messageDeleted', {
      messageId: data.messageId
    });
    return { success: true }
  }

  async handleConnection(client: Socket) {
    console.log('Connection attempt')

    const userId = (client as any).user._id;
    console.log('user authenticated', userId)

    const userGroups = await this.groupChatModel.find({
      members: userId
    })
    userGroups.forEach((group) => {
      this.server.to(group._id.toString()).emit('userOnline', { userId });
    })
  }

  async handleDisconnect(client: Socket) {
    const userId = (client as any).user._id;

    const userGroups = await this.groupChatModel.find({
      members: userId
    })
    userGroups.forEach((group) => {
      this.server.to(group._id.toString()).emit('userOffline', {
        userId,
        lastSeen: new Date()
      });
    })
  }

}
