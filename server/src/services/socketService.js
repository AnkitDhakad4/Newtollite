import { Server } from 'socket.io';

let io = null;

export function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      credentials: true
    }
  });

  io.on('connection', (socket) => {
    console.log(`[Socket.io] Client connected: ${socket.id}`);

    socket.on('disconnect', () => {
      console.log(`[Socket.io] Client disconnected: ${socket.id}`);
    });
  });

  console.log('[Socket.io] Real-time engine initialized.');
  return io;
}

export function getIO() {
  return io;
}

export function broadcastEvent(event, payload) {
  if (io) {
    io.emit(event, payload);
    console.log(`[Socket.io] Broadcast [${event}]:`, payload?.itemNumber || payload?.title || payload);
  }
}

export default {
  initSocket,
  getIO,
  broadcastEvent
};

