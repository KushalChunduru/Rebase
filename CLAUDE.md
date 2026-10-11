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
- Backend: Node.js + Express
- Simulator: Separate Node.js app
- Razorpay: Test Mode SDK integration (razorpay npm package)
- Design: Dark obsidian (#090a0d), lime (#d4f938), orange (#fa4d1e), glassmorphism, JetBrains Mono, Syne

## Razorpay Integration

### Live Demo Flow
1. Dashboard → Live APIs view → "Pay ₹5 Test" button
2. Backend creates Razorpay order via `POST /api/payments/create-order`
3. Frontend opens Razorpay Checkout (test mode)
4. After payment, frontend verifies signature via `POST /api/payments/verify`
5. Razorpay sends webhook to `POST /webhooks/razorpay` (via ngrok tunnel)
6. Rebase captures baseline schema from webhook payload
7. "Simulate Drift" button sends synthetic payload with `amount: number → string`
8. Rebase detects structural drift via deterministic schema diff

### Endpoints
- `POST /api/payments/create-order` — creates Razorpay test order, returns orderId + keyId
- `POST /api/payments/verify` — verifies checkout signature (order_id|payment_id HMAC)
- `POST /webhooks/razorpay` — receives genuine Razorpay webhooks, validates signature against raw body
- `POST /webhooks/simulate-drift` — sends synthetic payload to trigger type_changed detection
- `DELETE /webhooks/simulate-drift` — resets synthetic test baseline

### Webhook Signature Verification
- Uses raw request body (captured via express.json verify callback)
- Rejects missing signatures when webhook secret is configured
- Deduplicates by payment/order entity ID + event name

### Synthetic Drift Isolation
- Genuine webhooks use baseline key `razorpay:{event}`
- Synthetic test payloads use `razorpay-test:{event}`
- Synthetic payloads never corrupt genuine baselines

### Environment Variables (backend/.env)
```
RAZORPAY_KEY_ID=rzp_test_xxxx
RAZORPAY_KEY_SECRET=xxxx
RAZORPAY_WEBHOOK_SECRET=xxxx
```

### Webhook Setup
1. Run `npx ngrok http 3000` to get HTTPS tunnel URL
2. In Razorpay Dashboard → Settings → Webhooks → Add:
   - URL: `https://xxxx.ngrok-free.app/webhooks/razorpay`
   - Secret: same as RAZORPAY_WEBHOOK_SECRET in .env
   - Events: payment.captured, order.paid, payment.failed, refund.processed
3. Use test card `4111 1111 1111 1111` or UPI ID `success@razorpay`

## Current File Structure
```
hackwave/
  index.html                — Single-page dashboard
  src/main.js               — Frontend logic (payment flow, drift simulation, WS handlers)
  src/style.css             — Full design system
  src/services/api-service.js — Backend API client (payments, drift simulation)
  src/services/webhook-ws.js  — WebSocket client for real-time events
  package.json              — Vite + lucide
  scripts/start-all.js      — Starts simulator + backend + frontend
  simulator/                — Dependency Simulator app
  backend/
    server.js               — Express server (raw body capture, CORS, routes)
    src/config.js            — Environment config (Razorpay keys, pipeline thresholds)
    src/routes/payments.js   — Razorpay order creation + signature verification
    src/routes/webhooks.js   — Webhook receiver (signature validation, drift detection, simulation)
    src/routes/pipeline.js   — Pipeline execution API
    src/routes/dependencies.js — Dependency CRUD
    src/store/index.js       — In-memory store (deps, baselines, observations, pipeline runs)
    src/modules/pipeline.js  — 9-stage pipeline orchestrator
    src/modules/sandbox/     — Adapter validation (compile, no-throw, field coverage, idempotency)
    src/modules/safety/      — Safety gate (auto-apply / blocked / human review)
    src/ws.js                — WebSocket broadcast
    .env                     — Razorpay credentials (gitignored)
    .env.example             — Template for required env vars
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
