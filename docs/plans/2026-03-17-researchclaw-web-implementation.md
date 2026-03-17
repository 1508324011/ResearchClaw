# ResearchClaw Web Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deliver the first server-first web slice of ResearchClaw for a single-user, Docker-first workflow focused on paper import, reading, structured notes, and search.

**Architecture:** Keep the current Electron app operational while introducing a new browser path through shared contracts, transport-neutral client code, a `src/server` runtime, and a `src/web` UI. The first implementation must stay narrow: papers, reading, search, and job progress only. Projects, remote agents, and Edge extension capture are explicitly deferred.

**Tech Stack:** TypeScript, React 19, Vite, Electron legacy runtime, Node server runtime, SQLite, Vitest, Testing Library, Docker

---

### Task 1: Freeze shared contracts for the first web slice

**Files:**
- Create: `src/shared/contracts/papers.ts`
- Create: `src/shared/contracts/reading.ts`
- Create: `src/shared/contracts/search.ts`
- Create: `src/shared/contracts/jobs.ts`
- Create: `tests/unit/web-contracts.test.ts`

**Step 1: Write the failing test**

Create `tests/unit/web-contracts.test.ts` to assert the new contract modules export the request and response shapes required for:
- paper import and library listing
- reading detail + note save operations
- search query and result payloads
- job status and streamed progress events

**Step 2: Run test to verify it fails**

Run: `npm run test -- tests/unit/web-contracts.test.ts`

Expected: FAIL because the contract files do not exist yet.

**Step 3: Write minimal implementation**

Create the four shared contract files with browser-safe types only. Do not import Electron, Node, Prisma client instances, or renderer-specific modules.

**Step 4: Run test to verify it passes**

Run: `npm run test -- tests/unit/web-contracts.test.ts`

Expected: PASS with the contract surface defined.

**Step 5: Commit**

```bash
git add src/shared/contracts/papers.ts src/shared/contracts/reading.ts src/shared/contracts/search.ts src/shared/contracts/jobs.ts tests/unit/web-contracts.test.ts
git commit -m "feat: add shared contracts for web paper workflows"
```

### Task 2: Introduce a transport-neutral renderer client

**Files:**
- Create: `src/renderer/lib/researchclaw-client.ts`
- Create: `src/renderer/lib/electron-client.ts`
- Create: `src/renderer/lib/http-client.ts`
- Modify: `src/renderer/hooks/use-ipc.ts`
- Create: `tests/unit/http-client.test.ts`

**Step 1: Write the failing test**

Create `tests/unit/http-client.test.ts` to verify the browser client can call a fetch-based implementation for paper, reading, search, and job endpoints without requiring `window.electronAPI`.

**Step 2: Run test to verify it fails**

Run: `npm run test -- tests/unit/http-client.test.ts`

Expected: FAIL because the new client abstraction does not exist.

**Step 3: Write minimal implementation**

Add a shared client interface and two adapters:
- Electron adapter delegates to the existing invoke/on/off behavior
- HTTP adapter uses `fetch` and SSE-friendly helpers for browser usage

Refactor `use-ipc.ts` so browser paths do not immediately throw on missing preload when an HTTP client is configured.

**Step 4: Run test to verify it passes**

Run: `npm run test -- tests/unit/http-client.test.ts`

Expected: PASS with a transport-neutral client boundary.

**Step 5: Commit**

```bash
git add src/renderer/lib/researchclaw-client.ts src/renderer/lib/electron-client.ts src/renderer/lib/http-client.ts src/renderer/hooks/use-ipc.ts tests/unit/http-client.test.ts
git commit -m "refactor: add transport-neutral renderer client"
```

### Task 3: Add the server runtime skeleton for single-user web access

**Files:**
- Create: `src/server/index.ts`
- Create: `src/server/app.ts`
- Create: `src/server/routes/health.routes.ts`
- Create: `src/server/routes/papers.routes.ts`
- Create: `src/server/routes/reading.routes.ts`
- Create: `src/server/routes/search.routes.ts`
- Create: `src/server/routes/jobs.routes.ts`
- Create: `src/server/config/server-config.ts`
- Create: `tests/integration/web-server-health.test.ts`

**Step 1: Write the failing test**

Create `tests/integration/web-server-health.test.ts` to boot the server app in-process and verify:
- health endpoint responds successfully
- paper, reading, search, and jobs route groups are registered

**Step 2: Run test to verify it fails**

