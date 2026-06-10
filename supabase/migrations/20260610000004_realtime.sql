-- =====================================================================
-- 20260610000004_realtime.sql
-- Enable Realtime (replication) for the tables that previously used
-- Firestore onSnapshot listeners: lists, items, claims.
-- =====================================================================

-- The `supabase_realtime` publication is created by Supabase by default.
-- Add the tables whose changes the client subscribes to.
alter publication supabase_realtime add table public.lists;
alter publication supabase_realtime add table public.items;
alter publication supabase_realtime add table public.claims;

-- Realtime still honors RLS for the subscribing user, so the surprise-logic
-- claims policy continues to hide a list owner's claims in the stream.
