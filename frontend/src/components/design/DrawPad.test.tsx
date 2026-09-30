import { describe, it, expect, vi, afterEach, beforeAll } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { DrawPad, type DrawPreview } from "./DrawPad";
import { parsePoints } from "@/lib/design/geometry";
import type { Vec3 } from "@/lib/design/types";

// jsdom may lack PointerEvent; a MouseEvent subclass carries clientX/clientY + pointerId.
beforeAll(() => {
  if (typeof window.PointerEvent === "undefined") {
    class PointerEventPolyfill extends MouseEvent {
      pointerId: number;
      constructor(type: string, init: PointerEventInit = {}) {
        super(type, init);
        this.pointerId = init.pointerId ?? 1;
      }
    }
    (window as unknown as { PointerEvent: unknown }).PointerEvent = PointerEventPolyfill;
  }
});
afterEach(cleanup);

// jsdom reports a zero-size rect, so the pad maps client coordinates 1:1 onto its 560 × 340
// drawing space.
const pad = () => screen.getByLabelText("Drawing pad");

/** Sketch an arch across the pad, standing on its bottom edge. */
function drawArch() {
  fireEvent.pointerDown(pad(), { clientX: 20, clientY: 339, pointerId: 1 });
  for (let i = 1; i <= 40; i++) {
    const x = 20 + i * 13; // → 540
    const y = 339 - Math.sin((i / 40) * Math.PI) * 280;
    fireEvent.pointerMove(pad(), { clientX: x, clientY: y, pointerId: 1 });
  }
  fireEvent.pointerUp(pad(), { clientX: 540, clientY: 339, pointerId: 1 });
}

const slider = (name: string) => screen.getByRole("slider", { name });
const setSlider = (name: string, v: number) => fireEvent.change(slider(name), { target: { value: String(v) } });

/** Pad pixel of a plane point (a right, b up) on a pitched plane, at the pad's current zoom. */
function px(a: number, b: number) {
  const k = 560 / Number((slider("view width (m)") as HTMLInputElement).value);
  return { clientX: 280 + a * k, clientY: 340 - b * k };
}

const ARCH: Vec3[] = [[-3, 0, 0], [-1.5, 1.4, 0], [0, 1.9, 0], [1.5, 1.4, 0], [3, 0, 0]];

function renderEdit(extra: Partial<Parameters<typeof DrawPad>[0]> = {}) {
  const onSubmit = vi.fn();
  const onCancel = vi.fn();
  render(
    <DrawPad
      mode="edit"
      initial={{ pts: ARCH, smooth: 12, tension: 0, closed: "no" }}
      onCancel={onCancel}
      onSubmit={onSubmit}
      {...extra}
    />,
  );
  return { onSubmit, onCancel, apply: () => fireEvent.click(screen.getByRole("button", { name: "Apply" })) };
}
const submitted = (fn: ReturnType<typeof vi.fn>) => parsePoints(fn.mock.calls[0][0].pts);

