import * as dotenv from 'dotenv';
import type { LogLevel } from '@nestjs/common';

type ExtentedLogLevel = LogLevel | 'silent' | 'info';

dotenv.config();

const NODE_ENV = process.env.NODE_ENV ?? 'development';
const isTestENV = NODE_ENV === 'test';

function envOrThrow(key: string) {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function resolveMongoURL(): string {
  if (isTestENV) {
    return envOrThrow('MONGO_TEST_URL');
  }
  return envOrThrow('MONGO_URL');
}

function resolveLogLevel(): ExtentedLogLevel {
  if (isTestENV) {
    return 'silent';
  }

  const raw = (process.env.LOG_LEVEL ?? '').toLowerCase();
  const allowed: ExtentedLogLevel[] = [
    'silent',
    'error',
    'warn',
    'info',
    'debug',
    'verbose',
    'info',
  ];

  if (allowed.includes(raw as ExtentedLogLevel)) {
    return raw as ExtentedLogLevel;
  }

  return 'info';
}

export const AppConfig = {
  nodeEnv: NODE_ENV,
  mongoUrl: resolveMongoURL(),
  port: process.env.PORT || 3000,
  logLevel: resolveLogLevel(),
  performanceDebugger: process.env.PERFORMANCE_DEBUGGER === 'true',
};
