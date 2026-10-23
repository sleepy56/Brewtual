import { ServiceUnavailableError } from '../http/errors';
import nodemailer from 'nodemailer';

export class VerificationMailService {
  async send(email: string, token: string) {
    const sender = process.env.SMTP_FROM;
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT);
    const user = process.env.SMTP_USER;
    const password = process.env.SMTP_PASSWORD;
    const webUrl = process.env.APP_WEB_URL;
    if (!sender || !host || !Number.isInteger(port) || !user || !password || !webUrl) {
      throw new ServiceUnavailableError('Verification email is unavailable');
    }
    const link = new URL('/verify-email', webUrl);
    link.hash = new URLSearchParams({ token, email }).toString();
    const transport = nodemailer.createTransport({
      host, port, secure: port === 465 || port === 2465,
      auth: { user, pass: password },
      tls: { rejectUnauthorized: true, minVersion: 'TLSv1.2' },
      connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 15000,
    });
    try {
      await transport.sendMail({ from: sender, to: email, subject: 'Verify your brewtual email',
        text: `Open this link to verify your email, then enter your registration/account password:\n${link.toString()}\n\nThe link expires in 30 minutes.`,
      });
    } catch {
      // Provider errors can contain credentials; expose only this fixed message.
      throw new ServiceUnavailableError('Verification email is unavailable');
    } finally { transport.close(); }
  }
}
