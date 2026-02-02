import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { logger } from '../utils/logger';
import { env } from '../config/env';

let io: Server;

export function initializeWebSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: env.CORS_ORIGIN,
      methods: ['GET', 'POST'],
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  io.on('connection', (socket: Socket) => {
    logger.info(`WebSocket connected: ${socket.id}`);

    // Join session room
    socket.on('subscribe:session', (sessionId: string) => {
      socket.join(`session:${sessionId}`);
      logger.debug(`Socket ${socket.id} joined session:${sessionId}`);
    });

    // Leave session room
    socket.on('unsubscribe:session', (sessionId: string) => {
      socket.leave(`session:${sessionId}`);
      logger.debug(`Socket ${socket.id} left session:${sessionId}`);
    });

    // Handle disconnect
    socket.on('disconnect', (reason) => {
      logger.info(`WebSocket disconnected: ${socket.id} (${reason})`);
    });

    // Handle errors
    socket.on('error', (error) => {
      logger.error(`WebSocket error: ${error.message}`);
    });
  });

  logger.info('WebSocket server initialized');
  return io;
}

export function getIO(): Server {
  if (!io) {
    throw new Error('WebSocket not initialized');
  }
  return io;
}

// Emit events to session room
export const wsEmit = {
  sessionUpdated: (sessionId: string, data: unknown) => {
    getIO().to(`session:${sessionId}`).emit('session:updated', data);
  },

  sessionActivated: (sessionId: string, data: unknown) => {
    getIO().to(`session:${sessionId}`).emit('session:activated', data);
  },

  sessionClosed: (sessionId: string, data: unknown) => {
    getIO().to(`session:${sessionId}`).emit('session:closed', data);
  },

  actionConfirmed: (sessionId: string, data: unknown) => {
    getIO().to(`session:${sessionId}`).emit('action:confirmed', data);
  },

  actionSettled: (sessionId: string, data: unknown) => {
    getIO().to(`session:${sessionId}`).emit('action:settled', data);
  },

  balanceUpdated: (sessionId: string, remaining: string, spent: string) => {
    getIO().to(`session:${sessionId}`).emit('balance:updated', {
      sessionId,
      remaining,
      spent,
    });
  },

  settlementCommitted: (sessionId: string, batchId: string, txHash: string) => {
    getIO().to(`session:${sessionId}`).emit('settlement:committed', {
      batchId,
      txHash,
    });
  },

  settlementRevealed: (sessionId: string, batchId: string, txHash: string) => {
    getIO().to(`session:${sessionId}`).emit('settlement:revealed', {
      batchId,
      txHash,
    });
  },

  settlementComplete: (sessionId: string, batchId: string, settledCount: number) => {
    getIO().to(`session:${sessionId}`).emit('settlement:complete', {
      batchId,
      settledCount,
    });
  },

  payoutProcessing: (sessionId: string, payoutId: string) => {
    getIO().to(`session:${sessionId}`).emit('payout:processing', { payoutId });
  },

  payoutComplete: (sessionId: string, payoutId: string, txHashes: string[]) => {
    getIO().to(`session:${sessionId}`).emit('payout:complete', {
      payoutId,
      txHashes,
    });
  },

  error: (sessionId: string, code: string, message: string) => {
    getIO().to(`session:${sessionId}`).emit('error', { code, message });
  },
};
