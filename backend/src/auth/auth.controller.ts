import { Body, Controller, ForbiddenException, HttpCode, Post, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Request, Response } from 'express';
import { Public } from './public.decorator';
import { AuthService } from './auth.service';

class SessionDto {
  @IsOptional() @IsIn(['web', 'native']) client?: 'web' | 'native';
  @IsOptional() @IsString() @MaxLength(128) refreshToken?: string;
}
class LoginDto {
  @IsEmail() @MaxLength(254) email!: string;
  @IsString() @MinLength(1) @MaxLength(128) password!: string;
  @IsIn(['web', 'native']) client!: 'web' | 'native';
}
class SignupDto extends LoginDto {
  @MinLength(15) declare password: string;
}
class ResendDto {
  @IsEmail() @MaxLength(254) email!: string;
  @IsIn(['web', 'native']) client!: 'web' | 'native';
}
class ConfirmDto extends SignupDto {
  @IsString() @MinLength(43) @MaxLength(43) token!: string;
}

const COOKIE = 'pair_refresh';
@Public()
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  private checkOrigin(request: Request, client?: string) {
    const origin = request.get('origin');
    const allowed = (process.env.CORS_ORIGINS ?? 'http://localhost:3000').split(',').map(value => value.trim());
    // Browser requests, including native-labelled requests, must come from our UI.
    if ((origin && !allowed.includes(origin)) || (client !== 'native' && !origin) || (request.headers.cookie?.includes(`${COOKIE}=`) && !origin)) {
      throw new ForbiddenException('Untrusted sign-in origin');
    }
  }

  private token(request: Request, body: SessionDto): string {
    if (body.client === 'native') return body.refreshToken ?? '';
    const cookie = request.headers.cookie?.split(';').map(value => value.trim()).find(value => value.startsWith(`${COOKIE}=`));
    return cookie?.slice(COOKIE.length + 1) ?? '';
  }

  private cookieOptions() {
    return { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' as const, path: '/api/v1/auth' };
  }

  private respond(response: Response, client: string | undefined, session: Awaited<ReturnType<AuthService['login']>>) {
    response.setHeader('Cache-Control', 'no-store');
    if (client === 'native') return { ...session, expiresIn: 900 };
    response.cookie(COOKIE, session.refreshToken, { ...this.cookieOptions(), maxAge: 30 * 24 * 60 * 60 * 1000 });
    return { accessToken: session.accessToken, user: session.user, expiresIn: 900 };
  }

  @Post('signup')
  @HttpCode(202)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async signup(@Req() request: Request, @Res({ passthrough: true }) response: Response, @Body() body: SignupDto) {
    this.checkOrigin(request, body.client);
    response.setHeader('Cache-Control', 'no-store');
    return this.auth.signup(body.email, body.password);
  }

  @Post('verify/resend')
  @HttpCode(202)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async resend(@Req() request: Request, @Res({ passthrough: true }) response: Response, @Body() body: ResendDto) {
    this.checkOrigin(request, body.client);
    response.setHeader('Cache-Control', 'no-store');
    return this.auth.resendVerification(body.email);
  }

  @Post('verify/confirm')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async confirm(@Req() request: Request, @Res({ passthrough: true }) response: Response, @Body() body: ConfirmDto) {
    this.checkOrigin(request, body.client);
    response.setHeader('Cache-Control', 'no-store');
    return this.auth.confirmVerification(body.email, body.token, body.password);
  }

  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async login(@Req() request: Request, @Res({ passthrough: true }) response: Response, @Body() body: LoginDto) {
    this.checkOrigin(request, body.client);
    return this.respond(response, body.client, await this.auth.login(body.email, body.password));
  }

  @Post('refresh')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response, @Body() body: SessionDto) {
    this.checkOrigin(request, body.client);
    return this.respond(response, body.client, await this.auth.refresh(this.token(request, body)));
  }

  @Post('logout')
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response, @Body() body: SessionDto) {
    this.checkOrigin(request, body.client);
    await this.auth.logout(this.token(request, body));
    response.clearCookie(COOKIE, this.cookieOptions());
    response.setHeader('Cache-Control', 'no-store');
    return { ok: true };
  }
}
