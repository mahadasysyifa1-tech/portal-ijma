# AGENTS.md

## Project Overview
AI Studio app: "Portal Akademik Idad Jamiiy" — a school schedule/academic portal built with Vite + React 19 + Express. Single-origin setup: Express serves the API and wraps Vite dev middleware on port 3000.

## Dev Command
`tsx server.ts` — starts Express on port 3000 with Vite in middleware mode (dev). Production build uses `vite build` + `esbuild` for the server.

## Environment Variables
- `GEMINI_API_KEY` — listed in `.env.example` but **not referenced anywhere in the code**. Not required to boot.
- `JSONBIN_API_KEY` / `JSONBIN_BIN_ID` — optional remote storage (jsonbin.io). When absent, the app falls back to local `data/database.json`. Not required to boot.
- `APP_URL` — listed in `.env.example`, not referenced in code. Not required.
- No external credentials are needed to run the app.

## Data Storage
- `data/database.json` — local JSON file, seeded from `src/data/initialData.ts` on first boot if absent. Must not be empty (0 bytes causes parse warnings); delete it to re-seed.
- The `data/` directory is bind-mounted from the repo.

## Sandbox Setup (docker-compose.base44.yml)
- `node:22-slim` base image, repo bind-mounted at `/app`, `node_modules` in a named volume.
- Startup: `npm install && exec npx tsx server.ts`.
- Healthcheck: `GET /api/health` via node `fetch`.
- Port 3000 mapped to host.
