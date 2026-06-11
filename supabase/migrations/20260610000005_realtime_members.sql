-- =====================================================================
-- 20260610000005_realtime_members.sql
-- Enable Realtime on list_members so the "Shared with me" section updates
-- live when a user joins (or leaves) a list via a share code.
-- RLS still applies: members_select only exposes a user's own membership rows.
-- =====================================================================

alter publication supabase_realtime add table public.list_members;
