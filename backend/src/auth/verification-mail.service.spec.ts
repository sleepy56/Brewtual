import nodemailer from 'nodemailer';
import { VerificationMailService } from './verification-mail.service';

describe('Verification email delivery', () => {
  const originalEnv = { ...process.env };
  const transport = { sendMail: jest.fn(), close: jest.fn() };
  let create: jest.SpyInstance;
  beforeEach(() => {
    process.env.SMTP_HOST = 'smtp.resend.com';
    process.env.SMTP_PORT = '465';
    process.env.SMTP_USER = 'resend';
    process.env.SMTP_PASSWORD = 'test-only-api-key';
    process.env.SMTP_FROM = 'verify@example.com';
    process.env.APP_WEB_URL = 'https://habits.example.com';
    transport.sendMail.mockReset().mockResolvedValue({}); transport.close.mockReset();
    create = jest.spyOn(nodemailer, 'createTransport').mockReturnValue(transport as never);
  });
  afterEach(() => { create.mockRestore(); process.env = { ...originalEnv }; });

  it('uses validated TLS, bounded timeouts and a token fragment', async () => {
    await new VerificationMailService().send('recipient@example.com', 'a'.repeat(43));
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ secure: true, host: 'smtp.resend.com', port: 465,
      auth: { user: 'resend', pass: 'test-only-api-key' },
      tls: { rejectUnauthorized: true, minVersion: 'TLSv1.2' }, socketTimeout: 15000 }));
    const message = transport.sendMail.mock.calls[0][0];
    const link = new URL(message.text.match(/https:\/\/\S+/)[0]);
    expect(link.pathname).toBe('/verify-email'); expect(link.search).toBe('');
    expect(new URLSearchParams(link.hash.slice(1)).get('token')).toBe('a'.repeat(43));
    expect(message.from).toBe('verify@example.com'); expect(message.to).toBe('recipient@example.com'); expect(transport.close).toHaveBeenCalled();
  });

  it('hides provider errors and closes the transport', async () => {
    transport.sendMail.mockRejectedValue(new Error('credentials and provider details'));
    await expect(new VerificationMailService().send('recipient@example.com', 'token')).rejects.toThrow('Verification email is unavailable');
    expect(transport.close).toHaveBeenCalled();
  });

  it('fails closed before contacting the provider when unconfigured', async () => {
    delete process.env.SMTP_PASSWORD;
    await expect(new VerificationMailService().send('recipient@example.com', 'token')).rejects.toThrow('Verification email is unavailable');
    expect(create).not.toHaveBeenCalled();
  });
});
