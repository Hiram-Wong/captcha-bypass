import pkg from '@/../package.json' with { type: 'json' };

export interface HealthInfo {
  version: string;
  timestamp: number;
}

export const getHealth = (): HealthInfo => ({
  version: pkg.version,
  timestamp: Date.now(),
});
