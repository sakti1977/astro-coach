// Full-page screenshots of the running app, signed in (mocked session) with a
// seeded profile. Env: PAGES=/,/chart  THEMES=light,dark  W=390 H=844
//   FRESH=1  no saved profile (first-time visitor)   OUT=dir
import { chromium } from "playwright";
const { profile } = process.env.FRESH ? { profile: null } : await import("./seed.mjs");
const BASE = process.env.BASE ?? "http://localhost:3123";
const OUT = process.env.OUT ?? ".";
const pages = (process.env.PAGES ?? "/,/chart,/coach,/profile").split(",");
const themes = (process.env.THEMES ?? "light,dark").split(",");
const W = Number(process.env.W ?? 1280), H = Number(process.env.H ?? 900);
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" }).catch(() => chromium.launch());
for (const theme of themes) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, colorScheme: theme, isMobile: W < 500, hasTouch: W < 500 });
  if (profile) await ctx.addInitScript((p) => localStorage.setItem("astro_coach_profile", JSON.stringify(p)), profile);
  await ctx.route("**/api/auth/session", (r) => r.fulfill({ json: { user: { id: "u1", email: "test@example.com" }, expires: "2099-01-01T00:00:00.000Z" } }));
  await ctx.route("**/api/sync", (r) => r.fulfill({ status: 503, json: { error: "off in screenshots" } }));
  const errors = [];
  for (const path of pages) {
    const page = await ctx.newPage();
    page.on("pageerror", (e) => errors.push(`${path}: ${e.message}`));
    await page.goto(BASE + path, { waitUntil: "networkidle" }).catch(() => {});
    await page.waitForTimeout(600);
    const name = path === "/" ? "home" : path.slice(1).replaceAll("/", "-");
    await page.screenshot({ path: `${OUT}/${name}-${theme}-${W}.png`, fullPage: true });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    if (overflow > 0) errors.push(`${path}: horizontal overflow ${overflow}px`);
    await page.close();
  }
  console.log(theme, errors.length ? errors : "no page errors, no overflow");
  await ctx.close();
}
await browser.close();
