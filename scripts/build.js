import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.resolve(ROOT_DIR, 'dist');
const ENTRY_FILE = path.resolve(ROOT_DIR, 'src', 'index.ts');
const MODELS_DIR = path.resolve(ROOT_DIR, 'models');
const PUBLIC_DIR = path.resolve(ROOT_DIR, 'public');

const PLATFORM = {
  darwin: { bun: 'darwin', name: 'mac' },
  win32: { bun: 'windows', name: 'win', ext: '.exe' },
  linux: { bun: 'linux', name: 'linux' },
};

const ARCH = ['x64', 'arm64'];

const parseArgs = () => {
  const args = process.argv.slice(2);
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

const copyRuntimeModels = async () => {
  if (!fs.existsSync(MODELS_DIR)) return;
  const dest = path.resolve(DIST_DIR, 'models');
  await fsp.rm(dest, { recursive: true, force: true });
  await fsp.cp(MODELS_DIR, dest, { recursive: true });
};

const copyPublicAssets = async () => {
  if (!fs.existsSync(PUBLIC_DIR)) return;
  const dest = path.resolve(DIST_DIR, 'public');
  await fsp.rm(dest, { recursive: true, force: true });
  await fsp.cp(PUBLIC_DIR, dest, { recursive: true });
};

const buildOne = async (platform, arch) => {
  const cfg = PLATFORM[platform];
  const target = `bun-${cfg.bun}-${arch}`;
  const output = `captcha-bypass-${cfg.name}-${arch}${cfg.ext ?? ''}`;
  const outputPath = path.resolve(DIST_DIR, output);

  console.log(`Building: ${target}  →  ${output}`);

  const result = await Bun.build({
    entrypoints: [ENTRY_FILE],
    target: 'bun',
    minify: true,
    bytecode: true,
    naming: { asset: '[name].[ext]' },
    compile: {
      target,
      outfile: outputPath,
    },
  });

  if (!result.success) {
    for (const log of result.logs) console.error(log);
    throw new Error(`Build failed for ${target}`);
  }

  if (platform === 'darwin') {
    try {
      await Bun.spawn(['codesign', '--remove-signature', outputPath]).exited;
    } catch {
      /* ignore */
    }
    const proc = Bun.spawn(['codesign', '--force', '--sign', '-', outputPath]);
    await proc.exited;
    if (proc.exitCode !== 0) {
      console.warn(`Warning: codesign exited with code ${proc.exitCode}`);
    }
  }

  console.log(`Done: ${output}\n`);
};

const main = async () => {
  const targets = parseArgs();

  await fsp.rm(DIST_DIR, { recursive: true, force: true });
  await fsp.mkdir(DIST_DIR, { recursive: true });
  await copyRuntimeModels();
  await copyPublicAssets();

  for (const { platform, arch } of targets) {
    await buildOne(platform, arch);
  }

  console.log(`All ${targets.length} build(s) completed!`);
};

main().catch((err) => {
  console.error('\nBuild failed:', err);
  process.exit(1);
});
