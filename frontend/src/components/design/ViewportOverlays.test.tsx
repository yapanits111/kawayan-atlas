import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { PickTag, SnapBar } from "./ViewportOverlays";

afterEach(cleanup);

describe("SnapBar", () => {
  it("toggles grid and point snapping and picks the grid step", () => {
    const onChange = vi.fn();
    render(<SnapBar snap={{ grid: false, step: 0.1, points: true }} onChange={onChange} />);
    expect(screen.getByRole("button", { name: "Grid" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Points" })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "Grid" }));
    expect(onChange).toHaveBeenLastCalledWith({ grid: true, step: 0.1, points: true });
    fireEvent.change(screen.getByLabelText("Grid step"), { target: { value: "0.5" } });
    expect(onChange).toHaveBeenLastCalledWith({ grid: false, step: 0.5, points: true });
    fireEvent.click(screen.getByRole("button", { name: "Points" }));
    expect(onChange).toHaveBeenLastCalledWith({ grid: false, step: 0.1, points: false });
  });
});

describe("PickTag", () => {
  it("shows what was clicked and selects any node in the chain behind it", () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    const labels: Record<string, string> = { poly: "Spline (curve)", div: "Divide", culm: "Culm", arr: "Array (linear)" };
    render(
      <PickTag
        title="C2.1 · culm"
        detail="0.79 m · Ø 90→72 mm"
        chain={["poly", "div", "culm", "arr"]}
        labelOf={(id) => labels[id]}
        isSelected={(id) => id === "culm"}
        onSelect={onSelect}
        onClose={onClose}
      />,
    );
    expect(screen.getByText("C2.1 · culm")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Culm" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Spline (curve)" }));
    expect(onSelect).toHaveBeenCalledWith("poly");
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
