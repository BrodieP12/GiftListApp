-- ==============================================================================
-- 006_account_store_settings.sql
-- Adds store link choosing preferences to user profiles and gift lists.
-- Profiles hold the global user default store preferences.
-- Lists hold optional overrides (inheriting from account settings by default).
-- ==============================================================================

-- 1. Add preferred_retailers to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferred_retailers text[] DEFAULT ARRAY[
    'amazon.com',
    'target.com',
    'walmart.com',
    'bestbuy.com'
  ]::text[];

-- 2. Add inherit_store_preferences and preferred_retailers to lists
ALTER TABLE public.lists
  ADD COLUMN IF NOT EXISTS inherit_store_preferences boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS preferred_retailers text[] DEFAULT NULL;

-- 3. Document columns
COMMENT ON COLUMN public.profiles.preferred_retailers IS 'List of retailer domain identifiers preferred by the user for product searches.';
COMMENT ON COLUMN public.lists.inherit_store_preferences IS 'Whether this list inherits the account-wide preferred retailers or uses custom overrides.';
COMMENT ON COLUMN public.lists.preferred_retailers IS 'Custom retailer domain overrides for this specific list when inherit_store_preferences is false.';
