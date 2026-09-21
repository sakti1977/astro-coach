import { describe, it, expect, afterEach } from "vitest";
import { resolveAuthEnv } from "./auth-env";

describe("resolveAuthEnv", () => {
  const originalSecret = process.env.NEXTAUTH_SECRET;
  const originalAuthSecret = process.env.AUTH_SECRET;
  const originalUrl = process.env.NEXTAUTH_URL;
  const originalAuthUrl = process.env.AUTH_URL;

  afterEach(() => {
    for (const [key, value] of [
      ["NEXTAUTH_SECRET", originalSecret],
      ["AUTH_SECRET", originalAuthSecret],
      ["NEXTAUTH_URL", originalUrl],
      ["AUTH_URL", originalAuthUrl],
    ] as const) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("copies AUTH_SECRET and AUTH_URL onto the NextAuth v4 names", () => {
    delete process.env.NEXTAUTH_SECRET;
    delete process.env.NEXTAUTH_URL;
    process.env.AUTH_SECRET = "alias-secret";
    process.env.AUTH_URL = "https://example.com";

    const resolved = resolveAuthEnv();
    expect(resolved.secret).toBe("alias-secret");
    expect(resolved.url).toBe("https://example.com");
    expect(process.env.NEXTAUTH_SECRET).toBe("alias-secret");
    expect(process.env.NEXTAUTH_URL).toBe("https://example.com");
  });

  it("does not overwrite an existing NEXTAUTH_SECRET", () => {
    process.env.NEXTAUTH_SECRET = "canonical";
    process.env.AUTH_SECRET = "alias-secret";
    expect(resolveAuthEnv().secret).toBe("canonical");
  });
});
