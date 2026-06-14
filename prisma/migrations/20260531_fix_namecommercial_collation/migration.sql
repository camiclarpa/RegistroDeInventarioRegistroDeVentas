-- Migration: Add case-insensitive index for nameCommercial ordering
-- This enables proper alphabetical sorting (A-Z, Z-A) ignoring case

-- Drop existing index if exists (adjust name as needed)
DROP INDEX IF EXISTS "products_nameCommercial_idx";

-- Create functional index using LOWER() for case-insensitive ordering
CREATE INDEX "products_nameCommercial_ci_idx" ON products (LOWER("nameCommercial"));

-- Optional: Update column collation for future consistency (requires table lock)
-- ALTER TABLE products 
--   ALTER COLUMN "nameCommercial" TYPE VARCHAR(255) COLLATE "en_US.utf8";

-- Note: For immediate effect without app changes, queries should use:
-- ORDER BY LOWER("nameCommercial") ASC/DESC
-- The app will use this via raw SQL when sorting by nameCommercial
