# ResearchClaw Web Workflow Parity Test Runbook

**Purpose:** Provide the manual release-gate checklist for the staged web workflow parity effort.

**Parity contract:** Workflow parity, not pixel-identical desktop parity.

**Current release gate:** **Phase 1 only** — core research workflow parity.

**Phase 1 implementation status:** Code-complete with automated coverage for all Phase-1 browser workflow surfaces. The remaining release decision is manual runbook execution and evidence capture, not additional Phase-1 implementation.

Phase 2 and Phase 3 case groups are included as a draft inventory so later work can extend the same case-ID system without changing the document shape.

## Evidence policy

For every executed case, capture:

1. runtime start command used
2. browser URL used
3. screenshot or terminal output proving the result
4. exact failure symptom if the case does not pass
5. automated test file that covers the same behavior, if it exists

Do not mark a case as passed based on memory or assumptions.

## Environment preparation

### Clean-room setup

1. Choose a fresh storage directory:

```bash
export RESEARCH_CLAW_STORAGE_DIR="$(mktemp -d)"
```

2. Install dependencies and build the web runtime:

```bash
npm install
npm run build:web
```

3. Start the runtime:

```bash
npm run start:web
```

4. Confirm the app is reachable:

```bash
curl -sS http://127.0.0.1:3456/health
```

Expected: JSON containing `{"status":"ok","mode":"single-user-first"}`.

5. Open the browser at `http://127.0.0.1:3456`.

### Evidence folder recommendation

Save screenshots and terminal captures under a session folder such as:

```text
artifacts/manual-web-parity/2026-03-19/
```

## Phase 1 execution order

Run Phase 1 cases in the order below. This keeps failures easy to localize.

### Case PH1-BOOT-001 — Runtime boot and shell load

- **Scope:** Phase 1
- **Automated coverage:** `tests/integration/web-runtime-pure-node.test.ts`, `tests/integration/web-config.test.ts`, `tests/integration/web-server-health.test.ts`
- **Preconditions:** Clean storage directory, runtime started with `npm run start:web`

**Steps:**

1. Open `http://127.0.0.1:3456/`.
2. Confirm the browser receives HTML instead of JSON.
3. Confirm the top-level shell renders the web title and navigation.

**Expected result:**

- page loads without server error
- shell renders successfully
- browser console does not show missing preload / `window.electronAPI` dependency errors

**Failure signs:**

- blank page
- 404/500 HTML response
- console error about Electron-only globals

**Evidence to save:**

- screenshot of the loaded shell
- terminal output from `npm run start:web`

### Case PH1-LIB-001 — Library list loads existing papers

- **Scope:** Phase 1
- **Automated coverage:** `tests/integration/web-papers.test.ts`, `tests/frontend/web/library-page.test.tsx`
- **Preconditions:** At least one paper exists in storage

**Steps:**

1. Open `/`.
2. Verify the paper cards render.
3. Open one paper from the library list.

**Expected result:**

- existing papers are visible
- titles and authors render
- navigation moves into the paper workflow instead of dead-ending

**Failure signs:**

- empty state despite seeded data
- broken links
- cards render but navigation fails

**Evidence to save:**

- screenshot of the paper list
- screenshot of the clicked paper destination

### Case PH1-IMPORT-ARXIV-001 — Import an arXiv identifier from the browser UI

- **Scope:** Phase 1
- **Automated coverage:** `tests/integration/web-import.test.ts`, `tests/frontend/web/library-page.test.tsx`
- **Preconditions:** Runtime started; network available or test doubles configured in automated environments

**Steps:**

1. Open the import workspace on the library page.
2. Select identifier kind `arxiv`.
3. Enter a valid arXiv identifier.
4. Submit the import.
5. Observe job state and navigation outcome.

**Expected result:**

- the request succeeds
- a new paper appears in the library / overview flow
- job progress, if shown, moves to completion

**Failure signs:**

- import button does nothing
- server returns 400/500
- paper never appears after a reported success

**Evidence to save:**

- screenshot before submission
- screenshot after import completes
- captured network response or terminal log

### Case PH1-IMPORT-DOI-001 — Import a DOI from the browser workflow

