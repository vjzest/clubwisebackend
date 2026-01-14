import { MiddlewareConsumer, Module, RequestMethod } from '@nestjs/common';
import { UserModule } from './user/user.module';
import { ConfigModule } from '@nestjs/config';
import envConfig, { ENV } from './utils/config/env.config';
import { MongooseModule } from '@nestjs/mongoose';
import { LoginModule } from './user/auth/login/login.module';
import { SharedModule } from './shared/shared.module';
import { InterestModule } from './interest/interest.module';

import { FileUploadMiddleware } from './shared/middleware/file-upload.middleware';
import { MailerModule } from './mailer/mailer.module';
import { PluginModule } from './plugin/plugin.module';
import { RecaptchaModule } from './recaptcha/recaptcha.module';
import { SocketModule } from './socket/socket.module';
import { AssetsModule } from './assets/assets.module';
import { BookmarksModule } from './user/bookmarks/bookmarks.module';
// import { BookmarksModule } from './bookmarks/bookmarks.module';
import { ChatModule } from './chat/chat.module';
import { NotificationModule } from './notification/notification.module';
import { UserStdPluginsModule } from './standard-plugins/standard-plugins.module';
import { StdAssetsModule } from './user/standard-assets/standard-assets.module';
import { AdminModule } from './admin/admin.module';
import { RouterModule } from '@nestjs/core';
import { CacheModule } from '@nestjs/cache-manager';
import { ScheduleModule } from '@nestjs/schedule';
import { ClubsiteModule } from './clubsite/clubsite.module';
import { PaymentModule } from './payment/payment.module';

@Module({
  imports: [
    CacheModule.register({
      ttl: 60, // Default TTL in seconds (1 minute)
      max: 100, // Maximum number of items in cache
      isGlobal: true, // Make available across all modules
    }),
    UserModule,
    ConfigModule.forRoot({
      load: [envConfig],
      isGlobal: true,
    }),
    MongooseModule.forRoot(ENV.DATABASE_URL),
    LoginModule,
    SharedModule,
    InterestModule,
    MailerModule,
    RecaptchaModule,
    SocketModule,
    AssetsModule,
    PluginModule,
    BookmarksModule,
    ChatModule,
    NotificationModule,
    UserStdPluginsModule,
    StdAssetsModule,
    AdminModule,
    ClubsiteModule,
    PaymentModule,
    RouterModule.register([
      {
        path: 'admin',
        module: AdminModule,
      },
    ]),
    ScheduleModule.forRoot(),
  ],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(FileUploadMiddleware).forRoutes({
      path: 'onboarding/images',
      method: RequestMethod.PUT,
    });
  }
}
