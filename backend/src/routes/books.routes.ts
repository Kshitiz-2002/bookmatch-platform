import { FastifyInstance } from 'fastify';
import {
  createBookHandler,
  getBookHandler,
  listBooksHandler,
  updateBookHandler,
  deleteBookHandler,
  rateBookHandler,
  listGenresHandler,
  uploadCoverHandler,
  listRatingsHandler,
  downloadBookHandler,
  replaceFileHandler   
} from '../controllers/books.controller';

export default async function booksRoutes(app: FastifyInstance) {
  // public listing/search (supports ?q= & ?genre= & ?publicOnly=true & limit/offset)
  app.get('/books', listBooksHandler);

  // get single book (if private must be owner or admin)
  app.get('/books/:id', getBookHandler);

  // create book (multipart upload) - requires JWT
  app.post('/books', { preHandler: [async (req, reply) => { try { await (req as any).jwtVerify(); } catch (e){ reply.code(401).send({error:'Unauthorized'}) } }] }, createBookHandler);

  // update book metadata (owner or admin)
  app.put('/books/:id', { preHandler: [async (req, reply) => { try { await (req as any).jwtVerify(); } catch (e){ reply.code(401).send({error:'Unauthorized'}) } }] }, updateBookHandler);

  // delete book (owner or admin)
  app.delete('/books/:id', { preHandler: [async (req, reply) => { try { await (req as any).jwtVerify(); } catch (e){ reply.code(401).send({error:'Unauthorized'}) } }] }, deleteBookHandler);

  // rating
  app.post('/books/:id/rate', { preHandler: [async (req, reply) => { try { await (req as any).jwtVerify(); } catch (e){ reply.code(401).send({error:'Unauthorized'}) } }] }, rateBookHandler);

  // list genres
  app.get('/genres', listGenresHandler);

  // download endpoint
  app.get('/books/:id/download', downloadBookHandler);
  
  // list ratings for a book (public)
  app.get('/books/:id/ratings', listRatingsHandler);

  // replace file (owner or admin)
  app.post('/books/:id/replace-file', { preHandler: [ async (r, rp) => { try{ await (r as any).jwtVerify(); } catch { rp.code(401).send({error:'Unauthorized'}) } }] }, replaceFileHandler);
  
  // upload cover image (owner or admin)
  app.post('/books/:id/cover', { preHandler: [ async (r, rp) => { try{ await (r as any).jwtVerify(); } catch { rp.code(401).send({error:'Unauthorized'}) } }] }, uploadCoverHandler);

}

