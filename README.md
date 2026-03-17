<p align="center">
  <img src="assets/icon.png" width="160" alt="ResearchClaw Logo">
</p>

<h1 align="center">ResearchClaw</h1>

<p align="center">
  <strong>AI-powered research workspace for desktop and single-user web workflows</strong>
</p>

<p align="center">
  ResearchClaw keeps the original Electron desktop app and now adds a server-first, Docker-first web runtime for import, library, search, reading, and notes.
</p>

<p align="center">
  <a href="https://github.com/Noietch/ResearchClaw/stargazers"><img src="https://img.shields.io/github/stars/Noietch/ResearchClaw?style=for-the-badge&logo=github" alt="Stars"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-CC%20BY--NC%204.0-lightgrey?style=for-the-badge" alt="License"></a>
  <a href="https://github.com/Noietch/ResearchClaw/pulls"><img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=for-the-badge" alt="PRs Welcome"></a>
  <a href="README_CN.md"><img src="https://img.shields.io/badge/README-%E4%B8%AD%E6%96%87-blue?style=for-the-badge" alt="中文文档"></a>
</p>

---

## What is ResearchClaw?

**ResearchClaw** started as a standalone **Electron desktop app** for researchers. This fork keeps that desktop app intact while extending it into a **server-first, single-user, Docker-first web runtime** so the core paper workflow can also run in a browser.

### Current fork status

- **Desktop app remains available** for the original Electron workflow.
- **Web runtime is now available for the first browser slice**: library, arXiv identifier import, search, reader, and notes.
- **Same-origin runtime**: one Node server serves both the browser app and the web APIs.
- **Docker-first deployment path**: build `dist/web` + `dist/server/index.js`, then run as a single service.

## Screenshots

### Dashboard

![Dashboard](assets/screenshot_01.png)

_Today's papers with AI-generated tags (transformer, nlp, planning, instruction-following, etc.)_

### Reading Cards

![Reading Cards](assets/screenshot_02.png)

_AI-powered reading interface with structured note-taking cards._

### Projects & Ideas

![Projects](assets/screenshot_v3.png)

_Organize papers into projects and generate AI-powered research ideas._

## Key Features

| Area                    | Description                                                                                       |
| :---------------------- | :------------------------------------------------------------------------------------------------ |
| **Desktop app**         | Original Electron workflow for dashboards, projects, chat-heavy reading, and broader app features |
| **Web library**         | Browser-native paper list backed by `GET /papers`                                                 |
| **Web import**          | Browser-native arXiv identifier import backed by `POST /papers/import`                            |
| **Web search**          | Same-origin text/semantic search via `GET /search`                                                |
| **Web reader**          | Browser-native paper summary + latest note preview via `GET /reading/:paperId`                    |
| **Web notes**           | Save structured note summaries via `POST /reading/:paperId/notes`                                 |
| **Job APIs**            | Server-owned job list/status/SSE stream for long-running browser workflows                        |
| **Single-user runtime** | Server-first workflow optimized for one researcher and Docker deployment                          |

## Requirements

- macOS 12+ (arm64 / x64), Windows 10+ (x64 / arm64), or Linux (x64 / arm64)
- Node.js >= 20 recommended
- npm >= 10 recommended

## Quick Start

### Desktop development (original app)

```bash
git clone https://github.com/Noietch/ResearchClaw.git
cd ResearchClaw
npm install

# Electron desktop development
npm run dev

# Desktop release builds
npm run release:mac
npm run release:win
npm run release:linux
```

### Web runtime development (this fork)

```bash
git clone https://github.com/Noietch/ResearchClaw.git
cd ResearchClaw
npm install

# Build the browser client + Node server runtime
npm run build:web

# Start the same-origin web runtime
npm run start:web
```

Then open `http://localhost:3456` in your browser.

### Docker-first runtime

```bash
docker compose -f docker-compose.web.yml up --build
```

This publishes the same single-user runtime on `http://localhost:3456` and stores data in the named Docker volume `researchclaw-web-data`.

## Web Runtime Environment Variables

| Variable                     | Default                      | Purpose                                        |
| :--------------------------- | :--------------------------- | :--------------------------------------------- |
| `RESEARCH_CLAW_HOST`         | `0.0.0.0`                    | Bind host for the Node HTTP server             |
| `PORT`                       | `3456`                       | Port for the same-origin web runtime           |
| `RESEARCH_CLAW_STORAGE_DIR`  | platform default storage dir | Storage root for SQLite + imported paper files |
| `RESEARCH_CLAW_WEB_ROOT_DIR` | `dist/web`                   | Directory containing the built browser app     |

## Architecture

```text
src/
  main/       # Electron main process, IPC handlers, desktop-only workflows
  renderer/   # Electron renderer app (Vite + React)
  server/     # Server-first web runtime, API routes, static app serving
  web/        # Browser-native web UI entry, router, and pages
  shared/     # Shared contracts, prompts, and browser-safe utilities
  db/         # Prisma + SQLite repositories
prisma/       # schema.prisma
tests/        # Unit, frontend, and integration tests
scripts/      # build scripts for Electron and web runtime bundles
dist/
  renderer/   # Electron renderer build output
  server/     # Web runtime server bundle (`dist/server/index.js`)
  web/        # Browser client bundle (`dist/web`)
```

- **Database**: SQLite via Prisma at `{RESEARCH_CLAW_STORAGE_DIR}/researchclaw.db`
- **AI**: Vercel AI SDK supporting Anthropic, OpenAI, Gemini, and OpenAI-compatible providers
- **Build**: esbuild (Node/Electron bundles) + Vite (renderer + browser web UI)

## Web Runtime Notes

- The browser app and web APIs share the same origin.
- `/search` is both a browser route and an API endpoint. HTML navigations are served when the request advertises `Accept: text/html`; JSON/API requests continue to the existing search API.
- The current Docker/web runtime is intentionally **reliability-first**: it reuses the existing service graph, including some Electron-adjacent dependencies pulled in through `src/main/services`.

## License

[CC BY-NC 4.0](LICENSE) — Free for non-commercial use. Attribution required. Commercial use is not permitted.

## Star History

<a href="https://star-history.com/#Noietch/VibeResearch&Date">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=Noietch/VibeResearch&type=Date&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=Noietch/VibeResearch&type=Date" />
   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=Noietch/VibeResearch&type=Date" width="100%" />
 </picture>
</a>

---

<p align="center">
  Built with ❤️ for the research community.
</p>
