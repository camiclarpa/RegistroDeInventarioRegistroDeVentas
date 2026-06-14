import { Router } from 'express';
import { authenticate, authorize } from '../middleware/authMiddleware';
import * as crmController from '../controllers/crmController';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

// Clientes
router.get('/customers/search', authorize('finance.read'), crmController.searchCustomers);
router.get('/customers', authorize('finance.read'), crmController.listCustomers);
router.get('/customers/:id', authorize('finance.read'), crmController.getCustomerDetail);
router.post('/customers', authorize('finance.write'), crmController.createCustomer);
router.patch('/customers/:id', authorize('finance.write'), crmController.patchCustomer);
router.patch('/customers/:id/credit-limit', authorize('finance.write'), crmController.setCreditLimit);

// Motos del cliente
router.post('/customers/:id/motorcycles', authorize('finance.write'), crmController.postMotorcycle);
router.patch('/motorcycles/:id', authorize('finance.write'), crmController.patchMotorcycle);

// Garantías del cliente
router.get('/customers/:id/warranties', authorize('finance.read'), crmController.getWarranties);
router.patch('/warranties/:id/claim', authorize('finance.write'), crmController.claimWarranty);

// Créditos/Fiados
router.get('/customers/:id/credits', authorize('finance.read'), crmController.getCredits);
router.get('/customers/:id/check-limit', authorize('finance.read'), crmController.checkLimit);
router.post('/credits', authorize('finance.write'), crmController.postCredit);
router.patch('/credits/:id/pay', authorize('finance.write'), crmController.payCreditInstallment);

// Comunicaciones
router.post('/communication', authorize('finance.write'), crmController.postCommunication);

// Recordatorios
router.post('/customers/:id/reminders', authorize('finance.write'), crmController.postReminder);

// Fidelización
router.post('/customers/:id/loyalty', authorize('finance.write'), crmController.addLoyaltyPoints);


// Analytics / RFM
//router.get('/analytics/kpis', authorize('finance.read'), crmController.getRfmAnalytics);
//router.get('/analytics/rfm/refresh', authorize('finance.write'), crmController.refreshAllCustomersRfm);
//router.get('/customers/:id/rfm', authorize('finance.read'), crmController.getCustomerRfm);


// ═══════════════════════════════════════════════════════════════════════════
// COMUNICACIONES
// ═══════════════════════════════════════════════════════════════════════════
//router.get('/communications', authorize('finance.read'), crmController.listCommunicationsHandler);
//router.post('/communications', authorize('finance.write'), crmController.createCommunicationHandler);
//router.patch('/communications/:id/read', authorize('finance.write'), crmController.markCommunicationReadHandler);

// ═══════════════════════════════════════════════════════════════════════════
// TICKETS
// ═══════════════════════════════════════════════════════════════════════════
//router.get('/tickets', authorize('finance.read'), crmController.listTicketsHandler);
//router.post('/tickets', authorize('finance.write'), crmController.createTicketHandler);
//router.get('/tickets/:id', authorize('finance.read'), crmController.getTicketHandler);
//router.patch('/tickets/:id', authorize('finance.write'), crmController.updateTicketHandler);

// ═══════════════════════════════════════════════════════════════════════════
// COTIZACIONES
// ═══════════════════════════════════════════════════════════════════════════
//router.get('/quotes', authorize('finance.read'), crmController.listQuotesHandler);
//router.post('/quotes', authorize('finance.write'), crmController.createQuoteHandler);
//router.get('/quotes/:id', authorize('finance.read'), crmController.getQuoteHandler);
//router.patch('/quotes/:id', authorize('finance.write'), crmController.updateQuoteHandler);
//router.delete('/quotes/:id', authorize('finance.write'), crmController.deleteQuoteHandler);

// ═══════════════════════════════════════════════════════════════════════════
// TALLER (WORKSHOP)
// ═══════════════════════════════════════════════════════════════════════════
//router.get('/workshop', authorize('finance.read'), crmController.listWorkshopVisitsHandler);
//router.post('/workshop', authorize('finance.write'), crmController.createWorkshopVisitHandler);
//router.get('/workshop/summary/:customerId', authorize('finance.read'), crmController.getWorkshopVisitHandler);

export default router;
