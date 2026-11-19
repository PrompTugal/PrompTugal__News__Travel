// Renders _site/preview-card.svg to preview.png (1200 x 630, for social cards) when Playwright and a browser are
// available, and keeps a copy in src/preview.png so builds without a browser still serve one.
// Run after scripts/build.mjs: node scripts/preview-png.mjs. No network: the SVG is loaded as a local file and
// every request is refused.
import { createRequire } from 'node:module';
import { existsSync, copyFileSync } from 'node:fs';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { console.log('preview-png: Playwright not found, skipped (the committed src/preview.png is served)'); process.exit(0); }
if (!existsSync('_site/preview-card.svg')) { console.error('preview-png: run scripts/build.mjs first'); process.exit(1); }

const b = await chromium.launch();
try {
  const ctx = await b.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1, javaScriptEnabled: false });
  await ctx.route(/^(?!file:)/, r => r.abort());
  const p = await ctx.newPage();
  await p.goto('file://' + resolve('_site/preview-card.svg'));
  await p.screenshot({ path: '_site/preview.png', clip: { x: 0, y: 0, width: 1200, height: 630 } });
  copyFileSync('_site/preview.png', 'src/preview.png');
  console.log('preview-png: wrote _site/preview.png and src/preview.png');
} finally { await b.close(); }
