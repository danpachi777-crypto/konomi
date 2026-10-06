-- Run only after migration, in one SQL Editor execution. Always ROLLBACK.
-- Replace BOTH UUIDs with two existing, separate TEST Auth users in YOUR project.
begin;
select set_config('konomi.test_user_a', '00000000-0000-0000-0000-000000000001', true);
select set_config('konomi.test_user_b', '00000000-0000-0000-0000-000000000002', true);
do $$ begin
  if current_setting('konomi.test_user_a') = current_setting('konomi.test_user_b') or
     (select count(*) from auth.users where id in (current_setting('konomi.test_user_a')::uuid,
       current_setting('konomi.test_user_b')::uuid)) <> 2 then
    raise exception 'Set two existing different TEST Auth user UUIDs before running';
  end if;
end $$;
insert into public.fashion_items(id, image_url, source_url, source_name, license_name, license_url,
  image_sha256, rights_reviewed)
values ('__konomi_rls_test__', 'test-only-not-published.jpg', 'https://example.com/test', 'RLS test fixture',
  'test only', 'https://example.com/test', repeat('a', 64), true);
-- No embedding is fabricated, and every fixture is rolled back.
insert into public.swipes(user_id, fashion_item_id, action)
values (current_setting('konomi.test_user_b')::uuid, '__konomi_rls_test__', 'like');
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('konomi.test_user_a'), true);
select set_config('request.jwt.claims', json_build_object('sub', current_setting('konomi.test_user_a'), 'role', 'authenticated')::text, true);
do $$ declare affected integer; begin
  if exists(select 1 from public.swipes where user_id = current_setting('konomi.test_user_b')::uuid) then
    raise exception 'FAIL: another user history is visible';
  end if;
  begin
    insert into public.swipes(user_id, fashion_item_id, action)
    values(current_setting('konomi.test_user_b')::uuid, '__konomi_rls_test__', 'dislike');
    raise exception 'FAIL: another user write was allowed';
  exception when insufficient_privilege then null;
  end;
  update public.swipes set action = 'dislike' where user_id = current_setting('konomi.test_user_b')::uuid and fashion_item_id = '__konomi_rls_test__';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'FAIL: another user update allowed'; end if;
  delete from public.swipes where user_id = current_setting('konomi.test_user_b')::uuid and fashion_item_id = '__konomi_rls_test__';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'FAIL: another user deletion allowed'; end if;
  insert into public.swipes(user_id, fashion_item_id, action)
  values(current_setting('konomi.test_user_a')::uuid, '__konomi_rls_test__', 'like');
  insert into public.swipes(user_id, fashion_item_id, action)
  values(current_setting('konomi.test_user_a')::uuid, '__konomi_rls_test__', 'skip')
  on conflict(user_id, fashion_item_id) do update set action = excluded.action;
  if (select count(*) from public.swipes where fashion_item_id = '__konomi_rls_test__') <> 1 or
     (select action from public.swipes where fashion_item_id = '__konomi_rls_test__') <> 'skip' then
    raise exception 'FAIL: upsert or skip handling';
  end if;
  delete from public.swipes where user_id = current_setting('konomi.test_user_a')::uuid and fashion_item_id = '__konomi_rls_test__';
  raise notice 'PASS: own read/write/undo, no cross-user access, unique latest action, skip retained';
end $$;
rollback;
