const { SignJWT } = require('jose');
const { randomUUID } = require('node:crypto');
require('dotenv').config({ quiet: true });

async function main() {
  if (process.env.AUTH_MODE !== 'local' || !['development', 'test'].includes(process.env.NODE_ENV)) {
    throw new Error('Local token generation requires AUTH_MODE=local and NODE_ENV=development or test.');
  }
  const secret = process.env.LOCAL_AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error('Configure a LOCAL_AUTH_SECRET of at least 32 characters.');
  const [email, suppliedId] = process.argv.slice(2);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Usage: npm run local:token -- person@example.com [user-uuid]');
  const id = suppliedId ?? randomUUID();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) throw new Error('User ID must be a UUID.');
  const token = await new SignJWT({ email: email.trim().toLowerCase() })
    .setProtectedHeader({ alg: 'HS256' }).setIssuer('group-quests-local').setAudience('group-quests-api')
    .setSubject(id).setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode(secret));
  console.log(JSON.stringify({ userId: id, email, token }, null, 2));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
