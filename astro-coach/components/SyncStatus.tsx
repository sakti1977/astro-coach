"use client";

import { useDataSync } from "@/lib/useDataSync";
import { useState } from "react";

function formatLastSynced(iso: string | null): string {
  if (!iso) return "Never";
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString();
}

export default function SyncStatus() {
  const { isSyncing, lastSyncedAt, error, syncToServer, forceSyncFromServer } = useDataSync();
  const [showDetails, setShowDetails] = useState(false);

  const statusColor = error
    ? "bg-red-50 text-red-600 border-red-200"
    : isSyncing
    ? "bg-amber-50 text-amber-600 border-amber-200"
    : lastSyncedAt
    ? "bg-green-50 text-green-700 border-green-200"
    : "bg-gray-50 text-gray-500 border-gray-200";

  const statusText = isSyncing
    ? "Syncing…"
    : error
    ? "Sync error"
    : lastSyncedAt
    ? "Synced"
    : "Local only";

  const handleClick = async () => {
    if (isSyncing) return;
    try {
      await syncToServer();
      // Also pull latest if user wants fresh
      if (!error) {
        await forceSyncFromServer?.();
      }
    } catch {
      // errors are reflected in state
    }
    setShowDetails(true);
    setTimeout(() => setShowDetails(false), 2200);
  };

  return (
    <div className="relative flex items-center">
      <button
        onClick={handleClick}
        disabled={isSyncing}
        className={`flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded-full border transition-colors font-medium disabled:opacity-60 ${statusColor}`}
        title="Click to force sync with cloud"
      >
        <span
          className={`inline-block w-1.5 h-1.5 rounded-full ${
            isSyncing ? "bg-amber-500 animate-pulse" : error ? "bg-red-500" : lastSyncedAt ? "bg-green-500" : "bg-gray-400"
          }`}
        />
        {statusText}
      </button>

      {showDetails && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-gray-100 rounded-lg shadow-lg text-xs p-2 whitespace-nowrap">
          <div>Last sync: {formatLastSynced(lastSyncedAt)}</div>
          {error && <div className="text-red-600 mt-0.5">Error: {error}</div>}
          <div className="text-gray-500 mt-0.5">Click to sync now</div>
        </div>
      )}
    </div>
  );
}
