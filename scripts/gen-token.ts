import { randomUUID } from 'node:crypto';

const generateToken = (): string => `sk-${randomUUID().replaceAll('-', '')}`;

const main = async () => {
  console.log(generateToken());
};

main().catch((err) => {
  console.error('\nGenerate token failed:', err);
  process.exit(1);
});
