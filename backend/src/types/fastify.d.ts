import 'fastify';
import '@fastify/jwt';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: any;
    saveMultipartFile?: (file: any, destFilename: string) => Promise<string>;
  }

  interface FastifyRequest {
    currentUser?: {
      id: number;
      email: string;
      name?: string;
      createdAt?: Date;
      role?: string;
    };
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { userId: number };
    user: { userId: number };
  }
}
