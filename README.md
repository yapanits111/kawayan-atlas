# 🎋 Kawayan Atlas

**A Philippine reference and design sandbox for bamboo construction** — a browsable
species atlas, a joint/connection library, a template gallery, an interactive 3D design
studio, and a (safety-gated) structural calculator, in front of an aesthetic landing page.

![Kawayan Atlas landing page](docs/screenshots/landing.png)

> **Design-exploration tool — not engineering advice.** Kawayan Atlas helps you learn about
> and explore bamboo structures. It does **not** replace a licensed structural engineer or
> the LGU building-permit process. Every structural output is advisory, gated behind
> engineer review, and numeric facts are cited to their sources.

This repository is **Release 1**: a full-stack demo with **no login**, designed to run
entirely on free tiers. See [`PLAN.md`](PLAN.md) for the full product & build plan and
[`DEPLOYMENT.md`](DEPLOYMENT.md) for the $0 deployment guide.

---

## Features

### 🧩 Design Lab — browser node-graph platform
A Grasshopper-style computational design tool built specifically for bamboo, in the
browser — no install, no plugins. A **node-graph canvas** drives a **live 3D view** and a
**fabrication cut-list**, built on the whitepaper's architecture in dependency order
(geometry kernel → live evaluation engine → bamboo nodes → output).

**Node palette** — 26 nodes: the whitepaper's §7 palette in full, plus pole reconciliation. Every node's inputs,
outputs, and parameters are documented in [`docs/NODE-SPEC.md`](docs/NODE-SPEC.md), which
is generated from the registry so it cannot drift from the code.
- **Geometry** — point, line, arc, circle, rectangle, grid, divide, transform, array (linear/polar), mirror, extrude→posts, **loft**, **weave**, **intersect**
- **Bamboo** — `culm` (tapered tube with **node/diaphragm spacing**; **linked to the species atlas** — pick a species to auto-fill its cited diameter/wall), `strip` (flat ribbon), `internode` (mark a culm's diaphragms, or split it there — each segment keeping its own share of the taper), `laminate` (glue- or cross-laminated layup), `joint` (**linked to the joint library** — a fish-mouth saddle cuts its members to the mating culm's angle; a lashing or bolt butts them square), `bundle`
- **Analysis** (advisory) — `load`, `support`, `check`: coarse geometric slenderness flags anchored to **ISO 22156**, with a prominent "not a verified analysis" disclaimer; capacity is never computed (Phase 2 / whitepaper §9)
- **Output** — `schedule` → **two** buildable documents: a per-element cut-list (taper, node counts, layup, cut angle at each end) and a **joint schedule** (type, which members meet, included angle, location), both exportable as **CSV / PDF**; `inventory` reconciles the design against a yard of **real, measured poles** — which pole each mark is cut from and at what station, the offcut left, and any piece the yard cannot yield (CSV); the 3D model exports as **GLB** (mesh) or **DXF** (CAD lines)

**Honest about what is verifiable.** ISO 22156:2021 covers round culms and *explicitly
excludes* engineered bamboo. Culms are tagged `iso22156-round`; strips and laminates are
tagged `outside-iso22156`, badged **no code** in the schedule, and carry a validation-status
note into the exported PDF — modelled freely, never implied to be code-checked (§9).

**Editor:** live dependency-ordered re-evaluation, autosave + shareable links, undo/redo,
wire-type validation, node delete/duplicate, a minimap, and ten worked examples (barrel
vault, lofted shell, post & beam, woven screen, column ring, checked posts, nodes &
internodes, laminated arch, lashed screen, pole-yard reconciliation). The proof chain
`arc → divide → culm → array → schedule` ships preloaded.

![Design Lab](docs/screenshots/design.png)

### 📖 Bamboo Species Atlas
Six Philippine bamboo species with **verified, cited** properties (density, culm diameter,
wall thickness, structural roles, treatment) — every figure sourced to PROSEA, DOST-FPRDI /
Base Bahay, or published studies. Filter by role, search, and **compare species side by side**.

![Bamboo Atlas](docs/screenshots/atlas.png)

### 🧱 Parametric Design Studio
The freedom of parametric modelling — like Rhino + Grasshopper, but built for bamboo and
simple enough to use in a minute (no node graph, no plugins, no learning curve). Drive
continuous sliders — **width, bay length, bay count, stilt height, wall height, roof
pitch** — plus **species**, **roof type**, **bracing** (knee / cross), and a **door
opening**, and the `react-three-fiber` model reshapes live. A real-time **material takeoff** (footprint, roof angle, total culm length, estimated
culms) updates as you drag, and any design can be **saved & shared** via a link (anonymous,
no account).

![Parametric Design Studio](docs/screenshots/studio.png)

### ⇄ Compare Species
Pick any species and see their properties side by side.

