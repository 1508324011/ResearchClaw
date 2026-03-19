# ResearchClaw Web Core Workflow Parity Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deliver Phase 1 of web workflow parity by turning the current narrow browser slice into a complete core paper workflow: richer import, paper overview, browser-safe reading, notes persistence, and visible job recovery.

**Architecture:** Build on the existing same-origin runtime rather than inventing a new stack. Extend only the browser-safe contracts, web routes, and `src/web/*` pages needed for Phase 1, while treating desktop pages under `src/renderer/*` as reference material rather than a UI-copy mandate.

**Tech Stack:** TypeScript, React 19, React Router, Node HTTP runtime, SQLite/Prisma, Vitest, Testing Library, Tailwind, Vite

---

## Pre-read before implementation

1. `docs/plans/2026-03-17-researchclaw-web-design.md`
2. `docs/plans/2026-03-18-web-runtime-progress-summary.md`
3. `docs/plans/2026-03-19-web-workflow-parity-design.md`
4. `docs/plans/2026-03-19-web-workflow-parity-test-runbook.md`
5. `src/renderer/pages/papers/overview/page.tsx`
6. `src/renderer/components/import-modal.tsx`

### Task 1: Freeze the Phase-1 contract surface

**Files:**
- Modify: `src/shared/contracts/papers.ts`
- Modify: `src/shared/contracts/reading.ts`
- Modify: `src/shared/contracts/jobs.ts`
- Modify: `src/renderer/lib/researchclaw-client.ts`
- Modify: `src/renderer/lib/http-client.ts`
- Modify: `src/renderer/lib/electron-client.ts`
- Modify: `tests/unit/web-contracts.test.ts`
- Modify: `tests/unit/http-client.test.ts`

**Step 1: Write the failing tests**

Extend the unit coverage so the browser-safe contract layer locks the new Phase-1 shapes:

```ts
expect(GetPaperDetailResponseSchema.parse({
  paper: createPaperSummary(),
  pdfUrl: 'http://localhost:3456/papers/paper-1/pdf',
})).toMatchObject({ paper: { id: 'paper-1' } });

expectTypeOf<ResearchClawClient['importPdf']>().toBeFunction();
expectTypeOf<ResearchClawClient['getPaperDetail']>().toBeFunction();
```

**Step 2: Run tests to verify they fail**

Run:
- `npm run test -- tests/unit/web-contracts.test.ts`
- `npm run test -- tests/unit/http-client.test.ts`

Expected: FAIL because the new contract members and client methods do not exist yet.

**Step 3: Write minimal implementation**

Add only the Phase-1 browser-safe shapes and client methods:

- `GetPaperDetailRequest/Response`
- `importPdf(file: File)`
- `getPaperDetail({ paperId })`
- any job-list or job-detail helpers needed by the browser shell

Representative surface:

```ts
export interface ResearchClawClient {
  listPapers(request?: ListPapersRequest): Promise<ListPapersResponse>;
  importPdf(file: File): Promise<ImportPaperResponse>;
  importByIdentifier(request: ImportByIdentifierRequest): Promise<ImportPaperResponse>;
  getPaperDetail(request: GetPaperDetailRequest): Promise<GetPaperDetailResponse>;
  getReadingDetail(request: GetReadingDetailRequest): Promise<GetReadingDetailResponse>;
}
```

**Step 4: Run tests to verify they pass**

Run:
- `npm run test -- tests/unit/web-contracts.test.ts`
- `npm run test -- tests/unit/http-client.test.ts`

Expected: PASS with the Phase-1 contract surface locked.

**Step 5: Commit**

```bash
git add src/shared/contracts/papers.ts src/shared/contracts/reading.ts src/shared/contracts/jobs.ts src/renderer/lib/researchclaw-client.ts src/renderer/lib/http-client.ts src/renderer/lib/electron-client.ts tests/unit/web-contracts.test.ts tests/unit/http-client.test.ts
git commit -m "refactor: expand web client contracts for workflow parity"
```

### Task 2: Add server routes for paper detail, paper asset access, and broader identifier import

