BEGIN;

-- 1. Columnas CRM en customers (Prisma usa snake_case en BD)
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS preferences TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS loyalty_points INTEGER DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS loyalty_tier TEXT DEFAULT 'BRONZE' NOT NULL,
  ADD COLUMN IF NOT EXISTS total_spent DECIMAL(15,2) DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS last_purchase_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS purchase_count INTEGER DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS credit_limit DECIMAL(15,2);

CREATE INDEX IF NOT EXISTS customers_loyalty_tier_idx ON customers(loyalty_tier);

-- 2. Tabla motorcycles
CREATE TABLE IF NOT EXISTS motorcycles (
  id TEXT PRIMARY KEY,
  plate TEXT NOT NULL UNIQUE,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  year INTEGER,
  last_km INTEGER,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS motorcycles_customer_id_idx ON motorcycles(customer_id);

-- 3. Columna motorcycle_id en sales
ALTER TABLE sales ADD COLUMN IF NOT EXISTS motorcycle_id TEXT REFERENCES motorcycles(id) ON DELETE SET NULL;

-- 4. Tabla warranties
CREATE TABLE IF NOT EXISTS warranties (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id),
  sale_item_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  days INTEGER NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  claim_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS warranties_customer_id_idx ON warranties(customer_id);
CREATE INDEX IF NOT EXISTS warranties_status_expires_at_idx ON warranties(status, expires_at);

-- 5. Tabla communication_logs
CREATE TABLE IF NOT EXISTS communication_logs (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id),
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  performed_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS communication_logs_customer_id_idx ON communication_logs(customer_id);

-- 6. Tabla reminders
CREATE TABLE IF NOT EXISTS reminders (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id),
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  due_date TIMESTAMPTZ NOT NULL,
  is_sent BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS reminders_customer_id_idx ON reminders(customer_id);

-- 7. Permisos: usar nombres reales de columnas de Prisma (role_id, permission_id)
-- Solo ejecutar si las tablas permissions/roles ya existen
DO $$
DECLARE
  v_seller_id TEXT;
  v_finance_read TEXT;
  v_finance_write TEXT;
BEGIN
  -- Verificar que las tablas existen antes de intentar insertar
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'roles') THEN
    SELECT id INTO v_seller_id FROM roles WHERE name = 'SELLER' LIMIT 1;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'permissions') THEN
    SELECT id INTO v_finance_read FROM permissions WHERE name = 'finance.read' LIMIT 1;
    SELECT id INTO v_finance_write FROM permissions WHERE name = 'finance.write' LIMIT 1;
  END IF;

  -- Solo insertar si role_permissions existe con las columnas correctas
  IF v_seller_id IS NOT NULL AND v_finance_read IS NOT NULL AND 
     EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'role_permissions' AND column_name = 'role_id') THEN
    INSERT INTO role_permissions (role_id, permission_id)
    VALUES (v_seller_id, v_finance_read)
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  END IF;

  IF v_seller_id IS NOT NULL AND v_finance_write IS NOT NULL AND
     EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'role_permissions' AND column_name = 'role_id') THEN
    INSERT INTO role_permissions (role_id, permission_id)
    VALUES (v_seller_id, v_finance_write)
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  END IF;
END $$;

COMMIT;

-- Verificación
SELECT 'motorcycles' AS tabla, COUNT(*) AS filas FROM motorcycles
UNION ALL SELECT 'warranties', COUNT(*) FROM warranties
UNION ALL SELECT 'communication_logs', COUNT(*) FROM communication_logs
UNION ALL SELECT 'reminders', COUNT(*) FROM reminders;
