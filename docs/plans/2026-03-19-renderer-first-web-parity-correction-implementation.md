# Renderer-First Web Parity Correction Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the current parallel-web direction with a renderer-first migration path so the server-run web app reuses the existing ResearchClaw UI and interaction tree instead of rebuilding a simplified browser-only product.

**Architecture:** Treat `src/renderer` as the single presentation source of truth and convert `src/web` into a host-adaptation layer. The implementation must first make the renderer shell, providers, and canonical route tree web-safe, then migrate route groups onto that canonical tree in dependency order, with explicit waiver tracking for any temporary web-only surface that has no renderer counterpart.

**Tech Stack:** TypeScript, React 19, React Router, Electron renderer codebase, server-first Node runtime, Vitest, Testing Library, Tailwind, shared HTTP/Electron client abstractions

---

## Pre-read before implementation

1. `docs/plans/2026-03-19-renderer-first-web-parity-correction-design.md`
2. `src/renderer/router.tsx`
3. `src/renderer/components/app-shell.tsx`
4. `src/renderer/pages/papers/page.tsx`
5. `src/renderer/pages/search/page.tsx`
6. `src/renderer/pages/papers/overview/page.tsx`
7. `src/renderer/pages/papers/reader/page.tsx`
8. `src/renderer/pages/papers/notes/page.tsx`
9. `src/renderer/hooks/use-ipc.ts`
10. `src/renderer/hooks/use-main-ready.ts`
11. `src/renderer/hooks/use-chat.tsx`
12. `src/renderer/hooks/use-analysis.tsx`
13. `src/web/main.tsx`
14. `src/web/router.tsx`
15. `src/web/pages/library/page.tsx`
16. `src/web/pages/search/page.tsx`
17. `src/web/pages/papers/overview/page.tsx`
18. `src/web/pages/papers/reader/page.tsx`
19. `src/web/pages/papers/notes/page.tsx`
20. `src/web/pages/jobs/page.tsx`
21. `tests/frontend/web/test-utils.tsx`

## Current repo-state checkpoints

These are facts about the current branch that the plan must respect:

1. `src/web/main.tsx` still bootstraps the browser app directly with `RouterProvider` and `createBrowserRouter(...)` from `src/web/router.tsx`.
2. `src/web/router.tsx` still mounts a custom `WebLayout` and custom pages under `src/web/pages/*`.
3. `src/renderer/router.tsx` still owns the canonical product shell and provider stack: `ToastProvider`, `ChatProvider`, `AnalysisProvider`, `TabsProvider`, and `AppShell`.
4. `src/renderer/hooks/use-ipc.ts` fallback support is still narrow, so direct renderer reuse is currently blocked for multiple routes by missing browser-safe behaviors.
5. `src/renderer/hooks/use-main-ready.ts`, `src/renderer/hooks/use-chat.tsx`, and `src/renderer/hooks/use-analysis.tsx` still contain Electron-aware readiness/event assumptions that must be made web-safe before the renderer shell can mount on web.
6. Existing browser tests currently target the custom web surfaces: `library-page`, `import-workspace`, `paper-overview-page`, `search-page`, `reader-page`, and `jobs-page`.
7. `/jobs` currently exists only in the web runtime; it is **not** a canonical renderer route and therefore must be handled as an explicit waiver or folded into canonical shell behavior, not left implicit.
8. Current web paper routes use `:paperId`, while canonical renderer routes use `:id`; route-contract normalization must be planned explicitly.

## Ground rules before touching code

1. Do **not** add new long-lived page implementations under `src/web/pages/*`.
2. Do **not** redesign the shell or page interaction model to be “more web-like” unless the design doc explicitly allows it.
3. Do **not** bypass failing parity tests by weakening expectations.
4. Every task below must follow a red-green loop before implementation is considered complete.
5. Do **not** silently preserve `/jobs` or browser import UX as permanent web-only product surfaces; they must be documented in the parity matrix as either temporary waivers or explicit adapter layers.
6. Do **not** normalize route params ad hoc inside unrelated page code; make the `:id` versus `:paperId` contract explicit in shared routing or a thin adapter.
7. When replacing current web-page tests with parity coverage, remove or rewrite the old tests in the same task so the suite reflects the new canonical route contract.

