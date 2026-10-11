# REBASE — Project Context

## What is Rebase
Autonomous Dependency Resilience Engine. Observes external dependencies (APIs, Webhooks, MCP servers, SDKs), detects breaking changes, analyzes semantic meaning, generates compatibility adapters, validates in sandbox, and auto-applies safe fixes or blocks dangerous ones for human review.

## Two-Application Architecture

### A. Dependency Simulator (separate app)
A real backend that behaves like external third-party dependencies. Allows intentionally introducing changes (field renames, type changes, semantic shifts). Lives in `simulator/`. Has its own server, API endpoints, and UI to trigger changes.

### B. Rebase (this app)
The actual product — frontend + backend + resilience engine. Independently observes the simulator's dependencies, detects drift, and processes through the full pipeline. Lives in project root.

## Architecture — ONE Common Pipeline
```
API / Webhook / MCP / SDK
        ↓ (type-specific observer)
   Normalization → common DependencyObservation format
        ↓
   Baseline / History
        ↓
   Change Detection (deterministic structural diff)
        ↓
   Impact Analysis (affected workflows)
        ↓
   Semantic AI Engine (LLM for meaning, deterministic for structure)
        ↓
   Adapter / Patch Generator
        ↓
   Sandbox Validation
        ↓
   Safety Gate
      ↙       ↘
AUTO-FIX    HUMAN REVIEW
        ↓
Recovery Verification
```

Four dependency types share ONE pipeline. Type-specific logic only at observer/input layer.

## Key Scenarios

### API Happy Path (primary demo)
Simulator: `name` → `display_name` field rename. Rebase detects, analyzes (semantic equivalent, LOW risk), generates adapter, sandbox passes → AUTO-FIX APPLIED.

### MCP Killer Scenario (differentiator)
Simulator: `delete_user` description changes from "Deactivate user account" to "Permanently delete user and all data." Schema identical, parameters identical. Rebase detects semantic shift (12% semantic compat, CRITICAL risk) → AUTO-FIX BLOCKED, HUMAN REVIEW REQUIRED.

## Safety Policy
```
IF confidence >= 0.90 AND risk != CRITICAL AND sandbox passes → AUTO-APPLY
OTHERWISE → HUMAN REVIEW
CRITICAL semantic changes → ALWAYS BLOCKED
```

## Design Principles
- Real engine + controlled external dependency (not hardcoded frontend animations)
- Deterministic logic for structural diff, AI only for semantic analysis
- Compatibility adapter preferred over forcing changes across the application
- Modular monolith backend, not microservices
- Do NOT rebuild existing UI — evolve it

## Tech Stack
- Frontend: Vanilla JS + Vite (no framework migration)
- Backend: Node.js (to be built)
- Simulator: Separate Node.js app
- Design: Dark obsidian (#090a0d), lime (#d4f938), orange (#fa4d1e), glassmorphism, JetBrains Mono, Syne

## Current File Structure
```
hackwave/
  index.html          — Single-page dashboard (1045 lines, polished)
  src/main.js         — All frontend logic (1440 lines)
  src/style.css       — Full design system (4929 lines)
  package.json        — Vite + lucide
  simulator/          — (to be built) Dependency Simulator app
  backend/            — (to be built) Rebase backend + engine
```

## Existing UI Components to PRESERVE
- Dashboard layout (sidebar, top bar, hero, metrics grid)
- API registry table with status badges, filters, search
- Inspect Change modal (diff view, impact cards) — evolve into real pipeline investigation UI
- Pipeline modal (progress tracker, step content) — reuse for real pipeline results
- Telemetry feed, dependency graph, drawer, toast system, browse/add modals
- All CSS/visual design — do not redesign

## Implementation Phases
1. Rebase UI upgrade (make data-driven, remove hardcoded sim)
2. Dependency Simulator (separate app with real API endpoints)
3. Backend foundation (server, routing, modules)
4. API Observer + Normalization
5. Baseline + Change Detection
6. Impact Analysis
7. Semantic AI Engine
8. Adapter/Patch Generator
9. Sandbox Validation
10. Safety Gate + Human Review
11-13. Webhook, MCP, SDK support
14. Frontend ↔ Backend integration
15. End-to-end testing + demo polish

Priority: API end-to-end first, then MCP, then Webhook/SDK.

## What NOT to Do
- Do not rebuild existing UI from scratch
- Do not migrate to React/TypeScript
- Do not hardcode fake AI results into frontend
- Do not create microservices
- Do not build four independent systems
- Do not over-engineer production infrastructure
- Do not jump phases — complete and test each before moving on
