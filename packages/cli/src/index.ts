import process from 'node:process';

import { Command } from 'commander';

import { captchaCommand } from './modules/captcha';
import { healthCommand } from './modules/health';

const main = (args: string[] = process.argv.slice(2)): Promise<void> => {
  const program = new Command();

  program.name('cli').description('Captcha bypass CLI').addCommand(captchaCommand()).addCommand(healthCommand());

  return program.parseAsync(args, { from: 'user' }).then(
    () => undefined,
    (err) => {
      console.error('执行失败:', err instanceof Error ? err.message : err);
      process.exitCode = 1;
    },
  );
};

export { main };