### Task 1: Freeze the parity contract and waiver inventory in machine-checkable docs

**Files:**
- Create: `docs/plans/2026-03-19-renderer-first-web-parity-matrix.md`
- Modify: `docs/plans/2026-03-19-renderer-first-web-parity-correction-design.md`
- Modify: `changelog.md`

**Step 1: Write the failing documentation checklist**

Create a parity matrix document that lists each top-level canonical renderer route and records:

1. renderer source files
2. current web status (`reused`, `parallel implementation`, `missing`)
3. route-contract mismatches (for example `:id` vs `:paperId`)
4. required host seams
5. allowed waivers

Initial canonical route inventory must include at least:

- `/dashboard`
- `/search`
- `/papers`
- `/papers/:id`
- `/papers/:id/reader`
- `/papers/:id/notes`
- `/projects`
- `/agent-todos`
- `/settings`

The matrix must also contain a separate **Temporary Web-Only Waivers** section that explicitly records the current status of:

- `/jobs`
- browser-only import affordances that do not yet map 1:1 to the current renderer `ImportModal`

**Step 2: Verify the checklist is currently missing**

Run:

```bash
test -f docs/plans/2026-03-19-renderer-first-web-parity-matrix.md
```

Expected: non-zero exit / missing file.

**Step 3: Write the minimal documentation implementation**

Add the matrix file and update the design doc if needed so it explicitly points to the matrix as the enforcement artifact.

Minimum matrix headings:

```md
| Route | Renderer source | Current web state | Route mismatch | Required seam | Waiver allowed? |
| --- | --- | --- | --- | --- | --- |
```

Update `changelog.md` with a short planning entry describing the implementation-plan refinement.

**Step 4: Verify the documentation exists**

Run:

```bash
test -f docs/plans/2026-03-19-renderer-first-web-parity-matrix.md
```

Expected: exit 0.

**Step 5: Commit**

```bash
git add docs/plans/2026-03-19-renderer-first-web-parity-matrix.md docs/plans/2026-03-19-renderer-first-web-parity-correction-design.md docs/plans/2026-03-19-renderer-first-web-parity-correction-implementation.md changelog.md
git commit -m "docs: freeze renderer-first web parity contract"
```

### Task 2: Add failing shell-parity and canonical-route baseline tests before changing bootstrap code

**Files:**
- Create: `tests/frontend/web/renderer-shell-parity.test.tsx`
- Create: `tests/frontend/web/canonical-route-handoff.test.tsx`
- Modify: `tests/frontend/web/test-utils.tsx`
- Read for reference: `src/renderer/router.tsx`, `src/renderer/components/app-shell.tsx`, `src/web/router.tsx`

**Step 1: Write the failing tests**

Create frontend tests that prove two current facts:

1. the web runtime does **not** yet boot through the renderer shell/provider contract
2. the browser runtime does **not** yet hand off to the canonical renderer `/papers` route structure

Representative assertions:

```tsx
expect(screen.getByTestId('app-shell-root')).toBeInTheDocument();
expect(screen.getByRole('navigation', { name: /sidebar/i })).toBeInTheDocument();
expect(screen.queryByText('ResearchClaw Web')).not.toBeInTheDocument();
expect(router.state.location.pathname).toBe('/papers');
```

If `AppShell` currently has no stable selectors or accessible nav label, keep the test intent strict and let the failure document the missing contract.

**Step 2: Run the tests to verify they fail**

Run:

```bash
npm run test:frontend -- tests/frontend/web/renderer-shell-parity.test.tsx tests/frontend/web/canonical-route-handoff.test.tsx
```

Expected: FAIL because the web runtime still mounts `WebLayout`, still renders `ResearchClaw Web`, and still does not route through the canonical renderer shell.

**Step 3: Write minimal implementation notes only**

Do not fix the code in this task. Stop once the failing tests capture the drift.

