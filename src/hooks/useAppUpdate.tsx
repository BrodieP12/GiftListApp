/**
 * useAppUpdate.tsx
 *
 * Provides application update state and actions to the component tree via
 * React context. Automatically checks for updates on app load and makes the
 * result available instantly without blocking the initial screen render.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { UpdateService } from '../services/UpdateService';
import { AppUpdateInfo } from '../types/updates';

interface UpdateContextType {
  isChecking: boolean;
  updateInfo: AppUpdateInfo | null;
  error: string | null;
  checkForUpdates: () => Promise<void>;
  openUpdate: () => Promise<boolean>;
}

const UpdateContext = createContext<UpdateContextType | undefined>(undefined);

export const UpdateProvider = ({ children }: { children: React.ReactNode }) => {
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [updateInfo, setUpdateInfo] = useState<AppUpdateInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checkForUpdates = useCallback(async () => {
    setIsChecking(true);
    setError(null);
    try {
      const info = await UpdateService.checkForUpdates();
      if (info) {
        setUpdateInfo(info);
      } else {
        setError('Unable to check for updates');
      }
    } catch {
      setError('Network error while checking for updates');
    } finally {
      setIsChecking(false);
    }
  }, []);

  const openUpdate = useCallback(async (): Promise<boolean> => {
    if (!updateInfo?.downloadUrl) return false;
    return await UpdateService.openUpdate(updateInfo.downloadUrl);
  }, [updateInfo]);

  // Check for updates automatically on app mount
  useEffect(() => {
    checkForUpdates();
  }, [checkForUpdates]);

  return (
    <UpdateContext.Provider
      value={{
        isChecking,
        updateInfo,
        error,
        checkForUpdates,
        openUpdate,
      }}
    >
      {children}
    </UpdateContext.Provider>
  );
};

export const useAppUpdate = (): UpdateContextType => {
  const context = useContext(UpdateContext);
  if (!context) {
    throw new Error('useAppUpdate must be used within an UpdateProvider');
  }
  return context;
};
