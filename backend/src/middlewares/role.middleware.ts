import { FastifyReply, FastifyRequest } from 'fastify';

export function requireRole(role: string) {
  // returns a preHandler for routes
  return async (request: FastifyRequest & any, reply: FastifyReply) => {
    const currentUser = request.currentUser;
    if (!currentUser) return reply.code(401).send({ error: 'Unauthorized' });

    // if your Prisma User model contains role: string use that
    if ((currentUser as any).role) {
      if ((currentUser as any).role !== role) {
        return reply.code(403).send({ error: 'Forbidden' });
      }
      return;
    }

    // fallback - allow admin if email listed in env ADMIN_EMAILS (comma separated)
    const adminList = (process.env.ADMIN_EMAILS || '').split(',').map(s => s.trim()).filter(Boolean);
    if (adminList.includes(currentUser.email) && role === 'ADMIN') return;

    return reply.code(403).send({ error: 'Forbidden' });
  };
}
