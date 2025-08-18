import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../lib/db';

const authPlugin: FastifyPluginAsync = async (app) => {
  // decorate request types in our types file (fastify.d.ts)
  app.decorateRequest('currentUser', null);

  // add authenticate decorator to instance for easy route preHandler usage
  app.decorate('authenticate', async (request: any, reply: any) => {
    try {
      // verifies JWT and populates request.user (fastify-jwt)
      await request.jwtVerify();
    } catch (err) {
      return reply.code(401).send({ error: 'Unauthorized', message: (err as Error).message });
    }

    // request.user will contain { userId: ... } because we signed like that
    const payload: any = request.user;
    if (!payload?.userId) {
      return reply.code(401).send({ error: 'Invalid token payload' });
    }

    // fetch user from DB and attach sanitized user to request.currentUser
    const user = await prisma.user.findUnique({
      where: { id: Number(payload.userId) },
      select: { id: true, email: true, name: true /* add role if exists */ , createdAt: true }
    });

    if (!user) return reply.code(401).send({ error: 'User not found' });
    request.currentUser = user;
  });
};

export default authPlugin;