**Step 4: Re-run to confirm stable failure**

Run the same command again and confirm the failure is deterministic.

**Step 5: Commit**

```bash
git add tests/frontend/web/renderer-shell-parity.test.tsx tests/frontend/web/canonical-route-handoff.test.tsx tests/frontend/web/test-utils.tsx
git commit -m "test: add failing renderer shell and route handoff coverage"
```

### Task 3: Extract the initial web-safe host seam for the renderer shell and providers

**Files:**
- Create: `src/shared/platform/researchclaw-host.ts`
- Create: `src/web/host/web-host.ts`
- Create: `src/renderer/host/electron-host.ts`
- Modify: `src/renderer/hooks/use-ipc.ts`
- Modify: `src/renderer/hooks/use-main-ready.ts`
- Modify: `src/renderer/hooks/use-chat.tsx`
- Modify: `src/renderer/hooks/use-analysis.tsx`
- Modify: `src/renderer/components/app-shell.tsx`
- Test: `tests/unit/researchclaw-host.test.ts`

**Step 1: Write the failing unit test**

Add unit coverage that defines a host abstraction for shell/provider-sensitive behavior instead of hard-binding renderer code to Electron-only affordances.

Representative shape:

```ts
it('provides browser-safe shell and provider capabilities in the web host', () => {
  const host = createWebHost({ origin: 'http://localhost:3000' });
  expect(host.mode).toBe('web');
  expect(host.windowControls.supported).toBe(false);
  expect(host.events.supportsPushIpc).toBe(false);
  expect(host.assets.openPaperAssetUrl('paper-1')).toBe('/papers/paper-1/pdf');
});
```

**Step 2: Run the test to verify it fails**

Run:

```bash
npm run test -- tests/unit/researchclaw-host.test.ts
```

Expected: FAIL because the abstraction does not exist.

**Step 3: Write the minimal implementation**

Introduce a narrow host contract that isolates only real host differences needed by the renderer shell and providers, including:

1. window controls support
2. main-process readiness semantics
3. push IPC-event availability
4. browser-safe paper asset URL generation
5. browser-safe external-link behavior where required by shell/page chrome

Make `useMainReady`, `useChat`, and `useAnalysis` depend on host capabilities instead of directly assuming `window.electronAPI?.on` exists.

Also add stable shell selectors/accessibility hooks needed by the parity tests, for example an `app-shell-root` test id and a stable sidebar navigation label.

**Step 4: Run the test to verify it passes**

Run:

```bash
npm run test -- tests/unit/researchclaw-host.test.ts
```

Expected: PASS with browser-safe host behavior in place.

**Step 5: Commit**

```bash
git add src/shared/platform/researchclaw-host.ts src/web/host/web-host.ts src/renderer/host/electron-host.ts src/renderer/hooks/use-ipc.ts src/renderer/hooks/use-main-ready.ts src/renderer/hooks/use-chat.tsx src/renderer/hooks/use-analysis.tsx src/renderer/components/app-shell.tsx tests/unit/researchclaw-host.test.ts
git commit -m "refactor: add host seam for renderer shell parity"
```

### Task 4: Replace the custom web bootstrap with a shared canonical renderer route tree

**Files:**
- Create: `src/renderer/router-tree.tsx`
- Create: `src/web/router-adapter.tsx`
- Modify: `src/renderer/router.tsx`
- Modify: `src/web/router.tsx`
- Modify: `src/web/main.tsx`
- Test: `tests/frontend/web/renderer-shell-parity.test.tsx`
- Test: `tests/frontend/web/canonical-route-handoff.test.tsx`

**Step 1: Use the existing failing tests**

Do not write new tests. Reuse the shell and handoff tests from Task 2.

**Step 2: Run the tests to verify they still fail**

Run:

```bash
npm run test:frontend -- tests/frontend/web/renderer-shell-parity.test.tsx tests/frontend/web/canonical-route-handoff.test.tsx
```

Expected: FAIL against the current `WebLayout` bootstrap.

**Step 3: Write the minimal implementation**

Extract the canonical renderer route tree into a shared route-object factory so:

1. Electron still uses `createHashRouter(...)`
2. Web uses `createBrowserRouter(...)`
3. Both runtimes share the same canonical product route tree
4. `/` in web becomes a thin adapter redirect/handoff to canonical `/papers`
5. `WebLayout` stops being the long-term product shell

Not allowed:

1. keeping `WebLayout` as the long-term shell
2. copying `AppShell` into `src/web`
3. introducing a second parallel route tree just for browser parity

**Step 4: Run the tests to verify they pass**

Run:

```bash
npm run test:frontend -- tests/frontend/web/renderer-shell-parity.test.tsx tests/frontend/web/canonical-route-handoff.test.tsx
```

Expected: PASS with web now booting through the canonical renderer shell and route handoff.

**Step 5: Commit**

```bash
git add src/renderer/router-tree.tsx src/renderer/router.tsx src/web/router-adapter.tsx src/web/router.tsx src/web/main.tsx tests/frontend/web/renderer-shell-parity.test.tsx tests/frontend/web/canonical-route-handoff.test.tsx
git commit -m "refactor: boot the web app through the renderer route tree"
```

### Task 5: Add failing core route-parity tests for the canonical paper workflow

**Files:**
- Create: `tests/frontend/web/papers-route-parity.test.tsx`
- Create: `tests/frontend/web/search-route-parity.test.tsx`
- Create: `tests/frontend/web/paper-overview-route-parity.test.tsx`
- Create: `tests/frontend/web/reader-route-parity.test.tsx`
- Create: `tests/frontend/web/notes-route-parity.test.tsx`
- Reference: `src/renderer/pages/papers/page.tsx`
- Reference: `src/renderer/pages/search/page.tsx`
- Reference: `src/renderer/pages/papers/overview/page.tsx`
- Reference: `src/renderer/pages/papers/reader/page.tsx`
- Reference: `src/renderer/pages/papers/notes/page.tsx`

**Step 1: Write the failing tests**

Each test should prove that the web route still uses a parallel custom page or still fails to honor the canonical renderer route contract.

Representative intent:

```tsx
expect(renderedRouteSource()).toBe('renderer');
expect(screen.getByTestId('papers-by-tag-root')).toBeInTheDocument();
expect(screen.getByTestId('search-content-root')).toBeInTheDocument();
expect(screen.getByTestId('paper-overview-root')).toBeInTheDocument();
expect(screen.getByTestId('reader-workspace-root')).toBeInTheDocument();
expect(screen.getByTestId('notes-workspace-root')).toBeInTheDocument();
```

If stable selectors are missing in renderer pages/components, keep the parity target strict and let the failure expose the missing contract.

**Step 2: Run the tests to verify they fail**

Run:

```bash
npm run test:frontend -- tests/frontend/web/papers-route-parity.test.tsx tests/frontend/web/search-route-parity.test.tsx tests/frontend/web/paper-overview-route-parity.test.tsx tests/frontend/web/reader-route-parity.test.tsx tests/frontend/web/notes-route-parity.test.tsx
```

Expected: FAIL because the current browser flow still depends on custom `src/web/pages/*` implementations and still uses `:paperId`-shaped routes.

**Step 3: Stop after capturing the failures**

Do not migrate the routes in this task.

**Step 4: Re-run to verify deterministic failure**

Run the same command again and confirm the failures remain stable.

**Step 5: Commit**

```bash
git add tests/frontend/web/papers-route-parity.test.tsx tests/frontend/web/search-route-parity.test.tsx tests/frontend/web/paper-overview-route-parity.test.tsx tests/frontend/web/reader-route-parity.test.tsx tests/frontend/web/notes-route-parity.test.tsx
git commit -m "test: add failing parity coverage for canonical paper routes"
```

### Task 6: Migrate `/papers`, `/search`, and `/papers/:id` to renderer-backed implementations without losing browser import flow

