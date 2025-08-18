import { FastifyPluginAsync } from 'fastify';

const errorPlugin: FastifyPluginAsync = async (app) => {
  app.setErrorHandler((error, request, reply) => {
    // log server errors
    app.log.error(error);

    // handle validation / zod errors specially
    if ((error as any)?.validation) {
      return reply.status(400).send({ error: 'Validation error', details: (error as any).validation });
    }

    // Prisma known errors can be handled here (example)
    const name = (error as any).name;
    if (name === 'NotFoundError') {
      return reply.status(404).send({ error: (error as any).message });
    }

    // default internal server error
    const status = (error as any).statusCode || 500;
    reply.status(status).send({ error: error.message || 'Internal Server Error' });
  });
};

export default errorPlugin;
