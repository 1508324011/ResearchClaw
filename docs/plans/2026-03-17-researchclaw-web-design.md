# ResearchClaw Server-First Web Design

**Goal:** Turn ResearchClaw into a server-first web product for the first core workflow: import papers, read papers, take notes, and search from a browser such as Edge while all PDFs, metadata, notes, and background jobs live on the server.

## Problem Statement

The current product is a standalone Electron desktop app. Its renderer depends on `window.electronAPI`, its runtime depends on `BrowserWindow`, `ipcMain`, `dialog.showOpenDialog`, `app.getPath(...)`, local filesystem paths, and child processes launched from the host machine. That architecture works well for a local desktop researcher workflow, but it is the wrong shape for a user who mainly lives on a remote server and wants to open one URL in Edge.

The first web release should not try to replace every desktop capability. It should deliver the smallest browser-native workflow that is genuinely useful on a remote server:

1. import a paper by uploading a PDF or pasting an arXiv / DOI / URL
2. store the PDF and metadata on the server
3. browse and search the library in a browser
4. open a reading page with PDF preview and AI analysis
5. edit structured notes in the browser

## Product Direction

### Recommended Direction: Phase-B-first migration

Build a **server-first core web edition** first, while preserving the existing Electron app as the legacy desktop path.

This is the recommended direction because:

1. the user's main environment is remote-server-first, not laptop-first
2. Edge is not the blocker; Electron-native runtime assumptions are the blocker
3. the browser workflow can already satisfy the most valuable research loop without waiting for project management or remote agent parity
4. it lets the fork make visible progress under the user's account while keeping a future path for upstreamable abstractions

### Alternatives considered

#### Option A: Full parity web rewrite now

Pros:
- one long-term destination
- avoids temporary split thinking

Cons:
- too wide for the first milestone
- mixes core research workflow with projects, SSH agents, and broader desktop parity
- higher risk of stalling before a usable release exists

#### Option B: Server-first core web edition first (**recommended**)

Pros:
- smallest useful browser-native product
- directly matches the user's confirmed scope
- keeps architecture honest by separating transport, server runtime, and browser UI early

Cons:
- temporary feature gap versus desktop app
- some duplicated UI and adapter code in the short term

#### Option C: Only build an Edge capture extension first

Pros:
- small surface area
- good later convenience feature

Cons:
- does not solve the actual problem by itself
- still needs a real server-side paper library and reading product behind it

## Confirmed First-Release Scope

### In scope

The first server-first web release should include only:

1. **Single-user deployment**
   - no multi-user roles, orgs, or sharing model
   - deployment is assumed to be private or protected outside the app

2. **Docker-first deployment**
   - one service image for the server runtime
   - persistent volume for SQLite and paper storage

3. **Import flows**
   - upload PDF from browser
   - import by arXiv ID, DOI, or URL
   - application-side search import for supported paper sources
   - server-side metadata fetch and server-side PDF download when applicable

4. **Library + search**
   - paper list view
   - text search
   - semantic / ranked search where already supported by shared logic

5. **Reading workflow**
   - browser-native paper reading page
   - server-backed AI analysis
   - structured notes editing and persistence

6. **Background job visibility**
   - import and analysis progress available in the browser
   - HTTP + SSE for first release

### Explicitly out of scope for the first release

These items should be deferred to later phases:

1. Projects and idea generation
2. Remote SSH / agent workflows
3. Edge extension capture
4. Scanning local Chrome or Edge history
5. Multi-user identity, teams, permissions, or sharing
6. Full desktop/web parity in a single pass

## Edge Compatibility Position

Edge is acceptable as the primary browser target for the first web release because it is a modern Chromium browser and supports the needed primitives for this scope: file upload, authenticated HTTP requests, SSE, PDF rendering approaches, and normal React application behavior.

The important design rule is this:

**Do not model the web product around reading local browser history.**

For a server-first browser app, the correct import entry points are:

1. upload a PDF
2. paste an arXiv / DOI / URL
3. search from inside the app and import from there

An Edge extension may later become a convenience capture path, but it must not block the first usable release.

## Target Architecture

### 1. Client Layer

- **Desktop legacy client** remains under `src/renderer/*`
- **Web client** is added under `src/web/*`
- both clients should depend on transport-neutral contracts rather than directly depending on Electron IPC shapes

### 2. Shared Contract Layer

Introduce browser-safe shared contracts under `src/shared/contracts/*` for:

- papers
- reading
- search
- jobs

This layer becomes the stable boundary between UI callers and runtime-specific adapters.

### 3. Transport Layer

