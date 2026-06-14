import crypto from 'node:crypto';
import 'dotenv/config';

const parseAuthType = (value) => {
  if (value === undefined || value === '') return 0;

  const type = Number(value);
  if (!Number.isInteger(type) || type < 0 || type > 2) return 0;

  return type;
};

const makeTimestampToken = (key) => {
  const ts = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomBytes(16).toString('hex');
  const data = `${ts}:${nonce}:${key}`;
  const sig = crypto.createHash('md5').update(data).digest('hex');

  return `${ts}:${nonce}:${sig}`;
};

const key = process.env.AUTH_KEY || '';
const type = parseAuthType(process.env.AUTH_TYPE);

if (type === 0) {
  console.log('Authentication is disabled(manual shutdown).');
} else if (!key) {
  console.info('Authentication is disabled(key is empty).');
} else {
  const token = type === 1 ? key : makeTimestampToken(key);
  console.log(token);
}