Run: `npm run test -- tests/integration/web-server-health.test.ts`

Expected: FAIL because the server runtime does not exist.

**Step 3: Write minimal implementation**

Create a minimal Node server app with route registration, config loading, and an explicit single-user-first deployment comment in config docs. Do not add projects or SSH routes in this phase.

**Step 4: Run test to verify it passes**

Run: `npm run test -- tests/integration/web-server-health.test.ts`

Expected: PASS with the initial web runtime bootable.

**Step 5: Commit**

```bash
git add src/server/index.ts src/server/app.ts src/server/routes/health.routes.ts src/server/routes/papers.routes.ts src/server/routes/reading.routes.ts src/server/routes/search.routes.ts src/server/routes/jobs.routes.ts src/server/config/server-config.ts tests/integration/web-server-health.test.ts
git commit -m "feat: add server runtime skeleton for web workflows"
```

### Task 4: Move paper import to server-owned upload and identifier flows

**Files:**
- Create: `src/server/routes/import.routes.ts`
- Create: `src/server/services/web-import.service.ts`
- Modify: `src/main/services/papers.service.ts`
- Modify: `src/main/services/ingest.service.ts`
- Modify: `src/main/store/storage-path.ts`
- Create: `tests/integration/web-import.test.ts`

**Step 1: Write the failing test**

Create `tests/integration/web-import.test.ts` to verify the server can:
- accept uploaded PDF input
- accept arXiv / DOI / URL import input
- persist paper metadata and server-owned storage paths

**Step 2: Run test to verify it fails**

Run: `npm run test -- tests/integration/web-import.test.ts`

Expected: FAIL because browser-facing import routes and server import service do not exist.

**Step 3: Write minimal implementation**

Add server-owned import handlers that translate browser input into the existing paper creation flow. Keep local browser-history scanning out of scope. Ensure storage path code supports a server storage root cleanly.

**Step 4: Run test to verify it passes**

Run: `npm run test -- tests/integration/web-import.test.ts`

Expected: PASS with browser-native import entry points working against server storage.

**Step 5: Commit**

```bash
git add src/server/routes/import.routes.ts src/server/services/web-import.service.ts src/main/services/papers.service.ts src/main/services/ingest.service.ts src/main/store/storage-path.ts tests/integration/web-import.test.ts
git commit -m "feat: add server-owned web import flows"
```

### Task 5: Add reading, notes, search, and job-event web APIs

**Files:**
- Create: `src/server/jobs/job-bus.ts`
- Create: `src/server/routes/job-stream.routes.ts`
- Modify: `src/main/ipc/reading.ipc.ts`
- Modify: `src/main/services/reading.service.ts`
- Modify: `src/main/services/paper-processing.service.ts`
- Modify: `src/main/services/semantic-search.service.ts`
- Create: `tests/integration/web-reading-search.test.ts`
- Create: `tests/integration/web-job-stream.test.ts`

**Step 1: Write the failing tests**

Create integration tests that verify:
- reading detail and note save endpoints work through server routes
- search endpoint returns expected results using the shared contracts
- job stream endpoint emits progress events over SSE

**Step 2: Run tests to verify they fail**

Run:
- `npm run test -- tests/integration/web-reading-search.test.ts`
- `npm run test -- tests/integration/web-job-stream.test.ts`

Expected: FAIL because the web reading/search route surface and job streaming path do not exist.

**Step 3: Write minimal implementation**

Add server routes backed by shared services, then introduce a small job bus so import and analysis progress can be observed in a browser without `BrowserWindow.webContents.send`.

**Step 4: Run tests to verify they pass**

Run:
- `npm run test -- tests/integration/web-reading-search.test.ts`
- `npm run test -- tests/integration/web-job-stream.test.ts`

Expected: PASS with browser-consumable reading, notes, search, and progress events.

**Step 5: Commit**

```bash
git add src/server/jobs/job-bus.ts src/server/routes/job-stream.routes.ts src/main/ipc/reading.ipc.ts src/main/services/reading.service.ts src/main/services/paper-processing.service.ts src/main/services/semantic-search.service.ts tests/integration/web-reading-search.test.ts tests/integration/web-job-stream.test.ts
git commit -m "feat: add web reading search and job event routes"
```

### Task 6: Deliver the first browser-native paper workflow UI

