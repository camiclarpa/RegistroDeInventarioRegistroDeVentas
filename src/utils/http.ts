import { Response } from 'express';

export const ok = (res: Response, data: any, status = 200) => 
  res.status(status).json({ success: true, data });

export const fail = (res: Response, error: string, status = 400, details?: any) => 
  res.status(status).json({ success: false, error, ...(details && { details }) });

export const handleError = (res: Response, err: any, context: string) => {
  console.error(`[ErrorHandler] ${context}`, { err });
  
  if (err?.name === 'ZodError') {
    return fail(res, 'Datos inválidos', 422, err.errors);
  }
  if (err?.code === 'P2002') {
    return fail(res, 'Registro duplicado', 409);
  }
  if (err?.code === 'P2025') {
    return fail(res, 'Registro no encontrado', 404);
  }
  return fail(res, err?.message || 'Error interno', 500);
};
