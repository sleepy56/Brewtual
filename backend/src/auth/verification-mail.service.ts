import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import nodemailer from 'nodemailer';

@Injectable()
export class VerificationMailService {
  async send(email: string, token: string) {
    const sender = process.env.SMTP_USER;
    const password = process.env.SMTP_APP_PASSWORD;
    const webUrl = process.env.APP_WEB_URL;
    if (!sender || !password || !webUrl) throw new ServiceUnavailableException('Verification email is unavailable');
    const link = new URL('/verify-email', webUrl);
    link.hash = new URLSearchParams({ token, email }).toString();
    const transport = nodemailer.createTransport({
      host: 'smtp.gmail.com', port: 465, secure: true,
      auth: { user: sender, pass: password },
      tls: { rejectUnauthorized: true, minVersion: 'TLSv1.2' },
      connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 15000,
    });
    try {
      await transport.sendMail({ from: sender, to: email, subject: 'Verify your Pair Habits email',
        text: `Open this link to verify your email, then enter your registration/account password:\n${link.toString()}\n\nThe link expires in 30 minutes.`,
      });
    } catch {
      // Provider errors can contain credentials; expose only this fixed message.
      throw new ServiceUnavailableException('Verification email is unavailable');
    } finally { transport.close(); }
  }
}
