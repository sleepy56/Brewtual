const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, existsSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..');
const config = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8'));

test('one Vercel project serves Expo static web and the Nest API', () => {
  assert.equal(config.framework, 'express');
  assert.equal(config.installCommand, 'npm ci --include=dev');
  assert.equal(config.buildCommand, 'npm run build:vercel');
  assert.equal(config.outputDirectory, undefined);
  assert.deepEqual(config.rewrites, [{ source: '/verify-email', destination: '/index.html' }]);
  assert.ok(existsSync(join(root, 'public/index.html')), 'build:vercel must export the static app shell');
  const entry = readFileSync(join(root, 'src/index.ts'), 'utf8');
  assert.match(entry, /expressApp\.listen\(/);
  assert.match(entry, /setupApp\(app\)/);
  assert.match(readFileSync(join(root, 'backend/src/http/setup-app.ts'), 'utf8'), /setGlobalPrefix\('api\/v1'\)/);
});
