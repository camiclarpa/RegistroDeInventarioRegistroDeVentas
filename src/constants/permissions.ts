export const PERMISSIONS = {
  // ... permisos existentes 
  INVENTORY_READ: "inventory.read",
  INVENTORY_WRITE: "inventory.write",
  SALES_READ: "sales.read",
  SALES_WRITE: "sales.write",
  SALES_ADMIN: "sales.admin",
  PURCHASES_READ: "purchases.read",
  PURCHASES_WRITE: "purchases.write",
  FINANCE_READ: "finance.read",
  FINANCE_WRITE: "finance.write",
  TREASURY_READ: "treasury.read",
  TREASURY_WRITE: "treasury.write",
  REPORTS_READ: "reports.read",
  USERS_MANAGE: "users.manage",
  // NUEVOS PERMISOS CRM PRO
  CRM_COMM_READ: "crm.communication.read",
  CRM_COMM_WRITE: "crm.communication.write",
  CRM_QUOTES: "crm.quotes.write",
  CRM_CAMPAIGNS: "crm.campaigns.write",
  CRM_ANALYTICS: "crm.analytics.read",
  ADMIN_HEALTH: "admin.health.read",
  ADMIN_BACKUPS: "admin.backups.manage",
  ADMIN_RESTORE: "admin.restore.manage",
  ADMIN_AUDIT: "admin.audit.read",
};
export const ROLE_DESCRIPTIONS: Record<string, string> = {
  ADMIN: 'Acceso total', MANAGER: 'Gerente', SELLER: 'Vendedor', WAREHOUSE: 'Bodeguero',
};
