import { createServer } from 'http';
import { createApp } from './app';
import { env } from './config/env';
import { initializeWebSocket } from './websocket';
import { logger } from './utils/logger';
import { circleService, arcService, gatewayService } from './services/circle';

async function main() {
  try {
    // Initialize Circle Developer-Controlled Wallets SDK
    await circleService.initialize();

    // Initialize Arc blockchain provider
    arcService.initialize();

    // Initialize Circle Gateway (CCTP)
    gatewayService.initialize();

    // Create Express app
    const app = createApp();

    // Create HTTP server
    const httpServer = createServer(app);

    // Initialize WebSocket
    initializeWebSocket(httpServer);

    // Start server
    httpServer.listen(env.PORT, () => {
      logger.info(`
  ⚡ thunderFi Server running!

  🌐 HTTP:      http://localhost:${env.PORT}
  🔌 WebSocket: ws://localhost:${env.PORT}
  📚 API:       http://localhost:${env.PORT}/api/v1
  💾 Storage:   In-memory (MVP mode)

  Environment: ${env.NODE_ENV}
      `);
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`${signal} received, shutting down gracefully...`);

      httpServer.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });

      // Force close after 10 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

main();
