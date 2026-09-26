import { describe, it, expect } from "vitest";
import { scheduleHTML } from "./SchedulePanel";
import type { Schedule } from "@/lib/design/types";

// The printable cut-list is written into a same-origin iframe via document.write, and its
// text comes from node parameters (species / joint labels, layups) that ride along in a
// saved graph — i.e. attacker-controlled on a shared design. Everything must be escaped.
const XSS = '<img src=x onerror="alert(1)">';

function scheduleWith(overrides: Partial<Schedule>): Schedule {
  return {
    rows: [],
    groups: [],
    species: [],
    joints: [],
    totals: { count: 0, totalLength_m: 0, estCulms: 0, jointCount: 0 },
    ...overrides,
  };
}

describe("scheduleHTML escaping", () => {
  it("escapes a malicious species label", () => {
    const html = scheduleHTML(
      scheduleWith({ species: [{ species: XSS, count: 1, totalLength_m: 1 }] }),
    );
    // The tag can no longer form; the payload survives only as inert escaped text.
    expect(html).not.toContain("<img");
    expect(html).not.toContain('onerror="alert(1)"');
    expect(html).toContain("&lt;img");
  });

  it("escapes a malicious joint type", () => {
    const html = scheduleHTML(
      scheduleWith({
        joints: [{ id: "J1", type: XSS, members: 2, memberIds: "C1 + C2", x: 0, y: 0, z: 0 }],
      }),
    );
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });

  it("escapes malicious element detail and layup", () => {
    const html = scheduleHTML(
      scheduleWith({
        rows: [{ id: "C1", kind: "culm", length_m: 1, detail: XSS, layup: XSS }],
        groups: [{ kind: "culm", detail: XSS, length_m: 1, count: 1, totalLength_m: 1, layup: XSS }],
      }),
    );
    expect(html).not.toContain("<img");
    expect(html).not.toContain('onerror="alert(1)"');
  });

  it("still renders the legitimate content", () => {
    const html = scheduleHTML(
      scheduleWith({
        rows: [{ id: "C1", kind: "culm", length_m: 2.5, detail: "Ø 90→75 mm" }],
        totals: { count: 1, totalLength_m: 2.5, estCulms: 1, jointCount: 0 },
      }),
    );
    expect(html).toContain("C1");
    expect(html).toContain("Ø 90→75 mm");
    expect(html).toContain("Fabrication cut-list");
  });
});
