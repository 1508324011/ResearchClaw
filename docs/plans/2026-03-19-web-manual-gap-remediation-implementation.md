# Web Manual Gap Remediation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the three Phase-1 manual acceptance gaps by making the browser reader layout usable, turning DOI import into a strict complete-import flow, and raising browser PDF upload limits to a realistic bounded size.

**Architecture:** Keep the existing Phase-1 web workflow and server-first runtime intact. Apply three focused fixes at the real fault lines: a responsive layout adjustment in the browser reader, a stricter server-side DOI acquisition path that only creates papers after metadata/document success, and a shared higher body-size ceiling for browser import routes.

**Tech Stack:** TypeScript, React 19, React Router, Node HTTP runtime, Vitest, Testing Library, Tailwind, SQLite/Prisma

---

## Pre-read before implementation

1. `docs/plans/2026-03-19-web-manual-gap-remediation-design.md`
2. `docs/plans/2026-03-19-web-workflow-parity-design.md`
3. `docs/plans/2026-03-19-web-workflow-parity-test-runbook.md`
4. `src/web/pages/papers/reader/page.tsx`
5. `src/server/services/web-import.service.ts`
6. `src/server/routes/import.routes.ts`
7. `src/server/routes/papers.routes.ts`
8. `tests/frontend/web/reader-page.test.tsx`
9. `tests/integration/web-import.test.ts`

### Task 1: Make the browser reader layout usable on common laptop widths

**Files:**
- Modify: `src/web/pages/papers/reader/page.tsx`
- Test: `tests/frontend/web/reader-page.test.tsx`

**Step 1: Write the failing test**

Extend the reader-page frontend suite so it locks the responsive layout contract instead of relying on manual eyeballing. Add assertions that the reader workspace uses a large-screen two-column layout before `xl`, and that the notes panel remains a dedicated sidebar on that layout.

Representative assertions:

```tsx
const workspace = screen.getByTestId('reader-workspace');
expect(workspace.className).toContain('lg:grid-cols-[minmax(0,1fr)_320px]');

const notesPanel = screen.getByTestId('reader-notes-panel');
expect(notesPanel.className).toContain('lg:sticky');
```

**Step 2: Run test to verify it fails**

Run:

```bash
npm run test:frontend -- tests/frontend/web/reader-page.test.tsx
```

Expected: FAIL because the page still uses the old `xl:grid-cols-[minmax(0,1fr)_360px]` layout and has no locked responsive sidebar contract.

**Step 3: Write minimal implementation**

Update the page layout only where needed:

1. move the split from `xl` to `lg`
2. narrow the notes column so the PDF gets more width
3. keep the notes panel sticky/visually adjacent on large screens
4. avoid global shell rewrites unless the failing test proves the local page fix is insufficient

Representative direction:

```tsx
<section
  data-testid="reader-workspace"
  className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]"
>
  ...
  <aside
    data-testid="reader-notes-panel"
    className="rounded-2xl ... lg:sticky lg:top-6"
  >
```

**Step 4: Run test to verify it passes**

Run:

```bash
npm run test:frontend -- tests/frontend/web/reader-page.test.tsx
```

Expected: PASS with the reader layout contract now locked for the browser workflow.

**Step 5: Commit**

```bash
git add src/web/pages/papers/reader/page.tsx tests/frontend/web/reader-page.test.tsx
git commit -m "fix: improve browser reader layout"
```

### Task 2: Replace placeholder DOI import with strict complete import

**Files:**
- Modify: `src/server/services/web-import.service.ts`
- Modify: `tests/integration/web-import.test.ts`
- Possibly modify: `src/server/routes/papers.routes.ts`
- Possibly modify: `src/server/routes/reading.routes.ts`

**Step 1: Write the failing integration tests**

Replace the current placeholder DOI expectations with two explicit behaviors:

1. success path — DOI import only succeeds when meaningful metadata and a usable document are both acquired
2. failure path — DOI import returns an error and creates no paper when enrichment is incomplete

Representative tests:

```ts
it('imports a DOI into a complete readable paper when metadata and document acquisition succeed', async () => {
  // mock DOI metadata source + document fetch
  expect(response.status).toBe(200);
  expect(payload.paper.title).toBe('Retrieval-Augmented Planning via DOI');
  expect(payload.paper.abstract).toContain('planning');
  expect(fs.existsSync(expectedPdfPath)).toBe(true);
});

it('rejects DOI imports that cannot be enriched into a complete paper', async () => {
  expect(response.status).toBe(422);
  expect(await response.json()).toMatchObject({
    error: 'Unable to import DOI as a complete paper.',
  });
  expect(await papersService.list({})).toHaveLength(0);
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
npm run test -- tests/integration/web-import.test.ts
```