**Files:**
- Modify: `src/server/routes/papers.routes.ts`
- Modify: `src/server/routes/import.routes.ts`
- Modify: `src/server/services/web-import.service.ts`
- Modify: `src/main/services/papers.service.ts`
- Create: `tests/integration/web-paper-detail.test.ts`
- Modify: `tests/integration/web-import.test.ts`

**Step 1: Write the failing integration tests**

Add or extend integration coverage for:

```ts
const detailResponse = await fetch(`${baseUrl}/papers/${paper.id}`);
expect(detailResponse.status).toBe(200);

const pdfResponse = await fetch(`${baseUrl}/papers/${paper.id}/pdf`);
expect(pdfResponse.status).toBe(200);
expect(pdfResponse.headers.get('content-type')).toContain('application/pdf');

const doiResponse = await fetch(`${baseUrl}/import/identifier`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ value: '10.1000/example-doi', kind: 'doi' }),
});
expect(doiResponse.status).toBe(200);
```

**Step 2: Run tests to verify they fail**

Run:
- `npm run test -- tests/integration/web-paper-detail.test.ts`
- `npm run test -- tests/integration/web-import.test.ts`

Expected: FAIL because the detail route, PDF route, and broader identifier behavior are incomplete.

**Step 3: Write minimal implementation**

Implement only the server behavior needed for Phase 1:

- `GET /papers/:paperId`
- `GET /papers/:paperId/pdf`
- broaden `/import/identifier` beyond the arXiv-only browser UI path
- keep response shapes aligned with the shared contracts from Task 1

Minimal route shape:

```ts
if (req.method === 'GET' && pathname === `/papers/${paperId}`) {
  sendJson(res, 200, GetPaperDetailResponseSchema.parse({
    paper: mapPaperSummary(paper),
    pdfUrl: `/papers/${paper.id}/pdf`,
  }));
}
```

**Step 4: Run tests to verify they pass**

Run:
- `npm run test -- tests/integration/web-paper-detail.test.ts`
- `npm run test -- tests/integration/web-import.test.ts`

Expected: PASS with browser-safe paper detail and import entry points.

**Step 5: Commit**

```bash
git add src/server/routes/papers.routes.ts src/server/routes/import.routes.ts src/server/services/web-import.service.ts src/main/services/papers.service.ts tests/integration/web-paper-detail.test.ts tests/integration/web-import.test.ts
git commit -m "feat: add web paper detail and import parity routes"
```

### Task 3: Replace the narrow library import box with a browser import workspace

**Files:**
- Create: `src/web/components/import-workspace.tsx`
- Modify: `src/web/pages/library/page.tsx`
- Modify: `src/web/router.tsx`
- Modify: `tests/frontend/web/library-page.test.tsx`
- Create: `tests/frontend/web/import-workspace.test.tsx`

**Step 1: Write the failing frontend tests**

Cover the intended browser workflow rather than a single text field:

```tsx
await user.click(screen.getByRole('tab', { name: 'PDF Upload' }));
await user.upload(screen.getByLabelText('web.import.pdfInput'), pdfFile);
await waitFor(() => expect(spies.importPdf).toHaveBeenCalled());

await user.selectOptions(screen.getByLabelText('web.import.identifierKind'), 'doi');
await user.type(screen.getByLabelText('web.import.identifierValue'), '10.1000/example-doi');
await user.click(screen.getByRole('button', { name: 'web.import.submit' }));
```

**Step 2: Run tests to verify they fail**

Run:
- `npm run test:frontend -- tests/frontend/web/library-page.test.tsx`
- `npm run test:frontend -- tests/frontend/web/import-workspace.test.tsx`

Expected: FAIL because the workspace UI and client calls do not exist yet.

**Step 3: Write minimal implementation**

Create a focused browser import workspace with:

- identifier import form with explicit kind selection
- PDF upload form
- local error state
- a clear handoff into the job and reading flow after success

Keep the UI browser-native. Do **not** port Chrome-history or desktop modal complexity into Phase 1.

**Step 4: Run tests to verify they pass**

Run:
- `npm run test:frontend -- tests/frontend/web/library-page.test.tsx`
- `npm run test:frontend -- tests/frontend/web/import-workspace.test.tsx`

Expected: PASS with richer browser import behavior.

**Step 5: Commit**