**Files:**
- Modify: `src/renderer/pages/papers/page.tsx`
- Modify: `src/renderer/components/papers-by-tag.tsx`
- Modify: `src/renderer/components/import-modal.tsx`
- Modify: `src/renderer/pages/search/page.tsx`
- Modify: `src/renderer/components/search-content.tsx`
- Modify: `src/renderer/pages/papers/overview/page.tsx`
- Modify: `src/web/router.tsx` or `src/web/router-adapter.tsx`
- Delete or reduce: `src/web/pages/library/page.tsx`
- Delete or reduce: `src/web/pages/search/page.tsx`
- Delete or reduce: `src/web/pages/papers/overview/page.tsx`
- Delete or reduce: `src/web/components/import-workspace.tsx`
- Modify or delete: `tests/frontend/web/library-page.test.tsx`
- Modify or delete: `tests/frontend/web/import-workspace.test.tsx`
- Modify or delete: `tests/frontend/web/search-page.test.tsx`
- Modify or delete: `tests/frontend/web/paper-overview-page.test.tsx`
- Test: `tests/frontend/web/papers-route-parity.test.tsx`
- Test: `tests/frontend/web/search-route-parity.test.tsx`
- Test: `tests/frontend/web/paper-overview-route-parity.test.tsx`

**Step 1: Use the existing failing parity tests**

Do not write new parity tests; use the three route-parity files from Task 5.

**Step 2: Run the tests to verify they fail**

Run:

```bash
npm run test:frontend -- tests/frontend/web/papers-route-parity.test.tsx tests/frontend/web/search-route-parity.test.tsx tests/frontend/web/paper-overview-route-parity.test.tsx
```

Expected: FAIL before migration.

**Step 3: Write the minimal implementation**

Migrate the route implementation so the web runtime now renders renderer-backed `/papers`, `/search`, and `/papers/:id` surfaces.

Rules:

1. canonical route params must normalize to renderer’s `:id` contract
2. browser import must survive as a host adaptation, not as a parallel product page
3. if the current `ImportModal` cannot run directly on web, adapt it behind a thin host-aware seam instead of keeping `library/page.tsx` as the long-term implementation
4. do not keep the old custom web pages alive as primary route implementations
5. update or retire the old browser tests in this same task so the suite reflects the new canonical route model

**Step 4: Run the tests to verify they pass**

Run:

```bash
npm run test:frontend -- tests/frontend/web/papers-route-parity.test.tsx tests/frontend/web/search-route-parity.test.tsx tests/frontend/web/paper-overview-route-parity.test.tsx
```

Expected: PASS with renderer-backed route implementations.

**Step 5: Run targeted workflow regressions**

Run:

```bash
npm run test:frontend -- tests/frontend/web/papers-route-parity.test.tsx tests/frontend/web/search-route-parity.test.tsx tests/frontend/web/paper-overview-route-parity.test.tsx tests/frontend/web/library-page.test.tsx tests/frontend/web/import-workspace.test.tsx tests/frontend/web/search-page.test.tsx tests/frontend/web/paper-overview-page.test.tsx
```

Expected: PASS after the old tests are updated or replaced to match the canonical route contract.

**Step 6: Commit**

```bash
git add src/renderer/pages/papers/page.tsx src/renderer/components/papers-by-tag.tsx src/renderer/components/import-modal.tsx src/renderer/pages/search/page.tsx src/renderer/components/search-content.tsx src/renderer/pages/papers/overview/page.tsx src/web/router.tsx src/web/router-adapter.tsx src/web/pages/library/page.tsx src/web/pages/search/page.tsx src/web/pages/papers/overview/page.tsx src/web/components/import-workspace.tsx tests/frontend/web/papers-route-parity.test.tsx tests/frontend/web/search-route-parity.test.tsx tests/frontend/web/paper-overview-route-parity.test.tsx tests/frontend/web/library-page.test.tsx tests/frontend/web/import-workspace.test.tsx tests/frontend/web/search-page.test.tsx tests/frontend/web/paper-overview-page.test.tsx
git commit -m "refactor: move core paper browsing routes onto renderer parity"
```

### Task 7: Migrate `/papers/:id/reader` and `/papers/:id/notes` with explicit browser-safe adaptations

