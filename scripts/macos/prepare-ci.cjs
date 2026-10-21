// Runs only in an ephemeral macOS CI checkout. Never run against a Windows release checkout.
const fs = require('node:fs');
const path = require('node:path');
if (process.platform !== 'darwin' || process.env.GITHUB_ACTIONS !== 'true') {
  console.error('Refusing to modify Tauri configuration outside macOS GitHub Actions.');
  process.exit(1);
}
const tauri = path.resolve(__dirname, '../../tauri_gerador/src-tauri');
const configFile = path.join(tauri, 'tauri.conf.json');
const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
const icon = path.join(tauri, 'icons/icon.icns');
if (!fs.existsSync(icon)) throw Error('The macOS .icns icon was not generated');
config.bundle.targets = ['dmg'];
config.bundle.icon = ['icons/icon.icns'];
config.bundle.resources = {};
delete config.bundle.windows;
config.bundle.macOS = { minimumSystemVersion: '12.0' };
fs.writeFileSync(configFile, JSON.stringify(config, null, 2) + '\n');
console.log('Temporary macOS-only bundle config prepared. Windows config in Git is unchanged.');