- **Scope:** Phase 1 target
- **Automated coverage:** `tests/integration/web-import.test.ts`, `tests/frontend/web/import-workspace.test.tsx`
- **Preconditions:** Phase-1 DOI support has landed

**Steps:**

1. Open the import workspace.
2. Select identifier kind `doi`.
3. Enter a valid DOI.
4. Submit and wait for completion.

**Expected result:**

- the browser flow only reports success after metadata and a usable PDF are both acquired
- the resulting paper has meaningful overview content (not just the DOI string)
- the paper becomes available through library/search/overview/reader

**Failure signs:**

- old arXiv-only restriction remains
- import reports success but overview is empty or reader has no document
- import creates a hollow paper shell instead of returning an error on incomplete DOI enrichment

**Evidence to save:**

- screenshot of submitted DOI form
- screenshot of resulting paper page

### Case PH1-IMPORT-PDF-001 — Upload a PDF from the browser workflow

- **Scope:** Phase 1
- **Automated coverage:** `tests/integration/web-import.test.ts`, `tests/frontend/web/import-workspace.test.tsx`
- **Preconditions:** A realistic research-paper PDF smaller than 25 MB is available locally

**Steps:**

1. Open the import workspace.
2. Switch to PDF upload.
3. Upload a PDF smaller than 25 MB.
4. Submit the upload and wait for completion.

**Expected result:**

- upload succeeds
- a new paper record is created
- the paper is reopenable from the browser workflow

**Failure signs:**

- upload control does not accept the file
- 413 or generic 500 for a valid PDF smaller than 25 MB
- imported paper cannot be reopened

**Evidence to save:**

- screenshot of the selected file
- screenshot of the completed import result

### Case PH1-JOBS-001 — Job list and progress recovery

- **Scope:** Phase 1
- **Automated coverage:** `tests/integration/web-job-stream.test.ts`, `tests/frontend/web/jobs-page.test.tsx`
- **Preconditions:** At least one import or analysis job exists

**Steps:**

1. Open the browser jobs page.
2. Confirm that current jobs render with state and progress.
3. Refresh the page.
4. Confirm the same job can still be recovered.

**Expected result:**

- jobs list loads from `/jobs`
- progress is visible
- page refresh does not erase server-owned job state

**Failure signs:**

- empty jobs page while the server reports jobs
- SSE updates never appear
- refreshed page loses existing job status

**Evidence to save:**

- screenshot before refresh
- screenshot after refresh
- network capture showing `/jobs` and/or SSE traffic

### Case PH1-SEARCH-001 — Search reopens imported papers

- **Scope:** Phase 1
- **Automated coverage:** `tests/integration/web-reading-search.test.ts`, `tests/frontend/web/search-page.test.tsx`
- **Preconditions:** At least one imported paper exists

**Steps:**

1. Open `/search`.
2. Enter a text query that should match an imported paper.
3. Open the matched paper from the results.

**Expected result:**

- correct paper appears in results
- the result links into the browser paper workflow

**Failure signs:**

- query returns no result despite matching data
- result links are broken or route to the wrong page

**Evidence to save:**

- screenshot of query + results
- screenshot of destination page

### Case PH1-PAPER-001 — Paper overview workflow

- **Scope:** Phase 1 target
- **Automated coverage:** `tests/integration/web-paper-detail.test.ts`, `tests/frontend/web/paper-overview-page.test.tsx`
- **Preconditions:** Phase-1 paper overview page has landed

**Steps:**

1. Open a paper from library or search.
2. Confirm the overview shows metadata, abstract, and workflow actions.
3. Navigate from overview to reader.
4. Navigate from overview to notes.

**Expected result:**

- overview loads without desktop-only controls leaking into the browser UI
- reader and notes are reachable from the overview page

**Failure signs:**

- overview route 404s
- page renders but actions do not work
- browser page depends on Electron-only behavior

**Evidence to save:**

- screenshot of overview metadata
- screenshots of reader and notes navigation from the overview page

### Case PH1-READER-001 — Browser-safe reading workspace

- **Scope:** Phase 1 target
- **Automated coverage:** `tests/frontend/web/reader-page.test.tsx`, `tests/integration/web-reading-search.test.ts`
- **Preconditions:** A paper with a stored PDF exists; Phase-1 reader upgrade has landed