**Files:**
- Create: `src/web/main.tsx`
- Create: `src/web/router.tsx`
- Create: `src/web/pages/library/page.tsx`
- Create: `src/web/pages/search/page.tsx`
- Create: `src/web/pages/papers/reader/page.tsx`
- Create: `src/web/pages/papers/notes/page.tsx`
- Modify: `src/renderer/components/import-modal.tsx`
- Create: `tests/frontend/web/library-page.test.tsx`
- Create: `tests/frontend/web/search-page.test.tsx`
- Create: `tests/frontend/web/reader-page.test.tsx`

**Step 1: Write the failing frontend tests**

Create frontend tests that verify the web pages can:
- render a library list from mocked browser client data
- run a search from browser client data
- show reader and notes workflows without depending on Electron preload

**Step 2: Run tests to verify they fail**

Run:
- `npm run test:frontend -- tests/frontend/web/library-page.test.tsx`
- `npm run test:frontend -- tests/frontend/web/search-page.test.tsx`
- `npm run test:frontend -- tests/frontend/web/reader-page.test.tsx`

Expected: FAIL because the browser-native web pages do not exist yet.

**Step 3: Write minimal implementation**

Add a dedicated web entrypoint and pages for the first release workflow. Reuse presentational pieces where sensible, but do not force full desktop/web parity. Keep projects out of the first web UI.

**Step 4: Run tests to verify they pass**

Run:
- `npm run test:frontend -- tests/frontend/web/library-page.test.tsx`
- `npm run test:frontend -- tests/frontend/web/search-page.test.tsx`
- `npm run test:frontend -- tests/frontend/web/reader-page.test.tsx`

Expected: PASS with a browser-native path for library, search, reader, and notes.

**Step 5: Commit**

```bash
git add src/web/main.tsx src/web/router.tsx src/web/pages/library/page.tsx src/web/pages/search/page.tsx src/web/pages/papers/reader/page.tsx src/web/pages/papers/notes/page.tsx src/renderer/components/import-modal.tsx tests/frontend/web/library-page.test.tsx tests/frontend/web/search-page.test.tsx tests/frontend/web/reader-page.test.tsx
git commit -m "feat: add first browser-native paper workflow UI"
```

### Task 7: Add Docker-first packaging for the single-user web runtime

**Files:**
- Create: `Dockerfile.web`
- Create: `docker-compose.web.yml`
- Create: `docs/plans/2026-03-17-researchclaw-web-deploy-notes.md`
- Modify: `package.json`
- Create: `tests/integration/web-config.test.ts`

**Step 1: Write the failing integration test**

Create `tests/integration/web-config.test.ts` to verify required server config values resolve correctly for a Docker-backed single-user deployment, including storage root and runtime mode.

**Step 2: Run test to verify it fails**

Run: `npm run test -- tests/integration/web-config.test.ts`

Expected: FAIL because the Docker-focused web runtime config path is incomplete.

**Step 3: Write minimal implementation**

Add Docker packaging and runtime script support for the web server path. Persist SQLite and paper storage to a mounted volume. Keep auth assumptions simple and documented for a private single-user deployment.

**Step 4: Run test to verify it passes**

Run: `npm run test -- tests/integration/web-config.test.ts`

Expected: PASS with Docker-first configuration behavior captured.

**Step 5: Commit**

```bash
git add Dockerfile.web docker-compose.web.yml docs/plans/2026-03-17-researchclaw-web-deploy-notes.md package.json tests/integration/web-config.test.ts
git commit -m "feat: add docker-first packaging for web runtime"
```

### Task 8: Final verification and project documentation update

**Files:**
- Modify: `changelog.md`
- Modify: `README.md`
- Modify: `README_CN.md`

**Step 1: Run full verification**

Run:
- `npm run lint`
- `npm run test`
- `npm run test:frontend`
- `npm run build`

Expected: PASS for the supported subset, or a clearly documented list of remaining known failures with root causes if desktop Electron binary download still blocks certain install paths.

**Step 2: Update documentation**

Document the new server-first web workflow, Docker-first deployment notes, and the intentionally deferred scope: projects, remote agents, and Edge extension capture.

**Step 3: Update changelog**

Append a concise session entry summarizing the new web migration work and validation evidence.

**Step 4: Re-run verification**

Run:
- `npm run lint`
- `npm run test`

Expected: PASS or explicitly documented blocker evidence.

**Step 5: Commit**

```bash
git add changelog.md README.md README_CN.md
git commit -m "docs: update web migration and deployment guidance"
```
