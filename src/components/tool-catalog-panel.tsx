"use client";

import { useState } from "react";
import { toolCatalog, categoryLabels, categoryColors, type ToolDefinition, type ToolArg } from "@/lib/tool-catalog";

export function ToolCatalogPanel() {
  const [expandedTool, setExpandedTool] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<ToolDefinition["category"] | "all">("all");

  const categories = ["all", "visual", "content", "animation", "context", "control"] as const;
  const filtered =
    filterCategory === "all" ? toolCatalog : toolCatalog.filter((t) => t.category === filterCategory);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-white/10 px-4 py-3">
        <h3 className="text-sm font-bold text-white">Tool Catalog</h3>
        <p className="mt-1 text-[11px] text-zinc-500">Every tool the AI can call on your page</p>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-white/5 px-4 py-2">
        {categories.map((cat) => (
          <button
            className={[
              "shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition",
              filterCategory === cat
                ? "bg-white/10 text-white"
                : "text-zinc-500 hover:text-zinc-300",
            ].join(" ")}
            key={cat}
            onClick={() => setFilterCategory(cat)}
            type="button"
          >
            {cat === "all" ? "All" : categoryLabels[cat]}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2">
        {filtered.map((tool) => (
          <ToolCard
            expanded={expandedTool === tool.name}
            key={tool.name}
            onToggle={() => setExpandedTool(expandedTool === tool.name ? null : tool.name)}
            tool={tool}
          />
        ))}
      </div>

      <div className="border-t border-white/5 px-4 py-2">
        <p className="text-[10px] text-zinc-600">
          {toolCatalog.length} tools total &middot; The AI validates every call before applying
        </p>
      </div>
    </div>
  );
}

function ToolCard({
  tool,
  expanded,
  onToggle,
}: {
  tool: ToolDefinition;
  expanded: boolean;
  onToggle: () => void;
}) {
  const catColor = categoryColors[tool.category];

  return (
    <div className="mb-2 rounded-xl border border-white/[0.06] bg-white/[0.02] transition hover:border-white/10">
      <button
        className="flex w-full items-start gap-3 px-3 py-2.5 text-left"
        onClick={onToggle}
        type="button"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <code className="text-xs font-bold text-white">{tool.name}</code>
            <span className={["rounded-md border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em]", catColor].join(" ")}>
              {categoryLabels[tool.category]}
            </span>
          </div>
          <p className="mt-1 text-[11px] leading-4 text-zinc-500">{tool.description}</p>
        </div>
        <span className="mt-1 shrink-0 text-[10px] text-zinc-600">{expanded ? "−" : "+"}</span>
      </button>

      {expanded && (
        <div className="border-t border-white/5 px-3 py-2">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-500">Arguments</p>
          <div className="space-y-2">
            {tool.args.map((arg) => (
              <ArgRow arg={arg} key={arg.name} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ArgRow({ arg }: { arg: ToolArg }) {
  const [showValues, setShowValues] = useState(false);

  return (
    <div className="rounded-lg bg-black/20 p-2">
      <div className="flex items-center gap-2">
        <code className="text-[11px] font-semibold text-zinc-200">{arg.name}</code>
        <span className="rounded bg-white/5 px-1.5 py-0.5 text-[9px] font-mono text-zinc-500">{arg.type}</span>
        {arg.required && (
          <span className="text-[9px] font-bold uppercase text-red-400/70">required</span>
        )}
      </div>
      <p className="mt-0.5 text-[10px] text-zinc-500">{arg.description}</p>
      {arg.values && arg.values.length > 0 && (
        <div className="mt-1.5">
          <button
            className="text-[9px] font-semibold uppercase tracking-[0.1em] text-fuchsia-400/70 hover:text-fuchsia-300"
            onClick={() => setShowValues(!showValues)}
            type="button"
          >
            {showValues ? "Hide" : "Show"} {arg.values.length} values
          </button>
          {showValues && (
            <div className="mt-1 flex flex-wrap gap-1">
              {arg.values.map((v) => (
                <span
                  className="rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-zinc-400"
                  key={v}
                >
                  {v}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
      {arg.range && (
        <p className="mt-1 text-[9px] text-zinc-600">
          Range: {arg.range.min} – {arg.range.max}
        </p>
      )}
    </div>
  );
}
