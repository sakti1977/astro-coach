<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Cloud Agent development

The repo root `.cursor/environment.json` starts two services via terminals:

- **ephemeris-api** — Python FastAPI on port 8000 (`python-service/.venv/bin/uvicorn`)
- **nextjs-dev** — Next.js dev server on port 3000 (`astro-coach/`)

Guest chart calculation works without Supabase or Anthropic keys. For auth/coaching features, copy `astro-coach/.env.example` to `astro-coach/.env.local` and fill in secrets.

Canonical checks (from repo root):

```bash
cd astro-coach && npm test && npx tsc --noEmit
cd ../python-service && .venv/bin/pytest -q
```
