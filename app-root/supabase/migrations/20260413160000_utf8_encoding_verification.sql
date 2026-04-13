-- UTF-8 Encoding Verification and Fix for Turkish Characters
-- Run this in Supabase SQL Editor to verify and ensure proper encoding

-- 1. Verify database encoding
SELECT 
    datname,
    pg_encoding_to_char(encoding) as encoding
FROM pg_database 
WHERE datname = current_database();

-- 2. Verify all tables use UTF8 columns
SELECT 
    table_schema,
    table_name,
    column_name,
    data_type,
    character_set_name
FROM information_schema.columns
WHERE table_schema = 'public'
    AND data_type IN ('character varying', 'character', 'text')
ORDER BY table_name, column_name;

-- 3. Ensure proper encoding for all text columns (if needed, convert)
-- This is a safety check - Supabase defaults to UTF8

-- 4. Create function to normalize Turkish text
CREATE OR REPLACE FUNCTION normalize_turkish_text(input_text TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    -- Return input as-is since UTF-8 handles Turkish natively
    -- This function exists for explicit Turkish text handling
    RETURN input_text;
END;
$$;

-- 5. Verify storage buckets have proper encoding settings
SELECT 
    id,
    name,
    public
FROM storage.buckets;

-- 6. Add comment about UTF-8 requirement
COMMENT ON FUNCTION normalize_turkish_text IS 'Normalizes Turkish text for consistent UTF-8 handling. Assetly requires full UTF-8 support for Turkish characters (İ, ı, ğ, ş, ö, ü, ç).';

-- 7. Test Turkish characters support
-- This query should display correctly: İ, ı, ğ, ş, ö, ü, ç
SELECT 'Türkçe karakter testi: İ, ı, ğ, ş, ö, ü, ç' as encoding_test;

-- 8. Set proper client encoding for all connections (this is session-level)
SET client_encoding TO 'UTF8';

-- Note: Database encoding is set at creation time and cannot be changed without recreation.
-- Supabase databases are created with UTF8 by default.
-- If you see encoding issues, verify your client connection uses UTF8.
