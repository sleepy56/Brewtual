import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { setupApp } from '../http/setup-app';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('Auth routes', () => {
  let app: INestApplication;
  const previousOrigin = process.env.CORS_ORIGINS;
  const auth = { signup: jest.fn(), resendVerification: jest.fn(), confirmVerification: jest.fn() };
  beforeAll(async () => {
    process.env.CORS_ORIGINS = 'http://localhost:8081';
    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: ConfigService, useValue: { getOrThrow: () => 'http://localhost:8081' } },
      ],
    }).compile();
    app = module.createNestApplication();
    setupApp(app);
    await app.init();
  });
  afterAll(async () => {
    await app.close();
    if (previousOrigin === undefined) delete process.env.CORS_ORIGINS;
    else process.env.CORS_ORIGINS = previousOrigin;
  });

  it('routes strict POST bodies under /api/v1 and has no consuming GET', async () => {
    auth.signup.mockResolvedValue({ message: 'If this address can be registered, check your email.' });
    auth.resendVerification.mockResolvedValue({ message: 'If this address can be registered, check your email.' });
    auth.confirmVerification.mockResolvedValue({ verified: true });
    const base = request(app.getHttpServer());
    const origin = 'http://localhost:8081';
    await base.post('/api/v1/auth/signup').set('Origin', origin).send({ email: 'alex@example.com', password: 'long registration password', client: 'web' }).expect(202);
    await base.post('/api/v1/auth/signup').set('Origin', origin).send({ email: 'alex@example.com', password: 'long registration password', client: 'web', role: 'admin' }).expect(400);
    await base.post('/api/v1/auth/verify/resend').set('Origin', origin).send({ email: 'alex@example.com', client: 'web' }).expect(202);
    await base.post('/api/v1/auth/verify/confirm').set('Origin', origin).send({ email: 'alex@example.com', token: 'a'.repeat(43), password: 'long registration password', client: 'web' }).expect(201, { verified: true });
    await base.get('/api/v1/auth/verify/confirm').expect(404);
    expect(auth.confirmVerification).toHaveBeenCalledTimes(1);
  });
});
