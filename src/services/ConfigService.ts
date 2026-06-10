import { supabase } from '../api/supabase';

/**
 * Remote configuration (replaces Firebase Remote Config).
 *
 * Values live in the `app_config` table and are served by the `get-config`
 * Edge Function. The shape mirrors the old Remote Config keys so the OTA /
 * native-update flow in App.tsx can swap source with minimal change.
 */
export interface AppConfig {
  latest_ota_version: string;
  force_ota_update: boolean;
  required_native_version: string;
  apk_download_url: string;
  latest_update_message: string;
}

// Defaults used when the network fetch fails or times out (was setDefaults()).
export const CONFIG_DEFAULTS: AppConfig = {
  latest_ota_version: '1.0.9',
  force_ota_update: false,
  required_native_version: '1.0.5.4',
  apk_download_url: 'https://giftlistapp.example/latest.apk',
  latest_update_message: 'Internal improvements.',
};

export const ConfigService = {
  /**
   * Fetches remote config, racing against a timeout. On timeout/failure the
   * provided fallback (typically CONFIG_DEFAULTS) is returned.
   */
  async fetch(timeoutMs = 3000, fallback: AppConfig = CONFIG_DEFAULTS): Promise<AppConfig> {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('REMOTE_CONFIG_TIMEOUT')), timeoutMs)
    );

    const fetchConfig = (async () => {
      const { data, error } = await supabase.functions.invoke<Partial<AppConfig>>('get-config');
      if (error || !data) throw error ?? new Error('No config');
      return { ...fallback, ...data } as AppConfig;
    })();

    return Promise.race([fetchConfig, timeout]);
  },
};
