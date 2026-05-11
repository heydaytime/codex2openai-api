import {
  backgroundPresets,
  moods,
  accentPresets,
  surfacePresets,
  textPresets,
  fontPresets,
  layoutPresets,
  paddingPresets,
  spacingPresets,
  alignmentPresets,
  widthPresets,
  avatarStyles,
  sizePresets,
  linkShapes,
  linkFills,
  shadowPresets,
  animationPresets,
  backgroundMotionPresets,
  motionIntensityPresets,
  motionSpeedPresets,
  featuredStyles,
  resetElementTargets,
  sceneElementKinds,
  sceneEasings,
  titleTreatments,
  bioTreatments,
} from "./page-config";
import { presetTools } from "./preset-tools";

export type ToolArg = {
  name: string;
  type: "enum" | "string" | "number" | "boolean" | "object" | "array";
  required: boolean;
  description: string;
  values?: readonly string[];
  range?: { min: number; max: number };
};

export type ToolDefinition = {
  name: string;
  description: string;
  category: "context" | "visual" | "content" | "animation" | "control";
  args: ToolArg[];
};

export const toolCatalog: ToolDefinition[] = [
  {
    name: "fuzz_find",
    description: "Pass-1-only tool that searches the local preset embedding database using detailed natural-language queries.",
    category: "context",
    args: [
      { name: "queries", type: "array", required: true, description: "2-4 detailed search phrases recommended; server accepts up to 12" },
      { name: "limit", type: "number", required: false, description: "Number of preset results to return", range: { min: 1, max: 10 } },
    ],
  },
  {
    name: "apply_preset",
    description: `Apply one of ${presetTools.length} local preset operations returned by fuzz_find. Presets expand into safe base tool calls on the server.`,
    category: "visual",
    args: [
      { name: "id", type: "string", required: true, description: "Preset operation id returned by the local embedding search" },
    ],
  },

  {
    name: "change_background",
    description: "Change the page background to a preset gradient/color or a custom CSS gradient.",
    category: "visual",
    args: [
      { name: "preset", type: "enum", required: false, description: "Named background preset", values: backgroundPresets.filter((p) => p !== "custom") as unknown as string[] },
      { name: "css", type: "object", required: false, description: "Custom CSS background (backgroundColor, backgroundImage as gradient, backgroundSize, backgroundPosition, backgroundRepeat)" },
    ],
  },
  {
    name: "change_theme",
    description: "Adjust the overall mood, accent color, surface style, or text contrast of the page.",
    category: "visual",
    args: [
      { name: "mood", type: "enum", required: false, description: "Overall design mood", values: moods as unknown as string[] },
      { name: "accent", type: "enum", required: false, description: "Primary accent color", values: accentPresets as unknown as string[] },
      { name: "surface", type: "enum", required: false, description: "Card/surface material", values: surfacePresets as unknown as string[] },
      { name: "text", type: "enum", required: false, description: "Text contrast level", values: textPresets as unknown as string[] },
    ],
  },
  {
    name: "change_background_motion",
    description: "Animate the existing page background with safe enum-only CSS motion such as slow gradient shifts, aurora drift, spotlight panning, breathing color, or star twinkle. No raw CSS, scripts, URLs, or selectors are accepted.",
    category: "animation",
    args: [
      { name: "preset", type: "enum", required: true, description: "Trusted background motion preset", values: backgroundMotionPresets as unknown as string[] },
      { name: "intensity", type: "enum", required: false, description: "Motion/overlay strength", values: motionIntensityPresets as unknown as string[] },
      { name: "speed", type: "enum", required: false, description: "Animation speed", values: motionSpeedPresets as unknown as string[] },
    ],
  },
  {
    name: "change_typography",
    description: "Change fonts, text style, or custom text color.",
    category: "visual",
    args: [
      { name: "font", type: "enum", required: false, description: "Font family preset", values: fontPresets as unknown as string[] },
      { name: "text", type: "enum", required: false, description: "Text contrast preset", values: textPresets as unknown as string[] },
      { name: "textColor", type: "string", required: false, description: "Custom text color (hex/rgb/hsl)" },
    ],
  },
  {
    name: "change_layout",
    description: "Change the page layout structure, spacing, alignment, or content width.",
    category: "visual",
    args: [
      { name: "preset", type: "enum", required: false, description: "Layout template", values: layoutPresets as unknown as string[] },
      { name: "spacing", type: "enum", required: false, description: "Vertical gap between links", values: spacingPresets as unknown as string[] },
      { name: "padding", type: "enum", required: false, description: "Outer page padding", values: paddingPresets as unknown as string[] },
      { name: "alignment", type: "enum", required: false, description: "Content alignment", values: alignmentPresets as unknown as string[] },
      { name: "width", type: "enum", required: false, description: "Max content width", values: widthPresets as unknown as string[] },
    ],
  },
  {
    name: "change_profile",
    description: "Update the bio text, avatar style, or profile section size. Cannot change display name or slug.",
    category: "content",
    args: [
      { name: "displayName", type: "string", required: false, description: "Page title/display name (manual user edits only; AI should not change this)" },
      { name: "bio", type: "string", required: false, description: "New bio text (max 240 chars)" },
      { name: "avatarStyle", type: "enum", required: false, description: "Avatar display style", values: avatarStyles as unknown as string[] },
      { name: "profileSize", type: "enum", required: false, description: "Profile section size", values: sizePresets as unknown as string[] },
      { name: "titleFont", type: "enum", required: false, description: "Display/title font", values: fontPresets as unknown as string[] },
      { name: "bioFont", type: "enum", required: false, description: "Bio/description font", values: fontPresets as unknown as string[] },
      { name: "titleTreatment", type: "enum", required: false, description: "Title styling treatment", values: titleTreatments as unknown as string[] },
      { name: "bioTreatment", type: "enum", required: false, description: "Bio styling treatment", values: bioTreatments as unknown as string[] },
    ],
  },
  {
    name: "change_link_appearance",
    description: "Style all links: button shape, fill style, size, shadow, and hover animation.",
    category: "visual",
    args: [
      { name: "shape", type: "enum", required: false, description: "Button corner style", values: linkShapes as unknown as string[] },
      { name: "fill", type: "enum", required: false, description: "Button fill treatment", values: linkFills as unknown as string[] },
      { name: "size", type: "enum", required: false, description: "Button size", values: sizePresets as unknown as string[] },
      { name: "shadow", type: "enum", required: false, description: "Drop shadow / glow effect", values: shadowPresets as unknown as string[] },
      { name: "animation", type: "enum", required: false, description: "Hover/featured animation", values: animationPresets as unknown as string[] },
    ],
  },
  {
    name: "change_individual_link_style",
    description: "Override shape, fill, size, shadow, animation, or font for one existing link without changing every link.",
    category: "visual",
    args: [
      { name: "id", type: "string", required: true, description: "ID of an existing link" },
      { name: "shape", type: "enum", required: false, description: "Button corner style", values: linkShapes as unknown as string[] },
      { name: "fill", type: "enum", required: false, description: "Button fill treatment", values: linkFills as unknown as string[] },
      { name: "size", type: "enum", required: false, description: "Button size", values: sizePresets as unknown as string[] },
      { name: "shadow", type: "enum", required: false, description: "Drop shadow / glow effect", values: shadowPresets as unknown as string[] },
      { name: "animation", type: "enum", required: false, description: "Hover/featured animation", values: animationPresets as unknown as string[] },
      { name: "font", type: "enum", required: false, description: "Font just for this link", values: fontPresets as unknown as string[] },
    ],
  },
  {
    name: "change_creative_layer",
    description: "Add animated background elements: floating emojis, shapes, text particles with CSS animations.",
    category: "animation",
    args: [
      { name: "enabled", type: "boolean", required: true, description: "Whether the creative layer is active" },
      { name: "elements", type: "array", required: true, description: `Array of up to 18 scene elements. Each: id, kind (${sceneElementKinds.join("/")}), content, color, left/top %, width/height %, opacity, blur, zIndex, animation with from/to transforms. Easings: ${sceneEasings.join(", ")}` },
    ],
  },
  {
    name: "feature_link",
    description: "Highlight an existing link with a featured treatment (glow, badge, larger, etc).",
    category: "content",
    args: [
      { name: "id", type: "string", required: true, description: "ID of an existing link to feature" },
      { name: "style", type: "enum", required: false, description: "Featured display style", values: featuredStyles as unknown as string[] },
    ],
  },
  {
    name: "reset_page",
    description: "Reset all visual properties (theme, layout, link style, creative layer, emphasis) back to clean defaults. User data (links, bio, name) is preserved.",
    category: "control",
    args: [],
  },
  {
    name: "reorder_links",
    description: "Move existing links into a new order. Omitted links stay after the provided ordered IDs.",
    category: "content",
    args: [
      { name: "order", type: "array", required: true, description: "Existing link IDs in the desired order" },
    ],
  },
  {
    name: "reset_element",
    description: "Reset one visual area back to defaults: page, title, bio, layout, all links, or one link by id.",
    category: "control",
    args: [
      { name: "target", type: "enum", required: true, description: "Element area to reset", values: resetElementTargets as unknown as string[] },
      { name: "id", type: "string", required: false, description: "Required only when target is link" },
    ],
  },
  {
    name: "validate_result",
    description: "Terminal validation step. The AI lists what it checked. Does not trigger another AI call.",
    category: "control",
    args: [
      { name: "checklist", type: "array", required: true, description: "List of validation assertions (1-8 items, each max 120 chars)" },
    ],
  },
];

export const categoryLabels: Record<ToolDefinition["category"], string> = {
  context: "Context",
  visual: "Visual Design",
  content: "Content",
  animation: "Animation",
  control: "Flow Control",
};

export const categoryColors: Record<ToolDefinition["category"], string> = {
  context: "text-sky-400 bg-sky-400/10 border-sky-400/20",
  visual: "text-fuchsia-400 bg-fuchsia-400/10 border-fuchsia-400/20",
  content: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  animation: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  control: "text-zinc-400 bg-zinc-400/10 border-zinc-400/20",
};
