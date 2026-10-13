# AGENTS.md

## Project Overview
AI Studio app: "Portal Akademik Idad Jamiiy" — a school schedule/academic portal built with Vite + React 19 + Express. Single-origin setup: Express serves the API and wraps Vite dev middleware on port 3000.

## Dev Command
`tsx server.ts` — starts Express on port 3000 with Vite in middleware mode (dev). Production build uses `vite build` + `esbuild` for the server.

## Environment Variables (as of the Turso migration in main)
- `TURSO_METADATA_URL` / `TURSO_METADATA_TOKEN` — Turso Cloud (LibSQL) credentials; **required for all data endpoints** (app boots without them but logs "Turso: OFFLINE" and `/api/database` etc. fail). Delivered via `/run/base44/app.env` (wired in docker-compose `env_file:`). Get them from app.turso.io → database → "Show credentials".
- `GEMINI_API_KEY` / `APP_URL` — listed in `.env.example`, not referenced in code. Not required.

## Data Storage
- Turso cloud database `ijma-metadata` (unified schema in `server/db/index.ts`); local SQLite fallback files under `data/` for direct download endpoints (`/api/database/download/*`). The old JSON-file/jsonbin storage was removed.

## Sandbox Setup (docker-compose.base44.yml)
- `node:22-slim` base image, repo bind-mounted at `/app`, `node_modules` in a named volume.
- Startup: `npm install && exec npx tsx server.ts`.
- Healthcheck: `GET /api/health` via node `fetch`.
- Port 3000 mapped to host.