![Compare species](docs/screenshots/compare.png)

### 🔎 Safety-Gated Calculator
A single-member capacity check whose numeric rules stay **disabled until a licensed
engineer signs off** — so no capacity figures are shown, only the honest disclaimer.

![Gated calculator](docs/screenshots/calculator.png)

Plus: a **joint & connection library** (traditional lashings to bolted mortar-plug joints,
cited to ISO 22156 and Base Bahay), a **template gallery** with bills of materials, a
responsive mobile nav, custom 404 / error pages, and SEO (dynamic metadata, sitemap,
`robots.txt`, and a branded OpenGraph image).

---

## Tech stack

| Layer | Choice |
|---|---|
| **Frontend** | Next.js 14 (App Router) · TypeScript · Tailwind CSS · react-three-fiber |
| **Backend** | Python · FastAPI · SQLAlchemy · Alembic |
| **Database** | SQLite (local dev) → PostgreSQL / Neon (deployment) — one `DATABASE_URL` swap |
| **Tests / CI** | pytest · GitHub Actions (backend tests + frontend type-check & build) |
| **Hosting** | Azure Static Web Apps / Vercel (frontend) · Azure Container Apps (backend) · Neon (DB) — all free tier |

The frontend fetches all content from the backend REST API (server-rendered), so it's a
genuine full-stack app rather than a static site — while still deployable for $0.

---

## Project structure

```
kawayan-atlas/
├── backend/                 # FastAPI + SQLAlchemy
│   ├── app/
│   │   ├── main.py          # app + routers + CORS
│   │   ├── models.py        # SQLAlchemy models (schema)
│   │   ├── schemas.py       # Pydantic request/response
│   │   ├── routers/         # species, joints, templates, designs, calculator
│   │   ├── seed_data/       # cited JSON content (species, joints, templates)
│   │   └── seed.py          # idempotent seeder
│   ├── alembic/             # database migrations
│   └── tests/               # pytest API suite
├── frontend/                # Next.js app
│   └── src/
│       ├── app/             # routes (atlas, joints, templates, studio, compare, calculator)
│       ├── components/      # header, footer, glyphs, 3D studio, sources
│       └── lib/             # typed API client
├── docs/screenshots/        # images used in this README
├── PLAN.md                  # product & build plan
└── DEPLOYMENT.md            # free-tier deployment guide
```

---

## Run it locally

Requires Python 3.12+ and Node 20+.

### 1. Backend (from `backend/`)

```bash
python -m venv .venv
.venv/Scripts/python.exe -m pip install -r requirements.txt   # Windows
# source .venv/bin/activate && pip install -r requirements.txt  # macOS/Linux

# create the schema — quick (create_all runs on startup) or via migrations:
alembic upgrade head

# seed the database (idempotent)
python -m app.seed

# run the API on http://127.0.0.1:8020
python -m uvicorn app.main:app --reload --port 8020
```

Interactive API docs: http://127.0.0.1:8020/docs

### 2. Frontend (from `frontend/`)

```bash
npm install
npm run dev   # http://localhost:3000
```

The frontend defaults to the API at `http://127.0.0.1:8020`. To point elsewhere, copy
`.env.local.example` to `.env.local` and set `NEXT_PUBLIC_API_URL`.

---

## Testing & CI

```bash
# backend (13 API tests, isolated temp database)
cd backend && .venv/Scripts/python.exe -m pytest -q

# frontend type-check + build
cd frontend && npx tsc --noEmit && npm run build
```

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs the backend tests plus the
frontend type-check and build on every push / PR (assumes `kawayan-atlas/` is the repo root).

---

## Data model

| Table | Purpose |
|---|---|
| `bamboo_species` | Species atlas content (properties, roles, sources) |
| `joint_types` | Joint/connection library |
| `templates` | Template gallery (components + bill of materials) |
| `designs` | Anonymous saved/shared designs (owner added in Release 2 with accounts) |

Content types map 1:1 to future database tables, and the calculator is a pure function —
so the Release 2 additions (accounts, community) are extensions, not a rewrite.

---

## Deploying

See [`DEPLOYMENT.md`](DEPLOYMENT.md) for the free-tier ($0) path: Neon Postgres + Azure
Container Apps (backend) + Azure Static Web Apps or Vercel (frontend).

---

## Sources

Species and joint data are cited on each detail page. Primary sources include
[PROSEA Bamboos](https://prosea-bamboos.linnaeus.naturalis.nl/),
[DOST-FPRDI](https://fprdi.dost.gov.ph/),
[Base Bahay Foundation](https://base-builds.com/) (Cement-Bamboo Frame Technology and the
ISO 22156 design manual), and [ISO 22156:2021](https://www.iso.org/standard/73831.html).
