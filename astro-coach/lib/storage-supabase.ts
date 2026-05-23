"use client";

import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { UserProfile, CoachingObservation } from "./profile";
import { getProfile, saveProfile } from "./profile";
import { supabase } from "./supabase";

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
  async syncToServer(userId: string): Promise<void> {
    try {
      const profile = getProfile();
      const observations = await this.getObservations();

      // Upsert user profile
      const { error: profileError } = await supabase
        .from("user_profiles")
        .upsert({
          user_id: userId,
          birth_data: profile.birthData as unknown as Record<string, unknown>,
          chart: profile.chart as unknown as Record<string, unknown>,
          dashas: profile.dashas as unknown as Record<string, unknown>,
          validation: profile.validation as unknown as Record<string, unknown>,
          goals: profile.goals as unknown as Record<string, unknown>,
          habits: profile.habits as unknown as Record<string, unknown>,
          chat_history: profile.chatHistory as unknown as Record<string, unknown>,
          coaching: profile.coaching as unknown as Record<string, unknown>,
          updated_at: new Date().toISOString(),
        });

      if (profileError) throw profileError;

      // Delete existing observations and insert new ones
      await supabase
        .from("coaching_observations")
        .delete()
        .eq("user_id", userId);

      if (observations.length > 0) {
        const { error: obsError } = await supabase
          .from("coaching_observations")
          .insert(
            observations.map((obs) => ({
              user_id: userId,
              observation_id: obs.id,
              timestamp: obs.timestamp,
              text: obs.text,
              category: obs.category,
              exchange_index: obs.exchangeIndex,
            }))
          );

        if (obsError) throw obsError;
      }
    } catch (error) {
      console.error("Error syncing to server:", error);
      throw error;
    }
  }

  async syncFromServer(userId: string): Promise<void> {
    try {
      // Fetch user profile
      const { data: profileData, error: profileError } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (profileError && profileError.code !== "PGRST116") {
        throw profileError;
      }

      if (profileData) {
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
            includeReligiousSolutions: false,
          },
        };

        saveProfile(profile);
      }

      // Fetch observations
      const { data: obsData, error: obsError } = await supabase
        .from("coaching_observations")
        .select("*")
        .eq("user_id", userId)
        .order("timestamp", { ascending: true });

      if (obsError) throw obsError;

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
