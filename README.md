# Rebase

**Dependency Control Platform** — Observe API behaviour, catch breaking schema changes, and recover with confidence.

Rebase is a dashboard UI for monitoring and managing external API dependencies. It tracks contract validity, schema drift, and downstream impact in real time.

## Features

- **Interactive Dependency Graph** — Live SVG visualization of your API dependency tree with animated data flow, health indicators, and hover tooltips
- **Schema Drift Detection** — Identifies breaking changes in upstream APIs before they cascade to production
- **Contract Validation** — Continuous monitoring of API contracts with pass/fail status
- **Metric Cards** — At-a-glance view of registered APIs, detected changes, and protected workflows
- **Live Ticker** — Real-time feed of API health checks scrolling across the dashboard
- **API Registry** — Searchable, filterable table of all registered dependencies with status, latency, and version info
- **Inspect Modal** — Side-by-side diff view of schema changes with field-level detail
- **Discoverable Catalog** — Browse and add new APIs from a curated catalog

## Tech Stack

- **Vite** — Build tool and dev server
- **Vanilla JS** — No framework, ES modules
- **Lucide Icons** — Icon library
- **CSS Custom Properties** — Full design system with dark theme
- **Google Fonts** — Outfit, Syne, JetBrains Mono, Plus Jakarta Sans, Space Grotesk, Italiana

## Getting Started

```bash
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

## Build

```bash
npm run build
npm run preview
```

## Project Structure

```
├── index.html          # Main HTML — sidebar, hero, metrics, table, modals
├── src/
│   ├── style.css       # Full design system and component styles
│   └── main.js         # Data store, rendering, event handlers, graph interactivity
├── package.json
└── .gitignore
```

## License

MIT
