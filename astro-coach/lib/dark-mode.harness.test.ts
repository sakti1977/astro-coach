import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

// Dark mode is class-based (`dark:` variants, see app/globals.css). A new
// surface or text colour added without its dark counterpart renders as a
// white box / invisible text for dark-theme users, so the common offenders
// are checked here.
const ROOT = process.cwd();

function tsxFiles(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) tsxFiles(full, acc);
    else if (full.endsWith(".tsx")) acc.push(full);
  }
  return acc;
}

const RULES: Array<[RegExp, string]> = [
  [/(?<![:\w-])bg-white(?![\w/-])/, "dark:bg-"],
  [/(?<![:\w-])text-gray-900(?![\w-])/, "dark:text-"],
  [/(?<![:\w-])border-gray-100(?![\w-])/, "dark:border-"],
];

describe("dark mode coverage", () => {
  it("light surfaces and text always carry a dark: counterpart in the same class list", () => {
    const problems: string[] = [];
    for (const file of [...tsxFiles(join(ROOT, "app")), ...tsxFiles(join(ROOT, "components"))]) {
      const src = readFileSync(file, "utf8");
      for (const literal of src.match(/"[^"\n]*"|`[^`]*`/g) ?? []) {
        for (const [light, dark] of RULES) {
          if (light.test(literal) && !literal.includes(dark)) {
            problems.push(`${relative(ROOT, file)}: ${literal.slice(0, 80)}`);
          }
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it("the theme is applied before first paint", () => {
    const layout = readFileSync(join(ROOT, "app/layout.tsx"), "utf8");
    expect(layout).toContain("THEME_BOOT_SCRIPT");
    const css = readFileSync(join(ROOT, "app/globals.css"), "utf8");
    expect(css).toContain("@custom-variant dark");
  });
});
