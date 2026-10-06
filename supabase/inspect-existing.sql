-- Read-only preflight. Run this BEFORE the migration on the intended project.
select table_name, column_name, data_type, udt_name
from information_schema.columns where table_schema = 'public'
order by table_name, ordinal_position;
select schemaname, tablename, policyname, cmd, qual, with_check from pg_policies
where schemaname = 'public' order by tablename, policyname;
select extname, extversion, extnamespace::regnamespace from pg_extension where extname = 'vector';