**Files:**
- Modify: `src/renderer/pages/papers/reader/page.tsx`
- Modify: `src/renderer/pages/papers/notes/page.tsx`
- Modify: `src/renderer/components/pdf-viewer.tsx`
- Possibly modify: `src/renderer/components/pdf-viewer-native.tsx`
- Modify: `src/web/router.tsx` or `src/web/router-adapter.tsx`
- Delete or reduce: `src/web/pages/papers/reader/page.tsx`
- Delete or reduce: `src/web/pages/papers/notes/page.tsx`
- Modify or delete: `tests/frontend/web/reader-page.test.tsx`
- Test: `tests/frontend/web/reader-route-parity.test.tsx`
- Test: `tests/frontend/web/notes-route-parity.test.tsx`

**Step 1: Use the existing failing parity tests**

Do not write new parity tests; use the reader and notes parity files from Task 5.

**Step 2: Run the tests to verify they fail**

Run:

```bash
npm run test:frontend -- tests/frontend/web/reader-route-parity.test.tsx tests/frontend/web/notes-route-parity.test.tsx
```

Expected: FAIL before migration.

**Step 3: Write the minimal implementation**

Migrate the route implementation so the web runtime now renders renderer-backed reader and notes workspaces.

Rules:

1. prefer renderer page reuse first
2. any browser-safe PDF handling must sit behind an adapter seam rather than leaving the custom web page as the primary implementation
3. notes save/load behavior must remain server-backed and survive the route migration
4. if chat/analysis panels cannot fully match on web yet, document the difference as a waiver instead of silently deleting behavior
5. update or retire the old `reader-page.test.tsx` coverage in the same task so test intent matches the canonical workspace contract

**Step 4: Run the tests to verify they pass**

Run:

```bash
npm run test:frontend -- tests/frontend/web/reader-route-parity.test.tsx tests/frontend/web/notes-route-parity.test.tsx
```

Expected: PASS with renderer-backed reader/notes implementations.

**Step 5: Run targeted workflow regressions**

Run:

```bash
npm run test:frontend -- tests/frontend/web/reader-route-parity.test.tsx tests/frontend/web/notes-route-parity.test.tsx tests/frontend/web/reader-page.test.tsx
```

Expected: PASS after the old browser reader test is updated or replaced to reflect the canonical workspace.

**Step 6: Commit**

```bash
git add src/renderer/pages/papers/reader/page.tsx src/renderer/pages/papers/notes/page.tsx src/renderer/components/pdf-viewer.tsx src/renderer/components/pdf-viewer-native.tsx src/web/router.tsx src/web/router-adapter.tsx src/web/pages/papers/reader/page.tsx src/web/pages/papers/notes/page.tsx tests/frontend/web/reader-route-parity.test.tsx tests/frontend/web/notes-route-parity.test.tsx tests/frontend/web/reader-page.test.tsx
git commit -m "refactor: move reader and notes routes onto renderer parity"
```

### Task 8: Resolve non-canonical `/jobs` handling and expand parity breadth to the remaining core renderer routes

**Files:**
- Modify: `docs/plans/2026-03-19-renderer-first-web-parity-matrix.md`
- Test: `tests/frontend/web/dashboard-route-parity.test.tsx`
- Test: `tests/frontend/web/projects-route-parity.test.tsx`
- Test: `tests/frontend/web/agent-todos-route-parity.test.tsx`
- Test: `tests/frontend/web/settings-route-parity.test.tsx`
- Modify: shared router/bootstrap files
- Modify: renderer host seams only as required
- Modify or delete: `tests/frontend/web/jobs-page.test.tsx`

**Step 1: Decide `/jobs` status in the matrix before breadth work**

Record one of two allowed outcomes in the parity matrix:

1. `/jobs` remains as an explicit temporary web-only waiver with justification and expiry conditions
2. `/jobs` is folded into canonical shell/job-status behavior and the standalone page is retired

Do not continue breadth work until this is written down.

**Step 2: Write the failing breadth tests**

Add route-level parity tests for canonical renderer routes that still have no meaningful web parity story:

