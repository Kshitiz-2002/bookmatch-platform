import { FastifyReply, FastifyRequest } from 'fastify';
import { ZodSchema } from 'zod';

export function validateBody(schema: ZodSchema<any>) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // will throw if invalid
      const parsed = schema.parse(request.body);
      // replace body with parsed (useful for e.g. defaults)
      (request as any).body = parsed;
    } catch (err: any) {
      return reply.code(400).send({ error: 'Invalid request body', details: err.errors ?? err.message });
    }
  };
}
