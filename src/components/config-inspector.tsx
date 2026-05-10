"use client";

import { useState } from "react";
import type { PageConfig } from "@/lib/page-config";

export function ConfigInspector({ config }: { config: PageConfig }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const sections: { key: string; label: string; data: unknown }[] = [
    { key: "profile", label: "Profile", data: config.profile },
    { key: "theme", label: "Theme", data: config.theme },
    { key: "layout", label: "Layout", data: config.layout },
    { key: "linkStyle", label: "Link Style", data: config.linkStyle },
    { key: "emphasis", label: "Emphasis", data: config.emphasis },
    { key: "creativeLayer", label: "Creative Layer", data: { enabled: config.creativeLayer.enabled, elements: config.creativeLayer.elements.length } },
    { key: "links", label: `Links (${config.links.length})`, data: config.links },
  ];

  return (
    <div className="space-y-1">
      {sections.map((section) => (
        <div key={section.key} className="rounded-lg border border-white/[0.06] bg-white/[0.02]">
          <button
            className="flex w-full items-center justify-between px-3 py-2 text-left"
            onClick={() => setExpanded(expanded === section.key ? null : section.key)}
            type="button"
          >
            <span className="text-xs font-semibold text-zinc-300">{section.label}</span>
            <span className="text-[10px] text-zinc-600">{expanded === section.key ? "−" : "+"}</span>
          </button>
          {expanded === section.key && (
            <div className="border-t border-white/5 px-3 py-2">
              <pre className="max-h-48 overflow-auto text-[10px] leading-4 text-zinc-400">
                {JSON.stringify(section.data, null, 2)}
              </pre>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
