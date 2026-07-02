import os from 'node:os';

import { config } from '@/config';

import { WEBSITE_URL, APP_VERSION } from './appInfo';
import { log as logger } from './logger';

export const loggerStartSuccess = () => {
  logger.raw(`${'='.repeat(23)} 服务启动成功 ${'='.repeat(23)}`);
};

export const loggerStartFail = (err: any) => {
  logger.raw(`${'='.repeat(23)} 服务启动失败 ${'='.repeat(23)}`);
  logger.raw(err instanceof Error ? (err.stack ?? err.message) : err);
  logger.raw('='.repeat(60));
};

export const loggerInfo = () => {
  logger.raw(`${'='.repeat(27)} 信息 ${'='.repeat(27)}`);
  logger.raw(`地址: http://127.0.0.1:${config.server.port}`);
  if (config.server.openapiEnable) logger.raw(`文档: http://127.0.0.1:${config.server.port}/docs`);
  logger.raw(`项目: ${WEBSITE_URL}`);
  logger.raw(`版本: ${APP_VERSION} | 系统: ${os.platform()} | 架构: ${os.arch()}`);
  logger.raw('='.repeat(60));
};

export const loggerDonate = () => {
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

  logger.raw(`${'='.repeat(27)} 赞助 ${'='.repeat(27)}`);
  logger.raw(`${' '.repeat(13)}支付宝扫描如下二维码请作者喝杯咖啡`);
  QR_PATTERN.forEach((line) => logger.raw(`${' '.repeat(14)}${line}`));
  logger.raw('='.repeat(60));
};

export default {
  serverStartSuccess: loggerStartSuccess,
  serverStartFail: loggerStartFail,
  serverInfo: loggerInfo,
  donate: loggerDonate,
};
