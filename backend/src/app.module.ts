import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { PairsModule } from './pairs/pairs.module';
import { DomainModule } from './domain/domain.module';
import { GoalsModule } from './goals/goals.module';
import { WalletModule } from './wallet/wallet.module';
import { RewardsModule } from './rewards/rewards.module';
import { HealthController } from './health.controller';
import { validateEnvironment } from './config';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }]),
    DatabaseModule, DomainModule, AuthModule, PairsModule, GoalsModule, WalletModule, RewardsModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
