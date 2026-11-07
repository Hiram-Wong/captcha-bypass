import process from 'node:process';

import { file, write } from 'bun';
import { Command } from 'commander';

const program = new Command();

program
  .name('convert-charset')
  .description('Convert a plain text file (one character per line) into a JSON charset array.')
  .argument('[input]', 'input text file path')
  .option('-i, --input <file>', 'input text file path')
  .option('-o, --output <file>', 'output JSON file path')
  .action(async (inputArg, options) => {
    const input = options.input ?? inputArg;
    const { output } = options;

    if (!input || !output) {
      program.error('Missing required argument: --input and --output are required');
    }

    const inputFile = file(input);
    if (!(await inputFile.exists())) {
      program.error(`Input file does not exist: ${input}`);
    }

    const text = await inputFile.text();

    const lines = text.split('\n');
    if (lines[lines.length - 1] === '') lines.pop();
    const charset = ['', ...lines];

    await write(output, `${JSON.stringify(charset, null, 2)}\n`);

    console.log(`Converted: ${input} -> ${output}`);
    console.log(`Total characters: ${charset.length} (including 1 blank token at index 0)`);
  });

program.parseAsync().catch((err) => {
  console.error('\nConvert failed:', err);
  process.exit(1);
});
