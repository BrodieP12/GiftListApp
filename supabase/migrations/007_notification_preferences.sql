-- ==============================================================================
-- 007_notification_preferences.sql
-- Adds per-user notification subscription, channel kind, and custom message
-- template preferences to public.profiles.
-- ==============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notification_preferences jsonb DEFAULT NULL;

COMMENT ON COLUMN public.profiles.notification_preferences IS
  'User-configured notification subscriptions, delivery kinds, action button flags, and custom title/body templates.';