**Steps:**

1. Open `/papers/:paperId/reader`.
2. Verify the paper asset is reachable from the browser page.
3. Confirm metadata and abstract remain visible.
4. Open notes from the reader.

**Expected result:**

- browser page can access the paper asset through a server route
- the reading page remains navigable
- notes integration still works
- on common laptop widths, the notes summary remains beside the reader instead of dropping below it

**Failure signs:**

- broken PDF frame / broken paper asset route
- reader only shows placeholder text after the upgrade was supposed to land

**Evidence to save:**

- screenshot of the reader page
- screenshot or browser devtools evidence of the paper asset request

### Case PH1-NOTES-001 — Save and reopen notes

- **Scope:** Phase 1
- **Automated coverage:** `tests/integration/web-reading-search.test.ts`, `tests/frontend/web/reader-page.test.tsx`
- **Preconditions:** Paper exists

**Steps:**

1. Open the notes page for a paper.
2. Create or update the note content.
3. Save the note.
4. Refresh the page.
5. Reopen the paper and confirm the note persists.

**Expected result:**

- note save succeeds
- refreshed or reopened page shows the saved content

**Failure signs:**

- save button succeeds visually but data disappears on refresh
- note content saved under the wrong paper

**Evidence to save:**

- screenshot before save
- screenshot after refresh and reopen

### Case PH1-ERR-IDENTIFIER-001 — Invalid identifier error handling

- **Scope:** Phase 1
- **Automated coverage:** `tests/integration/web-import.test.ts`
- **Preconditions:** Runtime started

**Steps:**

1. Submit an invalid identifier payload from the browser UI if supported.
2. If the UI path is not yet implemented, reproduce with:

```bash
curl -sS -X POST http://127.0.0.1:3456/import/identifier \
  -H 'content-type: application/json' \
  -d '{"value":12345,"kind":"arxiv"}'
```

**Expected result:**

- request is rejected with a clear error
- no partial paper record is created

**Failure signs:**

- generic 500
- inconsistent client-side state after the failure

**Evidence to save:**

- screenshot of UI error or curl response body

### Case PH1-ERR-PDF-001 — Oversized PDF rejection

- **Scope:** Phase 1
- **Automated coverage:** `tests/integration/web-import.test.ts`
- **Preconditions:** Runtime started; an oversized PDF or blob is available

**Steps:**

1. Attempt to upload a PDF larger than 25 MB.
2. If UI upload is not yet available, reproduce with the existing API path.

**Expected result:**

- request is rejected with HTTP 413 / a matching user-visible error
- no paper record is created

**Failure signs:**

- upload succeeds unexpectedly
- generic 500 instead of a clear size error

**Evidence to save:**

- screenshot of error state or terminal response

### Case PH1-PERSIST-001 — Restart persistence

- **Scope:** Phase 1
- **Automated coverage:** `tests/integration/web-runtime-pure-node.test.ts`
- **Preconditions:** At least one imported paper and one saved note exist

**Steps:**

1. Stop the runtime.
2. Restart with the same `RESEARCH_CLAW_STORAGE_DIR`.
3. Reopen the browser app.
4. Confirm library entries and note content still exist.

**Expected result:**

- paper metadata persists
- notes persist
- runtime does not reinitialize into an empty state

**Failure signs:**

- data loss after restart
- database init errors on restart

**Evidence to save:**

- terminal output of both starts
- screenshots showing the same paper/note before and after restart

## Phase 1 exit criteria

Phase 1 is ready only when:

1. all Phase-1 manual cases above pass
2. linked automated coverage passes
3. `npm run lint` passes
4. `npm run test` passes
5. `npm run test:frontend` passes
6. `npm run build` passes

## Phase 1 closeout snapshot (2026-03-19)

**Current status:** Phase 1 implementation and automated verification are complete. Manual browser evidence capture from the PH1 cases above is still the remaining release-signoff step.

### Automated execution record captured for Task 7

**Targeted Phase-1 suites executed:**

