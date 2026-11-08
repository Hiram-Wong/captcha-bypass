import process from 'node:process';

import { Command } from 'commander';

import { main as startCli } from '@captcha-bypass/cli';
import { APP_DESC, APP_NAME, APP_VERSION } from '@captcha-bypass/core/utils/appInfo';
import { main as startServer } from '@captcha-bypass/server';

const program = new Command();

program.name(APP_NAME).description(APP_DESC).version(APP_VERSION);

program
  .command('server')
  .description('Captcha bypass Server')
  .action(async () => {
    await startServer();
  });

program
  .command('cli')
  .description('Captcha bypass CLI')
  .allowExcessArguments(true)
  .allowUnknownOption(true)
  .helpOption(false)
  .action(async () => {
    await startCli(program.args.slice(1));
  });

program.parseAsync(process.argv.slice(2), { from: 'user' }).catch((err) => {
  console.error('执行失败:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
