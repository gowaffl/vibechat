/**
 * Hook to automatically detect and sync user's timezone
 * 
 * This hook detects the device's timezone and updates the user's profile
 * if it differs from what's stored in the database. This ensures that
 * time-based AI workflows always execute in the user's current timezone.
 */

import { useEffect, useRef } from 'react';
import { useUser } from '@/contexts/UserContext';
import { api } from '@/lib/api';

/**
 * Get the device's current timezone in IANA format
 * e.g., "America/New_York", "Europe/London", "Asia/Tokyo"
 */
function getDeviceTimezone(): string {
  try {
    // Use Intl API to get IANA timezone
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch (error) {
    console.warn('[Timezone] Failed to detect device timezone:', error);
    return 'America/New_York'; // Fallback
  }
}

/**
 * Hook that syncs the user's timezone with their device
 * Runs once on mount and whenever the user object changes
 */
export function useTimezoneSync() {
  const { user, updateUser } = useUser();
  const hasSyncedRef = useRef(false);

  useEffect(() => {
    // Only sync once per session
    if (!user || hasSyncedRef.current) {
      return;
    }

    const syncTimezone = async () => {
      try {
        const deviceTimezone = getDeviceTimezone();
        
        // Check if timezone needs updating
        if (user.timezone && user.timezone === deviceTimezone) {
          console.log('[Timezone] Already in sync:', deviceTimezone);
          hasSyncedRef.current = true;
          return;
        }

        console.log('[Timezone] Syncing timezone:', {
          current: user.timezone || 'not set',
          device: deviceTimezone,
        });

        // Update timezone in backend
        await api.patch(`/api/users/${user.id}`, {
          timezone: deviceTimezone,
        });

        // Update local user context
        await updateUser({ timezone: deviceTimezone });

        console.log('[Timezone] ✅ Timezone synced successfully');
        hasSyncedRef.current = true;
      } catch (error) {
        console.error('[Timezone] Failed to sync timezone:', error);
        // Don't retry on error - will sync on next app launch
      }
    };

    syncTimezone();
  }, [user, updateUser]);
}

