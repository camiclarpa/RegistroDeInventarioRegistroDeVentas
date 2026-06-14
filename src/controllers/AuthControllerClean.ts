import { Request, Response } from 'express';
import { container } from '../infrastructure/config/di-container';
import { AuthService } from '../core/application/services/AuthService';

const authService = container.resolve(AuthService);

export const AuthController = {
  async login(req: Request, res: Response): Promise<Response> {
    try {
      const { email, password } = req.body;
      const result = await authService.login({ email, password });
      return res.json({ success: true, data: result });
    } catch (error) {
      return res.status(401).json({ 
        success: false, 
        error: (error as Error).message 
      });
    }
  },

  async verify(req: Request, res: Response): Promise<Response> {
    try {
      const token = req.headers.authorization?.split(' ')[1];
      if (!token) {
        return res.status(401).json({ success: false, error: 'Token no proporcionado' });
      }
      const decoded = await authService.validateToken(token);
      return res.json({ success: true, data: decoded });
    } catch (error) {
      return res.status(401).json({ success: false, error: (error as Error).message });
    }
  }
};
