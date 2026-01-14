import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ForumsController } from './forums.controller';
import { ForumsService } from './forums.service';
import { Club, ClubSchema } from '../../shared/entities/club.entity';
import { Node_, NodeSchema } from '../../shared/entities/node.entity';
import { User, UserSchema } from '../../shared/entities/user.entity';
import { AuthModule } from '../../user/auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Club.name, schema: ClubSchema },
      { name: Node_.name, schema: NodeSchema },
      { name: User.name, schema: UserSchema },
    ]),
    AuthModule,
  ],
  controllers: [ForumsController],
  providers: [ForumsService],
})
export class ForumsModule {}