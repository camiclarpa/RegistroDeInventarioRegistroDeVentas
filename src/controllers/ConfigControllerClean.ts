import { Request, Response } from 'express';
import { container } from '../infrastructure/config/di-container';
import { ConfigService } from '../core/application/services/ConfigService';

const configService = container.resolve(ConfigService);

export const getConfig = async (_req: Request, res: Response) => {
  try {
    const config = await configService.getConfig();
    res.json({ success: true, data: config });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
};

export const updateConfig = async (req: Request, res: Response) => {
  try {
    const config = await configService.updateConfig(req.body);
    res.json({ success: true, data: config });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
};
