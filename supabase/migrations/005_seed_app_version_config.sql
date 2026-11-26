-- 005_seed_app_version_config.sql
-- Seeds default app_version configuration into public.app_config

INSERT INTO public.app_config (key, value)
VALUES (
  'app_version',
  jsonb_build_object(
    'latest_version', '1.0.11',
    'minimum_version', '1.0.0',
    'release_notes', 'Initial release for internal testing feedback.',
    'download_url', jsonb_build_object(
      'android', 'https://play.google.com/apps/internaltest/com.brodiepasker.giftlistapp',
      'ios', ''
    ),
    'force_update', false
  )
)
ON CONFLICT (key) DO NOTHING;
