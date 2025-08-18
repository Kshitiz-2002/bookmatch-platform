import { FastifyInstance } from 'fastify';
import { registerHandler, loginHandler, refreshHandler, logoutHandler  } from '../controllers/auth.controller';

export default async function authRoutes(app: FastifyInstance) {
  app.post('/auth/register', registerHandler);
  app.post('/auth/login', loginHandler);
  app.post('/auth/refresh', refreshHandler);
  app.post('/auth/logout', logoutHandler);
}
