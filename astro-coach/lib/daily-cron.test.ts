// @vitest-environment node
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SCRIPT = join(process.cwd(), "..", "deploy", "daily-cron.sh");

function fn(body: string, env: Record<string, string> = {}) {
  return spawnSync("bash", ["-c", `source "${SCRIPT}"; ${body}`], {
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
}

// 2026-09-26T01:00:00Z and friends
const at = (iso: string) => String(Date.parse(iso) / 1000);

describe("daily-cron.sh scheduling", () => {
  it("waits until today's 02:30 UTC when it's earlier", () => {
    const r = fn("seconds_until_next", { NOW_EPOCH: at("2026-09-26T01:00:00Z") });
    expect(r.stdout.trim()).toBe(String(90 * 60));
  });

  it("waits until tomorrow when today's run has passed", () => {
    const r = fn("seconds_until_next", { NOW_EPOCH: at("2026-09-26T03:00:00Z") });
    expect(r.stdout.trim()).toBe(String(23.5 * 3600));
  });

  it("honours CRON_UTC_TIME", () => {
    const r = fn("seconds_until_next", { NOW_EPOCH: at("2026-09-26T03:00:00Z"), CRON_UTC_TIME: "04:00" });
    expect(r.stdout.trim()).toBe(String(3600));
  });

  it("catches up only within the window after today's run time", () => {
    expect(fn("in_catchup_window", { NOW_EPOCH: at("2026-09-26T04:00:00Z") }).status).toBe(0);
    expect(fn("in_catchup_window", { NOW_EPOCH: at("2026-09-26T09:00:00Z") }).status).toBe(1);
    expect(fn("in_catchup_window", { NOW_EPOCH: at("2026-09-26T02:00:00Z") }).status).toBe(1);
  });

  it("does nothing without CRON_SECRET", () => {
    const r = spawnSync("bash", [SCRIPT, "3000"], { encoding: "utf8", env: { ...process.env, CRON_SECRET: "" } });
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("daily notifications are off");
  });
});

describe("daily-cron.sh --once", () => {
  it("calls the notifications endpoint with the cron bearer token", async () => {
    const seen: Array<{ url?: string; auth?: string }> = [];
    const server = createServer((req, res) => {
      seen.push({ url: req.url, auth: req.headers.authorization });
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ processed: 2, sent: 1 }));
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = (server.address() as AddressInfo).port;

    const out = await new Promise<{ code: number | null; stdout: string }>((resolve) => {
      const child = spawn("bash", [SCRIPT, String(port), "--once"], {
        env: { ...process.env, CRON_SECRET: "test-secret" },
      });
      let stdout = "";
      child.stdout.on("data", (d) => (stdout += d));
      child.on("close", (code) => resolve({ code, stdout }));
    });
    server.close();

    expect(out.code).toBe(0);
    expect(seen).toEqual([{ url: "/api/cron/notifications", auth: "Bearer test-secret" }]);
    expect(out.stdout).toContain('notifications ok: {"processed":2,"sent":1}');
  });

  it("retries and reports failure without crashing", async () => {
    let calls = 0;
    const server = createServer((_req, res) => {
      calls++;
      res.statusCode = 503;
      res.end("{}");
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = (server.address() as AddressInfo).port;
    const code = await new Promise<number | null>((resolve) => {
      const child = spawn("bash", [SCRIPT, String(port), "--once"], {
        env: { ...process.env, CRON_SECRET: "s", CRON_RETRY_SLEEP: "0" },
      });
      child.on("close", resolve);
    });
    server.close();
    expect(calls).toBe(3);
    expect(code).toBe(1);
  });
});
