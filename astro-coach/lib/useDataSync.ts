"use client";

import { useSession } from "next-auth/react";
import { useEffect, useRef } from "react";
import { storage } from "@/lib/storage-supabase";

export function useDataSync() {
  const { data: session } = useSession();
  const hasSynced = useRef(false);

  useEffect(() => {
    async function syncData() {
      if (session?.user?.id && !hasSynced.current) {
        try {
          // Sync from server on first load
          await storage.syncFromServer(session.user.id);
          hasSynced.current = true;
        } catch (error) {
          console.error("Failed to sync from server:", error);
        }
      }
    }

    syncData();
  }, [session?.user?.id]);

  const syncToServer = async () => {
    if (session?.user?.id) {
      try {
        await storage.syncToServer(session.user.id);
      } catch (error) {
        console.error("Failed to sync to server:", error);
        throw error;
      }
    }
  };

  return { syncToServer };
}
