import { Request, Response } from 'express';
import * as settingsService from '../services/settingsService';
import { logger } from '../config/logger';
import { ok, fail, handleError } from '../utils/http';

/**
 * GET /api/v1/settings/business
 * Obtiene la configuración actual del negocio
 */
export async function getBusinessSettings(req: Request, res: Response) {
  try {
    logger.info('[settingsController] getBusinessSettings');
    
    const settings = await settingsService.getBusinessSettings();
    
    return ok(res, {
      settings: settings || {
        businessName: 'Mi Negocio',
        nit: '',
        address: '',
        phone: '',
        email: '',
        defaultIva: 19,
        dianResolution: '',
        dianResolutionDate: null,
        ticketFooter: 'Gracias por su compra',
        invoicePrefix: 'FAC',
        logoPath: null,
      },
    });
  } catch (err) {
    logger.error('[settingsController] getBusinessSettings', { err });
    return handleError(res, err, 'getBusinessSettings');
  }
}

/**
 * PUT /api/v1/settings/business
 * Actualiza la configuración del negocio
 */
export async function updateBusinessSettings(req: Request, res: Response) {
  try {
    logger.info('[settingsController] updateBusinessSettings', { body: req.body });
    
    const data = req.body;
    
    // Validaciones básicas
    if (data.defaultIva !== undefined) {
      const iva = Number(data.defaultIva);
      if (iva < 0 || iva > 100) {
        return fail(res, 'El IVA debe estar entre 0 y 100', 400);
      }
    }
    
    if (data.email !== undefined && data.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(data.email)) {
        return fail(res, 'Formato de email inválido', 400);
      }
    }
    
    const updated = await settingsService.updateBusinessSettings(data);
    
    return ok(res, {
      message: 'Configuración actualizada correctamente',
      settings: updated,
    });
  } catch (err) {
    logger.error('[settingsController] updateBusinessSettings', { err });
    return handleError(res, err, 'updateBusinessSettings');
  }
}

/**
 * POST /api/v1/settings/logo
 * Actualiza la ruta del logo
 */
export async function updateLogo(req: Request, res: Response) {
  try {
    logger.info('[settingsController] updateLogo', { body: req.body });
    
    const { logoPath } = req.body;
    
    if (!logoPath) {
      return fail(res, 'logoPath es requerido', 400);
    }
    
    const updated = await settingsService.updateLogo(logoPath);
    
    return ok(res, {
      message: 'Logo actualizado correctamente',
      logoPath: updated.logoPath,
    });
  } catch (err) {
    logger.error('[settingsController] updateLogo', { err });
    return handleError(res, err, 'updateLogo');
  }
}