- dashboard
- projects
- agent todos
- settings

**Step 3: Run the tests to verify they fail**

Run:

```bash
npm run test:frontend -- tests/frontend/web/dashboard-route-parity.test.tsx tests/frontend/web/projects-route-parity.test.tsx tests/frontend/web/agent-todos-route-parity.test.tsx tests/frontend/web/settings-route-parity.test.tsx
```

Expected: FAIL because these routes are missing or not renderer-backed in the web runtime.

**Step 4: Write the minimal implementation**

Bring each route online through renderer-first reuse and any necessary host seams.

If `/jobs` remains waived, update `jobs-page.test.tsx` so it verifies the documented waiver behavior instead of silently preserving a stray parallel product surface.

**Step 5: Run the tests to verify they pass**

Run:

```bash
npm run test:frontend -- tests/frontend/web/dashboard-route-parity.test.tsx tests/frontend/web/projects-route-parity.test.tsx tests/frontend/web/agent-todos-route-parity.test.tsx tests/frontend/web/settings-route-parity.test.tsx tests/frontend/web/jobs-page.test.tsx
```

Expected: PASS, with `/jobs` either explicitly waived and tested as such or retired in favor of canonical behavior.

**Step 6: Commit**

```bash
git add docs/plans/2026-03-19-renderer-first-web-parity-matrix.md src/web/router.tsx src/web/router-adapter.tsx src/renderer/router.tsx src/renderer/pages/dashboard/page.tsx src/renderer/pages/projects/page.tsx src/renderer/pages/agent-todos/page.tsx src/renderer/pages/settings/page.tsx tests/frontend/web/dashboard-route-parity.test.tsx tests/frontend/web/projects-route-parity.test.tsx tests/frontend/web/agent-todos-route-parity.test.tsx tests/frontend/web/settings-route-parity.test.tsx tests/frontend/web/jobs-page.test.tsx
git commit -m "feat: extend renderer-backed parity to the remaining core routes"
```

### Task 9: Run final parity verification gates

**Files:**
- Verify only

**Step 1: Run focused parity suites**

Run:

```bash
npm run test:frontend -- tests/frontend/web/renderer-shell-parity.test.tsx tests/frontend/web/canonical-route-handoff.test.tsx tests/frontend/web/papers-route-parity.test.tsx tests/frontend/web/search-route-parity.test.tsx tests/frontend/web/paper-overview-route-parity.test.tsx tests/frontend/web/reader-route-parity.test.tsx tests/frontend/web/notes-route-parity.test.tsx tests/frontend/web/dashboard-route-parity.test.tsx tests/frontend/web/projects-route-parity.test.tsx tests/frontend/web/agent-todos-route-parity.test.tsx tests/frontend/web/settings-route-parity.test.tsx
```

Expected: PASS.

**Step 2: Run browser workflow regressions that survived the migration**

Run:

```bash
npm run test:frontend -- tests/frontend/web/library-page.test.tsx tests/frontend/web/import-workspace.test.tsx tests/frontend/web/paper-overview-page.test.tsx tests/frontend/web/reader-page.test.tsx tests/frontend/web/search-page.test.tsx tests/frontend/web/jobs-page.test.tsx
```

Expected: PASS, or the files have been intentionally removed/replaced in earlier tasks and the command has been updated accordingly.

**Step 3: Run repository verification**

Run:

```bash
npm run lint
npm run test
npm run test:frontend
npm run build
```

Expected: all commands exit 0.

**Step 4: Review the waiver inventory**

Confirm that every remaining renderer/web difference is documented and host-justified, including the final disposition of `/jobs` and any remaining browser-only import adaptation.

**Step 5: Verify no unapproved parallel pages remain**

Run:

```bash
grep -R "src/web/pages" docs/plans/2026-03-19-renderer-first-web-parity-matrix.md
```

Expected: only approved temporary adapter notes remain.

**Step 6: Commit**

```bash
git add docs/plans/2026-03-19-renderer-first-web-parity-matrix.md
git commit -m "test: verify renderer-first web parity gates"
```
