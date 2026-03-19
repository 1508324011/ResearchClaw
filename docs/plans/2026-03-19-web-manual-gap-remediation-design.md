# ResearchClaw Web Manual Gap Remediation Design

**Goal:** Close the three concrete Phase-1 acceptance gaps found during manual browser testing: cramped reader layout, hollow DOI imports, and unrealistic browser PDF upload limits.

## Why this design exists

Phase 1 is already code-complete and automation-complete, but the latest manual runbook execution exposed three product-quality failures that are serious enough to block practical acceptance:

1. the browser reader is too cramped for normal laptop use, and the notes panel drops below the reader instead of staying beside it
2. DOI import currently creates a paper shell with no real metadata or readable document
3. browser PDF upload rejects realistic paper sizes with `HTTP 413: Payload Too Large`

These are not vague polish concerns. They are direct contradictions of the approved workflow-parity contract:

- reading must be browser-useful
- DOI import must not mislead users into thinking a paper was successfully acquired when it was not
- PDF upload must support normal research-paper files

## User-reported evidence that this design must address

The approved remediation scope is grounded in the manual Phase-1 runbook feedback:

1. `PH1-LIB-001` / `PH1-READER-001`: the reader is too small, and notes appear below instead of on the right
2. `PH1-IMPORT-DOI-001`: DOI import creates a paper page, but there is no abstract and no reader content
3. `PH1-IMPORT-PDF-001` / `PH1-ERR-PDF-001`: browser upload fails with `HTTP 413`, and a 2 MB ceiling is not realistic for normal scientific PDFs

## Root-cause summary

### 1. Reader layout

`src/web/pages/papers/reader/page.tsx` currently uses:

```tsx
<section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
```

This means the notes sidebar stays beside the reader only at `xl` and above. Below that breakpoint, the layout collapses to a single column and the notes panel falls beneath the reader. The PDF iframe itself is already `w-full min-h-[70vh]`; the problem is page layout, not PDF rendering logic.

### 2. DOI import

`src/server/services/web-import.service.ts` currently treats DOI import as a manual placeholder flow:

1. validate DOI format
2. create a paper titled with the DOI string itself
3. set `sourceUrl` to `https://doi.org/<doi>`
4. stop there

No metadata fetch happens. No abstract is acquired. No browser-usable document is acquired. This is why the system can create a paper record that looks import-successful while still having no useful content.

### 3. Browser upload limit

Both `src/server/routes/import.routes.ts` and `src/server/routes/papers.routes.ts` enforce a hard `2 * 1024 * 1024` body limit for browser import requests. That explains the 413 result directly.

## Final design decisions

### Decision 1: Make the reader page usable on common laptop widths

The browser reader will move from the current `xl`-only split into a `lg`-and-up split so the notes panel stays beside the reader on normal laptop widths.

Chosen direction:

1. switch the main reader workspace from `xl:grid-cols-[minmax(0,1fr)_360px]` to a `lg` breakpoint
2. narrow the notes column so the PDF area gains more width instead of less
3. keep the notes panel visually attached to the reading session rather than moving it into a separate page-only workflow
4. keep the layout browser-native and simple; do not introduce desktop workstation parity or chat-side complexity

This is intentionally a local page-layout fix, not a global shell rewrite.

### Decision 2: DOI import becomes strict complete import

The user explicitly approved the strict policy: **a DOI import must not create a hollow paper record.**

That means a DOI import is only considered successful if the server can obtain:

1. sufficiently complete metadata for a real paper record, and
2. a usable document path for the browser reading workflow

If either condition fails, the import must fail and return an error. It must not leave behind a misleading placeholder paper.

Chosen direction:

1. add a DOI metadata/document acquisition pipeline in `src/server/services/web-import.service.ts`
2. use real fetched metadata instead of the DOI string as the title
3. only create/store the paper after metadata and document acquisition succeed
4. return a clear server error when DOI enrichment cannot produce a valid browser-reading artifact

This is a deliberate product correction: failed DOI acquisition should be visibly failed, not silently downgraded into a shell paper.

### Decision 3: Raise browser PDF upload limits to a realistic bounded size

The current 2 MB ceiling is too low for ordinary research papers. The new behavior will keep a bounded limit, but it will be large enough for realistic browser uploads.

Chosen direction:

1. replace the duplicated 2 MB constants with a shared browser-import limit
2. raise the limit to a realistic paper-friendly threshold
3. keep both browser import endpoints aligned so `/import/pdf` and `/papers/import` enforce the same ceiling
4. preserve explicit 413 handling for genuinely oversized payloads

The design goal is not “unbounded uploads.” It is “normal papers succeed; obviously abnormal payloads still fail predictably.”

## Non-goals

This remediation wave does **not** attempt to:

1. redesign the desktop reader/workstation UI for the browser
2. add browser chat/workbench parity
3. make DOI import succeed for every publisher or paywalled source
4. remove all upload limits
5. change the browser import success handoff structure beyond what the three accepted remediation goals require

## Files likely affected

### Reader layout

- Modify: `src/web/pages/papers/reader/page.tsx`
- Possibly modify: `tests/frontend/web/reader-page.test.tsx`

### DOI import

- Modify: `src/server/services/web-import.service.ts`
- Modify: `tests/integration/web-import.test.ts`
- Possibly modify: `src/server/routes/papers.routes.ts`
- Possibly modify: `src/server/routes/reading.routes.ts`
- Possibly modify: `src/web/pages/papers/overview/page.tsx`
- Possibly modify: `src/web/components/import-workspace.tsx`

### Upload limits

- Modify: `src/server/routes/import.routes.ts`
- Modify: `src/server/routes/papers.routes.ts`
- Modify: `tests/integration/web-import.test.ts`

### Documentation and release guidance

- Modify: `changelog.md`
- Modify: `README.md`
- Modify: `README_CN.md`
- Possibly modify: `docs/plans/2026-03-19-web-workflow-parity-test-runbook.md`

## Test strategy

All three fixes will follow strict TDD.

### Reader layout

Add frontend assertions that lock the intended responsive layout contract instead of relying on manual memory.

### DOI import

Replace the current placeholder DOI integration test with:

1. one success-path test that proves meaningful metadata + document acquisition
2. one failure-path test that proves the system does **not** create a shell paper when enrichment is incomplete

### Upload limit

Add one passing upload test for a realistic paper-sized PDF and keep one failing oversized-body test at the new ceiling.

### Final gate

After targeted TDD loops, rerun:

1. `npm run lint`
2. `npm run test`
3. `npm run test:frontend`
4. `npm run build`

## Acceptance outcome for this remediation batch

This remediation wave is complete only when all of the following are true:

1. a browser reader on common laptop widths keeps notes beside the reader and gives the PDF area materially more usable width
2. DOI import either yields a meaningful, readable paper or fails clearly without creating a shell record
3. normal research-paper PDFs no longer fail with 413 in the browser workflow
4. the automated test suite locks these behaviors before release documentation is updated
