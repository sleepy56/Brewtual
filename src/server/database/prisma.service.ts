import { Prisma, PrismaClient } from '@prisma/client';

const MAX_TRANSACTION_ATTEMPTS = 4;

export class PrismaService extends PrismaClient {
  async runInTransaction<T>(
    callback: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 1; ; attempt += 1) {
      try {
        return await this.$transaction(callback, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: Number(process.env.DB_TRANSACTION_MAX_WAIT_MS ?? 10000),
          timeout: Number(process.env.DB_TRANSACTION_TIMEOUT_MS ?? 30000),
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
