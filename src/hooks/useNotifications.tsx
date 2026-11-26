import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { mergeNotificationPreferences } from '../constants/notifications';
import { NotificationBanner } from '../components/common/NotificationBanner';
import { NotificationService } from '../services/NotificationService';
import { startNotificationListener } from '../services/notificationListener';
import { UserService } from '../services/UserService';
import { CrashLogger } from '../services/LoggingService';
import { useAuth } from './useAuth';
import {
  InAppNotificationPayload,
  NotificationNavigationTarget,
  NotificationPreferences,
} from '../types/notifications';

const BANNER_TIMEOUT_MS = 4500;

interface NotificationContextValue {
  preferences: NotificationPreferences;
  showInAppBanner: (payload: InAppNotificationPayload) => void;
  dismissBanner: () => void;
  savePreferences: (next: NotificationPreferences) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

interface NotificationProviderProps {
  navigationRef: React.RefObject<any>;
  children: React.ReactNode;
}

export const NotificationProvider = ({ navigationRef, children }: NotificationProviderProps) => {
  const { user, updateNotificationPreferences } = useAuth();
  const [activeBanner, setActiveBanner] = useState<InAppNotificationPayload | null>(null);
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const preferences = useMemo(
    () => mergeNotificationPreferences(user?.notificationPreferences),
    [user?.notificationPreferences]
  );

  const preferencesRef = useRef<NotificationPreferences>(preferences);
  preferencesRef.current = preferences;

  const dismissBanner = useCallback(() => {
    if (bannerTimerRef.current) {
      clearTimeout(bannerTimerRef.current);
      bannerTimerRef.current = null;
    }
    setActiveBanner(null);
  }, []);

  const showInAppBanner = useCallback(
    (payload: InAppNotificationPayload) => {
      if (bannerTimerRef.current) {
        clearTimeout(bannerTimerRef.current);
      }
      setActiveBanner(payload);
      bannerTimerRef.current = setTimeout(() => {
        setActiveBanner(null);
        bannerTimerRef.current = null;
      }, BANNER_TIMEOUT_MS);
    },
    []
  );

  const navigateToTarget = useCallback(
    (target: NotificationNavigationTarget) => {
      const nav = navigationRef.current;
      if (!nav) return;

      if (target.tab === 'FriendsTab') {
        nav.navigate('FriendsTab');
        return;
      }

      if (target.tab === 'MessagesTab') {
        nav.navigate('MessagesTab', {
          screen: target.screen,
          params: target.params,
        });
        return;
      }

      nav.navigate('ListsTab', {
        screen: target.screen,
        params: target.params,
      });
    },
    [navigationRef]
  );

  const handleBannerPress = useCallback(
    (payload: InAppNotificationPayload) => {
      dismissBanner();
      if (payload.navigationTarget) {
        navigateToTarget(payload.navigationTarget);
      }
    },
    [dismissBanner, navigateToTarget]
  );

  const savePreferences = useCallback(
    async (next: NotificationPreferences) => {
      if (!user?.uid) return;
      const normalized = mergeNotificationPreferences(next);
      await UserService.updateNotificationPreferences(user.uid, normalized);
      updateNotificationPreferences(normalized);
    },
    [user?.uid, updateNotificationPreferences]
  );

  useEffect(() => {
    if (!user?.uid) {
      dismissBanner();
      return;
    }

    let isCancelled = false;

    NotificationService.initializeNotifications(true).catch((err) => {
      if (!isCancelled) {
        CrashLogger.error(err, 'NotificationProvider.initialize');
      }
    });

    const stopListener = startNotificationListener({
      userId: user.uid,
      getPreferences: () => preferencesRef.current,
      onInAppNotification: showInAppBanner,
      onNavigate: navigateToTarget,
    });

    return () => {
      isCancelled = true;
      stopListener();
    };
  }, [user?.uid, showInAppBanner, navigateToTarget, dismissBanner]);

  useEffect(() => {
    return () => {
      if (bannerTimerRef.current) {
        clearTimeout(bannerTimerRef.current);
      }
    };
  }, []);

  return (
    <NotificationContext.Provider
      value={{
        preferences,
        showInAppBanner,
        dismissBanner,
        savePreferences,
      }}
    >
      {children}
      <NotificationBanner
        notification={activeBanner}
        onPress={handleBannerPress}
        onDismiss={dismissBanner}
      />
    </NotificationContext.Provider>
  );
};

export const useNotifications = (): NotificationContextValue => {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return ctx;
};
