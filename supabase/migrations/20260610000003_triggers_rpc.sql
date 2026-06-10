-- =====================================================================
-- 20260610000003_triggers_rpc.sql
-- Auth->profile trigger and the join-via-code RPC.
-- Replaces: useAuth's "create default user" branch + the Firestore
-- security rule that let clients append their own uid to allowedUsers.
-- =====================================================================

-- ---------------------------------------------------------------------
-- handle_new_user : create a profiles row whenever an auth user is created.
-- The CreateProfile screen later fills in the remaining fields via an update.
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, coalesce(new.email, ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- join_list_by_code : safely add the caller to a list's members by share code.
-- SECURITY DEFINER so it can look up a list the caller can't yet see.
-- Returns the joined list id; raises 'invalid_code' if no match.
-- ---------------------------------------------------------------------
create or replace function public.join_list_by_code(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_list uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select id into v_list
  from public.lists
  where share_code = p_code;

  if v_list is null then
    raise exception 'invalid_code';
  end if;

  insert into public.list_members (list_id, user_id)
  values (v_list, auth.uid())
  on conflict do nothing;

  return v_list;
end;
$$;

-- Allow authenticated clients to call the RPC.
grant execute on function public.join_list_by_code(text) to authenticated;