```bash
git add src/web/components/import-workspace.tsx src/web/pages/library/page.tsx src/web/router.tsx tests/frontend/web/library-page.test.tsx tests/frontend/web/import-workspace.test.tsx
git commit -m "feat: add browser import workspace for web parity"
```

### Task 4: Add a browser paper overview route and navigation flow

**Files:**
- Create: `src/web/pages/papers/overview/page.tsx`
- Modify: `src/web/router.tsx`
- Modify: `src/web/pages/library/page.tsx`
- Modify: `src/web/pages/search/page.tsx`
- Create: `tests/frontend/web/paper-overview-page.test.tsx`
- Modify: `tests/integration/web-paper-detail.test.ts`

**Step 1: Write the failing tests**

Add browser navigation expectations that mirror the workflow, not the desktop shell:

```tsx
await user.click(screen.getByRole('link', { name: 'web.library.openOverview' }));
await waitFor(() => {
  expect(router.state.location.pathname).toBe('/papers/paper-1');
});

expect(await screen.findByText('Graph Foundations')).toBeInTheDocument();
expect(screen.getByRole('link', { name: 'web.paperOverview.openReader' })).toBeInTheDocument();
```

**Step 2: Run tests to verify they fail**

Run:
- `npm run test:frontend -- tests/frontend/web/paper-overview-page.test.tsx`
- `npm run test -- tests/integration/web-paper-detail.test.ts`

Expected: FAIL because there is no browser overview route yet.

**Step 3: Write minimal implementation**

Add `/papers/:paperId` to the web router and implement a browser overview page that shows the metadata and actions needed for Phase 1:

- open reader
- open notes
- open source URL when present
- show abstract and key metadata

Use `src/renderer/pages/papers/overview/page.tsx` only as a workflow reference. Do not carry over the full desktop workstation.

**Step 4: Run tests to verify they pass**

Run:
- `npm run test:frontend -- tests/frontend/web/paper-overview-page.test.tsx`
- `npm run test -- tests/integration/web-paper-detail.test.ts`

Expected: PASS with a browser overview page integrated into library and search.

**Step 5: Commit**

```bash
git add src/web/pages/papers/overview/page.tsx src/web/router.tsx src/web/pages/library/page.tsx src/web/pages/search/page.tsx tests/frontend/web/paper-overview-page.test.tsx tests/integration/web-paper-detail.test.ts
git commit -m "feat: add web paper overview workflow"
```

### Task 5: Upgrade the browser reader with server-backed paper access

**Files:**
- Create: `src/web/components/pdf-viewer.tsx`
- Modify: `src/web/pages/papers/reader/page.tsx`
- Modify: `src/web/pages/papers/notes/page.tsx`
- Modify: `tests/frontend/web/reader-page.test.tsx`
- Modify: `tests/integration/web-reading-search.test.ts`

**Step 1: Write the failing tests**

Add assertions that the browser reader can render the paper asset route and preserve note editing flow:

```tsx
expect(await screen.findByTitle('web.reader.pdfFrame')).toHaveAttribute(
  'src',
  '/papers/paper-1/pdf',
);

await user.click(screen.getByRole('link', { name: 'web.reader.openNotes' }));
await user.type(await screen.findByLabelText('web.notes.editorLabel'), 'Updated browser notes');
```

**Step 2: Run tests to verify they fail**

Run:
- `npm run test:frontend -- tests/frontend/web/reader-page.test.tsx`
- `npm run test -- tests/integration/web-reading-search.test.ts`

Expected: FAIL because the current reader only shows summary text and has no paper-asset route.

**Step 3: Write minimal implementation**

Add a browser-safe paper viewer that points at the server route from Task 2. Keep the UI intentionally narrower than the desktop chat workstation:

```tsx
<iframe
  title={t('web.reader.pdfFrame')}
  src={detail.pdfUrl}
  className="h-full min-h-[70vh] w-full rounded-xl border border-notion-border bg-white"
/>
```

Notes editing must still use the existing server-backed save flow.

**Step 4: Run tests to verify they pass**

Run:
- `npm run test:frontend -- tests/frontend/web/reader-page.test.tsx`
- `npm run test -- tests/integration/web-reading-search.test.ts`

Expected: PASS with browser-safe reading and notes continuity.

**Step 5: Commit**

