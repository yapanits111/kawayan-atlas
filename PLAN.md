# Kawayan Atlas — Product & Build Plan (v2)

A Philippine-based platform for learning about, designing, and sanity-checking bamboo
structures.

> **Working name:** *Kawayan Atlas* ("kawayan" = bamboo in Filipino). Swap for whatever
> you land on.
>
> **Revision note (v2, Sept 2026):** Reworked from the first draft after a critique pass.
> Key changes: the compliance module is re-scoped and renamed to a **Design Sanity
> Pre-Check** (the standards can't back a real pass/fail permitting engine); the
> **3D Design Studio is demoted to an explicit stretch goal (Phase 1.5)**; **SME
> sign-off is now a hard gate**, not a footnote; and the **launch audience is narrowed**
> to students/educators and self-builders. See §0 for the reasoning behind each.
>
> **Decision update (Sept 2026, same session):** Daniel wants the project to demonstrate
> **full-stack skill** for his resume, but **at $0 cost**. So the earlier "no backend
> until Phase 3" call is reversed: the **first release includes a real backend
> (FastAPI + Postgres), free-hosted, but with NO login/accounts** — a **demo release**.
> Login, per-user accounts, and the community layer move to a **second release**. To
> avoid a naming clash with this doc's own "v1/v2" (which mean draft revisions), product
> versions are called **Release 1 (demo)** and **Release 2 (accounts)** below. Free-tier
> hosting: FastAPI on Azure App Service Free (F1) or Container Apps; Postgres on Neon
> free tier (Azure Postgres has no free-forever tier). Verify current free-tier limits
> before committing.

---

## 0. What changed from v1, and why

These are the load-bearing decisions. Everything downstream follows from them.

| Decision | v1 | v2 | Why |
|---|---|---|---|
| **Compliance module** | "Compliance Checker" that flags what would fail permitting ("pupula") | **Design Sanity Pre-Check** — coarse geometric/load sanity flags, never references permitting outcomes | The cited standards (PNS ISO 22157/19624) are *test & grading methods*, not encodable design rules. ISO 22156 is the real design standard but is paywalled and needs judgment. A pass/fail permitting claim writes a check the standards can't cash — and is the single biggest liability. |
| **Backend** | FastAPI + PostgreSQL + Azure App Service from Phase 1 | **Real backend in Release 1, on free tiers.** FastAPI + Postgres (Neon free tier), content served via API, calculator server-side. *(This reverses the interim "no backend until Phase 3" call — see the Decision update above.)* | Daniel wants a full-stack resume signal, achievable at $0 by routing around Azure's paid Postgres (Neon free tier) and using Azure App Service Free / Container Apps for compute. |
| **Login / accounts** | Assumed part of the product | **Deferred to Release 2.** Release 1 is a **demo with no login**; designs are saved/shared anonymously (shareable link or anonymous DB row) | Auth is real complexity with nothing to show yet. You get the full-stack signal from the API + DB without building an account system first. |
| **3D Design Studio** | Item 5 of 8 inside Phase 1, "3D from the start" | **Phase 1.5 stretch goal**, attempted only after everything else in Phase 1 ships | v1 committed to 3D and then spent three paragraphs warning it's a trap. Demoting it means cutting it costs nothing that was promised. |
| **SME sign-off** | "My brother, if he's open" — a nice-to-have | **Hard gate.** Calculator + pre-check are hidden from all users until an SME reviews the numeric rules | Anything touching structural safety can't ship on disclaimers alone. |
| **Launch audience** | Owners, investors, students, firms (all four) | **Students/educators + curious self-builders**, positioned as an educational reference | A narrow, low-liability wedge. Selling firms/investors a "will it pass inspection" answer comes later, if ever. |
| **Positioning** | Unstated | Decide explicitly (§1) — portfolio piece vs. business vs. public good | This is upstream of the stack decision. Answer it first. |

---

## 1. The Vision (and the positioning question to answer first)

An **educational encyclopedia + parametric design sandbox** for bamboo construction in
the Philippines. A student, self-builder, or curious owner should be able to:

1. **Learn** — browse a bamboo species atlas (local species, properties, best uses) and
   a joint/connection library (traditional Filipino lashings, pin joints,
   bolted/steel-reinforced joints).
2. **Design** — mix and match components (culm type, joint type, wall system, roof
   system) starting from templates (bahay kubo variants, event pavilions,
   disaster-resilient housing).
3. **Sanity-check** — get *coarse advisory flags* on a design (span too long for culm
   size, missing lateral bracing, roof load exceeding a conservative joint capacity)
   — **explicitly not** a permitting or code-compliance verdict.
4. **Estimate** — see a rough single-member capacity check and a cost/material takeoff.
5. **Get inspired** — a genuinely attractive landing/showcase page with real example
   designs, so it reads as a product, not a spreadsheet.

### Positioning — DECIDED (Sept 2026)

**Resume/portfolio piece now, architected to grow into a free-or-business product later.**

The near-term deliverable is a polished, deployed link Daniel can put on a resume *this
month*. The long-term option is a real free-or-paid product. These are **not** in
tension — the way to serve both is to future-proof *architecturally* while still shipping
cheap and fast, and specifically **not** by building accounts/DB/backend infrastructure
now.

How "future-proof" is achieved without cost or delay:
- **Content as clean, typed schemas** (`BambooSpecies` / `JointType` / `Template`) — these
  map 1:1 onto database tables later. Files → Postgres is a data migration, not a rewrite.
- **Calculator as a pure function** — drops into a serverless function or FastAPI endpoint
  untouched when Phase 3 needs server-side logic.
- **No backend now** — $0 hosting on Azure Static Web Apps' free tier, fastest path to a
  deployed, resume-ready link.

**Resume-value nuance:** the 3D Design Studio (§3C) is the "money shot" — the feature that
makes a recruiter stop scrolling. It stays demoted in *build order* to protect the
timeline, but for this goal it is worth genuinely attempting **once the base ships**, with
the timebox intact. The base (atlas + templates + landing) makes the product *complete*;
the 3D makes it *impressive*.

**Gate on the business path:** the free/business version (accounts, saved designs,
paid tiers) raises the liability bar on every structural claim, so it stays behind the SME
sign-off gate — see §3E/F and §7.

### The persistent honesty caveat

This is a **design-exploration and learning tool, not a substitute for a licensed
structural engineer or the LGU building-permit process.** That disclaimer lives *in the
product* — a persistent footer on anything that outputs a number or a flag — not just in
the pitch.

---

## 2. Who It's For

**Launch audience (Phase 1):**
- **Architecture/engineering students & educators** — want a reference atlas + a sandbox.
- **Curious self-builders** — want to explore whether a bamboo house idea is roughly
  feasible *before* hiring a professional.

**Later, once content + SME-backed numbers exist (Phase 3+):**
- **Small design-build firms** — templates + a pre-check to speed client conversations.
- **Investors/developers** — fast template comparison and rough costing.

Narrowing the launch audience isn't giving up reach — it's picking the users you can
serve **without making claims you can't defend.**

---

## 3. Core Modules

### A. Bamboo Atlas (encyclopedia)
Philippine bamboo species — e.g. Kawayan Tinik (*Bambusa blumeana*), Bolo
(*Gigantochloa levis*), Bayog (*Bambusa* spp.), Buho (*Schizostachyum lumampao*) — each
with: growth region, culm diameter / wall-thickness ranges, density, treatment method
(borax–boric, smoking, curing), typical structural role (post, beam, truss, flooring,
wall infill), and **sourcing notes** (where it's farmed regionally — your differentiator
vs. generic timber tools).

> **Content is the bottleneck, not code.** An atlas full of `[PLACEHOLDER]` facts isn't
> an atlas. Prefer **fewer entries with real, cited data and real photos** over broad
> coverage of placeholders. Every fact carries a source. Budget real time for
> sourcing/commissioning species photography and joint diagrams — this is what makes the
> atlas feel real.

### B. Joint & Connection Library
Traditional lashing/rattan-tie joints, pin/dowel joints, bolted + mortar-plug joints,
steel-strap/gusset joints, modern engineered connectors. Each entry: applicable culm
sizes, load-behavior notes, typical failure mode, and which templates use it.

### C. Design Studio (the "mix-and-match" canvas) — **Phase 1.5 stretch goal**
The centerpiece *demo* feature ("parang blueprint na pwede mong laruin"). Start from a
template → swap components → canvas updates live.

**Built in 3D (`react-three-fiber`/Three.js), but explicitly deferred and timeboxed.**
The first version is deliberately narrow: **one** template, 2–3 swappable components (not
the full matrix), orbit/zoom camera only, no physics. It is attempted **only after** the
atlas, joint library, templates, landing page, and calculator are all shipped.

> **Timebox rule:** if you're deep in Three.js camera/lighting tuning and the rest of
> Phase 1 isn't done, that's the signal to **cut it and ship**, not push through. Nothing
> in the promised Phase 1 scope depends on it.

### D. Template Gallery
Curated starting points: bahay kubo (traditional & modern), single-room dwelling,
multi-bay pavilion/event space, disaster-resilient core-shelter unit, elevated
flood-resistant variant. Each ships with a default bill of materials and a "known
sanity-checked range" (spans/loads it's been reviewed against).

### E. Design Sanity Pre-Check — *(renamed from "Compliance Checker")*
Coarse, **advisory** flags — span-to-diameter ratios, presence of lateral bracing, roof
load vs. a conservative joint capacity. **What it must never do:** claim a design will
pass or fail permitting, inspection, or code compliance.

**Standards, for reference and honesty (verified, not assumed):**
- **ISO 22156** — *Bamboo structures — Structural design.* The real design basis, but
  paywalled and judgment-dependent — a source of conservative rules-of-thumb, not an
  encodable rulebook.
- **PNS ISO 22157:2020** — PH-adopted standard for *determining physical/mechanical
  properties* of bamboo culms (test methods). *Not* design rules.
  [DTI-BPS FOI listing](https://www.foi.gov.ph/requests/pns-iso-221572020-bamboo-structures/)
- **PNS ISO 19624:2020** — PH-adopted *grading/classification* standard. *Not* design
  rules.
- **DTI-BPS adoption announcement** —
  [BPS S&C Portal](https://www.bps.dti.gov.ph/index.php/press-releases/24-2020/214-dti-bps-adopts-international-standards-on-bamboo-structures)
  / [DTI mirror](https://www.dti.gov.ph/archives/news-archives/bps-international-standards-bamboo-structures/)
- **NSCP** and the **National Building Code (PD 1096)** govern general
  structural/permitting requirements, but bamboo-specific provisions are thin — treat
  NSCP as *general structural sanity*, not a bamboo rulebook.

> **Hard gate:** do not hardcode load factors or safety margins from memory, and do not
> show this module (or the calculator below) to any user until a structural engineer
> reviews and signs off on the numeric rules. Implement the rules as a small set of
> explicit, reviewed predicates — **not** a stored-expression mini-DSL, which is more
> work and harder to audit.

### F. Structural + Cost Calculator
Basic single-member check: given culm species/diameter/spacing/span, estimate
axial/bending capacity and flag a safety factor. Cost layer: regional bamboo pricing +
treatment + labor multiplier → rough project cost range. Every output labeled **"estimate,
not a stamped calculation"** and subject to the same SME gate.

### G. Landing / Showcase Page
What "sells" the product — must look aesthetic and inviting, not like an engineering tool.
Hero section with a hero-quality bamboo structure image/video; a short
**atlas → design → check → build** visual flow; a gallery of example designs (rendered
from the Design Studio itself — dogfood your own tool); a "try it" CTA into a sandboxed
demo. **Visual identity:** warm natural palette (bamboo tan/green, not generic SaaS blue),
Filipino vernacular-architecture cues without kitsch.

---

## 4. Build Order

Two product releases. **Release 1** is the free-hosted, full-stack **demo with no login**
— the resume deliverable. **Release 2** adds accounts and community. Within Release 1,
work is ordered so a good-looking product exists early and the risky 3D piece is last.

### Release 1 — full-stack demo, free-hosted, no login

**1.1 — Backend foundation (the full-stack signal)**
1. FastAPI app + **SQLAlchemy + Alembic** against **Postgres (Neon free tier)**.
2. Define + migrate the content schema: `BambooSpecies`, `JointType`, `Template`,
   `Component` (see §5). Seed ~6 species and ~6 joints — **real, cited** where possible;
   mark unverified facts `[PLACEHOLDER — needs verification]`, every entry with `sources[]`.
3. REST endpoints to list/filter/read species, joints, templates. This is what makes it
   demonstrably full-stack rather than a static site.

**1.2 — Frontend core (the good-looking, defensible part)**
4. Next.js + Tailwind + shadcn/ui, fetching content from the API.
5. **Atlas + Joint Library** — browsable, filterable pages.
6. **3–4 Template** detail pages.
7. **Landing page** — the aesthetic front door (warm natural palette).
8. **Single-member calculator** — logic **server-side** (FastAPI endpoint), *hidden
   behind a feature flag / SME gate until Daniel's brother reviews the numbers*. Persistent
   "estimate, not a stamped calculation" disclaimer.

**1.3 — The demo showpiece (stretch, timeboxed)**
9. **Design Studio v0:** one template in 3D (`react-three-fiber`), 2–3 swappable
   components, orbit/zoom only, no physics. Attempt only after 1.1–1.2 ship. **Cut it if
   it balloons** — nothing else depends on it.
10. **Anonymous save/share** — serialize a design to a shareable link and/or an anonymous
    DB row. Exercises the backend for writes **without** needing login.

> A complete, deployable, full-stack product exists after 1.1–1.2 alone. 1.3 makes the
> demo impressive; protect the timeline from it.

### Release 2 — accounts & depth (later)
11. **Auth + user accounts.** Per-user saved designs; migrate anonymous designs to owned.
12. **Design Studio v1** — full component matrix, live recalculation on swap.
13. **Design Sanity Pre-Check v1** — reviewed predicates, **SME-signed-off**.
14. **Cost/material takeoff**, exportable spec sheets (PDF).
15. **Community layer** — submitted designs, ratings, regional sourcing directory.

---

## 5. Data Model Sketch (starting point)

**Release 1** implements the content types **as real Postgres tables** (SQLAlchemy +
Alembic) plus an anonymous `Design` for save/share. `User` and the reviewed
`SanityRuleResult` / `CostEstimate` arrive in **Release 2** with accounts.

```
# Release 1 — Postgres tables (SQLAlchemy models, Alembic migrations)
BambooSpecies (id, name_local, name_scientific, region, density, culm_diam_range,
  wall_thickness_range, treatment_methods[], structural_role[], sources[])
JointType     (id, name, description, applicable_species[], applicable_culm_sizes,
  load_notes, failure_mode, media_url, sources[])
Template      (id, name, category, description, components[], default_bom[],
  known_span_range, hero_image)
Component     (id, type[post|beam|truss|wall|roof], species_id, joint_id, dimensions, notes)
Design        (id, based_on_template_id, based_on_template_version, components[],
  span/load params, created_at, updated_at)   # anonymous in R1; snapshot template version
                                              #   owner_id added in R2

# Release 2 — added with accounts
User              (id, role[student|builder|firm|admin], ...)
SanityRuleResult  (id, design_id, rule_id, passed, severity[info|warning|flag], detail)
CostEstimate      (id, design_id, material_cost, labor_cost, region, generated_at)
```

Notes: `sources[]` is added to every content type so citations are first-class.
`Design` snapshots the template *version* it forked from (templates evolve). Sanity rules
are code predicates, not a stored `condition_expr` string.

---

## 6. Tech Stack (full-stack, $0)

Personal project, unconstrained time. **Full-stack from Release 1, hosted entirely on
free tiers.** The only reason the earlier draft avoided a backend was cost — routed around
below.

**Release 1 (build this now):**
- **Frontend:** Next.js + TypeScript, Tailwind CSS, `shadcn/ui`. Fetches content from the
  API. SSR/SEO for the discovery-driven landing page.
- **Backend:** Python + **FastAPI** + **SQLAlchemy + Alembic** (migrations). Serves
  content and runs the calculator server-side. Pydantic models for typed request/response.
- **Database:** **PostgreSQL on [Neon](https://neon.tech) free tier** — real managed
  Postgres, no card, no expiry. (Azure's managed Postgres has no free-forever tier, which
  is the whole reason to use Neon here.) JSONB for flexible component/design specs.
- **3D (step 1.3):** `react-three-fiber` / Three.js.
- **Content media:** species & joint photography/diagrams are **first-class content** —
  budget time to source or commission them.

**Hosting — all free tier ($0):**
- **Frontend:** Azure Static Web Apps (free) — or Vercel free tier.
- **Backend:** Azure App Service **Free (F1)** or **Container Apps** (free monthly grant,
  scales to zero). Keeps the all-Azure story if desired.
- **Database:** Neon free tier.

> **Verify current free-tier limits** (Neon row/storage caps, Azure F1 compute minutes,
> Container Apps free grant) before committing — these terms shift.

**Release 2 additions:** auth provider (e.g. Azure AD B2C free tier, or a self-rolled
JWT), and — if you outgrow free tiers — Azure Database for PostgreSQL Flexible Server
(Burstable B1ms). Migrating Neon → Azure Postgres is Postgres-to-Postgres, straightforward.

**Cost hygiene (do on day one):**
- Set an **Azure billing alert** immediately, even on free tiers.
- Grab **[Azure for Students](https://azure.microsoft.com/en-us/resources/students)** and
  the **[GitHub Student Developer Pack](https://education.github.com/pack)** *before* your
  PUP graduation (Sept 2026) ends eligibility — extra credit as a buffer.

---

## 7. Risks to Plan Around

- **Structural-safety liability.** Mitigated in v2 by renaming the module to a Pre-Check,
  the never-mention-permitting rule, the persistent in-product disclaimer, and the hard
  SME gate. Keep all four.
- **Content is the real bottleneck.** Scope narrow, source real, cite everything. An
  atlas of placeholders has no value prop.
- **3D as a timeline trap.** Mitigated by demoting it to Phase 1.5 and the timebox rule.
- **Azure cost creep.** Controlled by keeping Release 1 entirely on free tiers (Neon
  Postgres + Azure App Service F1 / Container Apps scale-to-zero) and a day-one billing
  alert. Paid tiers are a deliberate Release 2 choice, only if free limits are outgrown.
- **SME availability is now a dependency, not a wish.** If no engineer will review the
  numbers, the calculator and pre-check **do not ship to users** — the atlas, joint
  library, templates, and landing page still make a complete, valuable product on their
  own.

---

## 8. Ready-to-Paste Scaffold Prompt (v2)

Paste into Claude Code **in the `kawayan-atlas/` folder**. Edit bracketed parts first.

```
I'm building "Kawayan Atlas" — an educational web platform for learning about and
designing bamboo structures in the Philippines. Phase 1 is a STATIC site (no backend,
no database). It has: (1) a Bamboo Species Atlas, (2) a Joint/Connection Library,
(3) a Template Gallery, (4) a single-member structural calculator (kept behind a flag
until an engineer reviews the numbers), and (5) an aesthetic marketing landing page.
A 3D "Design Studio" is a LATER stretch goal — do not build it now.

Tech stack: Next.js + TypeScript (static export / SSG) + Tailwind + shadcn/ui. Content
lives as MDX/JSON in a content/ directory. The calculator is a pure client-side TS
function. Target hosting is Azure Static Web Apps (free tier) — no server or DB.

Build Phase 1 only:
1. Scaffold a single Next.js app (not a monorepo — there's no backend yet) with a
   content/ directory for structured seed data (species, joints, templates).
2. Define TypeScript content types for BambooSpecies, JointType, Template, Component
   (schema below). Load content from files; no ORM/migrations.
3. Seed ~6 species and ~6 joints. Mark every unverified fact as
   [PLACEHOLDER — needs verification] and give each a `sources[]` field so real
   citations can be dropped in.
4. Build the Atlas and Joint Library as browsable, filterable content pages.
5. Build 3 Template detail pages (static specs).
6. Build the landing page: hero, "atlas → design → check → build" flow visual, example
   gallery (placeholder images ok), CTA. Warm natural palette (bamboo tan/green, NOT
   generic SaaS blue) — this must attract non-technical people, not just engineers.
7. Build the single-member calculator as a pure TS function behind a feature flag
   (default OFF), with a persistent "estimate, not a stamped calculation — consult a
   licensed engineer" disclaimer wherever it renders.
8. Do NOT build: the mix-and-match matrix, the 3D Design Studio, the sanity-check rules
   engine, user accounts, or any backend. Those are later phases.

Content types:
BambooSpecies(id, name_local, name_scientific, region, density, culm_diam_range,
  wall_thickness_range, treatment_methods[], structural_role[], sources[])
JointType(id, name, description, applicable_species[], applicable_culm_sizes,
  load_notes, failure_mode, media_url, sources[])
Template(id, name, category, description, components[], default_bom[],
  known_span_range, hero_image)

Design priorities: the landing page and atlas must look genuinely polished and inviting.
Prioritize a working, good-looking, static Phase 1 over any partial later-phase feature.

Ask me clarifying questions about anything ambiguous, then propose a file/folder
structure before writing code.
```

---

## 9. Sources Consulted

- [DTI-BPS adopts International Standards on bamboo structures (BPS S&C Portal)](https://www.bps.dti.gov.ph/index.php/press-releases/24-2020/214-dti-bps-adopts-international-standards-on-bamboo-structures)
- [DTI-BPS adopts International Standards on bamboo structures (DTI mirror)](https://www.dti.gov.ph/archives/news-archives/bps-international-standards-bamboo-structures/)
- [PNS ISO 22157:2020 Bamboo Structures (FOI listing)](https://www.foi.gov.ph/requests/pns-iso-221572020-bamboo-structures/)
- [Philippine National Standards (PNS) for Bamboo Structures (FOI listing)](https://www.foi.gov.ph/requests/philippine-national-standards-pns-for-bamboo-structures/)
- [ISO 22156:2021 — Bamboo structures — Bamboo culms — Structural design](https://www.iso.org/standard/73831.html)
- [ISO 22156:2004 — Bamboo — Structural design (earlier edition)](https://www.iso.org/standard/36149.html)
