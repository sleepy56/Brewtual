import { BadRequestError, ServiceUnavailableError, UnauthorizedError } from '../http/errors';
import { Prisma } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import { SignJWT } from 'jose';
import { PrismaService } from '../database/prisma.service';
import { hashPassword, verifyPassword } from './password';
import { VerificationMailService } from './verification-mail.service';

const digest = (token: string) => createHash('sha256').update(token).digest('hex');
const REFRESH_MS = 30 * 24 * 60 * 60 * 1000;
const VERIFY_MS = 30 * 60 * 1000;
const COOLDOWN_MS = 60 * 1000;
const WINDOW_MS = 60 * 60 * 1000;
const GENERIC = { message: 'If this address can be registered, check your email.' };

export class AuthService {
  // Unknown accounts still pay the password derivation cost.
  private readonly dummyHash = hashPassword(randomBytes(32).toString('hex'));
  constructor(private readonly prisma: PrismaService, private readonly mail: VerificationMailService) {}

  private ensureJwtMode() {
    if (process.env.AUTH_MODE !== 'jwt' && !(process.env.AUTH_MODE === undefined && process.env.NODE_ENV === 'production')) {
      throw new UnauthorizedError('Password login requires JWT authentication mode');
    }
  }

  private async accessToken(userId: string, sessionId: string) {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 32) throw new UnauthorizedError('Authentication is unavailable');
    return new SignJWT({ sid: sessionId }).setProtectedHeader({ alg: 'HS256' }).setSubject(userId)
      .setIssuer(process.env.JWT_ISSUER ?? 'pair-habits').setAudience(process.env.JWT_AUDIENCE ?? 'pair-habits-api')
      .setIssuedAt().setExpirationTime('15m').sign(new TextEncoder().encode(secret));
  }

  async signup(email: string, password: string) {
    return this.issueVerification(email, password);
  }

  async resendVerification(email: string) {
    return this.issueVerification(email);
  }

  private async issueVerification(inputEmail: string, password?: string) {
    this.ensureJwtMode();
    const email = inputEmail.trim().toLowerCase();
    const proposedHash = password === undefined ? undefined : await hashPassword(password);
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing?.emailVerifiedAt) return GENERIC;
    const passwordHash = existing?.passwordHash ?? proposedHash;
    const now = new Date();
    // shortcut: expired pending rows persist until that email signs up again, add cleanup if storage grows.
    const previous = await this.prisma.pendingSignup.findUnique({ where: { email } });
    if (!previous && !passwordHash) return GENERIC;
    if (previous && !passwordHash && previous.expiresAt <= now) return GENERIC;
    if (previous && (previous.lastSentAt.getTime() > now.getTime() - COOLDOWN_MS ||
      (previous.windowStart.getTime() > now.getTime() - WINDOW_MS && previous.sendCount >= 5) ||
      (password !== undefined && previous.expiresAt > now))) return GENERIC;
    const token = randomBytes(32).toString('base64url');
    const tokenHash = digest(token);
    const expiresAt = new Date(now.getTime() + VERIFY_MS);
    if (previous) {
      const newWindow = previous.windowStart.getTime() <= now.getTime() - WINDOW_MS;
      const updated = await this.prisma.pendingSignup.updateMany({
        where: { email, tokenHash: previous.tokenHash },
        data: { tokenHash, expiresAt, lastSentAt: now,
          ...(passwordHash ? { passwordHash } : {}),
          windowStart: newWindow ? now : previous.windowStart,
          sendCount: newWindow ? 1 : previous.sendCount + 1 },
      });
      if (updated.count !== 1) return GENERIC;
    } else {
      try {
        await this.prisma.pendingSignup.create({ data: {
          email, passwordHash: passwordHash!, tokenHash, expiresAt, lastSentAt: now, windowStart: now, sendCount: 1,
        } });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return GENERIC;
        throw error;
      }
    }
    try { await this.mail.send(email, token); }
    catch {
      await this.prisma.pendingSignup.deleteMany({ where: { email, tokenHash } });
      throw new ServiceUnavailableError('Verification email is unavailable');
    }
    return GENERIC;
  }

  async confirmVerification(inputEmail: string, token: string, password: string) {
    this.ensureJwtMode();
    const email = inputEmail.trim().toLowerCase();
    const invalid = () => new BadRequestError('Verification link is invalid or expired');
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw invalid();
    const tokenHash = digest(token);
    const pending = await this.prisma.pendingSignup.findUnique({ where: { tokenHash } });
    if (!pending || pending.email !== email || pending.expiresAt <= new Date() ||
      !await verifyPassword(password, pending.passwordHash)) throw invalid();
    try {
      await this.prisma.runInTransaction(async tx => {
        const consumed = await tx.pendingSignup.deleteMany({ where: {
          email, tokenHash, passwordHash: pending.passwordHash, expiresAt: { gt: new Date() },
        } });
        if (consumed.count !== 1) throw invalid();
        const existing = await tx.user.findUnique({ where: { email } });
        if (existing) {
          if (existing.emailVerifiedAt || (existing.passwordHash && existing.passwordHash !== pending.passwordHash)) throw invalid();
          const verified = await tx.user.updateMany({
            where: { id: existing.id, emailVerifiedAt: null, passwordHash: existing.passwordHash },
            data: { passwordHash: pending.passwordHash, emailVerifiedAt: new Date() },
          });
          if (verified.count !== 1) throw invalid();
        } else {
          await tx.user.create({ data: { email, passwordHash: pending.passwordHash, emailVerifiedAt: new Date() } });
        }
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw invalid();
      throw error;
    }
    return { verified: true };
  }

  async login(email: string, password: string) {
    this.ensureJwtMode();
    const user = await this.prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    const valid = await verifyPassword(password, user?.passwordHash ?? await this.dummyHash);
    if (!user?.passwordHash || !valid || !user.emailVerifiedAt) throw new UnauthorizedError('Email or password is incorrect');
    const refreshToken = randomBytes(32).toString('base64url');
    const session = await this.prisma.authSession.create({ data: {
      userId: user.id, tokenHash: digest(refreshToken), expiresAt: new Date(Date.now() + REFRESH_MS),
    } });
    return { accessToken: await this.accessToken(user.id, session.id), refreshToken, user: { id: user.id, email: user.email } };
  }

  async refresh(token: string) {
    this.ensureJwtMode();
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new UnauthorizedError('Session expired. Please sign in again');
    const session = await this.prisma.authSession.findUnique({ where: { tokenHash: digest(token) }, include: { user: true } });
    if (!session || !session.user?.emailVerifiedAt || session.revokedAt || session.expiresAt <= new Date()) throw new UnauthorizedError('Session expired. Please sign in again');
    const refreshToken = randomBytes(32).toString('base64url');
    // Conditional rotation permits only one winner, even across API instances.
    const rotated = await this.prisma.authSession.updateMany({
      where: { id: session.id, tokenHash: digest(token), revokedAt: null, expiresAt: { gt: new Date() }, user: { emailVerifiedAt: { not: null } } },
      data: { tokenHash: digest(refreshToken) },
    });
    if (rotated.count !== 1) throw new UnauthorizedError('Session expired. Please sign in again');
    return { accessToken: await this.accessToken(session.userId, session.id), refreshToken,
      user: { id: session.user.id, email: session.user.email } };
  }

  async logout(token: string) {
    if (token) await this.prisma.authSession.updateMany({ where: { tokenHash: digest(token), revokedAt: null }, data: { revokedAt: new Date() } });
  }
}