```bash
git add src/web/components/pdf-viewer.tsx src/web/pages/papers/reader/page.tsx src/web/pages/papers/notes/page.tsx tests/frontend/web/reader-page.test.tsx tests/integration/web-reading-search.test.ts
git commit -m "feat: add browser-safe paper reading workflow"
```

### Task 6: Add a browser job center and workflow recovery path

**Files:**
- Create: `src/web/pages/jobs/page.tsx`
- Modify: `src/web/router.tsx`
- Modify: `src/web/pages/library/page.tsx`
- Modify: `src/web/pages/search/page.tsx`
- Create: `tests/frontend/web/jobs-page.test.tsx`
- Modify: `tests/integration/web-job-stream.test.ts`

**Step 1: Write the failing tests**

Cover browser navigation and job recovery explicitly:

```tsx
const router = createMemoryRouter(webRoutes, { initialEntries: ['/jobs'] });
expect(await screen.findByText('job-running')).toBeInTheDocument();
expect(screen.getByText('45%')).toBeInTheDocument();
```

Also extend the SSE integration test to prove the browser page can recover a snapshot and receive a later progress event.

**Step 2: Run tests to verify they fail**

Run:
- `npm run test:frontend -- tests/frontend/web/jobs-page.test.tsx`
- `npm run test -- tests/integration/web-job-stream.test.ts`

Expected: FAIL because the jobs page and recovery assertions do not exist yet.

**Step 3: Write minimal implementation**

Add a focused browser jobs page and link to it from the web shell. Reuse the existing `/jobs`, `/jobs/:id`, and SSE endpoints instead of inventing a new transport.

The page only needs to support Phase 1:

- list current jobs
- show state/progress/message
- recover state after refresh/navigation
- link back into relevant paper workflows when possible

**Step 4: Run tests to verify they pass**

Run:
- `npm run test:frontend -- tests/frontend/web/jobs-page.test.tsx`
- `npm run test -- tests/integration/web-job-stream.test.ts`

Expected: PASS with browser-visible job state and recovery.

**Step 5: Commit**

```bash
git add src/web/pages/jobs/page.tsx src/web/router.tsx src/web/pages/library/page.tsx src/web/pages/search/page.tsx tests/frontend/web/jobs-page.test.tsx tests/integration/web-job-stream.test.ts
git commit -m "feat: add web jobs page for workflow recovery"
```

### Task 7: Final phase verification and documentation sync

**Files:**
- Modify: `docs/plans/2026-03-19-web-workflow-parity-test-runbook.md`
- Modify: `changelog.md`

**Step 1: Run the targeted feature suites**

Run:
- `npm run test -- tests/unit/web-contracts.test.ts`
- `npm run test -- tests/unit/http-client.test.ts`
- `npm run test -- tests/integration/web-paper-detail.test.ts`
- `npm run test -- tests/integration/web-import.test.ts`
- `npm run test -- tests/integration/web-reading-search.test.ts`
- `npm run test -- tests/integration/web-job-stream.test.ts`
- `npm run test:frontend -- tests/frontend/web/library-page.test.tsx`
- `npm run test:frontend -- tests/frontend/web/import-workspace.test.tsx`
- `npm run test:frontend -- tests/frontend/web/paper-overview-page.test.tsx`
- `npm run test:frontend -- tests/frontend/web/reader-page.test.tsx`
- `npm run test:frontend -- tests/frontend/web/jobs-page.test.tsx`

Expected: PASS for the complete Phase-1 surface.

**Step 2: Run repository-level verification**

Run:
- `npm run lint`
- `npm run test`
- `npm run test:frontend`
- `npm run build`

Expected: PASS with fresh evidence.

**Step 3: Update the runbook and changelog**

Record the final Phase-1 behavior, any renamed routes, the exact case IDs executed, and the verification evidence.

**Step 4: Re-run the release gate**

Run:
- `npm run lint`
- `npm run test`
- `npm run test:frontend`
- `npm run build`

Expected: PASS again after documentation updates.

**Step 5: Commit**

```bash
git add docs/plans/2026-03-19-web-workflow-parity-test-runbook.md changelog.md
git commit -m "docs: finalize phase-1 web workflow parity guidance"
```
