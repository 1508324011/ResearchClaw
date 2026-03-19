# ResearchClaw Renderer-First Web Parity Correction Design

**Goal:** Realign the web effort so ResearchClaw is migrated to a server-run, edge-interactive web app by reusing the existing `src/renderer` UI and interaction model as the single product source of truth, with Web-specific behavior limited to host adaptation.

## Why this design exists

The previous staged web-parity work successfully proved that a server-first browser runtime can load papers, run imports, show job progress, and expose basic reading flows. That work was useful, but the latest product review exposed a more important problem: the implementation direction drifted away from the actual target.

The approved target is now explicit:

1. ResearchClaw should become a server-run web application
2. the web product should preserve the existing ResearchClaw feature set, UI structure, and interaction logic as closely as practical
3. `src/renderer` is the canonical UI and interaction tree
4. the web runtime is allowed to adapt host-specific behavior, but it is not allowed to evolve as a parallel product line

This document supersedes the earlier “workflow parity, not UI parity” planning assumption for future work. The earlier documents remain useful as delivery history, but they are no longer the governing architecture for subsequent implementation.

## Approved architecture principle

### Legacy contract is law

The existing desktop renderer is not reference material. It is the product contract.

That means:

1. route structure in `src/renderer/router.tsx` is the default product route map
2. shell behavior in `src/renderer/components/app-shell.tsx` is the default product frame
3. renderer pages and renderer components are the first reuse target for web work
4. any Web-only divergence must be justified as a host adaptation or explicitly recorded as a waiver

### What web work is allowed to change

Web work may adapt only the parts that are truly host-sensitive, such as:

1. Electron window controls
2. native filesystem and preload-only APIs
3. native PDF display mechanics
4. OS-specific shell affordances
5. transport implementation details below the UI layer

Everything else should default to reuse, not redesign.

## Evidence of the current drift

The current branch already contains concrete signs of parallel-product drift.

### 1. The shell has been rewritten instead of adapted

`src/renderer/router.tsx` wraps the app in:

- `AppShell`
- `TabsProvider`
- `ChatProvider`
- `AnalysisProvider`
- `ToastProvider`

By contrast, `src/web/router.tsx` defines a separate `WebLayout` with a simple page header and three navigation links. That means the browser runtime currently does not share the real application shell.

### 2. Core pages were reimplemented instead of reusing renderer pages

Examples:

1. `src/web/pages/library/page.tsx` is a custom page, while the desktop product uses `src/renderer/pages/papers/page.tsx` plus `src/renderer/components/papers-by-tag.tsx` and `src/renderer/components/import-modal.tsx`
2. `src/web/pages/search/page.tsx` is a custom form/results page, while the desktop product delegates search UX to `src/renderer/components/search-content.tsx`
3. `src/web/pages/papers/reader/page.tsx` is a simplified iframe-plus-notes page, while `src/renderer/pages/papers/reader/page.tsx` contains the real reading workspace, chat/session state, layout modes, downloads, ratings, and message-stream logic

### 3. The web slice only reused shallow assets

The browser runtime does reuse:

1. `src/renderer/locales/en.json`
2. `src/renderer/locales/zh.json`
3. `src/renderer/styles/globals.css`
4. the renderer-side client abstraction (`setResearchClawClient`, `HttpClient`, `getResearchClawClient`)

That is useful, but it is not enough. It reuses copy, tokens, and transport helpers while leaving the actual product UI tree forked.

### 4. Coverage breadth already diverges from the desktop app

The browser runtime currently covers only a narrow set of routes:

- library
- search
- jobs
- paper overview
- reader
- notes

But the desktop renderer route tree includes:

- dashboard
- papers
- search
- paper overview / reader / notes
- projects
- agent todos
- agent todo detail
- settings

and the renderer component tree also includes graph, project reporting, richer settings, and task orchestration components.

This proves the current effort behaves like a partial web rewrite, not a renderer-first migration.

## Design decision: move to renderer-first migration

### Decision 1: `src/renderer` becomes the single presentation source

