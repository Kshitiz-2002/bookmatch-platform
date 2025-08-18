import { FastifyPluginAsync } from 'fastify';

const authenticate: FastifyPluginAsync = async (app) => {
  // ensure fastify-jwt is registered in app (we did in app.ts earlier)
  app.decorate('authenticate', async (request: any, reply: any) => {
    try {
      await request.jwtVerify(); // will throw if invalid
    } catch (err: any) {
      reply.code(401).send({ error: 'Unauthorized', message: err?.message ?? err });
    }
  });
};

export default authenticate;
