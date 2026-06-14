-- ============================================================
-- SIGH-Motos — Reparación de BD de producción (idempotente)
-- Ejecutar: psql $DATABASE_URL -f scripts/fix-production-db.sql
-- O en Docker: docker compose exec db psql -U $POSTGRES_USER -d $POSTGRES_DB -f /tmp/fix-production-db.sql
-- ============================================================

BEGIN;

-- ─── 1. Columna motorcycle_id en sales ───────────────────────────────────────
-- Corrige el error: "The column sales.motorcycleId does not exist"
ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS motorcycle_id TEXT;

-- FK a motorcycles (si la tabla existe)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'motorcycles')
     AND NOT EXISTS (
       SELECT 1 FROM information_schema.table_constraints
       WHERE constraint_name = 'sales_motorcycle_id_fkey' AND table_name = 'sales'
     )
  THEN
    ALTER TABLE sales
      ADD CONSTRAINT sales_motorcycle_id_fkey
        FOREIGN KEY (motorcycle_id) REFERENCES motorcycles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ─── 2. Columnas RFM en customers ────────────────────────────────────────────
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS assigned_user_id       TEXT,
  ADD COLUMN IF NOT EXISTS recency_days            INT            DEFAULT 9999,
  ADD COLUMN IF NOT EXISTS frequency_6m            INT            DEFAULT 0,
  ADD COLUMN IF NOT EXISTS monetary_6m             NUMERIC(15,2)  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rfm_segment             TEXT,
  ADD COLUMN IF NOT EXISTS credit_risk_score       INT            DEFAULT 50,
  ADD COLUMN IF NOT EXISTS last_communication_at   TIMESTAMPTZ;

-- ─── 3. Columnas aging en accounts_receivable ────────────────────────────────
ALTER TABLE accounts_receivable
  ADD COLUMN IF NOT EXISTS days_overdue   INT  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS aging_bucket   TEXT DEFAULT 'CURRENT';

