import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, PrismaClient } from '@prisma/client';

const MAX_TRANSACTION_ATTEMPTS = 4;

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(private readonly config: ConfigService) {
    super();
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  async runInTransaction<T>(
    callback: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 1; ; attempt += 1) {
      try {
        return await this.$transaction(callback, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: this.config.getOrThrow<number>('DB_TRANSACTION_MAX_WAIT_MS'),
          timeout: this.config.getOrThrow<number>('DB_TRANSACTION_TIMEOUT_MS'),
        });
      } catch (error) {
        const canRetry =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2034' &&
          attempt < MAX_TRANSACTION_ATTEMPTS;

        if (!canRetry) {
          throw error;
        }

        await new Promise((resolve) =>
          setTimeout(resolve, 10 * 2 ** (attempt - 1)),
        );
      }
    }
  }
}
