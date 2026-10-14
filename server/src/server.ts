import { createServer } from 'node:http';
import { Server } from 'socket.io';
import app from './app';
import { env } from './config/env';
import { connectDatabase } from './config/database';
import { seedProblems } from './services/problem.service';
import { registerRoomSocket } from './sockets/room.socket';

async function bootstrap() {
  // Connect to MongoDB Atlas (if configured)
  const connected = await connectDatabase();
  if (connected) {
    await seedProblems();
  }

  const httpServer = createServer(app);

  const io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (
          origin === env.CLIENT_URL ||
          origin.startsWith('http://localhost:') ||
          origin.startsWith('http://127.0.0.1:')
        ) {
          return callback(null, true);
        }
        return callback(null, true);
      },
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    registerRoomSocket(io, socket);
  });

  httpServer.listen(env.PORT, () => {
    console.log(`[Server] Collab Code running on http://localhost:${env.PORT}`);
    console.log(`[Server] Environment: ${env.NODE_ENV}`);
    console.log('[Server] Socket.IO ready for real-time collaboration');
  });
}

bootstrap().catch((err) => {
  console.error('[Server] Fatal startup error:', err);
  process.exit(1);
});
