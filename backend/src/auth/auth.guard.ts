import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import { createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose';
import { PrismaService } from '../database/prisma.service';
import { AuthenticatedUser } from './auth.types';
import { IS_PUBLIC_KEY } from './public.decorator';

const LOCAL_ISSUER = 'group-quests-local';
const LOCAL_AUDIENCE = 'group-quests-api';
const SUPABASE_AUDIENCE = 'authenticated';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type AuthRequest = {
  headers: { authorization?: string };
  user?: AuthenticatedUser;
};

@Injectable()
export class AuthGuard implements CanActivate {
  private remoteJwks?: ReturnType<typeof createRemoteJWKSet>;
  private jwksUrl?: string;

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

  private async verify(token: string): Promise<JWTPayload> {
    const mode = process.env.AUTH_MODE;
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

    const baseUrl = process.env.SUPABASE_URL;
    if (!baseUrl) throw new UnauthorizedException('Authentication is not configured');
    const issuer = `${baseUrl.replace(/\/$/, '')}/auth/v1`;
    const url = `${issuer}/.well-known/jwks.json`;
    if (!this.remoteJwks || this.jwksUrl !== url) {
      this.remoteJwks = createRemoteJWKSet(new URL(url));
      this.jwksUrl = url;
    }
    try {
      const { payload } = await jwtVerify(token, this.remoteJwks, {
        issuer,
        audience: SUPABASE_AUDIENCE,
        algorithms: ['ES256', 'RS256'],
        requiredClaims: ['exp'],
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
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id) ||
      !EMAIL_PATTERN.test(email)
    ) {
      throw new UnauthorizedException('Token must contain a subject and email');
    }
    return { id, email: email.toLowerCase() };
  }
}
