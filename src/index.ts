import { startCli } from '@/cli';
import { config } from '@/config';
import { startServer } from '@/server';

const bootstrap = async (): Promise<void> => {
  if (config.runMode === 'server') {
    await startServer();
  } else {
    await startCli();
  }
};

void bootstrap();
