# ResearchClaw Web Workflow Parity Design

**Goal:** Extend the existing server-first web slice into staged **workflow parity** with the desktop product, prioritizing end-to-end research workflows over pixel-identical UI parity.

## Why a new design document is needed

The existing `2026-03-17-researchclaw-web-design.md` document intentionally defined a narrow first browser slice: library, import, search, reader, notes, single-user deployment, and Docker-first runtime. That decision was correct, and the branch now has code and tests proving that this narrow slice is real.

The next planning problem is different. The question is no longer “should ResearchClaw have a server-first web runtime?” The question is now “how far should web parity go, in what order, and how should we test it without letting scope explode?”

This document answers that next-stage question.

## Final product decision

### Chosen parity contract: workflow parity

The web effort should target **workflow parity**, not strict visual parity and not one-shot full-feature parity.

That means:

1. The browser path must let a user complete the same important research jobs as the desktop app.
2. The browser UI may adapt layout, controls, and navigation to fit web semantics.
3. Exact desktop shell behaviors such as tab-strip chrome, Electron-native window controls, and other platform-specific interactions are **not** phase-one requirements.

### What “workflow parity” means in this project

For ResearchClaw, workflow parity is evaluated on the user journey, not on page-for-page imitation:

1. **Acquire papers**
   - import from browser-safe entry points
   - watch progress
   - persist data on the server

2. **Inspect and organize papers**
   - open a paper overview
   - navigate between library, search, overview, reader, and notes
   - retain enough metadata and actions to continue the research loop

3. **Read and annotate papers**
   - open the paper in a browser-native reading workspace
   - see server-backed paper assets
   - save and reopen notes reliably

4. **Recover work after navigation or restart**
   - background jobs remain visible
   - browser navigation does not destroy the research flow
   - server-owned state survives browser refreshes and runtime restarts

## Locked constraints for the next implementation wave

These constraints are frozen unless a later product decision explicitly changes them:

1. **Same-origin runtime remains the deployment model**
   - one Node server serves both the browser app and the web APIs

2. **Single-user-first remains the product boundary**
   - no multi-user auth, sharing, or in-app RBAC in this phase

3. **Server-first ownership remains the storage model**
   - SQLite, PDFs, notes, and job state stay server-owned

4. **Docker-first remains the default deployment path**
   - the browser experience must stay aligned with `build:web`, `start:web`, and `docker-compose.web.yml`

5. **Manual test documents supplement automation; they do not replace it**
   - every major workflow still needs automated coverage
   - the manual runbook becomes a release gate artifact, not a substitute for tests

6. **Web-native adaptation is allowed**
   - layout, interaction style, and navigation may differ from Electron when the workflow outcome is preserved

## What this document explicitly does not require

The next stage does **not** require:

1. pixel-level recreation of the desktop shell
2. immediate parity for `projects`, `dashboard`, `agent-todos`, `settings`, `profile`, or `graph`
3. browser access to Chrome history or other local desktop-only data sources
4. multi-user deployment concerns
5. turning the web effort into a generic product rewrite with no milestone boundary

## Current state summary

The branch already has a credible narrow web runtime:

- `src/server/*` provides same-origin web serving plus papers, import, reading, search, and jobs routes
- `src/web/*` provides browser pages for library, search, reader, and notes
- `src/renderer/lib/researchclaw-client.ts` exposes only the minimal web-safe client surface
- tests under `tests/integration/web-*.test.ts` and `tests/frontend/web/*.test.tsx` prove the narrow slice

The gap is that desktop workflow breadth is still much larger:

- richer import surfaces
- paper overview/details
- PDF-centric reading
- job visibility integrated into the browser workflow
- later, projects, dashboard, agent todos, settings, profile, and graph

## Recommended milestone structure

### Phase 1: Core research workflow parity

This is the next implementation milestone.

#### In scope

1. **Browser import workspace**
   - identifier import should expand beyond the current arXiv-only UI
   - PDF upload should be available from the browser workflow
   - job progress should be visible from the initiating UI

2. **Paper overview workflow**
   - add a browser page for paper detail / overview
   - make library and search navigate through overview instead of jumping directly into notes-only actions
   - expose the minimum metadata and actions needed to continue reading

3. **Reader upgrade for browser usefulness**
   - add browser-native access to the paper asset
   - keep notes editing tightly integrated with the reading flow
   - avoid desktop-only chat workstation complexity in this phase

4. **Job visibility and recovery**
   - list jobs in the browser
   - recover in-progress or completed job state after navigation
   - preserve server-first long-running behavior

