# Renderer-First Web Parity Matrix

This matrix is the enforcement artifact for the 2026-03-19 renderer-first correction. A route is not “done on web” merely because it exists; it is done only when the browser runtime reuses the canonical renderer page/shell contract or records an explicit, host-justified waiver here.

## Canonical route matrix

| Route | Renderer source | Current web state | Route mismatch | Required seam | Waiver allowed? |
| --- | --- | --- | --- | --- | --- |
| `/dashboard` | `src/renderer/router.tsx`, `src/renderer/pages/dashboard/page.tsx` | Missing from `src/web/router.tsx` | None yet; route absent on web | Shared renderer route tree, shell/provider reuse | Temporary only while breadth migration is incomplete |
| `/search` | `src/renderer/router.tsx`, `src/renderer/pages/search/page.tsx`, `src/renderer/components/search-content.tsx` | Parallel implementation in `src/web/pages/search/page.tsx` | Canonical route path matches, but implementation diverges | Shared route tree, renderer component reuse, browser-safe client/host behavior | No long-term waiver |
| `/papers` | `src/renderer/router.tsx`, `src/renderer/pages/papers/page.tsx`, `src/renderer/components/papers-by-tag.tsx` | Parallel implementation via web index route and `src/web/pages/library/page.tsx` | Web uses `/` as library landing page instead of canonical `/papers` | Shared route tree, browser-safe import affordance, renderer shell | Temporary redirect/handoff waiver allowed only during bootstrap replacement |
| `/papers/:id` | `src/renderer/router.tsx`, `src/renderer/pages/papers/overview/page.tsx` | Parallel implementation in `src/web/pages/papers/overview/page.tsx` | Web uses `:paperId`; renderer uses `:id` | Shared route-param normalization, renderer page reuse, browser-safe asset/client adaptation | No long-term waiver |
| `/papers/:id/reader` | `src/renderer/router.tsx`, `src/renderer/pages/papers/reader/page.tsx` | Parallel implementation in `src/web/pages/papers/reader/page.tsx` | Web uses `:paperId`; renderer uses `:id` | Route-param normalization, browser-safe PDF/display seam, job/event seam, renderer workspace reuse | Temporary host-justified waiver allowed only for specific unsupported subpanels |
| `/papers/:id/notes` | `src/renderer/router.tsx`, `src/renderer/pages/papers/notes/page.tsx` | Parallel implementation in `src/web/pages/papers/notes/page.tsx` | Web uses `:paperId`; renderer uses `:id` | Route-param normalization, browser-safe PDF/editor seam, server-backed note persistence reuse | No long-term waiver |
| `/projects` | `src/renderer/router.tsx`, `src/renderer/pages/projects/page.tsx` | Missing from `src/web/router.tsx` | None yet; route absent on web | Shared renderer route tree, browser-safe external-link / filesystem affordances where needed | Temporary only while breadth migration is incomplete |
| `/projects/:id` | `src/renderer/router.tsx`, `src/renderer/pages/projects/page.tsx` | Missing from `src/web/router.tsx` | None yet; route absent on web | Same as `/projects`, plus route-tree reuse | Temporary only while breadth migration is incomplete |
| `/agent-todos` | `src/renderer/router.tsx`, `src/renderer/pages/agent-todos/page.tsx` | Missing from `src/web/router.tsx` | None yet; route absent on web | Shared renderer route tree, browser-safe background-job and stream adapters | Temporary only while breadth migration is incomplete |
| `/agent-todos/:id` | `src/renderer/router.tsx`, `src/renderer/pages/agent-todos/[id]/page.tsx` | Missing from `src/web/router.tsx` | None yet; route absent on web | Same as `/agent-todos`, plus detail-route reuse | Temporary only while breadth migration is incomplete |
| `/settings` | `src/renderer/router.tsx`, `src/renderer/pages/settings/page.tsx` | Missing from `src/web/router.tsx` | None yet; route absent on web | Shared renderer route tree plus explicit browser-safe replacements for Electron-only settings affordances | Temporary only while breadth migration is incomplete |

## Shell and provider parity contract

The following renderer shell contract is canonical for every web route above unless a route-specific waiver says otherwise:

1. `ToastProvider`
2. `ChatProvider`
3. `AnalysisProvider`
4. `TabsProvider`
5. `AppShell`

Current web status: **not reused**. `src/web/router.tsx` still mounts a separate `WebLayout` with `ResearchClaw Web` chrome and does not reuse the canonical provider stack.

Required seam categories before parity can be claimed:

1. host/window-control capability detection
2. main-process readiness behavior for browser mode
3. push-event subscription capability for chat/analysis/job updates
4. browser-safe asset/file/PDF URL handling
5. external-link / filesystem affordance isolation

## Temporary web-only waivers

These surfaces may continue temporarily only if they remain documented here and are covered by explicit tests.

### Waiver W-001: `/jobs`

- **Current surface**: `src/web/pages/jobs/page.tsx`
- **Reason**: There is no canonical standalone `/jobs` renderer route today; job visibility is currently a web-only recovery surface created during workflow-parity work.
- **Allowed temporary divergence**: A standalone `/jobs` route may remain during the migration only as an explicitly documented adapter/recovery surface.
- **Exit criteria**: Either (a) fold this capability into canonical renderer shell/job UX, or (b) keep it as a deliberate long-term waiver with dedicated tests and a written product justification.
- **Status**: Open; decision required during breadth-expansion task.

### Waiver W-002: Browser-first import workspace behavior

- **Current surface**: `src/web/components/import-workspace.tsx` used by `src/web/pages/library/page.tsx`
- **Reason**: The current browser import workflow was built as a dedicated page-level experience, while the renderer product currently anchors import from `PapersPage` + `ImportModal`.
- **Allowed temporary divergence**: Browser-specific import affordances may survive only as a thin host adaptation layer while `/papers` is migrated onto renderer components.
- **Exit criteria**: The user-visible import workflow must resolve to renderer-backed `/papers` behavior, with any remaining browser-only behavior isolated behind an adapter seam rather than a parallel product page.
- **Status**: Open; must be revisited during core paper-route migration.

## Prohibited silent divergence

The following are not allowed without an explicit matrix update:

1. New long-lived pages under `src/web/pages/*`
2. Any new web route that bypasses the canonical renderer shell/provider stack
3. Any new route-param contract other than the canonical renderer `:id` shape unless an adapter is documented here
4. Keeping old workflow-parity tests unchanged after the underlying product contract moves to renderer-first reuse

## Completion gate

The renderer-first correction is complete only when:

1. every non-waived route in the matrix is renderer-backed on web
2. every remaining divergence is listed in the waiver section above with justification and tests
3. `src/web` acts as bootstrap/adapter code, not a second product tree
4. parity tests cover shell composition, canonical route handoff, core paper routes, reader/notes workspaces, and the remaining breadth routes
