import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { pushSync } from "./sync-push";

const obs = [{ observation_id: "o1", timestamp: "2026-01-01T00:00:00Z", text: "t", category: "behavior", exchange_index: 1 }];
const base = { userId: "u1", profileRow: { chart: null, goals: [] }, observations: obs };

function fakeAdmin(opts: {
  rpc: { data?: unknown; error?: { code?: string; message?: string } | null };
  oldIds?: string[];
  failOn?: "upsert" | "insert" | "delete";
}) {
  const calls: string[] = [];
  const result = (op: string) => ({ error: opts.failOn === op ? { message: `${op} failed` } : null });
  const rpc = vi.fn<(fn: string, args: Record<string, unknown>) => Promise<typeof opts.rpc>>(async () => opts.rpc);
  const admin = {
    rpc,
    from: (table: string) => ({
      upsert: async () => { calls.push(`${table}.upsert`); return result("upsert"); },
      insert: async () => { calls.push(`${table}.insert`); return result("insert"); },
      select: () => ({ eq: async () => ({ data: (opts.oldIds ?? []).map((id) => ({ id })), error: null }) }),
      delete: () => ({
        eq: () => ({ in: async () => { calls.push(`${table}.delete`); return result("delete"); } }),
      }),
    }),
  };
  return { admin: admin as unknown as SupabaseClient, rpc, calls };
}

describe("pushSync", () => {
  it("passes everything to the transactional function and returns the new revision", async () => {
    const { admin, rpc, calls } = fakeAdmin({ rpc: { data: { ok: true, revision: 4 } } });
    const res = await pushSync(admin, { ...base, expectedRevision: 3 });
    expect(res).toEqual({ ok: true, revision: 4 });
    expect(rpc).toHaveBeenCalledWith("sync_push", {
      p_user_id: "u1",
      p_profile: base.profileRow,
      p_observations: obs,
      p_expected_revision: 3,
      p_force: false,
    });
    expect(calls).toEqual([]);
  });

  it("sends null observations when the client omitted them", async () => {
    const { admin, rpc } = fakeAdmin({ rpc: { data: { ok: true, revision: 1 } } });
    await pushSync(admin, { userId: "u1", profileRow: {} });
    expect(rpc.mock.calls[0][1]).toMatchObject({ p_observations: null, p_expected_revision: null });
  });

  it("reports a stale revision as a conflict", async () => {
    const { admin } = fakeAdmin({ rpc: { data: { ok: false, conflict: true, revision: 9 } } });
    expect(await pushSync(admin, { ...base, expectedRevision: 3 })).toEqual({ ok: false, conflict: true, revision: 9 });
  });

  it("throws real database errors instead of falling back", async () => {
    const { admin, calls } = fakeAdmin({ rpc: { error: { code: "23505", message: "boom" } } });
    await expect(pushSync(admin, base)).rejects.toMatchObject({ code: "23505" });
    expect(calls).toEqual([]);
  });

  describe("when migration 009 is not applied", () => {
    const missing = { error: { code: "PGRST202", message: "Could not find the function public.sync_push" } };

    it("inserts the new observations before removing the old ones", async () => {
      const { admin, calls } = fakeAdmin({ rpc: missing, oldIds: ["a", "b"] });
      expect(await pushSync(admin, base)).toEqual({ ok: true });
      expect(calls).toEqual([
        "user_profiles.upsert",
        "coaching_observations.insert",
        "coaching_observations.delete",
      ]);
    });

    it("keeps the old observations when the insert fails", async () => {
      const { admin, calls } = fakeAdmin({ rpc: missing, oldIds: ["a"], failOn: "insert" });
      await expect(pushSync(admin, base)).rejects.toMatchObject({ message: "insert failed" });
      expect(calls).not.toContain("coaching_observations.delete");
    });

    it("surfaces a failed cleanup delete", async () => {
      const { admin } = fakeAdmin({ rpc: missing, oldIds: ["a"], failOn: "delete" });
      await expect(pushSync(admin, base)).rejects.toMatchObject({ message: "delete failed" });
    });
  });
});
