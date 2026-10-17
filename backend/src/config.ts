export function validateEnvironment(env: Record<string, unknown>) {
  const nodeEnv = env.NODE_ENV ?? 'development';
  const mode = env.AUTH_MODE ?? (nodeEnv === 'production' ? 'jwt' : 'local');
  if (!['development', 'test', 'production'].includes(String(nodeEnv))) {
    throw new Error('NODE_ENV must be development, test or production');
  }
  if (!['local', 'jwt'].includes(String(mode))) {
    throw new Error('AUTH_MODE must be local or jwt');
  }
  if (typeof env.DATABASE_URL !== 'string' || !/^postgres(ql)?:\/\//.test(env.DATABASE_URL)) {
    throw new Error('DATABASE_URL must be a PostgreSQL connection URL');
  }
  const maxWait = Number(env.DB_TRANSACTION_MAX_WAIT_MS ?? 10000);
  const timeout = Number(env.DB_TRANSACTION_TIMEOUT_MS ?? 30000);
  if (!Number.isInteger(maxWait) || maxWait < 1000 || maxWait > 60000) {
    throw new Error('DB_TRANSACTION_MAX_WAIT_MS must be between 1000 and 60000');
  }
  if (!Number.isInteger(timeout) || timeout < 1000 || timeout > 60000) {
    throw new Error('DB_TRANSACTION_TIMEOUT_MS must be between 1000 and 60000');
  }
  const port = Number(env.PORT ?? 3001);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT is invalid');
  if (mode === 'local') {
    if (nodeEnv === 'production') throw new Error('Local authentication is forbidden in production');
    if (typeof env.LOCAL_AUTH_SECRET !== 'string' || env.LOCAL_AUTH_SECRET.length < 32) {
      throw new Error('LOCAL_AUTH_SECRET must contain at least 32 characters');
    }
  } else {
    if (typeof env.JWT_SECRET !== 'string' || env.JWT_SECRET.length < 32) {
      throw new Error('JWT_SECRET must contain at least 32 characters');
    }
  }
  const issuer = env.JWT_ISSUER ?? 'pair-habits';
  const audience = env.JWT_AUDIENCE ?? 'pair-habits-api';
  if (typeof issuer !== 'string' || !issuer.trim() || typeof audience !== 'string' || !audience.trim()) {
    throw new Error('JWT_ISSUER and JWT_AUDIENCE must be nonempty strings');
  }
  const origins = String(env.CORS_ORIGINS ?? 'http://localhost:3000').split(',').map(x => x.trim()).filter(Boolean);
  if (origins.some(origin => {
    try { return new URL(origin).origin !== origin; } catch { return true; }
  })) throw new Error('CORS_ORIGINS must be a comma-separated list of explicit origins');
  return { ...env, NODE_ENV: nodeEnv, AUTH_MODE: mode, JWT_ISSUER: issuer, JWT_AUDIENCE: audience, PORT: port, CORS_ORIGINS: origins.join(','), DB_TRANSACTION_MAX_WAIT_MS: maxWait, DB_TRANSACTION_TIMEOUT_MS: timeout };
}
