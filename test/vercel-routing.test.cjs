const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { createServer } = require('node:net');
const { once } = require('node:events');
const { setTimeout: delay } = require('node:timers/promises');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

test(
  'built Next.js serves web, verification and API with Lambda-compatible module loading',
  { timeout: 45000 },
  async (t) => {
    const root = join(__dirname, '..');
    const config = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8'));
    assert.equal(config.framework, 'nextjs');
    assert.equal(config.outputDirectory, undefined);
    const available = createServer().listen(0, '127.0.0.1');
    await once(available, 'listening');
    const port = available.address().port;
    await new Promise((resolve) => available.close(resolve));
    const child = spawn(
      process.execPath,
      [
        '--no-experimental-require-module',
        require.resolve('next/dist/bin/next'),
        'start',
        '--hostname',
        '127.0.0.1',
        '--port',
        String(port),
      ],
      {
        cwd: root,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
          NODE_ENV: 'production',
          NEXT_TELEMETRY_DISABLED: '1',
          AUTH_MODE: 'jwt',
          DATABASE_URL: 'postgresql://smoke:smoke@127.0.0.1:1/smoke?connect_timeout=1',
          DATABASE_URL_UNPOOLED: 'postgresql://smoke:smoke@127.0.0.1:1/smoke?connect_timeout=1',
          JWT_SECRET: 'production-smoke-test-secret-at-least-32-characters',
          APP_WEB_URL: 'https://smoke.example.com',
          CORS_ORIGINS: 'https://smoke.example.com',
          SMTP_HOST: '',
          REQUIRE_EMAIL_VERIFICATION: 'false',
          SMTP_USER: '',
          SMTP_PASSWORD: '',
          SMTP_FROM: '',
        },
      },
    );
    let output = '';
    child.stdout.on('data', (chunk) => {
      output = (output + chunk).slice(-5000);
    });
    child.stderr.on('data', (chunk) => {
      output = (output + chunk).slice(-5000);
    });
    t.after(async () => {
      if (child.exitCode !== null) return;
      const stopped = once(child, 'exit');
      child.kill();
      await stopped;
    });
    const url = `http://127.0.0.1:${port}`;
    let home;
    for (let attempt = 0; attempt < 100; attempt++) {
      if (child.exitCode !== null) assert.fail(`Production server exited: ${output}`);
      try {
        home = await fetch(url, { signal: AbortSignal.timeout(1000) });
        break;
      } catch {
        await delay(200);
      }
    }
    assert.ok(home, `Production server did not start: ${output}`);
    assert.equal(home.status, 200);
    assert.equal(home.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(home.headers.get('referrer-policy'), 'no-referrer');
    assert.match(home.headers.get('strict-transport-security'), /max-age=31536000/);
    assert.match(await home.text(), /Pair Habits/);
    const verify = await fetch(`${url}/verify-email`);
    assert.equal(verify.status, 200);
    assert.match(await verify.text(), /One last little step/);
    const health = await fetch(`${url}/api/v1/health`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { status: 'ok' });
    assert.equal((await fetch(`${url}/api/v1/me`)).status, 401);
    const invalidLogin = await fetch(`${url}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://smoke.example.com' },
      body: JSON.stringify({ email: 'invalid', password: '', client: 'web' }),
    });
    assert.equal(invalidLogin.status, 400);
    assert.equal(
      (await fetch(`${url}/api/v1/health/ready`)).status,
      503,
      'readiness must report an unavailable database without crashing the web app',
    );
    assert.equal((await fetch(url)).status, 200);
  },
);
