import { Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { MongooseModule } from '@nestjs/mongoose';
import { ChatMessage, ChatMessageSchema } from '../shared/entities/chat/chat-message.entity';
import { GroupChat, GroupChatSchema } from '../shared/entities/chat/group-chat.entity';
import { User } from '../user/auth/signup/entities/user.entity';
import { UserSchema } from '../shared/entities/user.entity';
import { WsAuthGuard } from '../user/guards/ws-auth.guard';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ChatMessage.name, schema: ChatMessageSchema },
      { name: GroupChat.name, schema: GroupChatSchema },
      { name: User.name, schema: UserSchema }
    ])
  ],
  providers: [ChatGateway, WsAuthGuard]
})
export class ChatModule { }
