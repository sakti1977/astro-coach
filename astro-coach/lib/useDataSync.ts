"use client";

import { useSession } from "next-auth/react";
import { useEffect, useRef, useState, useCallback } from "react";
import { storage } from "@/lib/storage-supabase";
import { getProfile } from "@/lib/profile";

export interface SyncState {
  isSyncing: boolean;
  lastSyncedAt: string | null; // ISO string
  error: string | null;
}

export function useDataSync() {
  const { data: session } = useSession();
  const hasSynced = useRef(false);
  const [syncState, setSyncState] = useState<SyncState>({
    isSyncing: false,
    lastSyncedAt: null,
    error: null,
  });

  const updateSyncState = (partial: Partial<SyncState>) => {
    setSyncState((prev) => ({ ...prev, ...partial }));
  };

  const performSyncFrom = useCallback(async (userId: string) => {
    updateSyncState({ isSyncing: true, error: null });
    try {
      await storage.syncFromServer(userId);
      const now = new Date().toISOString();
      updateSyncState({ isSyncing: false, lastSyncedAt: now, error: null });
      return now;
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Sync failed";
      console.error("Failed to sync from server:", error);
      updateSyncState({ isSyncing: false, error: msg });
      throw error;
    }
  }, []);

  useEffect(() => {
    async function syncData() {
      if (session?.user?.id && !hasSynced.current) {
        hasSynced.current = true;
        try {
          // Claim guest data: a chart-only guest who just signed up has real
          // local data and a brand-new (blank) server profile. Push before
          // pulling so that local data is backed up before anything could
          // pull the blank profile back down over it — storage-supabase.ts's
          // syncFromServer also refuses that overwrite as a backstop, but
          // this is what actually gets the guest's chart onto their account.
          if (getProfile().chart) {
            await storage.syncToServer(session.user.id);
          }
          await performSyncFrom(session.user.id);
        } catch {
          // error already handled in performSyncFrom/storage layer
        }
      }
    }

    syncData();
  }, [session?.user?.id, performSyncFrom]);

  const syncToServer = useCallback(async () => {
    if (!session?.user?.id) return;

    updateSyncState({ isSyncing: true, error: null });
    try {
      await storage.syncToServer(session.user.id);
      const now = new Date().toISOString();
      updateSyncState({ isSyncing: false, lastSyncedAt: now, error: null });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Sync failed";
      console.error("Failed to sync to server:", error);
      updateSyncState({ isSyncing: false, error: msg });
      throw error;
    }
  }, [session?.user?.id]);

  const forceSyncFromServer = async () => {
    if (session?.user?.id) {
      await performSyncFrom(session.user.id);
    }
  };

  return {
    syncToServer,
    forceSyncFromServer,
    ...syncState,
  };
}
