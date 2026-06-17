import { config } from '@/config';

import { isJson } from './validate';

type LogLevel = 'silly' | 'debug' | 'info' | 'warn' | 'error';
type ConsoleMethod = 'log' | 'debug' | 'info' | 'warn' | 'error';

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  silly: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
};

const CONSOLE_MAP: Record<LogLevel, ConsoleMethod> = {
  silly: 'log',
  debug: 'debug',
  info: 'info',
  warn: 'warn',
  error: 'error',
};

class Logger {
  private static instance: Logger;

  private currentLevel: LogLevel;
  private context?: string;

  constructor(level?: LogLevel, context?: string) {
    this.currentLevel = level ?? 'info';
    this.context = context;
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger(config.logLevel);
    }
    return Logger.instance;
  }

  private shouldLog(level: LogLevel): boolean {
    const current = LEVEL_WEIGHT[this.currentLevel] ?? LEVEL_WEIGHT.info;
    return LEVEL_WEIGHT[level] >= current;
  }

  private getTime() {
    const d = new Date();

    return (
      String(d.getHours()).padStart(2, '0') +
      ':' +
      String(d.getMinutes()).padStart(2, '0') +
      ':' +
      String(d.getSeconds()).padStart(2, '0') +
      '.' +
      String(d.getMilliseconds()).padStart(3, '0')
    );
  }

  private formatArg(arg: any) {
    if (arg instanceof Error) {
      return arg.stack || arg.message;
    }

    if (isJson(arg)) {
      try {
        return JSON.stringify(arg, null, 2);
      } catch {
        return '[Circular/Object]';
      }
    }

    return arg;
  }

  private print(level: LogLevel, args: any[]) {
    if (!this.shouldLog(level)) return;

    const method = CONSOLE_MAP[level];

    const msg = [
      this.getTime(),
      `[${level.toUpperCase()}]`,
      ...(this.context ? [`[${this.context}]`] : []),
      ...args.map((arg) => this.formatArg(arg)),
    ];
    console[method](...msg);
  }

  public debug(...args: any[]) {
    this.print('debug', args);
  }

  public silly(...args: any[]) {
    this.print('silly', args);
  }

  public info(...args: any[]) {
    this.print('info', args);
  }

  public warn(...args: any[]) {
    this.print('warn', args);
  }

  public error(...args: any[]) {
    this.print('error', args);
  }

  public raw(...args: any[]) {
    console.log(...args);
  }

  public withContext(module: string) {
    const newLogger = Object.create(this);

    newLogger.context = module;

    return newLogger;
  }
}

export const log = Logger.getInstance();
