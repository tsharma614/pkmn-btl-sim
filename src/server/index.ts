/**
 * HTTP + Socket.io entry point.
 * Starts the battle server on port 3000.
 */

import { createServer } from 'http';
import { Server } from 'socket.io';
import { RoomManager } from './room-manager';
import { DisconnectTracker } from './disconnect-tracker';
import { registerSocketHandlers } from './socket-handlers';
import { ClientToServerEvents, ServerToClientEvents } from './types';

const PORT = parseInt(process.env.PORT || '3000', 10);

const httpServer = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      rooms: roomManager.roomCount,
      sockets: roomManager.socketCount,
      uptime: process.uptime(),
    }));
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('PBS Battle Server');
});

const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  transports: ['websocket'],     // skip polling — React Native can't upgrade cleanly
  perMessageDeflate: false,       // compression causes transport errors in RN
  pingInterval: 30000,            // relaxed pings — avoids false disconnects on busy JS thread
  pingTimeout: 120000,            // very generous timeout — user prefers slow disconnect detection
});

const roomManager = new RoomManager();
const disconnectTracker = new DisconnectTracker();

registerSocketHandlers(io, roomManager, disconnectTracker);

// Clean up finished rooms every 5 minutes
setInterval(() => {
  const cleaned = roomManager.cleanup();
  if (cleaned > 0) {
    console.log(`[cleanup] Removed ${cleaned} finished rooms`);
  }
}, 5 * 60 * 1000);

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`PBS Battle Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

export { io, roomManager, disconnectTracker, httpServer };
