// backend/src/routes/users.routes.ts
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { updateMeHandler, deleteMeHandler } from '../controllers/users.controller';
import { meHandler } from '../controllers/auth.controller';
import {
  addToLibraryHandler,
  listLibraryHandler,
  removeFromLibraryHandler,
  updateLibraryHandler
} from '../controllers/library.controller';
import { prisma } from '../lib/db';

export default async function usersRoutes(app: FastifyInstance) {
  // GET /users/me  (protected)
  app.get(
    '/users/me',
    {
      preHandler: async (req: FastifyRequest, reply: FastifyReply) => {
        try {
          await (req as any).jwtVerify();
        } catch (err) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }
      }
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      // use the existing auth controller meHandler if present
      // it expects request.user to be populated by jwtVerify
      return meHandler(req, reply);
    }
  );

  // PUT /users/me  (update profile) - uses controller
  app.put(
    '/users/me',
    {
      preHandler: async (req: FastifyRequest, reply: FastifyReply) => {
        try {
          await (req as any).jwtVerify();
        } catch {
          return reply.code(401).send({ error: 'Unauthorized' });
        }
      }
    },
    updateMeHandler
  );

  // DELETE /users/me  (delete account) - uses controller
  app.delete(
    '/users/me',
    {
      preHandler: async (req: FastifyRequest, reply: FastifyReply) => {
        try {
          await (req as any).jwtVerify();
        } catch {
          return reply.code(401).send({ error: 'Unauthorized' });
        }
      }
    },
    deleteMeHandler
  );

  // Admin: GET /users  (list all users)
  app.get(
    '/users',
    {
      preHandler: async (req: FastifyRequest, reply: FastifyReply) => {
        try {
          await (req as any).jwtVerify();
        } catch {
          return reply.code(401).send({ error: 'Unauthorized' });
        }
        const payload: any = (req as any).user;
        const admin = await prisma.user.findUnique({ where: { id: Number(payload.userId) }});
        if (!admin || admin.role !== 'ADMIN') return reply.code(403).send({ error: 'Forbidden' });
      }
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const limit = Math.min(Number((req.query as any)?.limit ?? 100), 1000);
      const offset = Number((req.query as any)?.offset ?? 0);
      const users = await prisma.user.findMany({
        skip: offset,
        take: limit,
        select: { id: true, email: true, name: true, createdAt: true, role: true }
      });
      return reply.send({ users });
    }
  );

  // Admin: GET /users/:id
  app.get(
    '/users/:id',
    {
      preHandler: async (req: FastifyRequest, reply: FastifyReply) => {
        try {
          await (req as any).jwtVerify();
        } catch {
          return reply.code(401).send({ error: 'Unauthorized' });
        }
        const payload: any = (req as any).user;
        const admin = await prisma.user.findUnique({ where: { id: Number(payload.userId) }});
        if (!admin || admin.role !== 'ADMIN') return reply.code(403).send({ error: 'Forbidden' });
      }
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const id = Number((req.params as any).id);
      const user = await prisma.user.findUnique({ where: { id }, select: { id: true, email: true, name: true, createdAt: true, role: true }});
      if (!user) return reply.code(404).send({ error: 'Not found' });
      return reply.send({ user });
    }
  );
  
  // library endpoints
  app.post('/users/me/library', { preHandler: [async (req, reply) => { try { await (req as any).jwtVerify(); } catch (e) { return reply.code(401).send({ error: 'Unauthorized' }); } }] }, addToLibraryHandler);
  app.get('/users/me/library', { preHandler: [async (req, reply) => { try { await (req as any).jwtVerify(); } catch (e) { return reply.code(401).send({ error: 'Unauthorized' }); } }] }, listLibraryHandler);
  app.delete('/users/me/library/:bookId', { preHandler: [async (req, reply) => { try { await (req as any).jwtVerify(); } catch (e) { return reply.code(401).send({ error: 'Unauthorized' }); } }] }, removeFromLibraryHandler);
  app.put('/users/me/library/:bookId', {
  preHandler: async (req, reply) => { try { await (req as any).jwtVerify(); } catch (e) { return reply.code(401).send({ error: 'Unauthorized' }); } }
}, updateLibraryHandler);

}
