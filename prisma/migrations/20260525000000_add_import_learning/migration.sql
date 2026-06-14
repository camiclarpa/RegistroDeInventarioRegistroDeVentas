-- Create import_patterns table
-- Nota: user_id es TEXT para coincidir con la tabla users
CREATE TABLE IF NOT EXISTS import_patterns (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    excel_signature TEXT NOT NULL,
    column_mapping JSONB NOT NULL,
    brand_category_config JSONB NOT NULL,
    advanced_config JSONB NOT NULL,
    success_count INTEGER DEFAULT 1,
    failure_count INTEGER DEFAULT 0,
    last_used TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create import_history table
CREATE TABLE IF NOT EXISTS import_history (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    excel_signature TEXT NOT NULL,
    total_products INTEGER NOT NULL,
    success_products INTEGER NOT NULL,
    failed_products INTEGER NOT NULL,
    configuration_used JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_import_patterns_user_signature 
ON import_patterns(user_id, excel_signature);

CREATE INDEX IF NOT EXISTS idx_import_patterns_signature 
ON import_patterns(excel_signature);

CREATE INDEX IF NOT EXISTS idx_import_history_user 
ON import_history(user_id);

CREATE INDEX IF NOT EXISTS idx_import_history_created 
ON import_history(created_at);
