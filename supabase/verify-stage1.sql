-- Read-only. Run AFTER migration and the real precompute batch.
select extname, extversion, extnamespace::regnamespace as extension_schema
from pg_extension where extname = 'vector';
select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in ('fashion_items', 'swipes');
select tablename, policyname, cmd, qual, with_check from pg_policies
where schemaname = 'public' and tablename in ('fashion_items', 'swipes');
select count(*) as registered, count(embedding) as with_embedding,
count(*) filter (where embedding is not null and embedding_model = 'patrickjohncyh/fashion-clip'
  and embedding_model_version is not null and embedded_at is not null) as with_model_provenance
from public.fashion_items;
select id, image_sha256, source_url, source_name, license_name,
  embedding_model, embedding_model_version, embedded_at,
  (embedding is not null) as embedding_saved
from public.fashion_items where id = 'men-clean-01';
-- Aggregate only; no unrelated user's history is displayed here.
select action, count(*) from public.swipes group by action;
