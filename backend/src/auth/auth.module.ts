import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard } from './auth.guard';
import { MeController } from './me.controller';

@Global()
@Module({
  controllers: [MeController],
  providers: [AuthGuard, { provide: APP_GUARD, useExisting: AuthGuard }],
  exports: [AuthGuard],
})
export class AuthModule {}
