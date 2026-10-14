const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ quiet: true });

async function checkConnection(url, name) {
  if (!url) throw new Error(`${name} is missing`);
  const prisma = new PrismaClient({ datasourceUrl: url });
  try {
    await prisma.$queryRaw`SELECT 1`;
    return await prisma.$queryRaw`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `;
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const runtimeTables = await checkConnection(process.env.DATABASE_URL, 'DATABASE_URL');
  const migrationTables = await checkConnection(process.env.DATABASE_URL_UNPOOLED, 'DATABASE_URL_UNPOOLED');
  console.log(JSON.stringify({
    runtimeConnection: 'ok',
    migrationConnection: 'ok',
    publicTables: runtimeTables.map(row => row.table_name),
    migrationPublicTables: migrationTables.map(row => row.table_name),
  }, null, 2));
}

main().catch(error => {
  // Do not print raw database exceptions: they can include connection credentials.
  const code = typeof error.code === 'string' && /^P\d{4}$/.test(error.code) ? ` (${error.code})` : '';
  console.error(`Database connection check failed${code}. Check the private environment file and database availability.`);
  process.exitCode = 1;
});
