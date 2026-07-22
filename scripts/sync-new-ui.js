const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const targetDir = path.join(repoRoot, 'public', 'new');
// Source: built output from new-ui-source/dist (compiled by grunt sync-new-ui).
// NEW_UI_DIST_PATH overrides the location; there is no vendored-bundle fallback.
const newUiDist = path.join(repoRoot, 'new-ui-source', 'dist');

const sourceDir = process.env.NEW_UI_DIST_PATH
  ? path.resolve(process.env.NEW_UI_DIST_PATH)
  : newUiDist;

function copyRecursive(src, dst) {
  const stat = fs.statSync(src);

  if (stat.isDirectory()) {
    fs.mkdirSync(dst, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      copyRecursive(path.join(src, entry), path.join(dst, entry));
    }
    return;
  }

  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
}

function rimraf(targetPath) {
  fs.rmSync(targetPath, { recursive: true, force: true });
}

function injectHashBridge(indexHtml) {
  const marker = '</head>';
  if (!indexHtml.includes(marker)) return indexHtml;
  if (indexHtml.includes('id="adapt-new-ui-hash-bridge"')) return indexHtml;

  const script = [
    '<script id="adapt-new-ui-hash-bridge">',
    '(function(){',
    '  var hash = (window.location.hash || "").replace(/^#/, "");',
    '  if (!hash) return;',
    '  var map = {',
    '    "dashboard": "/new/",',
    '    "dashboard/shared": "/new/shared",',
    '    "assetManagement": "/new/assets",',
    '    "templateManagement": "/new/templates",',
    '    "userManagement": "/new/users",',
    '    "pluginManagement": "/new/plugins"',
    '  };',
    '  var target = map[hash];',
    '  if (!target) return;',
    '  if (window.location.pathname === target) return;',
    '  window.history.replaceState(null, "", target + window.location.search);',
    '})();',
    '</script>'
  ].join('');

  return indexHtml.replace(marker, script + marker);
}

function ensureRootLogo() {
  const bundledLogo = path.join(targetDir, 'adapt-logo.jpeg');
  const rootLogo = path.join(repoRoot, 'public', 'adapt-logo.jpeg');
  if (!fs.existsSync(bundledLogo)) return;
  fs.copyFileSync(bundledLogo, rootLogo);
}

function main() {
  if (!fs.existsSync(sourceDir)) {
    console.error('New UI dist not found:', sourceDir);
    console.error('Expected a Vite build in new-ui-source/dist, or set NEW_UI_DIST_PATH.');
    process.exit(1);
  }

  rimraf(targetDir);
  copyRecursive(sourceDir, targetDir);

  const indexPath = path.join(targetDir, 'index.html');
  if (!fs.existsSync(indexPath)) {
    console.error('Copied dist does not contain index.html');
    process.exit(1);
  }

  const indexHtml = fs.readFileSync(indexPath, 'utf8');
  fs.writeFileSync(indexPath, injectHashBridge(indexHtml), 'utf8');
  ensureRootLogo();

  console.log('New UI synced to', targetDir);
  console.log('Source:', sourceDir);
}

main();
