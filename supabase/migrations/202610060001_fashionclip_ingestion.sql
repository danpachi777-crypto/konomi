-- First-stage ingestion only. This repository previously had no database.
-- Never automatically apply this to an existing remote project.
begin;
do $$ begin
  if to_regclass('public.fashion_items') is not null or to_regclass('public.swipes') is not null then
    raise exception 'Existing fashion_items/swipes detected: inspect and extend existing schema; do not overwrite';
  end if;
  if exists(select 1 from pg_extension where extname = 'vector' and extnamespace::regnamespace::text <> 'extensions') then
    raise exception 'pgvector exists in another schema: adapt the vector type reference after inspection';
  end if;
end $$;
create schema if not exists extensions;
create extension if not exists vector with schema extensions;

create table public.fashion_items (
  id text primary key,
  image_url text not null,
  source_url text not null,
  source_name text not null,
  creator text,
  creator_url text,
  license_name text not null,
  license_url text not null,
  rights_metadata jsonb not null default '{}'::jsonb,
  rights_reviewed boolean not null default false,
  image_sha256 text not null check (image_sha256 ~ '^[a-f0-9]{64}$'),
  embedding extensions.vector(512),
  embedding_model text,
  embedding_model_version text,
  embedded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint embedding_provenance check (
    (embedding is null and embedding_model is null and embedding_model_version is null and embedded_at is null)
    or (embedding is not null and embedding_model = 'patrickjohncyh/fashion-clip'
      and embedding_model_version is not null and embedded_at is not null)
  )
);
-- Reuse the same content's embedding; no similarity search index is needed yet.
create index fashion_items_content_model on public.fashion_items(image_sha256, embedding_model_version);

create table public.swipes (
  user_id uuid not null references auth.users(id) on delete cascade,
  fashion_item_id text not null references public.fashion_items(id) on delete restrict,
  action text not null check (action in ('like', 'dislike', 'skip')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, fashion_item_id)
);
create function public.konomi_swipe_timestamps() returns trigger
language plpgsql set search_path = '' as $$ begin
  new.created_at := case when TG_OP = 'UPDATE' then old.created_at else now() end;
  new.updated_at := now();
  return new;
end $$;
create trigger konomi_swipe_timestamps before insert or update on public.swipes
for each row execute function public.konomi_swipe_timestamps();
revoke all on function public.konomi_swipe_timestamps() from public, anon, authenticated;

alter table public.fashion_items enable row level security;
alter table public.swipes enable row level security;
revoke all on public.fashion_items, public.swipes from anon, authenticated;
grant select on public.fashion_items to anon, authenticated;
grant select, insert, update, delete on public.swipes to authenticated;
grant all on public.fashion_items, public.swipes to service_role;
create policy "Reviewed catalog only" on public.fashion_items for select
to anon, authenticated using (rights_reviewed);
-- No client insert/update policy for image provenance or embeddings.
create policy "Read own swipes" on public.swipes for select to authenticated
using ((select auth.uid()) = user_id);
create policy "Insert own swipes" on public.swipes for insert to authenticated
with check ((select auth.uid()) = user_id and exists (
  select 1 from public.fashion_items f where f.id = fashion_item_id and f.rights_reviewed));
create policy "Update own swipes" on public.swipes for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id and exists (
  select 1 from public.fashion_items f where f.id = fashion_item_id and f.rights_reviewed));
create policy "Undo own swipes" on public.swipes for delete to authenticated
using ((select auth.uid()) = user_id);
commit;
