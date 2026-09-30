import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ReactFlowProvider, type NodeProps } from "@xyflow/react";
import { GraphNode } from "./GraphNode";
import { NODE_DEFS } from "@/lib/design/nodeDefs";

afterEach(cleanup);

const defaults = (type: string) =>
  Object.fromEntries(NODE_DEFS[type].params.map((p) => [p.key, p.default]));

function renderNode(type: string, params: Record<string, number | string> = {}, extra: object = {}, selected = false) {
  const updateParam = vi.fn();
  const props = {
    id: "n1",
    selected,
    data: { type, params: { ...defaults(type), ...params }, updateParam, ...extra },
  } as unknown as NodeProps;
  const { container } = render(
    <ReactFlowProvider>
      <GraphNode {...props} />
    </ReactFlowProvider>,
  );
  return { updateParam, container };
}

describe("GraphNode selection", () => {
  it("shows when the node is selected (from the graph or by a click in 3D)", () => {
    const { container } = renderNode("culm", {}, {}, true);
    expect(container.firstElementChild).toHaveClass("ring-2");
    cleanup();
    const plain = renderNode("culm").container;
    expect(plain.firstElementChild).not.toHaveClass("ring-2");
  });
});

describe("GraphNode parameters", () => {
  it("renders numeric params as sliders, not number boxes", () => {
    renderNode("culm");
    // Ø start, Ø end, wall, node spacing — species stays a dropdown.
    expect(screen.getAllByRole("slider")).toHaveLength(4);
    expect(screen.queryAllByRole("spinbutton")).toHaveLength(0);
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("shows each slider's live value and range", () => {
    renderNode("culm");
    const d0 = screen.getByRole("slider", { name: "Ø start (mm)" });
    expect(d0).toHaveValue("90");
    expect(d0).toHaveAttribute("min", "5");
    expect(d0).toHaveAttribute("max", "300");
    expect(screen.getByText("90")).toBeInTheDocument(); // readout
  });

  it("dragging a slider updates the param as a number", () => {
    const { updateParam } = renderNode("culm");
    fireEvent.change(screen.getByRole("slider", { name: "Ø start (mm)" }), { target: { value: "120" } });
    expect(updateParam).toHaveBeenCalledWith("n1", "d0", 120);
  });

  it("stretches the track to fit a value saved outside the usual range", () => {
    renderNode("line", { ax: -25 });
    expect(screen.getByRole("slider", { name: "A.x" })).toHaveAttribute("min", "-25");
  });

  it("formats readouts to the step's precision", () => {
    renderNode("polyline", { tension: 0.25 });
    expect(screen.getByText("0.25")).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: "tension" })).toHaveAttribute("step", "0.05");
  });
});

describe("GraphNode spline editing", () => {
  it("offers the draw pad on spline nodes", () => {
    const openDraw = vi.fn();
    renderNode("polyline", {}, { openDraw });
    fireEvent.click(screen.getByRole("button", { name: "Edit curve on the draw pad" }));
    expect(openDraw).toHaveBeenCalledWith("n1");
  });

  it("does not offer it on other nodes", () => {
    renderNode("culm", {}, { openDraw: vi.fn() });
    expect(screen.queryByRole("button", { name: "Edit curve on the draw pad" })).toBeNull();
  });
});
