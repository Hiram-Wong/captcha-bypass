import { cp, mkdir, rm, exists } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { argv, build, file, spawn } from 'bun';

import pkg from '../package.json';

const __dirname = dirname(fileURLToPath(import.meta.url));

const ROOT_DIR = resolve(__dirname, '..');
const DIST_DIR = resolve(ROOT_DIR, 'dist');

const PLATFORM = {
  darwin: { bun: 'darwin', name: 'mac' },
  win32: { bun: 'windows', name: 'win', ext: '.exe' },
  linux: { bun: 'linux', name: 'linux' },
};

const ARCH = ['x64', 'arm64'];

const parseArgs = () => {
  const args = argv.slice(2);
  let platform = Object.keys(PLATFORM);
  let arch = ARCH;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--platform') {
      const v = args[++i];
      if (!PLATFORM[v]) throw new Error(`Unknown platform: ${v}`);
      platform = [v];
    }
    if (args[i] === '--arch') {
      const v = args[++i];
      if (!ARCH.includes(v)) throw new Error(`Unknown arch: ${v}`);
      arch = [v];
    }
  }

  return platform.flatMap((p) => arch.map((a) => ({ platform: p, arch: a })));
};

const ensureDir = async (dir) => {
  const dirFile = file(dir);
  try {
    const stats = await dirFile.stat();
    if (!stats.isDirectory()) {
      await rm(dir, { recursive: true, force: true });
      await mkdir(dir, { recursive: true });
    }
  } catch {
    await mkdir(dir, { recursive: true });
  }
};

const ensureEmptyDir = async (dir) => {
  await ensureDir(dir);
  await rm(dir, { recursive: true, force: true });
};

const copyDir = async (src, dest) => {
  await ensureEmptyDir(dest);
  await cp(src, dest, { recursive: true });
};

const buildOne = async (platform, arch) => {
  const cfg = PLATFORM[platform];
  const target = `bun-${cfg.bun}-${arch}`;
  const output = `${pkg.name}-${cfg.name}-${arch}${cfg.ext ?? ''}`;
  const outputPath = resolve(DIST_DIR, output);

  console.log(`Building: ${target}  →  ${output}`);

  const result = await build({
    entrypoints: [resolve(ROOT_DIR, 'src/index.ts')],
    target: 'bun',
    minify: true,
    bytecode: true,
    naming: { asset: '[name].[ext]' },
    compile: {
      target,
      outfile: outputPath,
      ...(platform === 'win32'
        ? {
            windows: {
              icon: resolve(ROOT_DIR, 'public/favicon.ico'),
              title: pkg.name,
              publisher: `com.github.${pkg.author.name}`,
              version: pkg.version,
              description: pkg.description,
              copyright: `Copyright © ${new Date().getFullYear()} ${pkg.name}`,
            },
          }
        : {}),
    },
  });
  if (!result.success) {
    for (const log of result.logs) console.error(log);
    throw new Error(`Build failed for ${target}`);
  }

  if (platform === 'darwin') {
    try {
      const removeSign = spawn(['codesign', '--remove-signature', outputPath]);
      await removeSign.exited;
    } catch {}

    const sign = spawn(['codesign', '--deep', '--force', '--sign', '-', outputPath]);
    await sign.exited;
    if (sign.exitCode !== 0) {
      console.warn(`Warning: codesign exited with code ${sign.exitCode}`);
    }
  }

  console.log(`Done: ${output}\n`);
};

const main = async () => {
  await ensureEmptyDir(resolve(ROOT_DIR, 'dist'));

  await copyDir(resolve(ROOT_DIR, 'models'), resolve(DIST_DIR, 'models'));
  await copyDir(resolve(ROOT_DIR, 'public'), resolve(DIST_DIR, 'public'));

  const targets = parseArgs();
  for (const { platform, arch } of targets) {
    await buildOne(platform, arch);
  }

  console.log(`All ${targets.length} build(s) completed!`);
};

main().catch((err) => {
  console.error('\nBuild failed:', err);
  process.exit(1);
});
