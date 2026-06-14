import { Request, Response, NextFunction } from "express";
import { prisma } from "../config/prisma";

export function auditMiddleware(action: string, entity: string) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    const userId = (req as any).user?.id ?? "anonymous";
    const entityId = req.params.id ? (Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) : null;
    try {
      await prisma.system_audits.create({
        data: {
          user_id: userId,
          action,
          entity,
          entity_id: entityId,
          metadata: { method: req.method, path: req.path }
        } as any
      });
    } catch (e) { /* ignore audit errors */ }
    next();
  };
}