Future web work must start from renderer reuse analysis.

The decision order for any UI surface is now:

1. can the renderer page/component be reused directly?
2. if not, what exact host dependency blocks reuse?
3. can that dependency be moved behind an adapter seam?
4. only if both answers are no may a temporary divergence exist, and it must be recorded as a waiver

### Decision 2: `src/web` becomes a host adapter, not a second product tree

`src/web` should keep only the pieces that are specific to the browser host:

1. browser runtime entry wiring
2. browser router/bootstrap glue if absolutely required
3. transport/client injection
4. browser-only adapter implementations
5. static hosting concerns

It should not remain the long-term home of parallel page implementations for library/search/reader/import/jobs if those pages can instead be expressed through renderer components and adapters.

### Decision 3: platform seams must be isolated explicitly

The existing renderer tree mixes pure UI with Electron-aware behavior. That is expected. The correction is not to rewrite pages, but to extract the host-sensitive seams.

Likely seam categories:

1. window controls and shell chrome
2. native PDF path handling versus browser-safe asset URLs
3. filesystem-bound operations
4. IPC event/subscription plumbing
5. process-specific bootstrapping and background-job recovery wiring

The implementation goal is to keep the page/component contract intact while swapping the host adapter under it.

### Decision 4: parity is measured against renderer contracts, not route existence

A route only counts as complete when all of the following are true:

1. it reuses the renderer page/component tree or an approved extraction of it
2. it preserves the same major layout structure
3. it preserves the same interaction model unless a waiver says otherwise
4. it passes parity tests that lock the route contract

“A page exists and can fetch data” is no longer sufficient.

## Non-goals

This correction design does **not** attempt to:

1. keep the existing custom `src/web/pages/*` implementations alive as first-class long-term surfaces
2. redesign ResearchClaw for browser-native simplification
3. define a multi-user SaaS product direction
4. solve every host-adaptation detail in one batch before parity work begins
5. require impossible pixel identity where browser and Electron hosts genuinely differ

## Required migration rules

### Rule 1: No new parallel page implementations

Do not add new custom pages under `src/web/pages/*` unless the change is a temporary adapter shim and the reason is documented.

### Rule 2: Waivers must be explicit

Every intentional difference from renderer behavior must be tracked in a parity-waiver inventory with:

1. route/component name
2. exact divergence
3. reason the divergence is host-required
4. whether it is temporary or permanent

The working source of truth for that inventory is:

- `docs/plans/2026-03-19-renderer-first-web-parity-matrix.md`

### Rule 3: Testing must prove parity, not just functionality

Future tests must lock:

1. shell/provider composition
2. route coverage and route handoff behavior
3. key renderer interaction flows
4. approved waivers

The parity matrix and the parity test suite must evolve together. A waiver is not valid unless it is listed in the matrix and covered by an explicit test.

### Rule 4: Route sequence follows product importance and dependency

The migration order should be:

1. shared shell and provider stack
2. papers/library/import/search surfaces
3. reader and notes workspace
4. dashboard / projects / agent todos / settings
5. graph and remaining peripheral surfaces

## Files that define the new source-of-truth scope

### Canonical UI source

- `src/renderer/router.tsx`
- `src/renderer/components/app-shell.tsx`
- `src/renderer/pages/**/*`
- `src/renderer/components/**/*`
- `src/renderer/hooks/**/*`
- `src/renderer/locales/en.json`
- `src/renderer/locales/zh.json`
- `src/renderer/styles/globals.css`

### Browser-host integration layer

- `src/web/main.tsx`
- `src/web/router.tsx` or its replacement bootstrap adapter
- `src/server/**/*`
- transport-neutral client files under `src/renderer/lib/*`

## Acceptance outcome for the correction

This correction is complete only when:

1. future implementation plans treat renderer reuse as mandatory by default
2. new parity work starts by adapting the existing renderer shell and pages instead of extending custom `src/web/pages/*`
3. all approved divergences are documented as waivers rather than silently introduced
4. the implementation plan is rewritten around renderer-first migration tasks and parity tests
