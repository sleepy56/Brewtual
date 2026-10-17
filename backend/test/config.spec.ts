import { validateEnvironment } from '../src/config';

const valid = { DATABASE_URL: 'postgresql://localhost/test', AUTH_MODE: 'local', NODE_ENV: 'test', LOCAL_AUTH_SECRET: 'a'.repeat(32) };
const mail = { SMTP_USER: 'owner@gmail.com', SMTP_APP_PASSWORD: 'example-only-app-password', APP_WEB_URL: 'https://habits.example.com' };
describe('startup configuration', () => {
  it('rejects local authentication in production', () => {
    expect(() => validateEnvironment({ ...valid, NODE_ENV: 'production' })).toThrow('forbidden');
  });
  it('rejects short local signing keys', () => {
    expect(() => validateEnvironment({ ...valid, LOCAL_AUTH_SECRET: 'short' })).toThrow('32 characters');
  });
  it('rejects wildcard CORS configuration', () => {
    expect(() => validateEnvironment({ ...valid, CORS_ORIGINS: '*' })).toThrow('explicit origins');
  });
  it('requires a strong signing key for first-party JWT verification', () => {
    expect(() => validateEnvironment({ ...valid, ...mail, AUTH_MODE: 'jwt', JWT_SECRET: 'short' })).toThrow('JWT_SECRET');
  });
  it('normalizes the server port', () => {
    expect(validateEnvironment(valid).PORT).toBe(3001);
  });
  it('allows an empty browser origin list for a native-only client', () => {
    expect(validateEnvironment({ ...valid, CORS_ORIGINS: '' }).CORS_ORIGINS).toBe('');
  });
  it('uses bounded cloud-friendly transaction defaults', () => {
    const env = validateEnvironment(valid);
    expect(env.DB_TRANSACTION_MAX_WAIT_MS).toBe(10000);
    expect(env.DB_TRANSACTION_TIMEOUT_MS).toBe(30000);
  });
  it.each(['0', '60001', 'not-a-number'])('rejects an invalid transaction timeout: %s', timeout => {
    expect(() => validateEnvironment({ ...valid, DB_TRANSACTION_TIMEOUT_MS: timeout })).toThrow('DB_TRANSACTION_TIMEOUT_MS');
  });
  it('fails closed when production JWT settings are missing', () => {
    expect(() => validateEnvironment({ ...valid, NODE_ENV: 'production', AUTH_MODE: 'jwt', JWT_SECRET: '' })).toThrow('JWT_SECRET');
    expect(() => validateEnvironment({ ...valid, NODE_ENV: 'production', AUTH_MODE: 'jwt', JWT_SECRET: 'b'.repeat(48) })).toThrow('SMTP_USER');
    expect(() => validateEnvironment({ ...valid, ...mail, APP_WEB_URL: 'http://habits.example.com', NODE_ENV: 'production', AUTH_MODE: 'jwt', JWT_SECRET: 'b'.repeat(48) })).toThrow('APP_WEB_URL');
  });
  it('accepts configured production JWT auth and rejects the retired provider mode', () => {
    expect(validateEnvironment({ ...valid, ...mail, NODE_ENV: 'production', AUTH_MODE: 'jwt', JWT_SECRET: 'b'.repeat(48) }).AUTH_MODE).toBe('jwt');
    expect(() => validateEnvironment({ ...valid, AUTH_MODE: 'supabase' })).toThrow('AUTH_MODE');
  });
});
