import { validateEnvironment } from '../src/config';

const valid = { DATABASE_URL: 'postgresql://localhost/test', AUTH_MODE: 'local', NODE_ENV: 'test', LOCAL_AUTH_SECRET: 'a'.repeat(32) };
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
  it('requires a trusted HTTPS managed identity origin', () => {
    expect(() => validateEnvironment({ ...valid, AUTH_MODE: 'supabase', SUPABASE_URL: 'http://example.com' })).toThrow('HTTPS');
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
  it('identifies a missing managed auth project setting', () => {
    expect(() => validateEnvironment({ ...valid, AUTH_MODE: 'supabase', SUPABASE_URL: '' })).toThrow('SUPABASE_URL');
  });
});
