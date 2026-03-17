# ResearchClaw Web Deploy Notes

## Runtime shape

Task 7 packages the server-first web runtime as a same-origin Node service:

- browser app assets are built into `dist/web`
- the Node HTTP server is bundled into `dist/server/index.js`
- the server serves SPA routes and API routes from the same origin

This keeps the first deploy target simple for a single-user Docker workflow and avoids introducing a second reverse-proxy layer before formal usage testing.

## Build commands

Use the dedicated web build when you only need the browser-native runtime:

```bash
npm run build:web
```

This produces:

- `dist/web` for the browser entry and static assets
- `dist/server/index.js` for the Node runtime entry

To run the built runtime locally:

```bash
npm run start:web
```

## Environment variables

The web runtime reads the standard server config plus a web root override:

- `RESEARCH_CLAW_HOST` — defaults to `0.0.0.0`
- `PORT` — defaults to `3456`
- `RESEARCH_CLAW_STORAGE_DIR` — storage root for papers and database
- `RESEARCH_CLAW_WEB_ROOT_DIR` — defaults to `dist/web`

## Docker usage

Build and start with Compose:

```bash
docker compose -f docker-compose.web.yml up --build
```

Then open:

```text
http://localhost:3456
```

The compose file mounts persistent application data at `/data/researchclaw` inside the container.

## Routing behavior

The runtime intentionally distinguishes browser navigation from API traffic on overlapping paths such as `/search`:

- HTML navigations with `Accept: text/html` receive `dist/web/index.html`
- API requests continue into the existing server route handlers

That split keeps browser routing compatible with the web client while preserving the Task 5 search API contract.

## Current trade-off

The first Docker-first runtime is reliability-first, not aggressively slim:

- the server still reuses services from `src/main/services`
- some of those services transitively import Electron-dependent modules
- the image therefore carries the existing runtime dependency graph for now

This is intentional for the first formal usage-testing milestone. Dependency slimming can happen after the browser workflow is validated end-to-end.
