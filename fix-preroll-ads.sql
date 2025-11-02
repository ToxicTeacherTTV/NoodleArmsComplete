-- Add missing variant column to preroll_ads table
ALTER TABLE preroll_ads 
ADD COLUMN IF NOT EXISTS variant TEXT DEFAULT 'normal';

-- Verify the column was added
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'preroll_ads' 
AND column_name = 'variant';
