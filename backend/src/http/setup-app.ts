import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import helmet from 'helmet';
import { Request, Response, NextFunction } from 'express';
import { ApiExceptionFilter } from './api-exception.filter';

export function setupApp(app: INestApplication) {
  const config = app.get(ConfigService);
  app.setGlobalPrefix('api/v1');
  app.getHttpAdapter().getInstance().disable('x-powered-by');
  app.use(helmet());
  app.use((request: Request, response: Response, next: NextFunction) => {
    const supplied = request.header('X-Request-Id');
    response.setHeader('X-Request-Id', supplied && /^[a-zA-Z0-9_-]{1,64}$/.test(supplied) ? supplied : randomUUID());
    next();
  });
  app.enableCors({ origin: config.getOrThrow<string>('CORS_ORIGINS').split(',').filter(Boolean), methods: ['GET', 'POST', 'DELETE', 'OPTIONS'], allowedHeaders: ['Authorization', 'Content-Type', 'Idempotency-Key', 'X-Request-Id'] });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, transformOptions: { enableImplicitConversion: false } }));
  app.useGlobalFilters(new ApiExceptionFilter());
}
