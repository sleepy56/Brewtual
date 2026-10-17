const { run } = require('jest');
void run(['--runInBand', ...process.argv.slice(2)]);
