import os from 'os';

import { config } from '@/config';
import pkg from '../../package.json' with { type: 'json' };

export const consoleStartSuccess = () => {
  console.log(`${'='.repeat(23)} 服务启动成功 ${'='.repeat(23)}`);
};

export const consoleStartFail = (err: any) => {
  console.log(`${'='.repeat(23)} 服务启动失败 ${'='.repeat(23)}`);
  console.error(err instanceof Error ? err.message : err);
  console.log('='.repeat(60));
};

export const consoleInfo = () => {
  console.log(`${'='.repeat(27)} 信息 ${'='.repeat(27)}`);
  console.log(`地址: http://127.0.0.1:${config.port}`);
  if (config.openapiEnable) console.log(`文档: http://127.0.0.1:${config.port}/docs`);
  console.log(`项目: ${pkg.homepage}`);
  console.log(`版本: ${pkg.version} | 系统: ${os.platform()} | 架构: ${os.arch()}`);
  console.log('='.repeat(60));
};

export const consoleDonate = () => {
  const QR_PATTERN = [
    '███████████████████████████████',
    '█ ▄▄▄▄▄ █▀ █▀▀ █▀ ▀▄▄ █ ▄▄▄▄▄ █',
    '█ █   █ █▀ ▄ █▄▄▀▀▀▄ ▄█ █   █ █',
    '█ █▄▄▄█ █▀█ █▄▀██▀  ▄▀█ █▄▄▄█ █',
    '█▄▄▄▄▄▄▄█▄█▄█ ▀ ▀▄█▄█ █▄▄▄▄▄▄▄█',
    '█  ▄ ▄▀▄   ▄█▄▀▄ ▄ █ ▀ ▀ ▀▄█▄▀█',
    '█▀▄▄▀▄▀▄█  ▀ ▄▄▀▀▄█ ▀ ▀▄▄ ▀█▀██',
    '███▀▄▄█▄▄▀▄▀▄▀▀▀▄▀█▄ ▀▀▀▀▀▄▄█▀█',
    '█▀ █ ██▄▄ ▀▄█▀▄▀▄▄█ ▀▄▄▄▀█▄▄▀██',
    '█▀▀ █▄ ▄ ▀ ▄█▄▄ ▀▄▄ ▀▀█▀█▀▄ █▀█',
    '█ █▀█  ▄██▀  ▄▄▀▄▄▀ ▀▀ ██▀█▄▀██',
    '█▄████▄▄█  █▄ ▀ █▀▀▄▄ ▄▄▄ ▀   █',
    '█ ▄▄▄▄▄ █▄▄██ ▀▀ █ █▄ █▄█ ▄▄███',
    '█ █   █ █ ▀▀██▀▀▄██ ▀▄▄▄ ▄▀ ▄▄█',
    '█ █▄▄▄█ █  ▄█ ▄▀▄▄▀ ▀  ▄   ▄ ██',
    '█▄▄▄▄▄▄▄█▄▄▄████▄█▄█▄████▄▄▄███',
  ];

  console.log(`${'='.repeat(27)} 赞助 ${'='.repeat(27)}`);
  console.log(`${' '.repeat(13)}支付宝扫描如下二维码请作者喝杯咖啡`);
  QR_PATTERN.forEach((line) => console.log(`${' '.repeat(14)}${line}`));
  console.log('='.repeat(60));
};

export default {
  serverStartSuccess: consoleStartSuccess,
  serverStartFail: consoleStartFail,
  serverInfo: consoleInfo,
  donate: consoleDonate,
};
