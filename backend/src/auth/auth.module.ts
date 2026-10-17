import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard } from './auth.guard';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { MeController } from './me.controller';
import { VerificationMailService } from './verification-mail.service';

@Global()
@Module({
  controllers: [MeController, AuthController],
  providers: [AuthService, VerificationMailService, AuthGuard, { provide: APP_GUARD, useExisting: AuthGuard }],
  exports: [AuthGuard],
})
export class AuthModule {}
