import { cp } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { build, spawn } from 'bun';
import { Command } from 'commander';

import pkg from '../package.json' with { type: 'json' };

const __dirname = dirname(fileURLToPath(import.meta.url));

const ROOT_DIR = resolve(__dirname, '..');
const DIST_DIR = resolve(ROOT_DIR, 'dist');

type IPlatform = 'darwin' | 'win32' | 'linux' | 'android';
type IArch = 'x64' | 'arm64';

interface IPlatformConfig {
  target: string;
  outputName: string;
  ext?: string;
  libc?: string;
}

const PLATFORM: Record<IPlatform, IPlatformConfig> = {
  darwin: { target: 'darwin', outputName: 'mac' },
  win32: { target: 'windows', outputName: 'win', ext: '.exe' },
  linux: { target: 'linux', outputName: 'linux' },
  android: { target: 'linux', outputName: 'android', libc: 'android' },
};

const ARCH: IArch[] = ['x64', 'arm64'];

const parseArgs = (): { platform: IPlatform; arch: IArch }[] => {
  const program = new Command()
    .allowUnknownOption()
    .option('-p, --platform <platforms...>', 'target platform (darwin | win32 | linux | android)')
    .option('-a, --arch <archs...>', 'target architecture (x64 | arm64)')
    .parse(process.argv);

  const opts = program.opts<{ platform?: string[]; arch?: string[] }>();

  const platforms = (opts.platform?.length ? opts.platform : Object.keys(PLATFORM)) as IPlatform[];
  const archs = (opts.arch?.length ? opts.arch : [...ARCH]) as IArch[];

  for (const p of platforms) {
    if (!(p in PLATFORM)) throw new Error(`Unknown platform: ${p}`);
  }

  for (const a of archs) {
    if (!(ARCH as readonly string[]).includes(a)) {
      throw new Error(`Unknown arch: ${a}`);
    }
  }

  return platforms.flatMap((platform) => archs.map((arch) => ({ platform, arch })));
};

const copyToDist = async (name: 'models' | 'public'): Promise<void> => {
  await cp(resolve(ROOT_DIR, name), resolve(DIST_DIR, name), { recursive: true });
};

const signDarwin = async (path: string) => {
  try {
    const removeSign = spawn(['codesign', '--remove-signature', path]);
    await removeSign.exited;
  } catch {}

  const sign = spawn(['codesign', '--deep', '--force', '--sign', '-', path]);
  await sign.exited;
  if (sign.exitCode !== 0) {
    console.warn(`Warning: codesign exited with code ${sign.exitCode}`);
  }
};

const buildBinary = async (platform: IPlatform, arch: IArch): Promise<void> => {
  const cfg = PLATFORM[platform];
  const target = `bun-${cfg.target}-${arch}${cfg.libc ? `-${cfg.libc}` : ''}` as any;
  const output = `${pkg.name}-${cfg.outputName}-${arch}${cfg.ext ?? ''}`;
  const outputPath = resolve(DIST_DIR, output);

  console.log(`Building: ${target}  →  ${output}`);

  const result = await build({
    entrypoints: [resolve(ROOT_DIR, 'src/index.ts')],
    target: 'bun',
    // minify: true, // bug
    minify: { whitespace: true, identifiers: false, syntax: true },
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

  if (platform === 'darwin') await signDarwin(outputPath);

  console.log(`Done: ${output}\n`);
};

const main = async () => {
  await Promise.all([copyToDist('models'), copyToDist('public')]);

  const builds = parseArgs();
  for (const { platform, arch } of builds) {
    await buildBinary(platform, arch);
  }

  console.log(`All ${builds.length} build(s) completed!`);
};

main().catch((err) => {
  console.error('\nBuild failed:', err);
  process.exit(1);
});
