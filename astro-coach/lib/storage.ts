"use client";

import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { UserProfile, CoachingObservation } from "./profile";
import { getProfile, saveProfile } from "./profile";

// ─── Storage Adapter Interface ────────────────────────────────────────────────
// To migrate to Supabase or another backend:
//   1. Create a class implementing StorageAdapter
//   2. Replace the IndexedDBAdapter export below with your implementation
//   Everything in the app that imports `storage` will work without changes.

export interface StorageAdapter {
  getObservations(): Promise<CoachingObservation[]>;
  addObservation(obs: CoachingObservation): Promise<void>;
  clearObservations(): Promise<void>;
  // Full profile ops — currently delegates to localStorage, ready for server storage
  getFullProfile(): Promise<UserProfile>;
  saveFullProfile(profile: UserProfile): Promise<void>;
  clearAll(): Promise<void>;
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

// ─── IndexedDB Adapter ────────────────────────────────────────────────────────
// Profile: localStorage (via existing profile.ts functions — unchanged for other components)
// Observations: IndexedDB (new, larger store, structured queries)

class IndexedDBAdapter implements StorageAdapter {
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

  // Profile delegates to localStorage for now — swap these two methods when moving to a server backend
  async getFullProfile(): Promise<UserProfile> {
    return getProfile();
  }

  async saveFullProfile(profile: UserProfile): Promise<void> {
    saveProfile(profile);
  }

  async clearAll(): Promise<void> {
    await this.clearObservations();
  }
}

export const storage: StorageAdapter = new IndexedDBAdapter();
