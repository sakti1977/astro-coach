import { describe, expect, it } from "vitest";
import { buildUpiLink, isValidUpiId, normaliseAmount, readSupportConfig } from "./support";

describe("readSupportConfig", () => {
  it("is off when no UPI ID is configured, so the feature stays hidden", () => {
    expect(readSupportConfig(undefined, undefined)).toBeNull();
    expect(readSupportConfig("   ", "Name")).toBeNull();
  });

  it("rejects something that is not a UPI ID", () => {
    expect(readSupportConfig("https://evil.example", "x")).toBeNull();
    expect(readSupportConfig("name@", "x")).toBeNull();
  });

  it("defaults the payee name", () => {
    expect(readSupportConfig("astro.coach@ybl", "")).toEqual({ upiId: "astro.coach@ybl", payeeName: "Astro Coach" });
  });
});

describe("isValidUpiId", () => {
  it.each(["astrocoach@ybl", "sakti.b-1@okhdfcbank", "98xxxxxx10@paytm"])("accepts %s", (id) => {
    expect(isValidUpiId(id)).toBe(true);
  });
  it.each(["no-at-sign", "a@b", "a b@ybl", "x@ybl&am=1"])("rejects %s", (id) => {
    expect(isValidUpiId(id)).toBe(false);
  });
});

describe("normaliseAmount", () => {
  it("accepts whole rupees in range", () => {
    expect(normaliseAmount(101)).toBe(101);
    expect(normaliseAmount("251")).toBe(251);
  });
  it.each([0, -5, 1.5, 100_001, "abc", "", null])("rejects %s", (v) => {
    expect(normaliseAmount(v as number)).toBeNull();
  });
});

describe("buildUpiLink", () => {
  const config = { upiId: "astrocoach@ybl", payeeName: "Astro Coach" };

  it("builds an NPCI deep link with the amount in rupees", () => {
    expect(buildUpiLink(config, 101)).toBe(
      "upi://pay?pa=astrocoach%40ybl&pn=Astro%20Coach&cu=INR&tn=Support%20Astro%20Coach&am=101.00"
    );
  });

  it("leaves the amount to the payer when none (or an invalid one) is given", () => {
    expect(buildUpiLink(config)).not.toContain("am=");
    expect(buildUpiLink(config, 0)).not.toContain("am=");
  });

  it("encodes the payee name so it can't inject parameters", () => {
    expect(buildUpiLink({ ...config, payeeName: "A&am=99999" })).toContain("pn=A%26am%3D99999");
  });
});
