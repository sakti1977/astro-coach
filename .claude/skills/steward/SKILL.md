---
name: steward
description: How this repo's owner wants PRs driven for Jyotish Coach (sakti1977/astro-coach) — branch, commit, PR, CI, merge and post-merge deploy check. Read before opening, watching or merging a PR here.
---

# PR conventions for sakti1977/astro-coach

- **Branch:** work on the session's designated branch. If its last PR merged, restart it from
  `origin/main` (`git checkout -B <branch> origin/main`, `--force-with-lease` push is fine).
- **Checks before push** (all must pass): in `astro-coach/`: `npx vitest run`, `npx tsc --noEmit -p .`,
  `npx eslint app components lib` (2 pre-existing `_userId` warnings are expected), and
  `NEXTAUTH_SECRET=x npx next build` for UI/route changes. Python: `pytest -q` in `python-service/`
  (deps: `python3 -m venv` + `pip install -r requirements-dev.txt`).
- **CI** (`.github/workflows/ci.yml`): `astro-coach`, `python-service`, `one-host-compose`,
  `one-host-image`. ~2 min. No review bots, no Claude Approvals check.
- **Merging:** the owner merges by saying "merge". Never merge unprompted. Use
  `merge_method: "merge"` with `expectedHeadSha` = the CI-green head. Then unsubscribe from the PR
  and delete any check-in trigger.
- **After merge:** Railway auto-deploys `main` (~1.5–2 min). Confirm with `list-deployments`
  (SUCCESS on the merge SHA); see the `astro-coach-ops` skill for why a merge is the only way to get
  new `NEXT_PUBLIC_*` values built in.
- **Issues:** close them with `Closes #N` lines in the PR body; earlier fixes merged without it left
  issues open.
- **Commits/PR bodies:** plain-language summaries of what changed and why; list what was verified
  and what could not be (e.g. no API key → no live model replies; no WebKit → no real iOS check).
- Keep `NON_NEGOTIABLES.md` gates green; the harness tests enforce most of them.
