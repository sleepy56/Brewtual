import { UnauthorizedError } from '../http/errors';
import { Prisma } from '@prisma/client';
import { jwtVerify, JWTPayload } from 'jose';
import { PrismaService } from '../database/prisma.service';
import { AuthenticatedUser } from './auth.types';

const LOCAL_ISSUER = 'group-quests-local';
const LOCAL_AUDIENCE = 'group-quests-api';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class Authenticator {
  constructor(private readonly prisma: PrismaService) {}

  async authenticate(authorization: string | null): Promise<AuthenticatedUser> {
    if (!authorization || !authorization.startsWith('Bearer ')) {
      throw new UnauthorizedError('Bearer token required');
    }
    const token = authorization.slice('Bearer '.length).trim();
    if (!token) throw new UnauthorizedError('Bearer token required');

    const payload = await this.verify(token);
    if (this.authMode() === 'jwt') {
      if (!payload.sub || !UUID_PATTERN.test(payload.sub)) {
        throw new UnauthorizedError('Token subject must be a user ID');
      }
      const existingUser = await this.prisma.user.findUnique({ where: { id: payload.sub } });
      if (!existingUser?.emailVerifiedAt) throw new UnauthorizedError('Account is unavailable');
      if (typeof payload.sid !== 'string' || !UUID_PATTERN.test(payload.sid)) throw new UnauthorizedError('Session required');
      const session = await this.prisma.authSession.findUnique({ where: { id: payload.sid } });
      if (!session || session.userId !== existingUser.id || session.revokedAt || session.expiresAt <= new Date()) {
        throw new UnauthorizedError('Session expired. Please sign in again');
      }
      return { id: existingUser.id, email: existingUser.email };
    }
    const user = this.userFromClaims(payload);
    try {
      await this.prisma.user.upsert({
        where: { id: user.id },
        create: user,
        update: { email: user.email },
      });
    } catch (error) {
      // A unique email collision cannot bind a verified identity to another
      // account. Other database errors should retain their server error status.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new UnauthorizedError('Token identity could not be synchronized');
      }
      throw error;
    }
    return user;
  }

  private authMode(): string {
    return process.env.AUTH_MODE ?? (process.env.NODE_ENV === 'production' ? 'jwt' : 'local');
  }

  private async verify(token: string): Promise<JWTPayload> {
    const mode = this.authMode();
    if (mode === 'local') {
      if (
        process.env.NODE_ENV !== 'development' &&
        process.env.NODE_ENV !== 'test'
      ) {
        throw new UnauthorizedError('Local authentication is disabled');
      }
      const secret = process.env.LOCAL_AUTH_SECRET;
      if (!secret || secret.length < 32) {
        throw new UnauthorizedError('Local authentication is not configured');
      }
      try {
        const { payload } = await jwtVerify(
          token,
          new TextEncoder().encode(secret),
          {
            issuer: LOCAL_ISSUER,
            audience: LOCAL_AUDIENCE,
            algorithms: ['HS256'],
            requiredClaims: ['exp'],
          },
        );
        return payload;
      } catch {
        throw new UnauthorizedError('Invalid bearer token');
      }
    }

    if (mode !== 'jwt') throw new UnauthorizedError('Authentication mode is unavailable');
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 32) throw new UnauthorizedError('JWT authentication is not configured');
    try {
      const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
        issuer: process.env.JWT_ISSUER ?? 'pair-habits',
        audience: process.env.JWT_AUDIENCE ?? 'pair-habits-api',
        algorithms: ['HS256'],
        requiredClaims: ['exp', 'sub'],
      });
      return payload;
    } catch {
      throw new UnauthorizedError('Invalid bearer token');
    }
  }

  private userFromClaims(payload: JWTPayload): AuthenticatedUser {
    const id = payload.sub;
    const email = typeof payload.email === 'string' ? payload.email.trim() : '';
    if (
      !id ||
      !UUID_PATTERN.test(id) ||
      !EMAIL_PATTERN.test(email)
    ) {
      throw new UnauthorizedError('Token must contain a subject and email');
    }
    return { id, email: email.toLowerCase() };
  }
}