describe("DrawPad — drawing", () => {
  it("won't create a curve before anything is drawn", () => {
    render(<DrawPad mode="new" onCancel={vi.fn()} onSubmit={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Create spline node" })).toBeDisabled();
    expect(screen.getByText("No curve yet")).toBeInTheDocument();
  });

  it("turns a freehand stroke into spline control points and submits them", () => {
    const onSubmit = vi.fn();
    render(<DrawPad mode="new" onCancel={vi.fn()} onSubmit={onSubmit} />);
    drawArch();

    expect(screen.getByText(/control points ·/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Create spline node" }));

    expect(onSubmit).toHaveBeenCalledOnce();
    const r = onSubmit.mock.calls[0][0];
    const pts = parsePoints(r.pts);
    expect(pts.length).toBeGreaterThanOrEqual(3); // simplified, but still an arch
    expect(pts.length).toBeLessThan(42); // fewer than the raw samples
    expect(pts[0][1]).toBeCloseTo(0, 1); // starts on the ground (elevation plane)
    expect(Math.max(...pts.map((p) => p[1]))).toBeGreaterThan(2.5); // ~280 px ≈ 3 m high
    expect(r).toMatchObject({ smooth: 12, tension: 0, closed: "no", sweep: "culm" });
  });

  it("passes the chosen spline settings through", () => {
    const onSubmit = vi.fn();
    render(<DrawPad mode="new" onCancel={vi.fn()} onSubmit={onSubmit} />);
    drawArch();
    setSlider("tension", 0.5);
    fireEvent.click(screen.getByLabelText("closed loop"));
    fireEvent.change(screen.getByDisplayValue("Culm (round bamboo)"), { target: { value: "strip" } });
    fireEvent.click(screen.getByRole("button", { name: "Create spline node" }));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ tension: 0.5, closed: "yes", sweep: "strip" });
  });

  it("a click that doesn't move leaves the curve alone", () => {
    render(<DrawPad mode="new" onCancel={vi.fn()} onSubmit={vi.fn()} />);
    drawArch();
    const before = screen.getByText(/control points ·/).textContent;
    fireEvent.pointerDown(pad(), { clientX: 100, clientY: 100 });
    fireEvent.pointerUp(pad(), { clientX: 100, clientY: 100 });
    expect(screen.getByText(/control points ·/).textContent).toBe(before);
  });

  it("Clear wipes the stroke; Escape cancels", () => {
    const onCancel = vi.fn();
    render(<DrawPad mode="new" onCancel={onCancel} onSubmit={vi.fn()} />);
    drawArch();
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.getByText("No curve yet")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledOnce();
  });
});

describe("DrawPad — drawing planes", () => {
  it("draws on a turned, offset plane", () => {
    const onSubmit = vi.fn();
    render(<DrawPad mode="new" onCancel={vi.fn()} onSubmit={onSubmit} />);
    drawArch();
    setSlider("turn (°) — about the vertical", 90); // the side plane: the pad's right is +z
    setSlider("origin x (m)", 2);
    expect(screen.getByRole("button", { name: "Side" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Create spline node" }));
    const pts = submitted(onSubmit);
    expect(pts.every((p) => p[0] === 2)).toBe(true); // every point on the plane x = 2
    // Runs along z, left to right: the stroke spans 20→540 px of the 6 m, 560 px pad.
    expect(pts[0][2]).toBeCloseTo(-2.786, 3);
    expect(pts[pts.length - 1][2]).toBeCloseTo(2.786, 3);
  });

  it("pitch lays the plane down: flat draws a plan at the origin's height", () => {
    const onSubmit = vi.fn();
    render(<DrawPad mode="new" onCancel={vi.fn()} onSubmit={onSubmit} />);
    drawArch();
    setSlider("origin y (m)", 2.4);
    fireEvent.click(screen.getByRole("button", { name: "Plan" }));
    expect(slider("pitch (°) — 0 flat, 90 upright")).toHaveValue("0");
    fireEvent.click(screen.getByRole("button", { name: "Create spline node" }));
    expect(submitted(onSubmit).every((p) => p[1] === 2.4)).toBe(true);
  });

  it("marks an in-between plane as custom", () => {
    render(<DrawPad mode="new" onCancel={vi.fn()} onSubmit={vi.fn()} />);
    setSlider("pitch (°) — 0 flat, 90 upright", 30);
    expect(screen.getByText("custom")).toBeInTheDocument();
    for (const name of ["Elevation", "Plan", "Side"]) {
      expect(screen.getByRole("button", { name })).toHaveAttribute("aria-pressed", "false");
    }
  });

  it("changing the view width zooms without resizing the drawing", () => {
    const onSubmit = vi.fn();
    render(<DrawPad mode="new" onCancel={vi.fn()} onSubmit={onSubmit} />);
    drawArch();
    const len = screen.getByText(/control points ·/).textContent;
    setSlider("view width (m)", 20);
    expect(screen.getByText(/control points ·/).textContent).toBe(len);
  });
});

describe("DrawPad — editing an existing spline", () => {
  it("loads the spline's points onto its own plane, ready to edit", () => {
    renderEdit();
    expect(screen.getByText(/^5 control points/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit points" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Elevation" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getAllByLabelText(/^Point \d$/)).toHaveLength(5);
  });

  it("Apply with nothing changed just closes (leaves the node's text alone)", () => {
    const { onSubmit, onCancel, apply } = renderEdit();
    apply();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("dragging a point moves it on the plane", () => {
    const { onSubmit, apply } = renderEdit();
    fireEvent.pointerDown(screen.getByLabelText("Point 3"), { ...px(0, 1.9), pointerId: 1 });
    fireEvent.pointerMove(pad(), { ...px(0.5, 2.9), pointerId: 1 });
    fireEvent.pointerUp(pad(), { ...px(0.5, 2.9), pointerId: 1 });
    expect(screen.getByText(/^Point 3: x 0\.50 · y 2\.90 · z 0\.00/)).toBeInTheDocument();
    apply();
    const pts = submitted(onSubmit);
    expect(pts[2][0]).toBeCloseTo(0.5, 3);
    expect(pts[2][1]).toBeCloseTo(2.9, 3);
    expect(pts[0]).toEqual([-3, 0, 0]); // the rest stay put
    expect(onSubmit.mock.calls[0][0].sweep).toBe("none");
  });

  it("double-click adds a point on the curve, extends past its end, and removes a point", () => {
    const { onSubmit, apply } = renderEdit();
    // On the curve between the apex and the next point → inserted between them.
    fireEvent.doubleClick(pad(), px(0.8, 1.76));
    expect(screen.getByText(/^6 control points/)).toBeInTheDocument();
    // Well past the right end → appended.
    fireEvent.doubleClick(pad(), px(3.5, 1));
    expect(screen.getByText(/^7 control points/)).toBeInTheDocument();
    // On an existing point → removed.
    fireEvent.doubleClick(screen.getByLabelText("Point 1"), px(-3, 0));
    apply();
    const pts = submitted(onSubmit);
    expect(pts).toHaveLength(6);
    expect(pts[0]).toEqual([-1.5, 1.4, 0]); // the first point is gone
    expect(pts[2][0]).toBeCloseTo(0.8, 2); // the inserted one sits after the apex
    expect(pts[5][0]).toBeCloseTo(3.5, 2); // the extension is last
  });

  it("keyboard: arrows nudge the selected point, Delete removes it", () => {
    const { onSubmit, apply } = renderEdit();
    fireEvent.pointerDown(screen.getByLabelText("Point 2"), px(-1.5, 1.4));
    fireEvent.pointerUp(pad(), px(-1.5, 1.4));
    fireEvent.keyDown(pad(), { key: "ArrowUp" });
    fireEvent.keyDown(pad(), { key: "ArrowRight", shiftKey: true });
    expect(screen.getByText(/^Point 2: x -1\.25 · y 1\.45/)).toBeInTheDocument();
    fireEvent.pointerDown(screen.getByLabelText("Point 4"), px(1.5, 1.4));
    fireEvent.pointerUp(pad(), px(1.5, 1.4));
    fireEvent.keyDown(pad(), { key: "Delete" });
    apply();
    const pts = submitted(onSubmit);
    expect(pts).toHaveLength(4);
    expect(pts[1]).toEqual([-1.25, 1.45, 0]);
    expect(pts.map((p) => p[0])).not.toContain(1.5);
  });

  it("snaps dragged and added points to the grid when snapping is on; Shift moves freely", () => {
    const onSnapChange = vi.fn();
    const { onSubmit, apply } = renderEdit({ snap: { grid: true, step: 0.25, points: true }, onSnapChange });
    fireEvent.pointerDown(screen.getByLabelText("Point 3"), { ...px(0, 1.9), pointerId: 1 });
    fireEvent.pointerMove(pad(), { ...px(0.37, 2.61), pointerId: 1 });
    fireEvent.pointerUp(pad(), px(0.37, 2.61));
    fireEvent.pointerDown(screen.getByLabelText("Point 4"), { ...px(1.5, 1.4), pointerId: 1 });
    fireEvent.pointerMove(pad(), { ...px(1.63, 1.21), shiftKey: true, pointerId: 1 });
    fireEvent.pointerUp(pad(), px(1.63, 1.21));
    fireEvent.doubleClick(pad(), px(-2.36, 0.63)); // on the curve, between points 1 and 2
    apply();
    const pts = submitted(onSubmit);
    expect(pts[3]).toEqual([0.25, 2.5, 0]); // (0.37, 2.61) → the 0.25 m grid
    expect(pts[4][0]).toBeCloseTo(1.63, 2); // Shift: exactly where it was put
    expect(pts[4][1]).toBeCloseTo(1.21, 2);
    expect(pts[1]).toEqual([-2.25, 0.75, 0]); // the added point landed on the grid too
    // The toggle reports changes back (the setting is shared with the 3D view).
    fireEvent.click(screen.getByLabelText("snap points to grid"));
    expect(onSnapChange).toHaveBeenCalledWith({ grid: false, step: 0.25, points: true });
  });

  it("won't remove points below the two a spline needs", () => {
    renderEdit({ initial: { pts: [[0, 0, 0], [2, 1, 0]] } });
    fireEvent.pointerDown(screen.getByLabelText("Point 1"), px(-1, 0));
    fireEvent.pointerUp(pad(), px(-1, 0));
    fireEvent.keyDown(pad(), { key: "Delete" });
    expect(screen.getAllByLabelText(/^Point \d$/)).toHaveLength(2);
  });

  it("moving the plane moves the curve with it", () => {
    const { onSubmit, apply } = renderEdit();
    setSlider("origin z (m)", -4);
    apply();
    expect(submitted(onSubmit)).toEqual(ARCH.map(([x, y]) => [x, y, -4]));
  });

  it("a curve that isn't flat keeps each point's depth through an edit", () => {
    const wavy: Vec3[] = [[0, 0, 0], [1, 1, 0.3], [2, 1.5, -0.2], [3, 0.8, 0.1]];
    const { onSubmit, apply } = renderEdit({ initial: { pts: wavy } });
    expect(screen.getByText(/not flat: each point keeps its depth/)).toBeInTheDocument();
    setSlider("tension", 0.2); // change something unrelated to the points
    apply();
    submitted(onSubmit).forEach((p, i) => p.forEach((v, k) => expect(v).toBeCloseTo(wavy[i][k], 3)));
  });

  it("the Draw tool redraws the curve from scratch", () => {
    const { onSubmit, apply } = renderEdit();
    fireEvent.click(screen.getByRole("button", { name: "Draw" }));
    fireEvent.pointerDown(pad(), { clientX: 100, clientY: 300 });
    fireEvent.pointerMove(pad(), { clientX: 300, clientY: 200 });
    fireEvent.pointerMove(pad(), { clientX: 500, clientY: 300 });
    fireEvent.pointerUp(pad(), { clientX: 500, clientY: 300 });
    apply();
    expect(submitted(onSubmit)).toHaveLength(3);
  });

  it("starts from the node's settings, ignoring missing (NaN) ones from older graphs", () => {
    renderEdit({ initial: { pts: ARCH, smooth: 20, tension: 0.4, closed: "yes" } });
    expect(slider("tension")).toHaveValue("0.4");
    expect(screen.getByLabelText("closed loop")).toBeChecked();
    cleanup();
    renderEdit({ initial: { pts: ARCH, smooth: NaN, tension: NaN } });
    expect(slider("tension")).toHaveValue("0");
    expect(slider("smoothing")).toHaveValue("12");
  });

  it("warns when the node's points come from a wire", () => {
    renderEdit({ wiredInput: true });
    expect(screen.getByText(/from a wired input/)).toBeInTheDocument();
  });
});

describe("DrawPad — live preview for the 3D view", () => {
  it("reports the plane outline and the curve, and flags the first change", () => {
    const previews: DrawPreview[] = [];
    render(<DrawPad mode="new" onPreview={(p) => previews.push(p)} onCancel={vi.fn()} onSubmit={vi.fn()} />);
    const first = previews[previews.length - 1];
    expect(first.outline).toHaveLength(4);
    expect(first.base).toEqual([[-3, 0, 0], [3, 0, 0]]); // the elevation's ground line
    expect(first.result).toBeNull();
    expect(first.dirty).toBe(false);

    drawArch();
    const last = previews[previews.length - 1];
    expect(last.curve.length).toBeGreaterThan(last.ctrl.length);
    expect(last.result?.pts).toMatch(/drawn freehand/);
    expect(last.dirty).toBe(true);
  });

  it("stays quiet about unchanged edits, so opening a spline doesn't rewrite it", () => {
    const previews: DrawPreview[] = [];
    renderEdit({ onPreview: (p: DrawPreview) => previews.push(p) });
    expect(previews.every((p) => !p.dirty)).toBe(true);
    setSlider("view width (m)", 20); // zooming isn't an edit
    expect(previews.every((p) => !p.dirty)).toBe(true);
    setSlider("smoothing", 5);
    expect(previews[previews.length - 1].dirty).toBe(true);
  });
});
