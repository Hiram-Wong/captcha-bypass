import { dirname, join, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { file, write } from 'bun';
import { readdir } from 'node:fs/promises';

import pkg from '../package.json' with { type: 'json' };

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ROOT_DIR = resolve(__dirname, '..');
const PACKAGES_DIR = resolve(ROOT_DIR, 'packages');

const rootVersion = pkg.version;

const getSubpackageNames = async () => {
  const names = [];

  const dirFiles = await readdir(PACKAGES_DIR);
  for (const name of dirFiles) {
    const pkgPath = join(PACKAGES_DIR, name, 'package.json');
    if (!(await file(pkgPath).exists())) continue;
    names.push(name);
  }
  return names;
};

const syncSubPkgs = async () => {
  const names = await getSubpackageNames();

  let updated = 0;
  for (const name of names) {
    const pkgPath = join(PACKAGES_DIR, name, 'package.json');

    const subPkg = await file(pkgPath).json();
    const subVersion = subPkg.version;

    if (subVersion === rootVersion) continue;

    subPkg.version = rootVersion;
    await write(pkgPath, `${JSON.stringify(subPkg, null, 2)}\n`);

    console.log(`${subPkg.name}: ${subVersion} -> ${rootVersion}`);
    updated++;
  }

  return updated;
};

const syncSkill = async () => {
  const skillPath = join(PACKAGES_DIR, 'skills', 'captcha-bypass', 'SKILL.md');
  const content = await file(skillPath).text();

  const frontmatter = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatter) {
    console.warn('Skill frontmatter not found, skipped');
    return 0;
  }

  const versionLine = frontmatter[1].match(/^version:\s*(.+)$/m);
  if (!versionLine) {
    console.warn('Skill version field not found, skipped');
    return 0;
  }

  const oldVersion = versionLine[1];
  if (oldVersion === rootVersion) return 0;

  const next = content.replace(/^version:\s*.+$/m, `version: ${rootVersion}`);
  await write(skillPath, next);

  console.log(`skill captcha-bypass: ${oldVersion} -> ${rootVersion}`);
  return 1;
};

const syncMcpb = async () => {
  const manifestPath = join(PACKAGES_DIR, 'mcp', 'manifest.json');

  const manifest = await file(manifestPath).json();
  const oldVersion = manifest.version;

  if (oldVersion === rootVersion) return 0;

  manifest.version = rootVersion;
  await write(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  console.log(`mcpb manifest: ${oldVersion} -> ${rootVersion}`);
  return 1;
};

const main = async () => {
  const subpackageCount = await syncSubPkgs();
  const skillCount = await syncSkill();
  const mcpbCount = await syncMcpb();

  const total = subpackageCount + skillCount + mcpbCount;

  if (total === 0) {
    console.log(`All versions already match root (${rootVersion}).`);
  } else {
    console.log(
      `Synced ${subpackageCount} subpackage(s), ${skillCount} skill(s), ${mcpbCount} mcpb manifest(s) to version ${rootVersion}.`,
    );
  }
};

main().catch((err) => {
  console.error('\nSync version failed:', err);
  process.exit(1);
});
