"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { NODE_DEFS } from "@/lib/design/nodeDefs";

const CAT_COLOR: Record<string, string> = {
  Geometry: "#538343",
  Bamboo: "#9a8248",
  Analysis: "#8c4e2e",
  Output: "#a9623a",
};

const HEADER = 30;
const ROW = 22;

export function GraphNode({ data, id }: NodeProps) {
  const d = data as {
    type: string;
    params: Record<string, number | string>;
    updateParam: (nodeId: string, key: string, value: number | string) => void;
    deleteNode?: (nodeId: string) => void;
    duplicateNode?: (nodeId: string) => void;
    speciesOptions?: { value: string; label: string }[];
    jointOptions?: { value: string; label: string }[];
    error?: string;
  };
  const def = NODE_DEFS[d.type];
  if (!def) return <div className="rounded bg-red-100 p-2 text-xs">Unknown</div>;

  const portRows = Math.max(def.inputs.length, def.outputs.length);

  return (
    <div
      className="w-52 rounded-lg border bg-white text-xs shadow-sm"
      style={{ borderColor: d.error ? "#a9623a" : "#d9cfb2" }}
    >
      <div
        className="flex items-center justify-between rounded-t-lg px-2 py-1.5 font-semibold text-white"
        style={{ background: CAT_COLOR[def.category] }}
      >
        <span>{def.label}</span>
        <span className="flex items-center gap-0.5">
          {d.duplicateNode && (
            <button
              onClick={() => d.duplicateNode?.(id)}
              title="Duplicate node"
              aria-label="Duplicate node"
              className="nodrag rounded px-1 text-xs leading-none text-white/80 hover:bg-white/20 hover:text-white"
            >
              ⧉
            </button>
          )}
          {d.deleteNode && (
            <button
              onClick={() => d.deleteNode?.(id)}
              title="Delete node"
              aria-label="Delete node"
              className="nodrag rounded px-1 leading-none text-white/80 hover:bg-white/20 hover:text-white"
            >
              ×
            </button>
          )}
        </span>
      </div>

      {/* Ports */}
      <div className="relative" style={{ height: portRows * ROW + 6 }}>
        {def.inputs.map((port, i) => (
          <div key={port.id}>
            <Handle
              type="target"
              position={Position.Left}
              id={port.id}
              style={{ top: HEADER + i * ROW + 11, background: "#538343" }}
            />
            <span className="absolute left-2 text-bamboo-700" style={{ top: i * ROW + 4 }}>
              {port.label}
            </span>
          </div>
        ))}
        {def.outputs.map((port, i) => (
          <div key={port.id}>
            <Handle
              type="source"
              position={Position.Right}
              id={port.id}
              style={{ top: HEADER + i * ROW + 11, background: "#a9623a" }}
            />
            <span className="absolute right-2 text-bamboo-700" style={{ top: i * ROW + 4 }}>
              {port.label}
            </span>
          </div>
        ))}
      </div>

      {/* Params */}
      {def.params.length > 0 && (
        <div className="space-y-1 border-t border-bamboo-100 p-2">
          {def.params.map((param) => (
            <label key={param.key} className="flex items-center justify-between gap-2">
              <span className="text-bamboo-600">{param.label}</span>
              {param.multiline ? (
                <textarea
                  className="nodrag nowheel h-20 w-28 resize-y rounded border border-bamboo-200 px-1 py-0.5 font-mono text-[10px] leading-tight"
                  value={String(d.params[param.key] ?? "")}
                  onChange={(e) => d.updateParam(id, param.key, e.target.value)}
                  spellCheck={false}
                />
              ) : param.dynamic ? (
                <select
                  className="w-24 rounded border border-bamboo-200 px-1 py-0.5 nodrag"
                  value={String(d.params[param.key] ?? "")}
                  onChange={(e) => d.updateParam(id, param.key, e.target.value)}
                >
                  <option value="">{param.dynamic === "joints" ? "Unspecified" : "Custom"}</option>
                  {((param.dynamic === "joints" ? d.jointOptions : d.speciesOptions) ?? []).map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              ) : param.options ? (
                <select
                  className="w-20 rounded border border-bamboo-200 px-1 py-0.5 nodrag"
                  value={String(d.params[param.key] ?? param.default)}
                  onChange={(e) => d.updateParam(id, param.key, e.target.value)}
                >
                  {param.options.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="number"
                  className="w-20 rounded border border-bamboo-200 px-1 py-0.5 nodrag"
                  value={Number(d.params[param.key] ?? param.default)}
                  min={param.min}
                  max={param.max}
                  step={param.step ?? 1}
                  onChange={(e) => d.updateParam(id, param.key, parseFloat(e.target.value))}
                />
              )}
            </label>
          ))}
        </div>
      )}

      {d.error && (
        <div className="border-t border-clay-400/40 bg-clay-400/10 px-2 py-1 text-clay-600">
          {d.error}
        </div>
      )}
    </div>
  );
}
