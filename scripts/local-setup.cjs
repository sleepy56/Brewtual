const { randomBytes } = require('node:crypto');
const { readFileSync, writeFileSync, existsSync } = require('node:fs');
const { resolve } = require('node:path');
const destination = resolve(__dirname, '..', '.env');
if (existsSync(destination)) {
  console.log('Existing root .env preserved.');
} else {
  const template = readFileSync(resolve(__dirname, '..', '.env.example'), 'utf8');
  const secret = randomBytes(48).toString('base64url');
  writeFileSync(destination, template.replace('replace-with-a-random-secret-of-at-least-32-characters', secret), { flag: 'wx' });
  console.log('Created root .env with a random development signing key.');
}
