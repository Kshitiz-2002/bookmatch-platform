import * as express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';

import { config } from './config/config.js';

import authRouter from './routes/v1/auth.routes.js';
import usersRouter from './routes/v1/users.routes.js';
import booksRouter from './routes/v1/books.routes.js';
import ratingsRouter from './routes/v1/ratings.routes.js';
import recsRouter from './routes/v1/recs.routes.js';

import { errorHandler } from './middleware/error.middleware.js';
import { notFoundHandler } from './middleware/not-found.middleware.js';

import { logger, stream } from './lib/logger.js';


const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(config.NODE_ENV === 'production' ? 'combined' : 'dev', { stream }));

// Health check
app.get('/api/v1/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// API Routes
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/users', usersRouter);
app.use('/api/v1/books', booksRouter);
app.use('/api/v1/ratings', ratingsRouter);
app.use('/api/v1/recs', recsRouter);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

export default app;