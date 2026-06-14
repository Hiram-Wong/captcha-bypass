import { startServer } from '@/server';

const bootstrap = async (): Promise<void> => {
  await startServer();
};

void bootstrap();
