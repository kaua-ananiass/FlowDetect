const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const tests = fs.readdirSync(path.join(root, 'tests'))
  .filter(name => name.endsWith('.cjs') || name.endsWith('.test.mjs'))
  .sort().map(name => path.join(root, 'tests', name));
const result = spawnSync(process.execPath, ['--test', '--test-concurrency=2', ...tests], { cwd: root, stdio: 'inherit', env: process.env });
if (result.error) { console.error(result.error.message); process.exit(1); }
process.exit(result.status ?? 1);
