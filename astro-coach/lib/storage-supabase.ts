"use client";

import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { UserProfile, CoachingObservation } from "./profile";
import { getProfile, saveProfile } from "./profile";

// ─── Storage Adapter Interface ────────────────────────────────────────────────
export interface StorageAdapter {
  getObservations(): Promise<CoachingObservation[]>;
  addObservation(obs: CoachingObservation): Promise<void>;
  clearObservations(): Promise<void>;
  getFullProfile(): Promise<UserProfile>;
  saveFullProfile(profile: UserProfile): Promise<void>;
  clearAll(): Promise<void>;
  syncToServer(userId: string): Promise<void>;
  syncFromServer(userId: string): Promise<void>;
}

// ─── IndexedDB Schema ─────────────────────────────────────────────────────────
interface AstroCoachSchema extends DBSchema {
  observations: {
    key: string;
    value: CoachingObservation;
    indexes: { "by-timestamp": string };
  };
}

const DB_NAME = "astro_coach_db";
const DB_VERSION = 1;

// ─── Supabase-enabled Adapter ─────────────────────────────────────────────────
class SupabaseStorageAdapter implements StorageAdapter {
  private _db: IDBPDatabase<AstroCoachSchema> | null = null;

  private async open(): Promise<IDBPDatabase<AstroCoachSchema>> {
    if (this._db) return this._db;
    this._db = await openDB<AstroCoachSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("observations")) {
          const store = db.createObjectStore("observations", { keyPath: "id" });
          store.createIndex("by-timestamp", "timestamp");
        }
      },
    });
    return this._db;
  }

  async getObservations(): Promise<CoachingObservation[]> {
    const db = await this.open();
    return db.getAllFromIndex("observations", "by-timestamp");
  }

  async addObservation(obs: CoachingObservation): Promise<void> {
    const db = await this.open();
    await db.put("observations", obs);
  }

  async clearObservations(): Promise<void> {
    const db = await this.open();
    await db.clear("observations");
  }

  async getFullProfile(): Promise<UserProfile> {
    return getProfile();
  }

  async saveFullProfile(profile: UserProfile): Promise<void> {
    saveProfile(profile);
  }

  async clearAll(): Promise<void> {
    await this.clearObservations();
  }

  // ─── Supabase Sync Methods ────────────────────────────────────────────────
  // Both methods go through /api/sync rather than talking to Supabase directly
  // from the browser. The browser's Supabase client is never authenticated
  // (NextAuth signs in to Supabase server-side, inside authorize()), so any
  // direct browser -> Supabase call runs as `auth.uid() = NULL` and RLS
  // rejects it silently. The server route re-derives the user id from the
  // verified NextAuth session and uses the service-role key there instead.
  async syncToServer(_userId: string): Promise<void> {
    try {
      const profile = getProfile();
      const observations = await this.getObservations();

      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, observations }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Sync failed (${res.status})`);
      }
    } catch (error) {
      console.error("Error syncing to server:", error);
      throw error;
    }
  }

  async syncFromServer(_userId: string): Promise<void> {
    try {
      const res = await fetch("/api/sync", { method: "GET" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Sync failed (${res.status})`);
      }
      const { profile: profileData, observations: obsData } = await res.json();

      if (profileData) {
        // Guest-mode safety: a brand-new account gets a blank profile row
        // upserted at sign-up (ensureProfile in lib/auth.ts), chart: null.
        // Never let that empty server profile clobber a real local chart
        // that hasn't been pushed yet — useDataSync pushes before it pulls
        // specifically to avoid needing this, but this is the backstop.
        if (!profileData.chart && getProfile().chart) {
          return;
        }

        const profile: UserProfile = {
          birthData: profileData.birth_data as UserProfile["birthData"],
          chart: profileData.chart as UserProfile["chart"],
          dashas: profileData.dashas as UserProfile["dashas"],
          validation: profileData.validation as UserProfile["validation"] || {
            questions: [],
            accuracyScore: 0,
            confirmedThemes: [],
            isValidated: false,
          },
          goals: (profileData.goals as UserProfile["goals"]) || [],
          habits: (profileData.habits as UserProfile["habits"]) || [],
          chatHistory: (profileData.chat_history as UserProfile["chatHistory"]) || [],
          coaching: profileData.coaching as UserProfile["coaching"] || {
            behaviorProfile: [],
            lastUpdated: new Date().toISOString(),
            phase: "gathering",
            exchangeCount: 0,
            planDelivered: false,
            tonePreference: "jyotish",
            includeReligiousSolutions: true,
            preferredLanguage: "en-IN",
          },
        };

        saveProfile(profile);
      }

      if (obsData && obsData.length > 0) {
        const db = await this.open();
        await db.clear("observations");

        for (const obs of obsData) {
          await db.put("observations", {
            id: obs.observation_id,
            timestamp: obs.timestamp,
            text: obs.text,
            category: obs.category as CoachingObservation["category"],
            exchangeIndex: obs.exchange_index,
          });
        }
      }
    } catch (error) {
      console.error("Error syncing from server:", error);
      throw error;
    }
  }
}

export const storage: StorageAdapter = new SupabaseStorageAdapter();
