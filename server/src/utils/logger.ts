import winston from 'winston';
import { env } from '../config/env';

const { combine, timestamp, printf, colorize, errors } = winston.format;

const logFormat = printf(({ level, message, timestamp, stack }) => {
  return `${timestamp} [${level}]: ${stack || message}`;
});

export const logger = winston.createLogger({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }),
    logFormat
  ),
  transports: [
    new winston.transports.Console({
      format: combine(colorize(), logFormat),
    }),
  ],
});

// HTTP request logger
export const httpLogger = (req: { method: string; url: string }, res: { statusCode: number }, time: number) => {
  const level = res.statusCode >= 400 ? 'warn' : 'info';
  logger.log(level, `${req.method} ${req.url} ${res.statusCode} - ${time}ms`);
};
