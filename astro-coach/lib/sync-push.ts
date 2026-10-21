import type { SupabaseClient } from "@supabase/supabase-js";

export interface SyncObservationRow {
  observation_id: string;
  timestamp: string;
  text: string;
  category: string;
  exchange_index: number;
}

export interface SyncPushInput {
  userId: string;
  /** Snake-case user_profiles columns. Keys left undefined keep their stored value. */
  profileRow: Record<string, unknown>;
  /** undefined leaves cloud observations untouched; [] clears them. */
  observations?: SyncObservationRow[];
  expectedRevision?: number;
  force?: boolean;
}

export type SyncPushResult =
  | { ok: true; revision?: number }
  | { ok: false; conflict: true; revision?: number };

// supabase-js reports a missing function as PGRST202 (PostgREST schema cache)
// or 42883 (Postgres). The route ships before/independently of migration 009,
// so this must degrade to the old write path instead of failing every sync.
function isMissingFunction(error: { code?: string; message?: string }): boolean {
  return (
    error.code === "PGRST202"
    || error.code === "42883"
    || /could not find the function/i.test(error.message ?? "")
  );
}

/**
 * Writes the profile and replaces observations in one database transaction
 * (public.sync_push, migration 009), rejecting the write when the caller's
 * expected revision is stale.
 */
export async function pushSync(admin: SupabaseClient, input: SyncPushInput): Promise<SyncPushResult> {
  const { data, error } = await admin.rpc("sync_push", {
    p_user_id: input.userId,
    p_profile: input.profileRow,
    p_observations: input.observations ?? null,
    p_expected_revision: input.expectedRevision ?? null,
    p_force: input.force ?? false,
  });

  if (!error) {
    const result = data as { ok?: boolean; conflict?: boolean; revision?: number } | null;
    if (result?.conflict) return { ok: false, conflict: true, revision: result.revision };
    return { ok: true, revision: result?.revision };
  }
  if (!isMissingFunction(error)) throw error;

  await pushSyncLegacy(admin, input);
  return { ok: true };
}

/**
 * Non-transactional fallback for when migration 009 isn't applied. It still
 * can't lose data on a failed write: new observations are inserted before the
 * old ones are removed, and every result is checked.
 */
async function pushSyncLegacy(admin: SupabaseClient, input: SyncPushInput): Promise<void> {
  const { userId, profileRow, observations } = input;

  const { error: profileError } = await admin
    .from("user_profiles")
    .upsert({ user_id: userId, ...profileRow, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (profileError) throw profileError;

  if (!observations) return;

  const { data: oldRows, error: readError } = await admin
    .from("coaching_observations")
    .select("id")
    .eq("user_id", userId);
  if (readError) throw readError;

  if (observations.length > 0) {
    const { error: insertError } = await admin
      .from("coaching_observations")
      .insert(observations.map((obs) => ({ user_id: userId, ...obs })));
    if (insertError) throw insertError;
  }

  const oldIds = (oldRows ?? []).map((row: { id: string }) => row.id);
  if (oldIds.length > 0) {
    const { error: deleteError } = await admin
      .from("coaching_observations")
      .delete()
      .eq("user_id", userId)
      .in("id", oldIds);
    if (deleteError) throw deleteError;
  }
}
