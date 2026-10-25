import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';

let io: Server | null = null;

export const initSocket = (server: HttpServer): Server => {
  io = new Server(server, {
    cors: {
      origin: [
        'http://localhost:5173',
        'http://localhost:5174',
        'http://localhost:5175',
      ],
      credentials: true,
    },
  });

  io.on('connection', (socket: Socket) => {
    // Client joins their personal user room, e.g. "user:60c72b2f9b1d8b2bad000001"
    socket.on('join_user_room', (userId: string) => {
      if (userId) {
        socket.join(`user:${userId}`);
      }
    });

    socket.on('disconnect', () => {
      // Disconnected
    });
  });

  return io;
};

export const getIO = (): Server | null => {
  return io;
};

/**
 * Emit a real-time notification event to a specific user's room
 */
export const emitNotificationToUser = (userId: string, notification: any) => {
  if (io && userId) {
    io.to(`user:${userId.toString()}`).emit('notification', notification);
  }
};

/**
 * Emit real-time broadcast event to all connected clients (e.g. complaints updated, departments updated)
 */
export const emitAnalyticsUpdate = (eventType: string, data?: any) => {
  if (io) {
    io.emit('analytics_update', { eventType, data, timestamp: new Date() });
    io.emit(eventType, data);
  }
};
