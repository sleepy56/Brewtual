import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/auth/password';

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  // Read from stdin so passwords never appear in command arguments or shell history.
  let input = '';
  for await (const chunk of process.stdin) {
    input += chunk;
    if (input.length > 1024) throw new Error('Password input is too long');
  }
  const password = input.replace(/\r?\n$/, '');
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Provide an email as the first argument');
  if (password.length < 15 || password.length > 128) throw new Error('Provide a unique password of 15–128 characters through stdin');
  const prisma = new PrismaClient();
  try {
    const passwordHash = await hashPassword(password);
    await prisma.$transaction(async tx => {
      const user = await tx.user.upsert({ where: { email }, create: { email, passwordHash }, update: { passwordHash } });
      await tx.authSession.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
    });
    console.log('Account provisioned; previous sessions revoked.');
  } finally { await prisma.$disconnect(); }
}

main().catch(error => { console.error(error instanceof Error ? error.message : 'Provisioning failed'); process.exitCode = 1; });
