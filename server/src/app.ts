import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env';
import routes from './routes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { apiLimiter } from './middleware/rateLimit';
import { logger } from './utils/logger';

export function createApp(): Express {
  const app = express();

  // Security middleware
  app.use(helmet());

  // CORS
  app.use(cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
  }));

  // Body parsing
  app.use(express.json({ limit: '10kb' }));
  app.use(express.urlencoded({ extended: true, limit: '10kb' }));

  // Rate limiting
  app.use('/api', apiLimiter);

  // Request logging
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      const level = res.statusCode >= 400 ? 'warn' : 'debug';
      logger.log(level, `${req.method} ${req.path} ${res.statusCode} - ${duration}ms`);
    });
    next();
  });

  // API routes
  app.use('/api/v1', routes);

  // Health check at root
  app.get('/', (req, res) => {
    res.json({
      name: 'thunderFi API',
      version: '0.1.0',
      status: 'running',
    });
  });

  // 404 handler
  app.use(notFoundHandler);

  // Error handler
  app.use(errorHandler);

  return app;
}
