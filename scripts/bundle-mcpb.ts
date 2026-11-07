import { cp, rm, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { build, write } from 'bun';
import { packExtension } from '@anthropic-ai/mcpb';

import manifest from '../packages/mcp/manifest.json' with { type: 'json' };
import pkg from '../package.json' with { type: 'json' };

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ROOT_DIR = resolve(__dirname, '..');
const PACKAGES_DIR = resolve(ROOT_DIR, 'packages/mcp');
const STAGE_DIR = resolve(ROOT_DIR, 'dist/mcpb');

const bundleEntry = async () => {
  const bundled = await build({
    entrypoints: [join(PACKAGES_DIR, 'src/index.ts')],
    target: 'node',
    format: 'esm',
    outdir: join(STAGE_DIR, 'server'),
    naming: { entry: 'index.js' },
    minify: true,
  });

  if (!bundled.success) {
    console.error(bundled.logs);
    throw new Error('Bundling mcpb entry failed');
  }

  console.log('Bundling mcpb entry succeeded');
};

const syncManifest = async () => {
  manifest.name = pkg.name;
  manifest.version = pkg.version;

  await write(join(PACKAGES_DIR, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  await write(join(STAGE_DIR, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

  console.log('Manifest synced');
};

const copyIcon = async () => {
  const iconPath = join(ROOT_DIR, 'docs/assets/icon.png');
  try {
    if ((await stat(iconPath)).isFile()) {
      await cp(iconPath, join(STAGE_DIR, 'icon.png'));
    }
  } catch {
    console.warn('Icon not found or could not be copied');
  }
};

const bundleMcpb = async () => {
  const outFile = join(ROOT_DIR, 'dist', `${pkg.name}.mcpb`);

  const ok = await packExtension({
    extensionPath: STAGE_DIR,
    outputPath: outFile,
  });

  if (!ok) {
    throw new Error('Packing mcpb extension failed');
  }

  console.log('Packing mcpb extension succeeded');
};

const clean = async () => {
  await rm(STAGE_DIR, { recursive: true, force: true });

  console.log('Cleaned cache');
};

const main = async () => {
  await bundleEntry();
  await syncManifest();
  await copyIcon();
  await bundleMcpb();
  await clean();
};

main().catch((err) => {
  console.error('\nBundle mcpb failed:', err);
  process.exit(1);
});
