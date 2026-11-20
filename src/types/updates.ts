/**
 * updates.ts
 *
 * TypeScript types and interfaces for the Supabase-backed app versioning
 * and in-app update checking system.
 */

export interface AppUpdateConfig {
  latest_version: string;
  minimum_version?: string;
  release_notes?: string;
  download_url?: string | {
    android?: string;
    ios?: string;
  };
  force_update?: boolean;
}

export interface AppUpdateInfo {
  isAvailable: boolean;
  isForced: boolean;
  currentVersion: string;
  latestVersion: string;
  minimumVersion?: string;
  releaseNotes?: string;
  downloadUrl?: string;
}
