import { PageConfigSchema, defaultVisualConfig, type AiToolCall, type AppliedToolCall, type PageConfig } from "./page-config";
import { findPresetTool } from "./preset-tools";

type ApplyOptions = {
  source?: AppliedToolCall["source"];
  pass?: number;
};

export function applyToolCalls(config: PageConfig, toolCalls: AiToolCall[], options: ApplyOptions = {}) {
  let next: PageConfig = structuredClone(config);
  const trace: AppliedToolCall[] = [];
  const source = options.source ?? "ai";
  const pass = options.pass ?? 0;

  for (const toolCall of toolCalls) {
    const before = JSON.stringify(next);
    next = applyOne(next, toolCall);
    const changed = before !== JSON.stringify(next);

    trace.push({
      id: `${source}-${pass}-${trace.length + 1}`,
      source,
      pass,
      status: changed ? "applied" : "skipped",
      note: describeToolCall(toolCall, changed),
      tool_call: toolCall
    });
  }

  const parsed = PageConfigSchema.parse(next);
  validateFeaturedLink(parsed);

  return { config: parsed, trace };
}

export function dedupeToolCalls(toolCalls: AiToolCall[]) {
  const seen = new Set<string>();
  const result: AiToolCall[] = [];

  for (const call of toolCalls) {
    if (isControlTool(call)) continue;
    const key = `${call.tool}:${JSON.stringify(call.args)}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(call);
    }
  }

  return result.slice(0, 18);
}

export function isControlTool(toolCall: AiToolCall) {
  return toolCall.tool === "fuzz_find" || toolCall.tool === "validate_result";
}

function applyOne(config: PageConfig, toolCall: AiToolCall): PageConfig {
  const next = structuredClone(config);

  switch (toolCall.tool) {
    case "fuzz_find":
    case "validate_result":
      break;
    case "apply_preset": {
      const preset = findPresetTool(toolCall.args.id);
      if (!preset) throw new Error(`Unknown preset id: ${toolCall.args.id}`);
      let presetConfig = next;
      for (const operation of preset.operations) {
        presetConfig = applyOne(presetConfig, operation);
      }
      return PageConfigSchema.parse(presetConfig);
    }
    case "reset_page":
      next.theme = { ...next.theme, ...defaultVisualConfig.theme, backgroundCss: undefined };
      next.layout = { ...defaultVisualConfig.layout };
      next.linkStyle = { ...defaultVisualConfig.linkStyle };
      next.emphasis = { featuredLinkId: undefined, ...defaultVisualConfig.emphasis };
      next.creativeLayer = { enabled: false, elements: [] };
      next.links = next.links.map((link) => ({ ...link, featured: false, style: undefined }));
      break;
    case "change_background":
      if (toolCall.args.css) {
        next.theme.background = "custom";
        next.theme.backgroundCss = toolCall.args.css;
      } else if (toolCall.args.preset) {
        next.theme.background = toolCall.args.preset;
        next.theme.backgroundCss = undefined;
      }
      break;
    case "change_theme":
      next.theme = { ...next.theme, ...toolCall.args };
      break;
    case "change_typography":
      next.theme = { ...next.theme, ...toolCall.args };
      break;
    case "change_layout":
      next.layout = { ...next.layout, ...toolCall.args };
      break;
    case "change_profile":
      next.profile = { ...next.profile, ...toolCall.args };
      break;
    case "change_link_appearance":
      next.linkStyle = { ...next.linkStyle, ...toolCall.args };
      break;
    case "change_individual_link_style":
      ensureLinkExists(next, toolCall.args.id);
      next.links = next.links.map((link) =>
        link.id === toolCall.args.id
          ? { ...link, style: { ...link.style, ...withoutId(toolCall.args) } }
          : link
      );
      break;
    case "change_creative_layer":
      next.creativeLayer = {
        enabled: toolCall.args.enabled,
        elements: toolCall.args.elements
      };
      break;
    case "feature_link":
      ensureLinkExists(next, toolCall.args.id);
      next.emphasis.featuredLinkId = toolCall.args.id;
      next.emphasis.featuredStyle = toolCall.args.style ?? "glow";
      next.links = next.links.map((link) =>
        link.id === toolCall.args.id ? { ...link, featured: true } : link
      );
      break;
    case "reorder_links":
      next.links = reorderLinks(next, toolCall.args.order);
      break;
    default:
      toolCall satisfies never;
  }

  return PageConfigSchema.parse(next);
}

function withoutId<T extends { id: string }>(value: T) {
  const { id: _id, ...rest } = value;
  return rest;
}

function reorderLinks(config: PageConfig, order: string[]) {
  const uniqueOrder = Array.from(new Set(order));
  for (const id of uniqueOrder) ensureLinkExists(config, id);

  const byId = new Map(config.links.map((link) => [link.id, link]));
  const ordered = uniqueOrder.map((id) => byId.get(id)!);
  const remaining = config.links.filter((link) => !uniqueOrder.includes(link.id));
  return [...ordered, ...remaining];
}

function ensureLinkExists(config: PageConfig, id: string) {
  if (!config.links.some((link) => link.id === id)) throw new Error(`Unknown link id: ${id}`);
}

function validateFeaturedLink(config: PageConfig) {
  if (config.emphasis.featuredLinkId) ensureLinkExists(config, config.emphasis.featuredLinkId);
}

function describeToolCall(toolCall: AiToolCall, changed: boolean) {
  if (toolCall.tool === "fuzz_find") return `Searched preset tools: ${toolCall.args.queries.join("; ")}`;
  if (toolCall.tool === "apply_preset") return changed ? `Applied preset: ${toolCall.args.id}` : `Skipped preset: ${toolCall.args.id}; config was already equivalent`;
  if (toolCall.tool === "validate_result") return `Validation checklist: ${toolCall.args.checklist.join("; ")}`;
  if (toolCall.tool === "reset_page") return changed ? "Reset all visual properties to defaults" : "Skipped reset; already at defaults";

  const action = toolCall.tool.replaceAll("_", " ");
  return changed ? `Applied ${action}` : `Skipped ${action}; config was already equivalent`;
}
