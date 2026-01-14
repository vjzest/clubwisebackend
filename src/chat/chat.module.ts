import { Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { MongooseModule } from '@nestjs/mongoose';
import { ChatMessage, ChatMessageSchema } from 'src/shared/entities/chat/chat-message.entity';
import { GroupChat, GroupChatSchema } from 'src/shared/entities/chat/group-chat.entity';
import { User } from 'src/user/auth/signup/entities/user.entity';
import { UserSchema } from 'src/shared/entities/user.entity';
import { WsAuthGuard } from 'src/user/guards/ws-auth.guard';

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
