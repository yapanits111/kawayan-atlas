import { describe, it, expect, vi, afterEach, beforeAll } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { DrawPad } from "./DrawPad";
import { parsePoints } from "@/lib/design/geometry";

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

/** Sketch an arch across the pad. jsdom reports a zero-size rect, so the pad maps client
 *  coordinates 1:1 onto its 560 × 340 drawing space. */
function drawArch() {
  const pad = screen.getByLabelText("Drawing pad");
  fireEvent.pointerDown(pad, { clientX: 20, clientY: 339, pointerId: 1 });
  for (let i = 1; i <= 40; i++) {
    const x = 20 + i * 13; // → 540
    const y = 339 - Math.sin((i / 40) * Math.PI) * 280;
    fireEvent.pointerMove(pad, { clientX: x, clientY: y, pointerId: 1 });
  }
  fireEvent.pointerUp(pad, { clientX: 540, clientY: 339, pointerId: 1 });
}

describe("DrawPad", () => {
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
    fireEvent.change(screen.getByRole("slider", { name: "tension" }), { target: { value: "0.5" } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.change(screen.getByDisplayValue("Culm (round bamboo)"), { target: { value: "strip" } });
    fireEvent.click(screen.getByRole("button", { name: "Create spline node" }));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ tension: 0.5, closed: "yes", sweep: "strip" });
  });

  it("redraw starts from the node's current spline settings", () => {
    const onSubmit = vi.fn();
    render(
      <DrawPad
        mode="redraw"
        initial={{ smooth: 20, tension: 0.4, closed: "yes" }}
        onCancel={vi.fn()}
        onSubmit={onSubmit}
      />,
    );
    expect(screen.getByRole("slider", { name: "tension" })).toHaveValue("0.4");
    expect(screen.getByRole("checkbox")).toBeChecked();
    drawArch();
    fireEvent.click(screen.getByRole("button", { name: "Replace curve" }));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ smooth: 20, tension: 0.4, closed: "yes" });
  });

  it("redraw ignores a missing (NaN) setting from an older saved graph", () => {
    render(<DrawPad mode="redraw" initial={{ smooth: NaN, tension: NaN }} onCancel={vi.fn()} onSubmit={vi.fn()} />);
    expect(screen.getByRole("slider", { name: "tension" })).toHaveValue("0");
    expect(screen.getByRole("slider", { name: "smoothing" })).toHaveValue("12");
  });

  it("redraw mode replaces the curve and never adds a sweep", () => {
    const onSubmit = vi.fn();
    render(<DrawPad mode="redraw" wiredInput onCancel={vi.fn()} onSubmit={onSubmit} />);
    expect(screen.getByText(/from a wired input/)).toBeInTheDocument();
    drawArch();
    fireEvent.click(screen.getByRole("button", { name: "Replace curve" }));
    expect(onSubmit.mock.calls[0][0].sweep).toBe("none");
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
