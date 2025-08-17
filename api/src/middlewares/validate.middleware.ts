import { ZodObject } from "zod";
import { Request, Response, NextFunction } from "express";

/**
 * Attach `validated` object to request containing parsed { body, query, params }.
 * Use zod schemas shaped like:
 * z.object({ body: z.object({...}), query: z.object({...}), params: z.object({...}) })
 */
export const validate =
  (schema: ZodObject) => (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = schema.parse({
        body: req.body,
        query: req.query,
        params: req.params
      });
      (req as any).validated = parsed;
      return next();
    } catch (error: any) {
      return res.status(400).json({ error: "Validation error", issues: error.errors ?? error });
    }
  };
