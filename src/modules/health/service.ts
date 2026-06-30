import { APP_NAME, APP_VERSION, WEBSITE_URL } from '@/utils/appInfo';

export interface HealthInfo {
  name: string;
  homepage: string;
  version: string;
  timestamp: number;
}

export const getHealth = (): HealthInfo => ({
  name: APP_NAME,
  homepage: WEBSITE_URL,
  version: APP_VERSION,
  timestamp: Date.now(),
});
