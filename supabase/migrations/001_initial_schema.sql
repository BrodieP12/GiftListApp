-- =============================================
-- GiftListApp — Supabase Initial Schema
-- Run this in the Supabase SQL Editor
-- =============================================

-- Enable UUID extension (already on by default in Supabase)
create extension if not exists "uuid-ossp";

-- =============================================
-- PROFILES
-- =============================================
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text not null,
  display_name  text,
  given_name    text,
  family_name   text,
  photo_url     text,
  birthday      date,
  is_premium    boolean not null default false,
  minor_protection  jsonb,
  legal_acceptance  jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view any profile"
  on public.profiles for select using (true);

create policy "Users can insert own profile"
  on public.profiles for insert with check (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

-- Auto-create a minimal profile row when a new auth user signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================
-- LISTS
-- =============================================
create table if not exists public.lists (
  id          uuid primary key default uuid_generate_v4(),
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  title       text not null,
  is_private  boolean not null default true,
  share_code  text unique,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.lists enable row level security;

create policy "Owner can do everything with their list"
  on public.lists for all using (auth.uid() = owner_id);

create policy "Members can view lists they joined"
  on public.lists for select using (
    exists (
      select 1 from public.list_members
      where list_id = lists.id and user_id = auth.uid()
    )
  );

-- =============================================
-- LIST MEMBERS
-- =============================================
create table if not exists public.list_members (
  id       uuid primary key default uuid_generate_v4(),
  list_id  uuid not null references public.lists(id) on delete cascade,
  user_id  uuid not null references public.profiles(id) on delete cascade,
  role     text not null check (role in ('owner', 'member')) default 'member',
  joined_at timestamptz not null default now(),
  unique (list_id, user_id)
);

alter table public.list_members enable row level security;

create policy "Members can view membership rows"
  on public.list_members for select using (
    auth.uid() = user_id
    or exists (
      select 1 from public.lists where id = list_id and owner_id = auth.uid()
    )
  );

create policy "Owner can manage members"
  on public.list_members for all using (
    exists (
      select 1 from public.lists where id = list_id and owner_id = auth.uid()
    )
  );

-- Auto-add owner as a member when a list is created
create or replace function public.add_owner_as_member()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.list_members (list_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict (list_id, user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_list_created on public.lists;
create trigger on_list_created
  after insert on public.lists
  for each row execute function public.add_owner_as_member();

-- RPC: join a list by share code (SECURITY DEFINER so users can't inject rows directly)
drop function if exists public.join_list_by_code(text);
create or replace function public.join_list_by_code(p_share_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_list_id uuid;
begin
  select id into v_list_id
  from public.lists
  where share_code = upper(trim(p_share_code))
    and is_private = false;

  if v_list_id is null then
    raise exception 'Invalid or expired share code';
  end if;

  insert into public.list_members (list_id, user_id, role)
  values (v_list_id, auth.uid(), 'member')
  on conflict (list_id, user_id) do nothing;

  return v_list_id;
end;
$$;

-- =============================================
-- ITEMS
-- =============================================
create table if not exists public.items (
  id            uuid primary key default uuid_generate_v4(),
  list_id       uuid not null references public.lists(id) on delete cascade,
  name          text not null,
  description   text,
  price         numeric(10, 2),
  image_uri     text,
  url           text,
  substitutions boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.items enable row level security;

create policy "List members can view items"
  on public.items for select using (
    exists (
      select 1 from public.list_members
      where list_id = items.list_id and user_id = auth.uid()
    )
  );

create policy "List owner can manage items"
  on public.items for all using (
    exists (
      select 1 from public.lists
      where id = items.list_id and owner_id = auth.uid()
    )
  );

-- =============================================
-- CLAIMS
-- =============================================
create table if not exists public.claims (
  item_id       uuid primary key references public.items(id) on delete cascade,
  claimed_by    uuid not null references public.profiles(id) on delete cascade,
  list_owner_id uuid not null references public.profiles(id) on delete cascade,
  claimed_at    timestamptz not null default now()
);

alter table public.claims enable row level security;

-- Claimers can insert/delete their own claims; owners cannot see who claimed what
create policy "Non-owners can claim items"
  on public.claims for insert with check (
    auth.uid() = claimed_by
    and auth.uid() != list_owner_id
  );

create policy "Claimer can delete own claim"
  on public.claims for delete using (auth.uid() = claimed_by);

-- Non-owners see claims; owners cannot see who claimed (surprise logic enforced in app)
create policy "Non-owners can view claims"
  on public.claims for select using (auth.uid() != list_owner_id);

-- =============================================
-- FEEDBACK
-- =============================================
create table if not exists public.feedback (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references public.profiles(id) on delete set null,
  type        text,
  message     text not null,
  platform    text,
  created_at  timestamptz not null default now()
);

alter table public.feedback enable row level security;

create policy "Anyone can insert feedback"
  on public.feedback for insert with check (true);

-- =============================================
-- FRIENDS
-- =============================================
create table if not exists public.friends (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  friend_id   uuid not null references public.profiles(id) on delete cascade,
  status      text not null check (status in ('pending', 'accepted', 'declined')) default 'pending',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, friend_id),
  check (user_id != friend_id)
);

alter table public.friends enable row level security;

create policy "Users can view their friend rows"
  on public.friends for select using (
    auth.uid() = user_id or auth.uid() = friend_id
  );

create policy "Users can send friend requests"
  on public.friends for insert with check (auth.uid() = user_id);

create policy "Recipient can accept or decline"
  on public.friends for update using (auth.uid() = friend_id);

create policy "Either party can remove"
  on public.friends for delete using (
    auth.uid() = user_id or auth.uid() = friend_id
  );

-- =============================================
-- CONVERSATIONS
-- =============================================
create table if not exists public.conversations (
  id         uuid primary key default uuid_generate_v4(),
  created_at timestamptz not null default now()
);

alter table public.conversations enable row level security;

create policy "Participants can view conversation"
  on public.conversations for select using (
    exists (
      select 1 from public.conversation_participants
      where conversation_id = conversations.id and user_id = auth.uid()
    )
  );

create policy "Anyone can create a conversation"
  on public.conversations for insert with check (true);

-- =============================================
-- CONVERSATION PARTICIPANTS
-- =============================================
create table if not exists public.conversation_participants (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  primary key (conversation_id, user_id)
);

alter table public.conversation_participants enable row level security;

create policy "Participants can view participant rows"
  on public.conversation_participants for select using (
    auth.uid() = user_id
    or exists (
      select 1 from public.conversation_participants cp2
      where cp2.conversation_id = conversation_participants.conversation_id
        and cp2.user_id = auth.uid()
    )
  );

create policy "Users can insert themselves as participant"
  on public.conversation_participants for insert with check (auth.uid() = user_id);

-- =============================================
-- MESSAGES
-- =============================================
create table if not exists public.messages (
  id              uuid primary key default uuid_generate_v4(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id       uuid not null references public.profiles(id) on delete cascade,
  content         text not null,
  created_at      timestamptz not null default now()
);

alter table public.messages enable row level security;

create policy "Participants can view messages"
  on public.messages for select using (
    exists (
      select 1 from public.conversation_participants
      where conversation_id = messages.conversation_id and user_id = auth.uid()
    )
  );

create policy "Participants can send messages"
  on public.messages for insert with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.conversation_participants
      where conversation_id = messages.conversation_id and user_id = auth.uid()
    )
  );

-- =============================================
-- REALTIME — enable for live subscriptions
-- =============================================
alter publication supabase_realtime add table public.lists;
alter publication supabase_realtime add table public.list_members;
alter publication supabase_realtime add table public.items;
alter publication supabase_realtime add table public.claims;
alter publication supabase_realtime add table public.friends;
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.conversation_participants;
