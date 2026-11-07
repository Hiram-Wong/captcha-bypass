import { Command } from 'commander';

import { getHealth } from '@captcha-bypass/core/health';
import { run } from '../utils/run';

const healthCommand = (): Command =>
  new Command('health').description('Show service health information').action(async () => {
    await run('health', async () => getHealth());
  });

export { healthCommand };
