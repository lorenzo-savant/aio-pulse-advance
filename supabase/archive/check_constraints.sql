-- Check constraints on monitoring_results
SELECT 
    tc.constraint_name, 
    kcu.column_name, 
    tc.table_name,
    tc.constraint_type
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name = 'monitoring_results';

-- Check columns
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'monitoring_results';