-- ─── 4. Tabla motorcycles (si no existe) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS motorcycles (
  id          TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  plate       TEXT        NOT NULL,
  brand       TEXT        NOT NULL,
  model       TEXT        NOT NULL,
  year        INTEGER,
  last_km     INTEGER,
  customer_id TEXT        NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS motorcycles_plate_key ON motorcycles(plate);
CREATE INDEX IF NOT EXISTS motorcycles_customer_id_idx   ON motorcycles(customer_id);

-- Asegurar que FK de sales → motorcycles existe ahora que motorcycles está creado
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'sales_motorcycle_id_fkey' AND table_name = 'sales'
  ) THEN
    ALTER TABLE sales
      ADD CONSTRAINT sales_motorcycle_id_fkey
        FOREIGN KEY (motorcycle_id) REFERENCES motorcycles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ─── 5. Tabla warranties ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS warranties (
  id           TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  customer_id  TEXT        NOT NULL REFERENCES customers(id),
  sale_item_id TEXT        NOT NULL,
  product_name TEXT        NOT NULL,
  days         INTEGER     NOT NULL,
  expires_at   TIMESTAMPTZ NOT NULL,
  status       TEXT        NOT NULL DEFAULT 'ACTIVE',
  claim_notes  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS warranties_customer_id_idx       ON warranties(customer_id);
CREATE INDEX IF NOT EXISTS warranties_status_expires_at_idx ON warranties(status, expires_at);

-- ─── 6. Tabla reminders ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reminders (
  id          TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  customer_id TEXT        NOT NULL REFERENCES customers(id),
  type        TEXT        NOT NULL,
  message     TEXT        NOT NULL,
  due_date    TIMESTAMPTZ NOT NULL,
  is_sent     BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reminders_customer_id_idx      ON reminders(customer_id);
CREATE INDEX IF NOT EXISTS reminders_due_date_sent_idx    ON reminders(due_date, is_sent);

-- ─── 7. Tabla communications ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS communications (
  id               TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  customer_id      TEXT        NOT NULL REFERENCES customers(id),
  channel          TEXT        NOT NULL,
  direction        TEXT        NOT NULL DEFAULT 'OUTBOUND',
  message          TEXT        NOT NULL,
  status           TEXT        NOT NULL DEFAULT 'SENT',
  is_read          BOOLEAN     NOT NULL DEFAULT FALSE,
  sent_by_user_id  TEXT,
  read_at          TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_comm_customer ON communications(customer_id);
CREATE INDEX IF NOT EXISTS idx_comm_channel  ON communications(channel);
CREATE INDEX IF NOT EXISTS idx_comm_created  ON communications(created_at DESC);

-- ─── 8. Tabla tickets ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tickets (
  id          TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  customer_id TEXT        NOT NULL REFERENCES customers(id),
  subject     TEXT        NOT NULL,
  description TEXT        NOT NULL,
  status      TEXT        NOT NULL DEFAULT 'OPEN',
  priority    TEXT        NOT NULL DEFAULT 'MEDIUM',
  assigned_to TEXT,
  resolution  TEXT,
  resolved_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tickets_customer ON tickets(customer_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status   ON tickets(status);

-- ─── 9. Tabla quotes ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quotes (
  id             TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  customer_id    TEXT        NOT NULL REFERENCES customers(id),
  status         TEXT        NOT NULL DEFAULT 'DRAFT',
  subtotal       NUMERIC(15,2) NOT NULL DEFAULT 0,
  discount       NUMERIC(5,2)  NOT NULL DEFAULT 0,
  total          NUMERIC(15,2) NOT NULL DEFAULT 0,
  items          JSONB       NOT NULL DEFAULT '[]',
  expires_at     TIMESTAMPTZ,
  created_by_id  TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_quotes_customer ON quotes(customer_id);
CREATE INDEX IF NOT EXISTS idx_quotes_status   ON quotes(status);

-- ─── 10. Tabla quote_deliveries ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quote_deliveries (
  id           TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  quote_id     TEXT        NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  channel      TEXT        NOT NULL,
  status       TEXT        NOT NULL DEFAULT 'SENT',
  link         TEXT,
  sent_at      TIMESTAMPTZ,
  attempted_by TEXT        NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_quote_del_quote ON quote_deliveries(quote_id);

-- ─── 11. Tabla workshop_visits ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workshop_visits (
  id             TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  customer_id    TEXT        NOT NULL REFERENCES customers(id),
  motorcycle_id  TEXT        REFERENCES motorcycles(id),
  km_real        INT,
  services       TEXT[]      NOT NULL DEFAULT '{}',
  technician     TEXT,
  total_cost     NUMERIC(15,2) NOT NULL DEFAULT 0,
  status         TEXT        NOT NULL DEFAULT 'COMPLETED',
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_workshop_customer   ON workshop_visits(customer_id);
CREATE INDEX IF NOT EXISTS idx_workshop_motorcycle ON workshop_visits(motorcycle_id);

-- ─── 12. Tabla notifications ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id         TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id    TEXT        NOT NULL REFERENCES users(id),
  type       TEXT        NOT NULL DEFAULT 'INFO',
  title      TEXT        NOT NULL,
  message    TEXT        NOT NULL,
  metadata   JSONB,
  is_read    BOOLEAN     NOT NULL DEFAULT FALSE,
  read_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notif_user   ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notif_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;

-- ─── 13. Tabla system_backups ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS system_backups (
  id            TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  type          TEXT        NOT NULL DEFAULT 'FULL',
  status        TEXT        NOT NULL DEFAULT 'PENDING',
  triggered_by  TEXT        NOT NULL,
  started_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  storage_url   TEXT,
  size          NUMERIC(15,2),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── 14. Tabla system_audits ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS system_audits (
  id         TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id    TEXT,
  action     TEXT        NOT NULL,
  entity     TEXT        NOT NULL,
  entity_id  TEXT,
  ip_address TEXT,
  user_agent TEXT,
  metadata   JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sys_audit_user    ON system_audits(user_id);
CREATE INDEX IF NOT EXISTS idx_sys_audit_action  ON system_audits(action);
CREATE INDEX IF NOT EXISTS idx_sys_audit_entity  ON system_audits(entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_sys_audit_created ON system_audits(created_at DESC);

-- ─── 15. Columnas heredadas de customers (CRM v1) ────────────────────────────
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS preferences    TEXT,
  ADD COLUMN IF NOT EXISTS notes          TEXT,
  ADD COLUMN IF NOT EXISTS tags           TEXT[]        DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS loyalty_points INTEGER       DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS loyalty_tier   TEXT          DEFAULT 'BRONZE' NOT NULL,
  ADD COLUMN IF NOT EXISTS total_spent    DECIMAL(15,2) DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS last_purchase_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS purchase_count INTEGER       DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS credit_limit   DECIMAL(15,2);

-- ─── Tabla product_audit_logs (auditoría de inventario) ─────────────────────
CREATE TABLE IF NOT EXISTS product_audit_logs (
    id          TEXT        NOT NULL,
    "productId" TEXT        NOT NULL,
    "userId"    TEXT,
    "userName"  TEXT        NOT NULL DEFAULT 'Sistema',
    "userEmail" TEXT        NOT NULL DEFAULT '',
    "fieldName" TEXT        NOT NULL,
    "oldValue"  TEXT,
    "newValue"  TEXT,
    "changeType" TEXT       NOT NULL DEFAULT 'UPDATE',
    reason      TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT product_audit_logs_pkey PRIMARY KEY (id)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'product_audit_logs_productId_fkey'
  ) THEN
    ALTER TABLE product_audit_logs
      ADD CONSTRAINT "product_audit_logs_productId_fkey"
      FOREIGN KEY ("productId") REFERENCES products(id)
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS "product_audit_logs_productId_createdAt_idx"
  ON product_audit_logs ("productId", "createdAt");

CREATE INDEX IF NOT EXISTS "product_audit_logs_createdAt_idx"
  ON product_audit_logs ("createdAt");

COMMIT;

-- ─── Verificación final ───────────────────────────────────────────────────────
SELECT
  table_name,
  COUNT(*) AS columnas
FROM information_schema.columns
WHERE table_name IN (
  'sales','customers','motorcycles','warranties','reminders',
  'communications','tickets','quotes','quote_deliveries',
  'workshop_visits','notifications','system_backups','system_audits'
)
GROUP BY table_name
ORDER BY table_name;

SELECT 'Migración completada exitosamente.' AS resultado;