5. **Phase-1 test gate**
   - automated tests for the new contracts, APIs, and browser pages
   - a manual runbook for the entire phase-1 workflow

#### Explicitly out of scope

1. project management pages
2. dashboard parity
3. agent-todo parity
4. advanced reader chat / comparison workstation parity
5. settings/profile/graph parity

### Phase 2: Research workspace parity

This phase starts only after Phase 1 is complete and stable.

#### Candidate scope

1. dashboard
2. projects and project detail workflows
3. agent todo surfaces
4. richer reader-side analysis and workspace behaviors
5. stronger browser job orchestration around long-running analysis flows

#### Why it is deferred

These features rely on broader workflow semantics than the current narrow web slice. Shipping them before core paper workflows are complete would mix too many unknowns and make acceptance meaningless.

### Phase 3: Platform-sensitive and peripheral parity

This phase contains the widest desktop-specific surface area.

#### Candidate scope

1. settings
2. profile
3. citation graph
4. desktop-native or Electron-sensitive affordances that need explicit browser redesigns

#### Why it is last

These areas have the weakest relationship to the current browser path and the highest likelihood of requiring true product adaptation instead of direct translation.

## Architecture implications

### 1. Keep the current server-first layering

The repo already has the correct broad layering for web work:

- `src/shared/contracts/*`
- `src/renderer/lib/*` transport-neutral client boundary
- `src/server/*` for web runtime and APIs
- `src/web/*` for browser UI

The next wave should deepen this layering instead of bypassing it.

### 2. Expand contracts only where a workflow requires them

Phase 1 should extend shared contracts for:

- paper detail / overview data
- browser-safe import inputs and responses
- job list/detail usage in the browser shell

It should not preemptively add large contracts for later desktop-only surfaces.

### 3. Treat browser file access as a server route concern

Phase 1 browser reading must not depend on Electron file access assumptions. If the reader needs the paper asset, the server runtime must expose a browser-safe route for it.

### 4. Use the desktop UI as reference material, not as a copy target

Desktop files under `src/renderer/pages/*` and `src/renderer/components/*` should guide the browser workflow design, but the browser implementation should only absorb the parts needed for workflow completion.

## Acceptance gates

### Gate 0: Scope freeze

Before code implementation starts, the following must already be true:

1. workflow parity is the approved contract
2. same-origin + single-user + server-first + Docker-first remain locked
3. Phase 1 scope is frozen to core research workflows
4. manual runbook is defined as a gate artifact, not a test replacement

### Gate 1: Phase-1 feature acceptance

Phase 1 is complete only when a user can:

1. start the web runtime from a clean storage directory
2. import a paper through browser-safe entry points
3. observe job progress in the browser
4. open the paper overview
5. open the reader and access the paper asset through the browser flow
6. save notes and reopen them later
7. recover persisted data after restarting the runtime

### Gate 2: Evidence and validation

Phase 1 cannot be called complete without:

1. updated automated tests for added contracts and APIs
2. updated browser tests for changed pages/routes
3. a manual test runbook with case IDs, expected evidence, and failure signatures
4. fresh `npm run lint`, `npm run test`, `npm run test:frontend`, and `npm run build` evidence

## Manual test documentation policy

The web parity effort needs a runbook that is organized by **workflow**, not by page.

Each manual test case must record:

1. case ID
2. scope / phase
3. preconditions
4. concrete steps
5. expected result
6. failure signs
7. evidence to capture
8. matching automated coverage or a clear statement that automation still needs to be added

Phase 1 requires the runbook immediately. Phase 2 and Phase 3 can begin with reserved sections, but they should not block Phase 1 implementation.

## Main risks

1. **Range inflation**
   - trying to move projects, dashboard, settings, graph, and profile into the same milestone

2. **False parity**
   - recreating pieces of the desktop shell without restoring the underlying research workflow

3. **Manual-doc drift**
   - writing a runbook once and never updating it as routes, UI, and acceptance criteria change

4. **Over-expanding shared contracts**
   - turning Phase 1 into a speculative redesign of all desktop surfaces

5. **Skipping persistence/recovery validation**
   - browser flows look correct in one session but fail across restarts or navigation changes

## Final decision

ResearchClaw web development should proceed as a **workflow-parity program with staged milestones**, not as a one-shot full-parity rewrite and not as a UI-cloning exercise.

The next execution target is **Phase 1: core research workflow parity**. That phase should deepen the browser paper workflow by adding richer import paths, paper overview, browser-safe paper access, and job visibility while keeping the product boundary fixed to **same-origin, single-user, server-first, Docker-first**.
