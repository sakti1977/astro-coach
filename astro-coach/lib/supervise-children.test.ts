import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const LIB = join(process.cwd(), "..", "deploy", "supervise-children.sh");

function run(body: string) {
  return spawnSync("bash", ["-c", body], { encoding: "utf8" });
}

describe("supervise_children", () => {
  it("exits 1 and stops Next.js when the ephemeris process dies", () => {
    const result = run(`
      set -euo pipefail
      source "${LIB}"
      sleep 30 &
      python_pid=$!
      sleep 30 &
      next_pid=$!
      kill "$python_pid"
      supervise_children "$python_pid" "$next_pid"
    `);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Ephemeris process exited");
  });

  it("stops the ephemeris process when Next.js exits", () => {
    const result = run(`
      set -euo pipefail
      source "${LIB}"
      sleep 30 &
      python_pid=$!
      bash -c 'sleep 0.2; exit 7' &
      next_pid=$!
      supervise_children "$python_pid" "$next_pid"
    `);
    expect(result.status).toBe(7);
    expect(result.stderr).toContain("Next.js exited");
  });
});
