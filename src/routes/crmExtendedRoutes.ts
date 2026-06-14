import { Router } from 'express';
import { authenticate, authorize } from '../middleware/authMiddleware';
import { auditMiddleware } from '../middleware/auditMiddleware';
import { campaignRateLimit, crmWriteRateLimit } from '../middleware/rateLimitMiddleware';
import { PERMISSIONS } from '../constants/permissions';
// TODO: Implementar crmExtendedController - Controlador pendiente de desarrollo
// import * as ctrl from '../controllers/crmExtendedController';

const router = Router();
router.use(authenticate);

// Endpoints pendientes de implementar - Controlador no disponible
// Comunicaciones
// router.post('/communications', authorize(PERMISSIONS.CRM_COMM_WRITE), crmWriteRateLimit, auditMiddleware('CRM_COMM_CREATE', 'Communication'), ctrl.postCommunication);
// router.get('/communications', authorize(PERMISSIONS.CRM_COMM_READ), ctrl.listCommunications);
// router.patch('/communications/:id/read', authorize(PERMISSIONS.CRM_COMM_READ), ctrl.patchCommRead);

// Tickets
// router.post('/tickets', authorize(PERMISSIONS.CRM_COMM_WRITE), crmWriteRateLimit, auditMiddleware('CRM_TICKET_CREATE', 'Ticket'), ctrl.postTicket);
// router.get('/tickets', authorize(PERMISSIONS.CRM_COMM_READ), ctrl.listTickets);
// router.patch('/tickets/:id', authorize(PERMISSIONS.CRM_COMM_WRITE), auditMiddleware('CRM_TICKET_UPDATE', 'Ticket'), ctrl.patchTicket);

// Cotizaciones
// router.post('/quotes', authorize(PERMISSIONS.CRM_QUOTES), crmWriteRateLimit, auditMiddleware('CRM_QUOTE_CREATE', 'Quote'), ctrl.postQuote);
// router.get('/quotes', authorize(PERMISSIONS.CRM_COMM_READ), ctrl.listQuotes);
// router.get('/quotes/:id', authorize(PERMISSIONS.CRM_COMM_READ), ctrl.getQuoteDetail);
// router.patch('/quotes/:id/status', authorize(PERMISSIONS.CRM_QUOTES), auditMiddleware('CRM_QUOTE_STATUS', 'Quote'), ctrl.patchQuoteStatus);
// router.post('/quotes/:id/delivery', authorize(PERMISSIONS.CRM_QUOTES), ctrl.postQuoteDelivery);
// router.get('/quotes/:id/whatsapp', authorize(PERMISSIONS.CRM_QUOTES), ctrl.getQuoteWhatsApp);
// router.get('/quotes/:id/pdf', authorize(PERMISSIONS.CRM_QUOTES), ctrl.getQuotePdf);

// Taller
// router.post('/workshop', authorize(PERMISSIONS.CRM_COMM_WRITE), crmWriteRateLimit, auditMiddleware('CRM_WORKSHOP_CREATE', 'WorkshopVisit'), ctrl.postWorkshopVisit);
// router.get('/workshop', authorize(PERMISSIONS.CRM_COMM_READ), ctrl.listWorkshopVisits);

// Campañas
// router.post('/campaigns', authorize(PERMISSIONS.CRM_CAMPAIGNS), campaignRateLimit, auditMiddleware('CRM_CAMPAIGN_LAUNCH', 'Campaign'), ctrl.postCampaign);

// Analítica
// router.get('/analytics/kpis', authorize(PERMISSIONS.CRM_ANALYTICS), ctrl.getCrmKpis);
// router.post('/analytics/rfm/:id', authorize(PERMISSIONS.CRM_ANALYTICS), ctrl.refreshCustomerRfm);

// Endpoint de estado para indicar que los endpoints están pendientes
router.get('/status', (req, res) => {
  res.json({ 
    success: true, 
    message: 'CRM Extended endpoints pendientes de implementar',
    endpoints: [
      'communications', 'tickets', 'quotes', 'workshop', 'campaigns', 'analytics'
    ]
  });
});

export default router;