- `npm run test -- tests/unit/web-contracts.test.ts tests/unit/http-client.test.ts tests/integration/web-paper-detail.test.ts tests/integration/web-import.test.ts tests/integration/web-reading-search.test.ts tests/integration/web-job-stream.test.ts tests/integration/web-config.test.ts` → `7 passed`; `60 passed`
- `npm run test:frontend -- tests/frontend/web/library-page.test.tsx tests/frontend/web/import-workspace.test.tsx tests/frontend/web/paper-overview-page.test.tsx tests/frontend/web/reader-page.test.tsx tests/frontend/web/jobs-page.test.tsx tests/frontend/web/search-page.test.tsx` → `6 passed`; `11 passed`

**Repository-level release gate executed:**

- `npm run lint` → passed
- `npm run test` → passed on the authoritative sequential rerun (`52 passed`, `1 skipped`; `537 passed`, `48 skipped`)
- `npm run test:frontend` → passed (`12 passed`; `120 passed`)
- `npm run build` → passed

### Phase-1 case IDs with direct automated coverage

- `PH1-BOOT-001` → `tests/integration/web-runtime-pure-node.test.ts`, `tests/integration/web-config.test.ts`, `tests/integration/web-server-health.test.ts`
- `PH1-LIB-001` → `tests/integration/web-papers.test.ts`, `tests/frontend/web/library-page.test.tsx`
- `PH1-IMPORT-ARXIV-001` → `tests/integration/web-import.test.ts`, `tests/frontend/web/library-page.test.tsx`
- `PH1-IMPORT-DOI-001` → `tests/integration/web-import.test.ts`, `tests/frontend/web/import-workspace.test.tsx`
- `PH1-IMPORT-PDF-001` → `tests/integration/web-import.test.ts`, `tests/frontend/web/import-workspace.test.tsx`
- `PH1-JOBS-001` → `tests/integration/web-job-stream.test.ts`, `tests/frontend/web/jobs-page.test.tsx`, `tests/integration/web-config.test.ts`
- `PH1-SEARCH-001` → `tests/integration/web-reading-search.test.ts`, `tests/frontend/web/search-page.test.tsx`
- `PH1-PAPER-001` → `tests/integration/web-paper-detail.test.ts`, `tests/frontend/web/paper-overview-page.test.tsx`, `tests/integration/web-config.test.ts`
- `PH1-READER-001` → `tests/integration/web-reading-search.test.ts`, `tests/frontend/web/reader-page.test.tsx`
- `PH1-NOTES-001` → `tests/integration/web-reading-search.test.ts`, `tests/frontend/web/reader-page.test.tsx`
- `PH1-ERR-IDENTIFIER-001` → `tests/integration/web-import.test.ts`
- `PH1-ERR-PDF-001` → `tests/integration/web-import.test.ts`
- `PH1-PERSIST-001` → `tests/integration/web-runtime-pure-node.test.ts`

### Known non-blocking verification notes

- `npm run test` first showed one timeout in `tests/integration/web-runtime-pure-node.test.ts` when it was run in parallel with build/frontend/lint; the same file passed immediately when rerun alone, and the full suite passed on the final sequential rerun
- `npm run test:frontend` still emits known non-fatal Happy DOM iframe fetch noise for `http://localhost:3000/papers/paper-1/pdf`
- `npm run test:frontend` still emits pre-existing unrelated `act(...)` warnings in `TodoForm` / `IdeaChatModal` tests
- `npm run build` still emits existing non-fatal large-bundle warnings for `dist/main`, `dist/renderer`, and `dist/server`

## Draft inventory for later phases

These are **not** part of the current release gate. They exist so later work can reuse the same case-ID structure.

### Phase 2 draft case groups

- `PH2-DASH-*` — dashboard workflow
- `PH2-PROJ-*` — projects and project detail workflows
- `PH2-TODO-*` — agent-todo workflows
- `PH2-READ-CHAT-*` — reader-side analysis / chat workstation behaviors
- `PH2-JOB-ACTION-*` — advanced long-running workflow recovery

### Phase 3 draft case groups

- `PH3-SET-*` — settings adaptation and persistence
- `PH3-PROFILE-*` — profile workflow parity
- `PH3-GRAPH-*` — citation graph browser behavior
- `PH3-PLATFORM-*` — Electron-sensitive affordance replacements
