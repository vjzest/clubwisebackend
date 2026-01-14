import { Module } from '@nestjs/common';
import { SignupModule } from './signup/signup.module';
import { LoginModule } from './login/login.module';
import { ForgotPasswordModule } from './forgot-password/forgot-password.module';
import { ChangePasswordModule } from './change-password/change-password.module';
import { GoogleAuthModule } from './google-signup/google-signup.module';
import { GoogleSigninModule } from './google-signin/google-signin.module';
import { AuthorizationService } from './authorization.service';
import { SharedModule } from '../../shared/shared.module';

@Module({
  imports: [
    SharedModule,
    SignupModule,
    LoginModule,
    ForgotPasswordModule,
    ChangePasswordModule,
    GoogleAuthModule,
    GoogleSigninModule,
  ],
  providers: [AuthorizationService],
  exports: [AuthorizationService],
})
export class AuthModule { }
