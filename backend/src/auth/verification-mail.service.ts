import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { once } from 'node:events';
import { createInterface } from 'node:readline';
import { connect } from 'node:tls';

@Injectable()
export class VerificationMailService {
  async send(email: string, token: string) {
    const sender = process.env.SMTP_USER;
    const password = process.env.SMTP_APP_PASSWORD;
    const webUrl = process.env.APP_WEB_URL;
    if (!sender || !password || !webUrl) throw new ServiceUnavailableException('Verification email is unavailable');
    const link = new URL('/verify-email', webUrl);
    link.hash = new URLSearchParams({ token, email }).toString();
    const socket = connect({ host: 'smtp.gmail.com', port: 465, servername: 'smtp.gmail.com', rejectUnauthorized: true, minVersion: 'TLSv1.2' });
    socket.on('error', () => {});
    socket.setTimeout(15000, () => socket.destroy(new Error('SMTP timeout')));
    const lines = createInterface({ input: socket, crlfDelay: Infinity })[Symbol.asyncIterator]();
    const response = async (expected: number) => {
      for (let count = 0; count < 20; count++) {
        const next = await lines.next();
        const match = next.value?.match(/^(\d{3})([- ])/);
        if (next.done || !match) throw new Error('Invalid SMTP response');
        if (match[2] === ' ') {
          if (Number(match[1]) !== expected) throw new Error('SMTP rejected command');
          return;
        }
      }
      throw new Error('SMTP response too long');
    };
    const command = async (value: string, expected: number) => {
      socket.write(`${value}\r\n`);
      await response(expected);
    };
    try {
      await once(socket, 'secureConnect');
      if (!socket.authorized) throw new Error('SMTP TLS validation failed');
      await response(220);
      await command('EHLO pair-habits', 250);
      await command(`AUTH PLAIN ${Buffer.from(`\0${sender}\0${password}`).toString('base64')}`, 235);
      await command(`MAIL FROM:<${sender}>`, 250);
      await command(`RCPT TO:<${email}>`, 250);
      await command('DATA', 354);
      const body = `Open this link to verify your email, then enter the password you registered with:\r\n${link.toString()}\r\n\r\nThe link expires in 30 minutes.`;
      const message = `From: ${sender}\r\nTo: ${email}\r\nSubject: Verify your Pair Habits email\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n${body.replace(/\r\n\./g, '\r\n..')}\r\n.`;
      await command(message, 250);
      socket.write('QUIT\r\n');
    } catch {
      // SMTP errors can contain credentials; expose only this fixed message.
      throw new ServiceUnavailableException('Verification email is unavailable');
    } finally {
      socket.destroy();
    }
  }
}
