import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const APP_ROOT = process.cwd();
const REPO_ROOT = join(APP_ROOT, "..");

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next" || name === ".git") continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, acc);
    else acc.push(full);
  }
  return acc;
}

function read(path: string): string {
  return readFileSync(path, "utf8");
}

function apiRouteFiles(): string[] {
  return walk(join(APP_ROOT, "app/api")).filter((f) => f.endsWith("route.ts"));
}

const RATE_LIMIT_EXEMPT = new Set([
  "app/api/auth/[...nextauth]/route.ts",
]);

describe("NON_NEGOTIABLES harness", () => {
  it("#1 no client-side writes to user_profiles / coaching_observations", () => {
    const clientFiles = walk(APP_ROOT).filter((f) => {
      if (!/\.(ts|tsx)$/.test(f)) return false;
      const src = read(f);
      return src.includes('"use client"') || src.includes("'use client'");
    });
    for (const file of clientFiles) {
      const src = read(file);
      expect(src, relative(APP_ROOT, file)).not.toMatch(/\.from\(\s*["']user_profiles["']\s*\)/);
      expect(src, relative(APP_ROOT, file)).not.toMatch(/\.from\(\s*["']coaching_observations["']\s*\)/);
    }
  });

  it("#2 no overclaiming encryption / RLS-as-write-guarantee in app UI copy", () => {
    const files = walk(join(APP_ROOT, "app")).filter((f) => /\.(ts|tsx)$/.test(f));
    files.push(...walk(join(APP_ROOT, "components")).filter((f) => /\.(ts|tsx)$/.test(f)));
    for (const file of files) {
      const src = read(file);
      expect(src, relative(APP_ROOT, file)).not.toMatch(/encrypted and stored securely/i);
      expect(src, relative(APP_ROOT, file)).not.toMatch(/synced to Supabase with row-level security/i);
      expect(src, relative(APP_ROOT, file)).not.toMatch(/Local only \(no Supabase\)/);
    }
    const syncStatus = read(join(APP_ROOT, "components/SyncStatus.tsx"));
    expect(syncStatus).not.toContain('"Local only"');
  });

  it("#3 every python POST that takes user input depends on the shared secret", () => {
    const src = read(join(REPO_ROOT, "python-service/main.py"));
    const posts = [...src.matchAll(/@app\.post\("([^"]+)"(.*)/g)];
    expect(posts.length).toBeGreaterThanOrEqual(4);
    for (const [, path, rest] of posts) {
      expect(rest, path).toContain("Depends(_verify_secret)");
    }
    expect(src).toContain("EPHEMERIS_SHARED_SECRET must be set on a deployed");
    expect(src).toContain("EPHEMERIS_REQUIRE_SECRET");
    const compose = read(join(REPO_ROOT, "docker-compose.yml"));
    expect(compose).toContain("EPHEMERIS_REQUIRE_SECRET");
    expect(compose).toContain("http://ephemeris:8000");
  });

  it("#4 advice disclaimer is mounted in AppShell (covers every coaching surface)", () => {
    const shell = read(join(APP_ROOT, "components/AppShell.tsx"));
    expect(shell).toContain("AdviceDisclaimer");
    const disclaimer = read(join(APP_ROOT, "components/AdviceDisclaimer.tsx"));
    expect(disclaimer).toContain("ADVICE_DISCLAIMER");
    const constants = read(join(APP_ROOT, "lib/constants.ts"));
    expect(constants).toMatch(/not a substitute for professional medical/);
  });

  it("#6 every API handler rate-limits (or is an explicit exemption)", () => {
    for (const file of apiRouteFiles()) {
      const rel = relative(APP_ROOT, file).replaceAll("\\", "/");
      const src = read(file);
      if (RATE_LIMIT_EXEMPT.has(rel)) continue;
      if (rel.includes("cron/notifications")) {
        expect(src).toContain("CRON_SECRET");
        continue;
      }
      const handlers = [...src.matchAll(/export async function (GET|POST|PUT|PATCH|DELETE)\(/g)];
      expect(handlers.length, rel).toBeGreaterThan(0);
      for (const match of handlers) {
        const start = match.index ?? 0;
        const next = src.slice(start + 1).search(/export async function /);
        const block = next === -1 ? src.slice(start) : src.slice(start, start + 1 + next);
        expect(block, `${rel} ${match[1]}`).toContain("checkRateLimit");
      }
    }
  });

  it("#6 custom rate-limit windows still use Redis when configured", () => {
    const src = read(join(APP_ROOT, "lib/rate-limit.ts"));
    expect(src).toContain("getDistributedLimiter");
    expect(src).not.toMatch(/limit !== RATE_LIMIT_MAX/);
  });

  it("#7 backup import validates through parseBackupPayload", () => {
    const src = read(join(APP_ROOT, "app/page.tsx"));
    expect(src).toContain("parseBackupPayload");
    expect(src).not.toMatch(/if \(!parsed\.chart \|\| !parsed\.dashas\)/);
  });

  it("#8 no committed nextauth/service-role secret literals", () => {
    const docs = walk(REPO_ROOT).filter((f) =>
      /\.(md|txt|example|env)$/.test(f) && !f.includes("node_modules")
    );
    const secretAssign = /NEXTAUTH_SECRET\s*=\s*[A-Za-z0-9+/]{24,}={0,2}/;
    const serviceRole = /SUPABASE_SERVICE_ROLE_KEY\s*=\s*eyJ[A-Za-z0-9._-]+/;
    for (const file of docs) {
      const src = read(file);
      expect(src, relative(REPO_ROOT, file)).not.toMatch(secretAssign);
      expect(src, relative(REPO_ROOT, file)).not.toMatch(serviceRole);
    }
  });

  it("#10/#12 coach prompt stays grounded and non-fatalistic; ritual is not the core", () => {
    const src = read(join(APP_ROOT, "lib/astrology/prompts/coach.ts"));
    expect(src).toContain("GROUNDING — NON-NEGOTIABLE");
    expect(src).toContain("Never invent a placement, remedy, timing, or life detail");
    expect(src).toContain("purushartha");
    expect(src).not.toContain("THIS IS THE CORE OF YOUR ROLE");
    expect(src).toContain("BEHAVIOR FIRST, RITUAL AS AN OPT-IN LAYER");
  });

  it("#11 every remedy table entry has a behavioral field", () => {
    const src = read(join(REPO_ROOT, "python-service/remedies.py"));
    const planets = ["sun", "moon", "mars", "mercury", "jupiter", "venus", "saturn", "rahu", "ketu"];
    for (const planet of planets) {
      const blockMatch = src.match(new RegExp(`"${planet}":\\s*\\{([\\s\\S]*?)\\n    \\},`));
      expect(blockMatch, planet).toBeTruthy();
      expect(blockMatch![1], planet).toContain('"behavioral"');
    }
  });

  it("#13 foundation reuses the coach system prompt", () => {
    const src = read(join(APP_ROOT, "app/api/foundation/route.ts"));
    expect(src).toContain("buildCoachSystemPrompt");
    expect(src).toContain("buildFoundationTask");
  });
});
