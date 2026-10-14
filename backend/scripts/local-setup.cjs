const { randomBytes } = require('node:crypto');
const { readFileSync, writeFileSync, existsSync } = require('node:fs');
const { resolve } = require('node:path');
const destination = resolve(__dirname, '..', '.env');
if (existsSync(destination)) {
  console.log('Existing backend/.env preserved.');
} else {
  const template = readFileSync(resolve(__dirname, '..', '.env.example'), 'utf8');
  writeFileSync(destination, template.replace('replace-with-a-random-secret-of-at-least-32-characters', randomBytes(48).toString('base64url')), { flag: 'wx' });
  console.log('Created backend/.env with a random development signing key.');
}
