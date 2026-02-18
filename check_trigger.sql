SELECT 
  tgname AS trigger_name,
  tgrelid::regclass AS table_name
FROM pg_trigger
WHERE tgname = 'refresh_metadata_on_handoff';
