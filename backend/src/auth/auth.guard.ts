import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import { jwtVerify, JWTPayload } from 'jose';
import { PrismaService } from '../database/prisma.service';
import { AuthenticatedUser } from './auth.types';
import { IS_PUBLIC_KEY } from './public.decorator';

const LOCAL_ISSUER = 'group-quests-local';
const LOCAL_AUDIENCE = 'group-quests-api';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type AuthRequest = {
  headers: { authorization?: string };
  user?: AuthenticatedUser;
};

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthRequest>();
    const authorization = request.headers.authorization;
    if (!authorization || !authorization.startsWith('Bearer ')) {
      throw new UnauthorizedException('Bearer token required');
    }
    const token = authorization.slice('Bearer '.length).trim();
    if (!token) throw new UnauthorizedException('Bearer token required');

    const payload = await this.verify(token);
    if (this.authMode() === 'jwt') {
      if (!payload.sub || !UUID_PATTERN.test(payload.sub)) {
        throw new UnauthorizedException('Token subject must be a user ID');
      }
      const existingUser = await this.prisma.user.findUnique({ where: { id: payload.sub } });
      if (!existingUser) throw new UnauthorizedException('Account is unavailable');
      if (typeof payload.sid !== 'string' || !UUID_PATTERN.test(payload.sid)) throw new UnauthorizedException('Session required');
      const session = await this.prisma.authSession.findUnique({ where: { id: payload.sid } });
      if (!session || session.userId !== existingUser.id || session.revokedAt || session.expiresAt <= new Date()) {
        throw new UnauthorizedException('Session expired. Please sign in again');
      }
      request.user = { id: existingUser.id, email: existingUser.email };
      return true;
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
        throw new UnauthorizedException('Token identity could not be synchronized');
      }
      throw error;
    }
    request.user = user;
    return true;
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
        throw new UnauthorizedException('Local authentication is disabled');
      }
      const secret = process.env.LOCAL_AUTH_SECRET;
      if (!secret || secret.length < 32) {
        throw new UnauthorizedException('Local authentication is not configured');
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
        throw new UnauthorizedException('Invalid bearer token');
      }
    }

    if (mode !== 'jwt') throw new UnauthorizedException('Authentication mode is unavailable');
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 32) throw new UnauthorizedException('JWT authentication is not configured');
    try {
      const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
        issuer: process.env.JWT_ISSUER ?? 'pair-habits',
        audience: process.env.JWT_AUDIENCE ?? 'pair-habits-api',
        algorithms: ['HS256'],
        requiredClaims: ['exp', 'sub'],
      });
      return payload;
    } catch {
      throw new UnauthorizedException('Invalid bearer token');
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
      throw new UnauthorizedException('Token must contain a subject and email');
    }
    return { id, email: email.toLowerCase() };
  }
}
