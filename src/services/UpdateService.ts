/**
 * UpdateService.ts
 *
 * Handles remote version checking and update launching backed by Supabase
 * (`public.app_config` table).
 *
 * Avoids the brittleness and cache synchronization issues of over-the-air bundle
 * swapping by providing a transparent, database-driven version check and direct
 * update delivery path.
 */

import { Platform, Linking } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from '../api/supabase';
import { CrashLogger } from './LoggingService';
import { AppUpdateConfig, AppUpdateInfo } from '../types/updates';

/**
 * Pure semantic version comparison helper.
 * Returns:
 *   1 if v1 > v2
 *  -1 if v1 < v2
 *   0 if v1 === v2
 */
export function compareSemver(v1: string, v2: string): number {
  const sanitize = (v: string) => v.replace(/^v/, '').trim();
  const parts1 = sanitize(v1).split('.').map(num => parseInt(num, 10) || 0);
  const parts2 = sanitize(v2).split('.').map(num => parseInt(num, 10) || 0);

  const length = Math.max(parts1.length, parts2.length);
  for (let i = 0; i < length; i++) {
    const p1 = parts1[i] ?? 0;
    const p2 = parts2[i] ?? 0;
    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }
  return 0;
}

export const UpdateService = {
  /**
   * Retrieves the current installed app version from Expo constants.
   */
  getCurrentVersion(): string {
    return Constants.expoConfig?.version ?? '1.0.0';
  },

  /**
   * Checks Supabase `public.app_config` for the `app_version` remote config.
   * Compares the remote `latest_version` against the running version.
   */
  async checkForUpdates(): Promise<AppUpdateInfo | null> {
    const currentVersion = this.getCurrentVersion();

    try {
      const { data, error } = await supabase
        .from('app_config')
        .select('value')
        .eq('key', 'app_version')
        .maybeSingle();

      if (error) {
        CrashLogger.error(error, 'UpdateService.checkForUpdates');
        return null;
      }

      if (!data || !data.value) {
        // No version config entry present in database yet
        return {
          isAvailable: false,
          isForced: false,
          currentVersion,
          latestVersion: currentVersion,
        };
      }

      const config = data.value as AppUpdateConfig;
      const latestVersion = config.latest_version || currentVersion;
      const isAvailable = compareSemver(latestVersion, currentVersion) > 0;

      let isForced = false;
      if (config.minimum_version && compareSemver(config.minimum_version, currentVersion) > 0) {
        isForced = true;
      } else if (config.force_update) {
        isForced = true;
      }

      let downloadUrl: string | undefined;
      if (typeof config.download_url === 'string') {
        downloadUrl = config.download_url;
      } else if (config.download_url && typeof config.download_url === 'object') {
        downloadUrl = Platform.OS === 'ios' ? config.download_url.ios : config.download_url.android;
      }

      return {
        isAvailable,
        isForced,
        currentVersion,
        latestVersion,
        minimumVersion: config.minimum_version,
        releaseNotes: config.release_notes,
        downloadUrl,
      };
    } catch (err) {
      CrashLogger.error(err, 'UpdateService.checkForUpdates');
      return null;
    }
  },

  /**
   * Launches the download or store link using React Native's Linking API.
   */
  async openUpdate(url?: string): Promise<boolean> {
    if (!url) return false;

    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
        return true;
      } else {
        CrashLogger.error(new Error(`Cannot open URL: ${url}`), 'UpdateService.openUpdate');
        return false;
      }
    } catch (err) {
      CrashLogger.error(err, 'UpdateService.openUpdate');
      return false;
    }
  },
};
