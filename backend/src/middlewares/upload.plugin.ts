// backend/src/middlewares/upload.plugin.ts
import { FastifyPluginAsync } from 'fastify';
import fastifyMultipart from 'fastify-multipart';
import fs from 'fs';
import path from 'path';

const uploadPlugin: FastifyPluginAsync = async (app) => {
  // register the multipart plugin compatible with Fastify v4
  await app.register(fastifyMultipart, {
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB
  });

  // helper to save uploaded file to disk
  app.decorate('saveMultipartFile', async (file: any, destFilename: string) => {
    const uploadDir = process.env.UPLOAD_DIR || './uploads';
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

    const filepath = path.join(uploadDir, destFilename);
    const ws = fs.createWriteStream(filepath);

    // file is a readable stream (fastify-multipart)
    await new Promise<void>((resolve, reject) => {
      file.pipe(ws);
      file.on('end', () => resolve());
      file.on('error', (err: Error) => reject(err));
      ws.on('error', (err) => reject(err));
    });

    return filepath;
  });
};

export default uploadPlugin;
