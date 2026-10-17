import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { SignJWT } from 'jose';
import { PrismaService } from '../database/prisma.service';
import { hashPassword, verifyPassword } from './password';

const digest = (token: string) => createHash('sha256').update(token).digest('hex');
const REFRESH_MS = 30 * 24 * 60 * 60 * 1000;

@Injectable()
export class AuthService {
  // Unknown accounts still pay the password derivation cost.
  private readonly dummyHash = hashPassword(randomBytes(32).toString('hex'));
  constructor(private readonly prisma: PrismaService) {}

  private ensureJwtMode() {
    if (process.env.AUTH_MODE !== 'jwt' && !(process.env.AUTH_MODE === undefined && process.env.NODE_ENV === 'production')) {
      throw new UnauthorizedException('Password login requires JWT authentication mode');
    }
  }

  private async accessToken(userId: string, sessionId: string) {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 32) throw new UnauthorizedException('Authentication is unavailable');
    return new SignJWT({ sid: sessionId }).setProtectedHeader({ alg: 'HS256' }).setSubject(userId)
      .setIssuer(process.env.JWT_ISSUER ?? 'pair-habits').setAudience(process.env.JWT_AUDIENCE ?? 'pair-habits-api')
      .setIssuedAt().setExpirationTime('15m').sign(new TextEncoder().encode(secret));
  }

  async login(email: string, password: string) {
    this.ensureJwtMode();
    const user = await this.prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    const valid = await verifyPassword(password, user?.passwordHash ?? await this.dummyHash);
    if (!user?.passwordHash || !valid) throw new UnauthorizedException('Email or password is incorrect');
    const refreshToken = randomBytes(32).toString('base64url');
    const session = await this.prisma.authSession.create({ data: {
      userId: user.id, tokenHash: digest(refreshToken), expiresAt: new Date(Date.now() + REFRESH_MS),
    } });
    return { accessToken: await this.accessToken(user.id, session.id), refreshToken, user: { id: user.id, email: user.email } };
  }

  async refresh(token: string) {
    this.ensureJwtMode();
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new UnauthorizedException('Session expired. Please sign in again');
    const session = await this.prisma.authSession.findUnique({ where: { tokenHash: digest(token) }, include: { user: true } });
    if (!session || session.revokedAt || session.expiresAt <= new Date()) throw new UnauthorizedException('Session expired. Please sign in again');
    const refreshToken = randomBytes(32).toString('base64url');
    // Conditional rotation permits only one winner, even across API instances.
    const rotated = await this.prisma.authSession.updateMany({
      where: { id: session.id, tokenHash: digest(token), revokedAt: null, expiresAt: { gt: new Date() } },
      data: { tokenHash: digest(refreshToken) },
    });
    if (rotated.count !== 1) throw new UnauthorizedException('Session expired. Please sign in again');
    return { accessToken: await this.accessToken(session.userId, session.id), refreshToken,
      user: { id: session.user.id, email: session.user.email } };
  }

  async logout(token: string) {
    if (token) await this.prisma.authSession.updateMany({ where: { tokenHash: digest(token), revokedAt: null }, data: { revokedAt: new Date() } });
  }
}
