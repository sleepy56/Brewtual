// NestJS 12 is ESM. Jest's synchronous ESM loader requires Node 24.9+ and VM modules.
const { run } = require('jest');
void run(['--runInBand', ...process.argv.slice(2)]);
