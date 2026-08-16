import { readFile, writeFile } from 'node:fs/promises';

import { argv, file } from 'bun';

const args = argv.slice(2);

const isFileExists = async (path) => {
  const pathFile = file(path);
  try {
    const stats = await pathFile.stat();
    return stats.isFile();
  } catch {
    return false;
  }
};

const parseArgs = () => {
  const args = argv.slice(2);
  let input;
  let output;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--input' || args[i] === '-i') {
      const v = args[++i];
      input = v;
    }
    if (args[i] === '--output' || args[i] === '-o') {
      const v = args[++i];
      output = v;
    }
  }

  return { input, output };
};

const main = async () => {
  const { input, output } = parseArgs();

  if (!input || !output) {
    console.error('Usage: bun convert-charset.js --input <input_file> --output <output_file>');
    process.exit(1);
  }

  if (!(await isFileExists(input))) {
    console.error(`Input file does not exist: ${input}`);
    process.exit(1);
  }

  const text = await readFile(input, 'utf-8');

  let lines = text.split('\n');
  if (lines[lines.length - 1] === '') lines.pop();
  const charset = ['', ...lines];

  await writeFile(output, JSON.stringify(charset, null, 2) + '\n', 'utf-8');

  console.log(`Converted: ${input} -> ${output}`);
  console.log(`Total characters: ${charset.length} (including 1 blank token at index 0)`);
};

main().catch((err) => {
  console.error('\nConvert failed:', err);
  process.exit(1);
});
