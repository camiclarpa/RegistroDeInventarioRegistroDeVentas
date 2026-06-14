import type { Request, Response, NextFunction } from 'express'

// Stub para desarrollo - permite todas las requests
export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  // En producción, aquí iría la validación real del token JWT
  next()
}

export const authorize = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // En producción, verificar req.user.role contra roles permitidos
    next()
  }
}
