const { spawnSync } = require('node:child_process');
const { resolve } = require('node:path');

const root = resolve(__dirname, '..');
const npm = process.env.npm_execpath;
if (!npm) throw new Error('Run this build through npm');
const expo = require.resolve('expo/bin/cli', { paths: [resolve(root, 'mobile')] });
for (const [args, cwd, env] of [
  [[npm, 'run', 'build', '--workspace', 'backend'], root, process.env],
  [[expo, 'export', '--platform', 'web', '--output-dir', '../public'], resolve(root, 'mobile'), { ...process.env, EXPO_PUBLIC_API_URL: '/api/v1' }],
]) {
  const result = spawnSync(process.execPath, args, { cwd, env, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
