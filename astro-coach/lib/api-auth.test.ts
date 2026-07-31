import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

// Import after the mocks are registered so getApiAccessContext picks them up.
const { getApiAccessContext } = await import("./api-auth");

function req(ip = "1.2.3.4") {
  return new NextRequest("http://localhost/api/chart", {
    headers: { "x-forwarded-for": ip },
  });
}

describe("getApiAccessContext", () => {
  const originalSecret = process.env.NEXTAUTH_SECRET;
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    vi.mocked(getServerSession).mockReset();
  });

  afterEach(() => {
    process.env.NEXTAUTH_SECRET = originalSecret;
    (process.env as Record<string, string | undefined>).NODE_ENV = originalEnv;
  });

  it("returns 401 for no session and no allowAnonymous opt-in (default, unchanged)", async () => {
    process.env.NEXTAUTH_SECRET = "test-secret";
    vi.mocked(getServerSession).mockResolvedValue(null);

    const result = await getApiAccessContext(req());
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(401);
  });

  it("returns an IP-keyed anonymous context when allowAnonymous is true and there's no session", async () => {
    process.env.NEXTAUTH_SECRET = "test-secret";
    vi.mocked(getServerSession).mockResolvedValue(null);

    const result = await getApiAccessContext(req("9.9.9.9"), { allowAnonymous: true });
    expect(result).not.toBeInstanceOf(NextResponse);
    if (result instanceof NextResponse) throw new Error("unreachable");
    expect(result.session).toBeNull();
    expect(result.rateLimitKey).toBe("ip:9.9.9.9");
  });

  it("still returns the real user context when a session exists, even with allowAnonymous true", async () => {
    process.env.NEXTAUTH_SECRET = "test-secret";
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "user-123" } } as never);

    const result = await getApiAccessContext(req(), { allowAnonymous: true });
    if (result instanceof NextResponse) throw new Error("unreachable");
    expect(result.session).not.toBeNull();
    expect(result.rateLimitKey).toBe("user:user-123");
  });

  it("dev-without-NEXTAUTH_SECRET fallback is unaffected by allowAnonymous (already anonymous either way)", async () => {
    delete process.env.NEXTAUTH_SECRET;
    (process.env as Record<string, string | undefined>).NODE_ENV = "development";

    const result = await getApiAccessContext(req("5.5.5.5"));
    if (result instanceof NextResponse) throw new Error("unreachable");
    expect(result.rateLimitKey).toBe("ip:5.5.5.5");
    expect(result.session).toBeNull();
  });
});