- **Electron path:** existing preload + IPC remains for desktop behavior
- **Web path:** HTTP routes + SSE event streams

The renderer-side access pattern should be abstracted so the browser UI does not know about `window.electronAPI`.

### 4. Server Runtime Layer

Add `src/server/*` for the first real web runtime. This layer should:

- host HTTP routes
- own browser-originated import requests
- run background jobs for import and analysis
- persist state to server storage
- stream job progress back to the browser

### 5. Storage Layer

First release storage should stay intentionally simple:

- **database:** SQLite on a Docker-mounted persistent volume
- **paper files:** server-local persistent storage volume
- **notes and analysis artifacts:** database and server-owned file paths as appropriate

This keeps the first release aligned with the current app's storage model while moving ownership from the laptop to the server.

## Import Model Redesign

The import model is the most important behavior change.

### Desktop assumption today

Current desktop flows assume the app runs on the same machine that owns:

- the PDF file chooser
- the browser history database
- the local paper download path

### Server-first web model

The web product should instead assume:

1. the browser sends files or identifiers to the server
2. the server fetches metadata and PDFs
3. the server persists paper assets and job state
4. the browser observes progress and consumes results

### First-release import entry points

1. **Upload PDF**
   - browser posts file to server
   - server stores the file and creates paper record

2. **Paste identifier or URL**
   - browser posts arXiv / DOI / URL
   - server resolves metadata and downloads PDF when possible

3. **Search inside the app**
   - browser queries supported remote source through server routes
   - user selects result to import

### Deferred import entry point

- **Edge extension capture**
  - useful later
  - not required to validate the server-first architecture

## Feature Mapping

### First-release deliverables

| User need | First web release behavior |
|---|---|
| Put PDFs on the server | Upload PDF and server-managed import |
| Save laptop space | Files and SQLite live on server volume |
| Use Edge as client | Browser-native React app served from server |
| Read papers remotely | Web reading page with PDF preview |
| Take notes | Browser note editor backed by server storage |
| Search library | Text and semantic/ranked search endpoints |
| Watch long-running tasks | SSE job stream |

### Deferred deliverables

| Capability | Deferred reason |
|---|---|
| Projects | Not needed for first usable browser workflow |
| Remote agent / SSH | Wider execution model, larger security surface |
| Multi-user auth | Adds unnecessary complexity for a single-user release |
| Edge extension | Helpful convenience, not architectural blocker |

## Security and Deployment Position

The first release is **single-user-first**. That means:

- no in-app RBAC or collaboration model yet
- deployment may rely on private networking, reverse-proxy auth, or host-level protection
- server secrets stay on the server
- browser clients should never need direct filesystem access beyond uploading a file

The first release is also **Docker-first**. The expected deployment shape is:

- one application container
- one persistent volume mounted for DB and paper storage
- environment configuration for model providers and storage root

## Migration Phases

### Phase 1: Shared contracts and transport abstraction

- add `papers`, `reading`, `search`, and `jobs` shared contracts
- introduce transport-neutral client access on the frontend side
- keep Electron path working while opening a clean web path

### Phase 2: Web server skeleton

- add `src/server/*`
- add health route, storage config, and basic paper routes
- establish SSE job bus for progress updates

### Phase 3: Core browser workflow

- browser upload/import
- library and search pages
- reader page and notes editor
- server-backed AI analysis flow

### Phase 4: Docker release path

- Dockerfile
- compose example
- persistent-volume documentation
- server deployment instructions

### Phase 5: Later expansion

- projects
- remote agent / SSH workflows
- Edge extension capture
- stronger auth / multi-user shape if ever needed

## Success Criteria

The first web release is successful if a single user can:

1. open the app in Edge from a remote machine
2. upload or import a paper without touching the server filesystem manually
3. see the PDF and metadata stored server-side
4. search and reopen imported papers later
5. run AI analysis and edit structured notes in the browser
6. keep all meaningful data on the server instead of the laptop

## Main Risks

1. trying to preserve too much desktop parity too early
2. leaking Electron assumptions across the new web boundary
3. blocking on Edge extension work before the browser app is useful
4. letting projects / remote agent features bloat the first milestone
5. treating `npm install` Electron binary download problems as if they block document and architecture work

## Final Decision

ResearchClaw should be evolved into a **server-first, browser-accessed web product** in phased form, not “made Edge-compatible” as a thin desktop patch. The first release should be deliberately narrow: **single-user, Docker-first, import + reading + notes + search**. `Projects`, `remote agent`, and `Edge extension` are later-phase features, not first-release blockers.
