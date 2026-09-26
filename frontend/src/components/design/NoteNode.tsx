"use client";

import { NodeResizer, type NodeProps } from "@xyflow/react";

/** A free-floating annotation box that sits behind the graph nodes, for labelling regions
 *  of a design ("outer shell", "cladding", "phase 2"). It is not part of the computational
 *  graph — the evaluator ignores it — so it has no ports and never wires to anything. */
export function NoteNode({ id, data, selected }: NodeProps) {
  const d = data as {
    text?: string;
    updateNote?: (id: string, text: string) => void;
    deleteNode?: (id: string) => void;
  };
  return (
    <div className="relative h-full w-full rounded-lg border-2 border-dashed border-leaf-400/70 bg-leaf-50/50">
      <NodeResizer
        minWidth={140}
        minHeight={80}
        isVisible={!!selected}
        lineClassName="!border-leaf-400"
        handleClassName="!h-2 !w-2 !rounded-sm !border-0 !bg-leaf-500"
      />
      {d.deleteNode && (
        <button
          onClick={() => d.deleteNode?.(id)}
          title="Delete note"
          aria-label="Delete note"
          className="nodrag absolute right-1 top-1 z-10 rounded px-1 text-xs leading-none text-leaf-700/70 hover:bg-leaf-200 hover:text-leaf-800"
        >
          ×
        </button>
      )}
      <textarea
        value={d.text ?? ""}
        placeholder="Note…"
        aria-label="Note text"
        onChange={(e) => d.updateNote?.(id, e.target.value)}
        className="nodrag nowheel h-full w-full resize-none rounded-lg border-0 bg-transparent p-2 pr-5 text-xs font-medium text-leaf-800 outline-none placeholder:text-leaf-500/60"
        spellCheck={false}
      />
    </div>
  );
}
