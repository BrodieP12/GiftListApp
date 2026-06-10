-- =====================================================================
-- 20260610000002_rls.sql
-- Row Level Security — direct translation of firebase_config/firestore.rules.
--
-- Surprise logic preserved: the list owner is explicitly blocked from
-- reading the `claims` table (list_owner_id <> auth.uid()).
-- =====================================================================

alter table public.profiles     enable row level security;
alter table public.lists        enable row level security;
alter table public.list_members enable row level security;
alter table public.items        enable row level security;
alter table public.claims       enable row level security;
alter table public.feedback     enable row level security;
alter table public.app_config   enable row level security;

-- ---------------------------------------------------------------------
-- Helper: does the current user own or belong to a list?
-- SECURITY DEFINER so it can see list_members/lists regardless of the
-- caller's own row visibility, avoiding RLS recursion in policies.
-- ---------------------------------------------------------------------
create or replace function public.has_list_access(p_list uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
           select 1 from public.lists l
           where l.id = p_list and l.owner_id = auth.uid()
         )
      or exists (
           select 1 from public.list_members m
           where m.list_id = p_list and m.user_id = auth.uid()
         );
$$;

-- ---------------------------------------------------------------------
-- PROFILES : read/write only your own row.
-- (Email-uniqueness lookups are done server-side via the check-email
--  Edge Function using the service role, so no client `list` policy is needed.)
-- ---------------------------------------------------------------------
create policy profiles_self on public.profiles
  for all
  using (id = auth.uid())
  with check (id = auth.uid());

-- ---------------------------------------------------------------------
-- LISTS
-- ---------------------------------------------------------------------
create policy lists_select on public.lists
  for select
  using (owner_id = auth.uid() or public.has_list_access(id));

create policy lists_insert on public.lists
  for insert
  with check (owner_id = auth.uid());

create policy lists_update on public.lists
  for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy lists_delete on public.lists
  for delete
  using (owner_id = auth.uid());

-- ---------------------------------------------------------------------
-- LIST_MEMBERS
-- A user may add THEMSELVES (join-via-code goes through the
-- join_list_by_code RPC). Owners (or the member themselves) can remove.
-- ---------------------------------------------------------------------
create policy members_select on public.list_members
  for select
  using (user_id = auth.uid() or public.has_list_access(list_id));

create policy members_self_join on public.list_members
  for insert
  with check (user_id = auth.uid());

create policy members_delete on public.list_members
  for delete
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.lists l
      where l.id = list_id and l.owner_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------
-- ITEMS : anyone with access to the parent list can read/write.
-- ---------------------------------------------------------------------
create policy items_access on public.items
  for all
  using (public.has_list_access(list_id))
  with check (public.has_list_access(list_id));

-- ---------------------------------------------------------------------
-- CLAIMS : members can read/create/delete; the LIST OWNER is blocked.
-- ---------------------------------------------------------------------
create policy claims_member_select on public.claims
  for select
  using (public.has_list_access(list_id) and list_owner_id <> auth.uid());

create policy claims_member_insert on public.claims
  for insert
  with check (
    claimed_by = auth.uid()
    and public.has_list_access(list_id)
    and list_owner_id <> auth.uid()
  );

create policy claims_member_delete on public.claims
  for delete
  using (claimed_by = auth.uid());

-- ---------------------------------------------------------------------
-- FEEDBACK : any authenticated user may insert; nobody reads via client.
-- ---------------------------------------------------------------------
create policy feedback_insert on public.feedback
  for insert
  with check (auth.uid() is not null);

-- ---------------------------------------------------------------------
-- APP_CONFIG : world-readable; writes are service-role only (no write policy).
-- ---------------------------------------------------------------------
create policy app_config_read on public.app_config
  for select
  using (true);
