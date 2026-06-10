-- =====================================================================
-- 20260610000001_schema.sql
-- Core relational schema for GiftListApp (Firestore -> PostgreSQL).
--
-- Mapping from Firestore:
--   users/{uid}                 -> public.profiles
--   lists/{listId}              -> public.lists
--   lists.allowedUsers[]        -> public.list_members
--   lists/{listId}/items/{id}   -> public.items
--   claims/{itemId}             -> public.claims   (kept separate: surprise logic)
--   feedback/{id}               -> public.feedback
--   Remote Config               -> public.app_config
-- =====================================================================

-- gen_random_uuid() lives in pgcrypto (available by default on Supabase).
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- profiles : 1:1 mirror of auth.users, populated by the handle_new_user
-- trigger (see triggers migration). Flattens minorProtection + legalAcceptance.
-- ---------------------------------------------------------------------
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text not null,
  display_name  text not null default '',
  given_name    text not null default '',
  family_name   text not null default '',
  photo_url     text,
  birthday      timestamptz,
  is_premium    boolean not null default false,
  -- minorProtection.*
  is_minor      boolean not null default false,
  parent_email  text not null default '',
  -- legalAcceptance.*
  terms_accepted            boolean not null default false,
  privacy_accepted          boolean not null default false,
  acceptance_date           timestamptz,
  is_eu_user                boolean not null default false,
  gdpr_applies              boolean not null default false,
  accepted_data_processing  boolean not null default false,
  created_at    timestamptz not null default now()
);
create index profiles_email_idx on public.profiles (email);

-- ---------------------------------------------------------------------
-- lists
-- ---------------------------------------------------------------------
create table public.lists (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references public.profiles(id) on delete cascade,
  title        text not null,
  is_private   boolean not null default true,
  share_code   text unique,                       -- collision handled by this constraint
  created_at   timestamptz not null default now(),
  updated_at   timestamptz
);
create index lists_owner_idx on public.lists (owner_id);

-- ---------------------------------------------------------------------
-- list_members : replaces lists.allowedUsers[]
-- ---------------------------------------------------------------------
create table public.list_members (
  list_id   uuid not null references public.lists(id) on delete cascade,
  user_id   uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (list_id, user_id)
);
create index list_members_user_idx on public.list_members (user_id);

-- ---------------------------------------------------------------------
-- items : replaces the lists/{id}/items subcollection
-- ---------------------------------------------------------------------
create table public.items (
  id             uuid primary key default gen_random_uuid(),
  list_id        uuid not null references public.lists(id) on delete cascade,
  owner_id       uuid not null references public.profiles(id),
  name           text not null,
  description    text not null default '',
  price          numeric,
  image_uri      text,
  url            text,
  substitutions  boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz
);
create index items_list_idx on public.items (list_id);

-- ---------------------------------------------------------------------
-- claims : separate table so the list owner CANNOT read it (surprise logic).
-- One claim per item => item_id is the primary key (matches Firestore where
-- the claim doc id was the itemId).
-- ---------------------------------------------------------------------
create table public.claims (
  item_id        uuid primary key references public.items(id) on delete cascade,
  list_id        uuid not null references public.lists(id) on delete cascade,
  claimed_by     uuid not null references public.profiles(id),
  list_owner_id  uuid not null references public.profiles(id),
  claimed_at     timestamptz not null default now()
);
create index claims_list_idx on public.claims (list_id);

-- ---------------------------------------------------------------------
-- feedback
-- ---------------------------------------------------------------------
create table public.feedback (
  id           uuid primary key default gen_random_uuid(),
  user_id      text not null,            -- 'anonymous' permitted
  user_email   text not null,
  text         text not null,
  type         text not null default 'general',
  is_anonymous boolean not null default false,
  platform     text,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- app_config : replaces Firebase Remote Config. Values are JSONB so the
-- client can read typed primitives (string/bool) like Remote Config did.
-- ---------------------------------------------------------------------
create table public.app_config (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.app_config (key, value) values
  ('latest_ota_version',      '"1.0.9"'::jsonb),
  ('force_ota_update',        'false'::jsonb),
  ('required_native_version', '"1.0.5.4"'::jsonb),
  ('apk_download_url',        '"https://REPLACE_PROJECT.supabase.co/storage/v1/object/public/apk/latest.apk"'::jsonb),
  ('latest_update_message',   '"Migrated to Supabase"'::jsonb);
