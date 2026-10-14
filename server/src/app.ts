import express from 'express';
import cors from 'cors';
import { env } from './config/env';
import healthRoutes from './routes/health.routes';
import authRoutes from './routes/auth.routes';
import roomRoutes from './routes/room.routes';
import problemRoutes from './routes/problem.routes';
import executionRoutes from './routes/execution.routes';
import { requestLogger } from './middleware/requestLogger';
import { notFound } from './middleware/notFound';
import { errorHandler } from './middleware/errorHandler';

const app = express();

app.use(
  cors({
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
    credentials: true,
  })
);

app.use(express.json({ limit: '1mb' }));
app.use(requestLogger);

app.get('/', (_req, res) => {
  res.status(200).json({
    name: 'Collab Code API',
    status: 'running',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      auth: '/api/auth',
      rooms: '/api/rooms',
      problems: '/api/problems',
      execution: '/api/execution',
    },
  });
});

app.use('/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/problems', problemRoutes);
app.use('/api/execution', executionRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
