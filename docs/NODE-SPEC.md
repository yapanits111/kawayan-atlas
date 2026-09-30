# Node specification

*The artifact called for in the Kauayan Atlas whitepaper §15: for every node, its inputs,
outputs, and parameters.*

The tables below are **generated from the live registry** in
[`frontend/src/lib/design/nodeDefs.ts`](../frontend/src/lib/design/nodeDefs.ts), so they
describe what the Design Lab actually evaluates rather than what it was once intended to.
Regenerate after changing the registry (see [Regenerating](#regenerating)).

---

## How to read this

**Wire kinds.** Every wire carries one kind of value, and the editor refuses connections
between incompatible kinds:

| Kind | Carries |
|---|---|
| `number` | a scalar |
| `points` | `Vec3[]` — bare positions |
| `curve` / `curves` | one or many sampled polylines; every curve reduces to this, so all downstream operations work uniformly |
| `elements` | buildable bamboo: culms, strips, laminates |
| `joints` | clustered element ends |
| `schedule` | the fabrication cut-list |
| `checks` | advisory flags |

A `points` output may feed a `curve`/`curves` input — consecutive points become segments.
Curve-consuming nodes also accept `elements` and read their centrelines.

**Units.** Lengths and coordinates are metres; culm diameters, wall thicknesses, strip
widths and ply thicknesses are millimetres; angles are degrees.

**Controls.** Every numeric parameter is a slider in the editor; *Range* gives the slider's
span and step (a saved value outside it stretches the track rather than being clamped). A
Spline's points can be typed, wired in from any `points` output, or sketched with the
**Draw** tool, which simplifies a freehand stroke into control points on any plane (an axis
plane, or one turned, pitched and moved). They can then be dragged in the 3D view while the
node is selected, or edited point by point on the draw pad; both write back to `pts`.

**The four layers** follow the whitepaper's dependency order (§6, §14): geometry is the
foundation, the bamboo layer is thin and sits on top of it, output turns the model into a
buildable document, and analysis is advisory only.

---

## Validation status — read this before trusting a number

Two regimes are tracked per element and carried into the cut-list, because the whitepaper's
governing rule (§9) is never to blur "form model" and "verified structure":

| Status | Applies to | Meaning |
|---|---|---|
| `iso22156-round` | `culm` | Round culms — **ISO 22156:2021** applies. |
| `outside-iso22156` | `strip`, `laminate` | Processed and engineered bamboo. ISO 22156:2021 covers round culms and **explicitly excludes** glue-laminated, cross-laminated, oriented-strand, and densified bamboo. These can be modelled freely, but their structural validation rests on manufacturer data and project-specific engineering, not a settled international code path. |

The `check` node is **advisory only**. It flags coarse geometric slenderness and never
computes capacity. On non-round elements it says so explicitly rather than implying the
round-culm rule of thumb covers them. Rows carrying `outside-iso22156` are badged **no
code** in the schedule panel, and the exported PDF carries a validation-status note.

---

## What the schedule produces

The `schedule` node emits **two** documents, matching §6d and §8:

1. **Element cut-list** — per piece: mark, kind, length, taper (Ø start→end) or section
   (w×t), wall thickness, diaphragm count, layup for laminates, and the cut angle at each
   end.
2. **Joint schedule** — per joint: mark, type (from the joint library), which members meet,
   the included angle between them, and the location in metres.

Both export together to CSV and PDF.

A third document comes from the `inventory` node: a **pole assignment** reconciling the
design against a yard of real, measured poles (§8, Phase 4) — which pole each mark is cut
from and at what station, what offcut is left, and which pieces the yard simply cannot
yield. Exports to CSV.

**Piece marks are unique across the whole graph.** Marks (`C1`, `S1`, `L1`, …) come from
one counter shared by the evaluation, so two `culm` nodes cannot both emit `C1` — colliding
marks are dropped by the downstream collectors, which silently loses pieces from the
cut-list.

**Cut angles are real where the joint cuts the member.** A `fish-mouth` joint saddles over
its mating culm, so members meeting there take the joint's included angle at that end (an
A-frame apex of 67° gives both rafters a 67° cut). Every other library joint — lashing,
pin/dowel, bolted, mortar-plug, steel strap — butts square, and the members stay at 90°.

---

## The proof chain

The smallest graph that exercises every layer (whitepaper §7) ships preloaded:

```
arc → divide → culm → array → schedule
```

---

## Node reference

### Geometry

#### `point` — Point

| | |
|---|---|
| **Inputs** | — |
| **Outputs** | `out` points *(points)* |

| Param | Label | Default | Range |
|---|---|---|---|
| **x** | x | `0` | min -20, max 20, step 0.1 |
| **y** | y | `0` | min -20, max 20, step 0.1 |
| **z** | z | `0` | min -20, max 20, step 0.1 |

#### `line` — Line

| | |
|---|---|
| **Inputs** | — |
| **Outputs** | `out` curve *(curve)* |

| Param | Label | Default | Range |
|---|---|---|---|
| **ax** | A.x | `-2` | min -20, max 20, step 0.1 |
| **ay** | A.y | `0` | min -20, max 20, step 0.1 |
| **az** | A.z | `0` | min -20, max 20, step 0.1 |
| **bx** | B.x | `2` | min -20, max 20, step 0.1 |
| **by** | B.y | `0` | min -20, max 20, step 0.1 |
| **bz** | B.z | `0` | min -20, max 20, step 0.1 |

#### `polyline` — Spline (curve)

| | |
|---|---|
| **Inputs** | `in` points *(points)* |
| **Outputs** | `out` curve *(curve)* |

| Param | Label | Default | Range |
|---|---|---|---|
| **pts** | points | 5 lines, e.g. `-3, 0, 0` | free text, one entry per line |
| **closed** | closed | `no` | `no` / `yes` |
| **smooth** | smoothing | `12` | min 0, max 40, step 1 |
| **tension** | tension | `0` | min 0, max 1, step 0.05 |

#### `arc` — Arc

| | |
|---|---|
| **Inputs** | — |
| **Outputs** | `out` curve *(curve)* |

| Param | Label | Default | Range |
|---|---|---|---|
| **radius** | radius | `3` | min 0.1, max 20, step 0.1 |
| **start** | start° | `0` | min -360, max 360, step 5 |
| **end** | end° | `180` | min -360, max 360, step 5 |
| **plane** | plane | `xz` | `xy` / `xz` / `yz` |
| **samples** | samples | `24` | min 2, max 128, step 1 |

#### `grid` — Grid

| | |
|---|---|
| **Inputs** | — |
| **Outputs** | `out` points *(points)* |

| Param | Label | Default | Range |
|---|---|---|---|
| **cols** | cols | `4` | min 1, max 40, step 1 |
| **rows** | rows | `4` | min 1, max 40, step 1 |
| **sx** | spacing X | `1` | min 0.1, max 10, step 0.1 |
| **sy** | spacing Y | `1` | min 0.1, max 10, step 0.1 |

#### `circle` — Circle

| | |
|---|---|
| **Inputs** | — |
| **Outputs** | `out` curve *(curve)* |

| Param | Label | Default | Range |
|---|---|---|---|
| **radius** | radius | `2` | min 0.1, max 20, step 0.1 |
| **plane** | plane | `xz` | `xy` / `xz` / `yz` |
| **seg** | segments | `32` | min 3, max 128, step 1 |

#### `rectangle` — Rectangle

| | |
|---|---|
| **Inputs** | — |
| **Outputs** | `out` curve *(curve)* |

| Param | Label | Default | Range |
|---|---|---|---|
| **w** | width | `3` | min 0.1, max 30, step 0.1 |
| **d** | depth | `3` | min 0.1, max 30, step 0.1 |
| **plane** | plane | `xz` | `xy` / `xz` / `yz` |

#### `extrude` — Extrude (posts)

| | |
|---|---|
| **Inputs** | `in` points *(points)* |
| **Outputs** | `out` curves *(curves)* |

| Param | Label | Default | Range |
|---|---|---|---|
| **height** | height | `2.5` | min -20, max 20, step 0.1 |
| **axis** | axis | `y` | `x` / `y` / `z` |

#### `mirror` — Mirror

| | |
|---|---|
| **Inputs** | `in` geometry *(curves)* |
| **Outputs** | `out` geometry *(curves)* |

| Param | Label | Default | Range |
|---|---|---|---|
| **plane** | plane | `yz` | `xy` / `xz` / `yz` |

#### `loft` — Loft

| | |
|---|---|
| **Inputs** | `a` curve A *(curve)* · `b` curve B *(curve)* |
| **Outputs** | `out` curves *(curves)* |

| Param | Label | Default | Range |
|---|---|---|---|
| **count** | count | `8` | min 2, max 100, step 1 |

#### `divide` — Divide

| | |
|---|---|
| **Inputs** | `in` curve *(curve)* |
| **Outputs** | `out` points *(points)* |

| Param | Label | Default | Range |
|---|---|---|---|
| **count** | count | `6` | min 1, max 200, step 1 |

#### `transform` — Transform

| | |
|---|---|
| **Inputs** | `in` geometry *(curves)* |
| **Outputs** | `out` geometry *(curves)* |

| Param | Label | Default | Range |
|---|---|---|---|
| **tx** | move X | `0` | min -20, max 20, step 0.1 |
| **ty** | move Y | `0` | min -20, max 20, step 0.1 |
| **tz** | move Z | `0` | min -20, max 20, step 0.1 |
| **rx** | rot X° | `0` | min -180, max 180, step 5 |
| **ry** | rot Y° | `0` | min -180, max 180, step 5 |
| **rz** | rot Z° | `0` | min -180, max 180, step 5 |
| **s** | scale | `1` | min 0.05, max 10, step 0.05 |

#### `arrayLinear` — Array (linear)

| | |
|---|---|
| **Inputs** | `in` item *(curves)* |
| **Outputs** | `out` items *(curves)* |

| Param | Label | Default | Range |
|---|---|---|---|
| **count** | count | `3` | min 1, max 100, step 1 |
| **dx** | step X | `0` | min -10, max 10, step 0.1 |
| **dy** | step Y | `0` | min -10, max 10, step 0.1 |
| **dz** | step Z | `1` | min -10, max 10, step 0.1 |

#### `arrayPolar` — Array (polar)

| | |
|---|---|
| **Inputs** | `in` item *(curves)* |
| **Outputs** | `out` items *(curves)* |

| Param | Label | Default | Range |
|---|---|---|---|
| **count** | count | `6` | min 1, max 100, step 1 |
| **total** | sweep° | `360` | min -360, max 360, step 15 |
| **axis** | axis | `y` | `x` / `y` / `z` |

#### `weave` — Weave

| | |
|---|---|
| **Inputs** | — |
| **Outputs** | `out` curves *(curves)* |

| Param | Label | Default | Range |
|---|---|---|---|
| **w** | width | `3` | min 0.2, max 20, step 0.1 |
| **h** | height | `2.4` | min 0.2, max 20, step 0.1 |
| **u** | warp | `8` | min 1, max 60, step 1 |
| **v** | weft | `7` | min 1, max 60, step 1 |
| **plane** | plane | `xy` | `xy` / `xz` / `yz` |

#### `intersect` — Intersect

| | |
|---|---|
| **Inputs** | `a` curves A *(curves)* · `b` curves B *(curves)* |
| **Outputs** | `out` points *(points)* |

| Param | Label | Default | Range |
|---|---|---|---|
| **tol** | tolerance (m) | `0.02` | min 0.005, max 0.5, step 0.005 |

#### `offset` — Offset

| | |
|---|---|
| **Inputs** | `in` curves *(curves)* |
| **Outputs** | `out` curves *(curves)* |

| Param | Label | Default | Range |
|---|---|---|---|
| **dist** | distance (m) | `0.4` | min -5, max 5, step 0.05 |
| **plane** | plane | `xy` | `xy` / `xz` / `yz` |


### Bamboo

#### `culm` — Culm

| | |
|---|---|
| **Inputs** | `in` curve/points *(curves)* |
| **Outputs** | `out` elements *(elements)* |

| Param | Label | Default | Range |
|---|---|---|---|
| **species** | species | `(none)` | from the species atlas |
| **d0** | Ø start (mm) | `90` | min 5, max 300, step 1 |
| **d1** | Ø end (mm) | `75` | min 5, max 300, step 1 |
| **wall** | wall (mm) | `12` | min 1, max 40, step 1 |
| **nodes** | node spacing (m) | `0.3` | min 0, max 1, step 0.01 |

#### `strip` — Strip

| | |
|---|---|
| **Inputs** | `in` curve/points *(curves)* |
| **Outputs** | `out` elements *(elements)* |

| Param | Label | Default | Range |
|---|---|---|---|
| **w** | width (mm) | `25` | min 2, max 200, step 1 |
| **t** | thick (mm) | `6` | min 1, max 30, step 1 |

#### `internode` — Node / internode

| | |
|---|---|
| **Inputs** | `in` elements *(elements)* |
| **Outputs** | `out` elements *(elements)* · `nodes` node points *(points)* |

| Param | Label | Default | Range |
|---|---|---|---|
| **spacing** | node spacing (m) | `0.3` | min 0.02, max 2, step 0.01 |
| **mode** | mode | `mark` | `mark` / `split` |

#### `laminate` — Laminate (glulam)

| | |
|---|---|
| **Inputs** | `in` curve/points *(curves)* |
| **Outputs** | `out` elements *(elements)* |

| Param | Label | Default | Range |
|---|---|---|---|
| **w** | width (mm) | `60` | min 5, max 400, step 1 |
| **ply** | ply thick (mm) | `6` | min 0.5, max 20, step 0.5 |
| **layers** | layers | `5` | min 2, max 40, step 1 |
| **layup** | layup | `parallel` | `parallel` / `alternating` |

#### `joint` — Joint

| | |
|---|---|
| **Inputs** | `in` elements *(elements)* |
| **Outputs** | `out` elements *(elements)* · `joints` joints *(joints)* |

| Param | Label | Default | Range |
|---|---|---|---|
| **mode** | typing | `auto` | `auto` / `manual` |
| **type** | type (manual) | `(none)` | from the joint library |
| **splice** | splice° (bolt ≥) | `150` | min 90, max 180, step 5 |
| **tol** | tolerance (m) | `0.05` | min 0.01, max 1, step 0.01 |

#### `bundle` — Bundle

| | |
|---|---|
| **Inputs** | `a` elements A *(elements)* · `b` elements B *(elements)* |
| **Outputs** | `out` elements *(elements)* |

*No parameters.*


### Analysis

#### `load` — Load

| | |
|---|---|
| **Inputs** | — |
| **Outputs** | `out` load *(number)* |

| Param | Label | Default | Range |
|---|---|---|---|
| **kind** | type | `distributed` | `distributed` / `point` |
| **value** | value (kN) | `1` | min 0, max 100, step 0.5 |

#### `support` — Support

| | |
|---|---|
| **Inputs** | `in` elements *(elements)* |
| **Outputs** | `out` elements *(elements)* |

| Param | Label | Default | Range |
|---|---|---|---|
| **kind** | fixity | `pinned` | `pinned` / `fixed` |

#### `check` — Check (advisory)

| | |
|---|---|
| **Inputs** | `in` elements *(elements)* · `load` load *(number)* |
| **Outputs** | `out` elements *(elements)* · `checks` checks *(checks)* |

| Param | Label | Default | Range |
|---|---|---|---|
| **slenderness** | L/Ø limit | `30` | min 5, max 150, step 1 |


### Output

#### `schedule` — Schedule

| | |
|---|---|
| **Inputs** | `in` elements *(elements)* · `joints` joints *(joints)* |
| **Outputs** | `out` schedule *(schedule)* |

| Param | Label | Default | Range |
|---|---|---|---|
| **usable** | usable culm (m) | `6` | min 1, max 20, step 0.5 |

#### `inventory` — Pole inventory

| | |
|---|---|
| **Inputs** | `in` elements *(elements)* |
| **Outputs** | `out` elements *(elements)* · `report` reconciliation *(inventory)* |

| Param | Label | Default | Range |
|---|---|---|---|
| **poles** | measured poles | 8 lines, e.g. `P1, 6.0, 105, 82` | free text, one entry per line |
| **kerf** | saw kerf (m) | `0.01` | min 0, max 0.1, step 0.005 |
| **tol** | Ø tolerance (mm) | `5` | min 0, max 50, step 1 |

---

## Regenerating

The reference section above is generated from the node registry. After changing
`nodeDefs.ts`:

```bash
cd frontend && node scripts/gen-node-spec.mjs
```

The script compiles the registry, walks `NODE_DEFS`, and rewrites everything below the
`## Node reference` heading in this file. Prose above that heading is hand-written and is
left untouched.

---

## Still open

Tracked against the whitepaper's roadmap (§12):

- **Phase 2 — capacity.** Deliberately absent. `check` computes no capacity, and will not
  until the rules are reviewed and signed off (§9).
- **Phase 4 — accounts.** Anonymous save/share works; per-user ownership is Release 2 and
  out of scope for this build.
- **Reconciliation depth.** `inventory` matches on length and on the diameter available
  along each pole's taper. It does not model curvature, node position, grading, or defects,
  and it packs greedily (first-fit-decreasing) rather than optimally — a better yield may
  exist for a given yard.
