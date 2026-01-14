import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ForumsController } from './forums.controller';
import { ForumsService } from './forums.service';
import { Club, ClubSchema } from 'src/shared/entities/club.entity';
import { Node_, NodeSchema } from 'src/shared/entities/node.entity';
import { User, UserSchema } from 'src/shared/entities/user.entity';
import { AuthModule } from 'src/user/auth/auth.module';

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