-- ============================================================================
-- SIGH-Motos — Migración idempotente: Tesorería Avanzada + Admin + CRM
-- Fecha: 2026-05-14
-- Aplica con: npx prisma migrate deploy
-- ============================================================================

-- --- Nuevos valores en enum PaymentMethod ---------------------------------
DO $$ BEGIN
  ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'NEQUI';
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;

DO $$ BEGIN
  ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'DAVIPLATA';
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;

-- --- Nuevos enums de Tesorería --------------------------------------------
DO $$ BEGIN
  CREATE TYPE "DepositStatus" AS ENUM ('PENDING', 'IN_TRANSIT', 'RECONCILED');
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;

DO $$ BEGIN
  CREATE TYPE "WithholdingType" AS ENUM (
    'RETEFUENTE_35', 'RETEFUENTE_10', 'RETEIVA_15', 'RETEICA_01'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;

DO $$ BEGIN
  CREATE TYPE "ExpenseCategory" AS ENUM (
    'OPERATIVO', 'FINANCIERO', 'IMPUESTO', 'INVERSION', 'VARIOS'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;

DO $$ BEGIN
  CREATE TYPE "CashCountType" AS ENUM (
    'OPENING', 'CLOSING', 'SURPRISE', 'MIDDAY'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;

-- --- Columnas nuevas en products ------------------------------------------
ALTER TABLE "products"
  ADD COLUMN IF NOT EXISTS "warrantyDays" INTEGER NOT NULL DEFAULT 0;

-- --- Columnas CRM en customers --------------------------------------------
ALTER TABLE "customers"
  ADD COLUMN IF NOT EXISTS "preferences"           TEXT,
  ADD COLUMN IF NOT EXISTS "notes"                 TEXT,
  ADD COLUMN IF NOT EXISTS "tags"                  TEXT[]         NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "loyaltyPoints"         INTEGER        NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "loyaltyTier"           TEXT           NOT NULL DEFAULT 'BRONZE',
  ADD COLUMN IF NOT EXISTS "totalSpent"            DECIMAL(15,2)  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "lastPurchaseAt"        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "purchaseCount"         INTEGER        NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "creditLimit"           DECIMAL(15,2),
  ADD COLUMN IF NOT EXISTS "assigned_user_id"      TEXT,
  ADD COLUMN IF NOT EXISTS "recency_days"          INTEGER        NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "frequency_6m"          INTEGER        NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "monetary_6m"           DECIMAL(12,2)  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "rfm_segment"           TEXT           NOT NULL DEFAULT 'REGULAR',
  ADD COLUMN IF NOT EXISTS "credit_risk_score"     INTEGER        NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS "last_communication_at" TIMESTAMPTZ;

-- phone UNIQUE
DO $$ BEGIN
  ALTER TABLE "customers" ADD CONSTRAINT "customers_phone_key" UNIQUE ("phone");
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;

-- --- Columnas extendidas en cash_registers --------------------------------
ALTER TABLE "cash_registers"
  ADD COLUMN IF NOT EXISTS "closingBalance"        DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS "differenceStatus"      TEXT,
  ADD COLUMN IF NOT EXISTS "requiresAdminReview"   BOOLEAN        NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "approvedByUserId"      TEXT;

-- --- Columnas extendidas en financial_transactions ------------------------
ALTER TABLE "financial_transactions"
  ADD COLUMN IF NOT EXISTS "expenseCategory"       "ExpenseCategory",
  ADD COLUMN IF NOT EXISTS "bankingCommission"     DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS "requiresApproval"      BOOLEAN        NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "approvedByUserId"      TEXT,
  ADD COLUMN IF NOT EXISTS "approvedAt"            TIMESTAMPTZ;

-- --- Columnas en accounts_receivable --------------------------------------
ALTER TABLE "accounts_receivable"
  ADD COLUMN IF NOT EXISTS "days_overdue"          INTEGER        NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "aging_bucket"          TEXT           NOT NULL DEFAULT 'CURRENT';

-- --- Tabla cash_counts (Pilar 1: Conteo Ciego) ----------------------------
CREATE TABLE IF NOT EXISTS "cash_counts" (
  "id"               TEXT          NOT NULL,
  "cashRegisterId"   TEXT          NOT NULL,
  "countedByUserId"  TEXT          NOT NULL,
  "approvedByUserId" TEXT,
  "type"             "CashCountType" NOT NULL DEFAULT 'CLOSING',
  "denominations"    JSONB         NOT NULL DEFAULT '[]',
  "totalCounted"     DECIMAL(12,2) NOT NULL,
  "systemExpected"   DECIMAL(12,2) NOT NULL,
  "difference"       DECIMAL(12,2) NOT NULL,
  "differenceStatus" TEXT,
  "isBlindCount"     BOOLEAN       NOT NULL DEFAULT TRUE,
  "requiresApproval" BOOLEAN       NOT NULL DEFAULT FALSE,
  "observations"     TEXT,
  "countedAt"        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT "cash_counts_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "cash_counts"
  ADD CONSTRAINT IF NOT EXISTS "cash_counts_cashRegisterId_fkey"
    FOREIGN KEY ("cashRegisterId") REFERENCES "cash_registers"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "cash_counts_cashRegisterId_idx"
  ON "cash_counts"("cashRegisterId");

-- --- Tabla notifications (Panel Admin) ------------------------------------
CREATE TABLE IF NOT EXISTS "notifications" (
  "id"        TEXT        NOT NULL,
  "user_id"   TEXT        NOT NULL,
  "type"      TEXT        NOT NULL,
  "title"     TEXT        NOT NULL,
  "message"   TEXT        NOT NULL,
  "is_read"   BOOLEAN     NOT NULL DEFAULT FALSE,
  "read_at"   TIMESTAMPTZ,
  "metadata"  JSONB,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "notifications_userId_isRead_createdAt_idx"
  ON "notifications"("user_id", "is_read", "created_at" DESC);

-- --- Tabla system_backups (Panel Admin) -----------------------------------
CREATE TABLE IF NOT EXISTS "system_backups" (
  "id"           TEXT        NOT NULL,
  "type"         TEXT        NOT NULL DEFAULT 'FULL',
  "status"       TEXT        NOT NULL DEFAULT 'PENDING',
  "size"         DECIMAL,
  "checksum"     TEXT,
  "storage_url"  TEXT,
  "triggered_by" TEXT        NOT NULL,
  "started_at"   TIMESTAMPTZ,
  "completed_at" TIMESTAMPTZ,
  "created_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "system_backups_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "system_backups_status_createdAt_idx"
  ON "system_backups"("status", "created_at" DESC);

-- --- Tabla system_audits (Panel Admin) ------------------------------------
CREATE TABLE IF NOT EXISTS "system_audits" (
  "id"         TEXT        NOT NULL,
  "user_id"    TEXT,
  "action"     TEXT        NOT NULL,
  "entity"     TEXT        NOT NULL,
  "entity_id"  TEXT,
  "ip_address" TEXT,
  "user_agent" TEXT,
  "metadata"   JSONB,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "system_audits_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "system_audits_userId_action_createdAt_idx"
  ON "system_audits"("user_id", "action", "created_at" DESC);

-- --- Índices en customers -------------------------------------------------
CREATE INDEX IF NOT EXISTS "customers_loyaltyTier_idx"  ON "customers"("loyaltyTier");
CREATE INDEX IF NOT EXISTS "customers_rfm_segment_idx"  ON "customers"("rfm_segment");
CREATE INDEX IF NOT EXISTS "customers_creditRisk_idx"   ON "customers"("credit_risk_score");

-- --- Índice en accounts_receivable ----------------------------------------
CREATE INDEX IF NOT EXISTS "accounts_receivable_agingBucket_idx"
  ON "accounts_receivable"("aging_bucket");

-- --- Índice en financial_transactions -------------------------------------
CREATE INDEX IF NOT EXISTS "financial_transactions_expenseCategory_idx"
  ON "financial_transactions"("expenseCategory")
  WHERE "expenseCategory" IS NOT NULL;

-- --- Confirmar migración --------------------------------------------------
DO $$
BEGIN
  RAISE NOTICE 'Migración Treasury/Admin/CRM aplicada correctamente - %', NOW();
END;
$$;