Expected: FAIL because DOI import still creates a placeholder shell titled with the DOI string and does not enforce complete acquisition.

**Step 3: Write minimal implementation**

Implement a strict DOI acquisition pipeline in `src/server/services/web-import.service.ts`:

1. normalize DOI
2. fetch real DOI metadata
3. resolve a usable document URL/path
4. only create/store the paper after both metadata and document acquisition succeed
5. on incomplete acquisition, throw a user-visible import error and do not create a paper record

Required behavior constraints:

```ts
if (!metadata.title || !documentUrl) {
  throw new WebImportError(422, 'Unable to import DOI as a complete paper.');
}

const paper = await this.papersService.upsertFromIngest({
  title: metadata.title,
  source: 'doi',
  sourceUrl: metadata.sourceUrl,
  authors: metadata.authors,
  abstract: metadata.abstract,
  tags: ['doi'],
});

await this.papersService.downloadPdf(paper.id, documentUrl);
```

Do **not** preserve the old placeholder fallback. That behavior is explicitly rejected by the approved design.

**Step 4: Run test to verify it passes**

Run:

```bash
npm run test -- tests/integration/web-import.test.ts
```

Expected: PASS with successful DOI imports producing meaningful readable papers and failed DOI imports leaving no shell paper behind.

**Step 5: Commit**

```bash
git add src/server/services/web-import.service.ts tests/integration/web-import.test.ts src/server/routes/papers.routes.ts src/server/routes/reading.routes.ts
git commit -m "feat: enforce complete doi imports"
```

### Task 3: Raise browser PDF upload limits to a realistic bounded size

**Files:**
- Modify: `src/server/routes/import.routes.ts`
- Modify: `src/server/routes/papers.routes.ts`
- Modify: `tests/integration/web-import.test.ts`

**Step 1: Write the failing test**

Add one passing browser-upload case for a realistic paper-sized PDF and move the oversized failure threshold to the new shared limit.

Representative coverage:

```ts
it('accepts realistic browser PDF uploads up to the web import ceiling', async () => {
  const formData = new FormData();
  formData.set(
    'file',
    new Blob(['x'.repeat(5 * 1024 * 1024)], { type: 'application/pdf' }),
    'realistic-paper.pdf',
  );
  expect(response.status).toBe(200);
});

it('rejects browser PDF uploads above the web import ceiling', async () => {
  expect(response.status).toBe(413);
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
npm run test -- tests/integration/web-import.test.ts
```

Expected: FAIL because the server still rejects realistic files above 2 MB.

**Step 3: Write minimal implementation**

Unify the body-size ceiling across browser import routes:

1. define one shared constant for web import body size
2. use it from both `import.routes.ts` and `papers.routes.ts`
3. update the 413 message text to match the new limit

Recommended threshold for this batch: **25 MB**.

Representative shape:

```ts
export const MAX_WEB_IMPORT_BODY_BYTES = 25 * 1024 * 1024;
```

Apply it in both routes. Do not leave duplicated constants behind.

**Step 4: Run test to verify it passes**

Run:

```bash
npm run test -- tests/integration/web-import.test.ts
```

Expected: PASS with realistic uploads accepted and genuinely oversized uploads still rejected with 413.

**Step 5: Commit**

```bash
git add src/server/routes/import.routes.ts src/server/routes/papers.routes.ts tests/integration/web-import.test.ts
git commit -m "fix: raise browser pdf upload limit"
```

### Task 4: Sync docs and rerun full verification

**Files:**
- Modify: `changelog.md`
- Modify: `README.md`
- Modify: `README_CN.md`
- Possibly modify: `docs/plans/2026-03-19-web-workflow-parity-test-runbook.md`

**Step 1: Update docs for the final behavior**

Record:

1. reader layout improvement
2. DOI strict-complete import policy
3. realistic browser PDF upload ceiling

Keep README English/Chinese synchronized.

**Step 2: Run repository gates**

Run:

```bash
npm run lint
npm run test
npm run test:frontend
npm run build
```

Expected: all commands PASS on the final remediation state.

**Step 3: Commit**

```bash
git add changelog.md README.md README_CN.md docs/plans/2026-03-19-web-workflow-parity-test-runbook.md
git commit -m "docs: record post-phase1 remediation status"
```

### Task 5: Final review and push

**Files:**
- No new code files required

**Step 1: Collect Oracle review**

Have Oracle verify the final remediation state against:

1. the approved strict DOI policy
2. the manual-reader usability gap
3. the realistic PDF-upload requirement
4. final docs + verification evidence

**Step 2: Push only intended commits**

Run:

```bash
git status --short --branch
git push origin web/server-first-core
```

Expected: branch updated remotely with only the intended remediation commits.
