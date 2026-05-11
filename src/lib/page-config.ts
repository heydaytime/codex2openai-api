import { z } from "zod";

export const moods = ["clean", "dark", "playful", "luxury", "cyberpunk", "warm", "minimal", "cosmic"] as const;
export const backgroundPresets = [
  "black",
  "white",
  "cream",
  "warm-gradient",
  "purple-radial",
  "sunset-glow",
  "cyber-grid",
  "starry-sky",
  "soft-blue",
  "pink-pop",
  "forest",
  "custom"
] as const;
export const accentPresets = ["fuchsia", "blue", "green", "orange", "red", "gold", "mono", "purple", "cyan"] as const;
export const fontPresets = ["modern", "editorial", "mono", "rounded", "bold", "display", "serif", "condensed", "handwritten", "tech", "elegant"] as const;
export const surfacePresets = ["flat", "glass", "paper", "ink", "glow-card"] as const;
export const textPresets = ["light", "dark", "muted", "high-contrast"] as const;
export const layoutPresets = ["centered-stack", "poster-card", "split-hero", "compact", "bold-banner"] as const;
export const spacingPresets = ["tight", "normal", "airy"] as const;
export const paddingPresets = ["compact", "normal", "roomy", "flush"] as const;
export const alignmentPresets = ["left", "center"] as const;
export const widthPresets = ["narrow", "medium", "wide"] as const;
export const avatarStyles = ["initials", "circle", "blob", "hidden"] as const;
export const sizePresets = ["sm", "md", "lg"] as const;
export const linkShapes = ["square", "rounded", "pill"] as const;
export const linkFills = ["solid", "glass", "outline", "soft"] as const;
export const shadowPresets = ["none", "soft", "strong", "glow"] as const;
export const animationPresets = ["none", "lift", "pulse-featured"] as const;
export const featuredStyles = ["none", "larger", "glow", "top-card", "badge"] as const;
export const titleTreatments = ["normal", "wide", "tight", "gradient", "outline"] as const;
export const bioTreatments = ["normal", "muted", "card", "caps"] as const;
export const resetElementTargets = ["page", "title", "bio", "layout", "links", "link"] as const;
export const linkKinds = ["social", "music", "video", "shop", "website", "other"] as const;
export const contextSections = ["profile", "links", "visual_state", "available_tools", "current_config"] as const;
export const sceneElementKinds = ["emoji", "text", "circle", "rectangle", "triangle"] as const;
export const sceneEasings = ["linear", "ease", "ease-in", "ease-out", "ease-in-out"] as const;

const SafeCssValue = z
  .string()
  .min(1)
  .max(900)
  .refine((value) => !/[;{}]/.test(value), "CSS values cannot contain rule delimiters.")
  .refine((value) => !/url\s*\(|@import|expression\s*\(|javascript:/i.test(value), "External resources and executable CSS are not allowed.");

const SafeColorValue = z
  .string()
  .min(1)
  .max(80)
  .refine(
    (value) =>
      /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value.trim()) ||
      /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/i.test(value.trim()) ||
      /^hsla?\(\s*\d{1,3}\s*,\s*\d{1,3}%\s*,\s*\d{1,3}%(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/i.test(value.trim()),
    "Color must be hex, rgb/rgba, or hsl/hsla."
  );

const ImageSource = z
  .string()
  .min(1)
  .max(1_500_000)
  .refine(
    (value) =>
      /^https?:\/\//i.test(value.trim()) ||
      /^data:image\/(?:png|jpe?g|webp|gif);base64,[a-z0-9+/=\s]+$/i.test(value.trim()),
    "Image must be an http(s) URL or a base64 data image."
  );

const numeric = (min: number, max: number) =>
  z.preprocess(
    (value) => {
      if (typeof value === "string") {
        const parsed = Number.parseFloat(value.trim().replace(/%|px|vw|vh|deg|ms/g, ""));
        return Number.isFinite(parsed) ? parsed : value;
      }
      return value;
    },
    z.number().min(min).max(max)
  );

const integer = (min: number, max: number) =>
  z.preprocess(
    (value) => {
      if (typeof value === "string") {
        const parsed = Number.parseInt(value.trim().replace(/%|px|vw|vh|deg|ms/g, ""), 10);
        return Number.isFinite(parsed) ? parsed : value;
      }
      return value;
    },
    z.number().int().min(min).max(max)
  );

export const BackgroundCssSchema = z
  .object({
    backgroundColor: SafeCssValue.optional(),
    backgroundImage: SafeCssValue.refine(
      (value) => /^(none|(?:repeating-)?(?:linear|radial|conic)-gradient\(.+\))$/i.test(value.trim()),
      "backgroundImage must be none or a CSS gradient."
    ).optional(),
    backgroundSize: SafeCssValue.optional(),
    backgroundPosition: SafeCssValue.optional(),
    backgroundRepeat: z.enum(["repeat", "no-repeat", "repeat-x", "repeat-y", "space", "round"]).optional()
  })
  .strict()
  .refine((value) => Object.values(value).some(Boolean), "At least one background CSS field is required.");

export const LinkSchema = z
  .object({
    id: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/),
    label: z.string().min(1).max(80),
    url: z.string().min(1).max(500),
    kind: z.enum(linkKinds),
    featured: z.boolean(),
    style: z
      .object({
        shape: z.enum(linkShapes).optional(),
        fill: z.enum(linkFills).optional(),
        size: z.enum(sizePresets).optional(),
        shadow: z.enum(shadowPresets).optional(),
        animation: z.enum(animationPresets).optional(),
        font: z.enum(fontPresets).optional()
      })
      .strict()
      .optional()
  })
  .strict();

const SceneTransformSchema = z
  .object({
    x: numeric(-200, 200).optional(),
    y: numeric(-200, 200).optional(),
    scale: numeric(0, 5).optional(),
    rotate: numeric(-1080, 1080).optional(),
    opacity: numeric(0, 1).optional()
  })
  .strict();

export const SceneElementSchema = z
  .object({
    id: z.string().min(1).max(40).regex(/^[a-z0-9-]+$/),
    kind: z.enum(sceneElementKinds),
    content: z.string().max(40).optional(),
    color: SafeColorValue.optional(),
    backgroundColor: SafeColorValue.optional(),
    left: numeric(-30, 130),
    top: numeric(-30, 130),
    width: numeric(1, 80),
    height: numeric(1, 80),
    opacity: numeric(0, 1).default(1),
    blur: numeric(0, 24).default(0),
    zIndex: integer(0, 20).default(0),
    animation: z
      .object({
        durationMs: integer(250, 30000),
        delayMs: integer(0, 10000).default(0),
        easing: z.enum(sceneEasings).default("ease-in-out"),
        loop: z.boolean().default(true),
        alternate: z.boolean().default(false),
        from: SceneTransformSchema.default({}),
        to: SceneTransformSchema.default({})
      })
      .strict()
      .optional()
  })
  .strict()
  .refine((value) => value.kind !== "emoji" || !!value.content, "Emoji scene elements need content.")
  .refine((value) => value.kind !== "text" || !!value.content, "Text scene elements need content.");

export const CreativeLayerSchema = z
  .object({
    enabled: z.boolean(),
    elements: z.array(SceneElementSchema).max(18)
  })
  .strict();

export const PageConfigSchema = z
  .object({
    version: z.literal(1),
    slug: z.string().min(3).max(40).regex(/^[a-z0-9-]+$/),
    profile: z
      .object({
        displayName: z.string().min(1).max(80),
        bio: z.string().max(240),
        avatarUrl: ImageSource.optional(),
        avatarStyle: z.enum(avatarStyles),
        profileSize: z.enum(sizePresets),
        titleFont: z.enum(fontPresets).optional(),
        bioFont: z.enum(fontPresets).optional(),
        titleTreatment: z.enum(titleTreatments).optional(),
        bioTreatment: z.enum(bioTreatments).optional()
      })
      .strict(),
    theme: z
      .object({
        mood: z.enum(moods),
        background: z.enum(backgroundPresets),
        backgroundCss: BackgroundCssSchema.optional(),
        accent: z.enum(accentPresets),
        font: z.enum(fontPresets),
        textColor: SafeColorValue.optional(),
        surface: z.enum(surfacePresets),
        text: z.enum(textPresets)
      })
      .strict(),
    layout: z
      .object({
        preset: z.enum(layoutPresets),
        spacing: z.enum(spacingPresets),
        padding: z.enum(paddingPresets).optional(),
        alignment: z.enum(alignmentPresets),
        width: z.enum(widthPresets)
      })
      .strict(),
    linkStyle: z
      .object({
        shape: z.enum(linkShapes),
        fill: z.enum(linkFills),
        size: z.enum(sizePresets),
        shadow: z.enum(shadowPresets),
        animation: z.enum(animationPresets)
      })
      .strict(),
    emphasis: z
      .object({
        featuredLinkId: z.string().min(1).max(64).optional(),
        featuredStyle: z.enum(featuredStyles)
      })
      .strict(),
    creativeLayer: CreativeLayerSchema,
    links: z.array(LinkSchema).max(20)
  })
  .strict();

const OptionalThemeArgs = z
  .object({
    mood: z.enum(moods).optional(),
    accent: z.enum(accentPresets).optional(),
    surface: z.enum(surfacePresets).optional(),
    text: z.enum(textPresets).optional()
  })
  .strict()
  .refine((value) => Object.values(value).some(Boolean), "change_theme needs at least one field.");

const OptionalLayoutArgs = z
  .object({
    preset: z.enum(layoutPresets).optional(),
    spacing: z.enum(spacingPresets).optional(),
    padding: z.enum(paddingPresets).optional(),
    alignment: z.enum(alignmentPresets).optional(),
    width: z.enum(widthPresets).optional()
  })
  .strict()
  .refine((value) => Object.values(value).some(Boolean), "change_layout needs at least one field.");

const OptionalProfileArgs = z
  .object({
    displayName: z.string().min(1).max(80).optional(),
    bio: z.string().max(240).optional(),
    avatarUrl: ImageSource.nullable().optional(),
    avatarStyle: z.enum(avatarStyles).optional(),
    profileSize: z.enum(sizePresets).optional(),
    titleFont: z.enum(fontPresets).optional(),
    bioFont: z.enum(fontPresets).optional(),
    titleTreatment: z.enum(titleTreatments).optional(),
    bioTreatment: z.enum(bioTreatments).optional()
  })
  .strict()
  .refine((value) => Object.values(value).some((field) => field !== undefined), "change_profile needs at least one field.");

const OptionalTypographyArgs = z
  .object({
    font: z.enum(fontPresets).optional(),
    text: z.enum(textPresets).optional(),
    textColor: SafeColorValue.optional()
  })
  .strict()
  .refine((value) => Object.values(value).some(Boolean), "change_typography needs at least one field.");

const OptionalLinkAppearanceArgs = z
  .object({
    shape: z.enum(linkShapes).optional(),
    fill: z.enum(linkFills).optional(),
    size: z.enum(sizePresets).optional(),
    shadow: z.enum(shadowPresets).optional(),
    animation: z.enum(animationPresets).optional()
  })
  .strict()
  .refine((value) => Object.values(value).some(Boolean), "change_link_appearance needs at least one field.");

const OptionalIndividualLinkStyleArgs = z
  .object({
    id: z.string().min(1).max(64),
    shape: z.enum(linkShapes).optional(),
    fill: z.enum(linkFills).optional(),
    size: z.enum(sizePresets).optional(),
    shadow: z.enum(shadowPresets).optional(),
    animation: z.enum(animationPresets).optional(),
    font: z.enum(fontPresets).optional()
  })
  .strict()
  .refine((value) => Object.entries(value).some(([key, val]) => key !== "id" && val !== undefined), "change_individual_link_style needs at least one style field.");

const ChangeCreativeLayerArgs = z
  .object({
    enabled: z.boolean(),
    elements: z.array(SceneElementSchema).max(18)
  })
  .strict();

export const FuzzFindResponseSchema = z
  .object({
    message: z.string().min(1).max(240),
    tool_calls: z
      .array(
        z
          .object({
            tool: z.literal("fuzz_find"),
            args: z
              .object({
                queries: z.array(z.string().min(1).max(160)).min(1).max(12),
                limit: z.number().int().min(1).max(10).optional()
              })
              .strict()
          })
          .strict()
      )
      .min(1)
      .max(3)
  })
  .strict();

export const AiToolCallSchema = z.discriminatedUnion("tool", [
  z
    .object({
      tool: z.literal("fuzz_find"),
      args: z
        .object({
          queries: z.array(z.string().min(1).max(160)).min(1).max(12),
          limit: z.number().int().min(1).max(10).optional()
        })
        .strict()
    })
    .strict(),
  z
    .object({
      tool: z.literal("apply_preset"),
      args: z.object({ id: z.string().min(1).max(80).regex(/^[a-z0-9-]+$/) }).strict()
    })
    .strict(),

  z
    .object({
      tool: z.literal("change_background"),
      args: z
        .object({
          preset: z.enum(backgroundPresets).exclude(["custom"]).optional(),
          css: BackgroundCssSchema.optional()
        })
        .strict()
        .refine((value) => value.preset || value.css, "change_background needs preset or css.")
    })
    .strict(),
  z.object({ tool: z.literal("change_theme"), args: OptionalThemeArgs }).strict(),
  z.object({ tool: z.literal("change_typography"), args: OptionalTypographyArgs }).strict(),
  z.object({ tool: z.literal("change_layout"), args: OptionalLayoutArgs }).strict(),
  z.object({ tool: z.literal("change_profile"), args: OptionalProfileArgs }).strict(),
  z.object({ tool: z.literal("change_link_appearance"), args: OptionalLinkAppearanceArgs }).strict(),
  z.object({ tool: z.literal("change_individual_link_style"), args: OptionalIndividualLinkStyleArgs }).strict(),
  z.object({ tool: z.literal("change_creative_layer"), args: ChangeCreativeLayerArgs }).strict(),
  z
    .object({
      tool: z.literal("feature_link"),
      args: z.object({ id: z.string().min(1).max(64), style: z.enum(featuredStyles).optional() }).strict()
    })
    .strict(),
  z
    .object({
      tool: z.literal("reorder_links"),
      args: z.object({ order: z.array(z.string().min(1).max(64)).min(1).max(20) }).strict()
    })
    .strict(),
  z
    .object({
      tool: z.literal("reset_element"),
      args: z.object({ target: z.enum(resetElementTargets), id: z.string().min(1).max(64).optional() }).strict()
    })
    .strict(),
  z.object({ tool: z.literal("reset_page"), args: z.object({}).strict() }).strict(),
  z.object({ tool: z.literal("validate_result"), args: z.object({ checklist: z.array(z.string().min(1).max(120)).min(1).max(8) }).strict() }).strict()
]);

export const AiEditResponseSchema = z
  .object({
    message: z.string().min(1).max(240),
    tool_calls: z.array(AiToolCallSchema).min(1).max(16)
  })
  .strict();

export const AppliedToolCallSchema = z
  .object({
    id: z.string(),
    source: z.enum(["ai"]),
    pass: z.number().int().min(0).max(3),
    status: z.enum(["applied", "skipped"]),
    note: z.string(),
    tool_call: AiToolCallSchema
  })
  .strict();

export type PageConfig = z.infer<typeof PageConfigSchema>;
export type AiEditResponse = z.infer<typeof AiEditResponseSchema>;
export type FuzzFindResponse = z.infer<typeof FuzzFindResponseSchema>;
export type AiToolCall = z.infer<typeof AiToolCallSchema>;
export type AppliedToolCall = z.infer<typeof AppliedToolCallSchema>;
export type BackgroundCss = z.infer<typeof BackgroundCssSchema>;
export type CreativeLayer = z.infer<typeof CreativeLayerSchema>;
export type SceneElement = z.infer<typeof SceneElementSchema>;

export const samplePageConfig: PageConfig = {
  version: 1,
  slug: "username",
  profile: {
    displayName: "HeyDayTime",
    bio: "Producer, DJ, and visual artist building bright little worlds on the internet.",
    avatarStyle: "blob",
    profileSize: "md",
    titleFont: "display",
    bioFont: "modern",
    titleTreatment: "normal",
    bioTreatment: "normal"
  },
  theme: {
    mood: "cosmic",
    background: "purple-radial",
    accent: "fuchsia",
    font: "bold",
    textColor: undefined,
    surface: "glass",
    text: "light"
  },
  layout: {
    preset: "centered-stack",
    spacing: "normal",
    padding: "normal",
    alignment: "center",
    width: "medium"
  },
  linkStyle: {
    shape: "rounded",
    fill: "glass",
    size: "md",
    shadow: "glow",
    animation: "lift"
  },
  emphasis: {
    featuredLinkId: "spotify",
    featuredStyle: "glow"
  },
  creativeLayer: {
    enabled: false,
    elements: []
  },
  links: [
    { id: "instagram", label: "Instagram", url: "https://instagram.com/username", kind: "social", featured: false },
    { id: "spotify", label: "Spotify", url: "https://open.spotify.com/artist/example", kind: "music", featured: true },
    { id: "merch", label: "Merch Drop", url: "https://example.com/merch", kind: "shop", featured: false }
  ]
};

export function safeParsePageConfig(value: unknown) {
  return PageConfigSchema.safeParse(value);
}

export const defaultVisualConfig = {
  profile: {
    avatarStyle: "circle" as const,
    profileSize: "md" as const,
    titleFont: undefined,
    bioFont: undefined,
    titleTreatment: undefined,
    bioTreatment: undefined,
  },
  theme: {
    mood: "clean" as const,
    background: "white" as const,
    accent: "blue" as const,
    font: "modern" as const,
    surface: "paper" as const,
    text: "dark" as const,
    textColor: undefined,
    backgroundCss: undefined,
  },
  layout: {
    preset: "centered-stack" as const,
    spacing: "normal" as const,
    padding: "normal" as const,
    alignment: "center" as const,
    width: "medium" as const,
  },
  linkStyle: {
    shape: "rounded" as const,
    fill: "soft" as const,
    size: "md" as const,
    shadow: "soft" as const,
    animation: "lift" as const,
  },
  emphasis: {
    featuredStyle: "none" as const,
  },
  creativeLayer: {
    enabled: false,
    elements: [] as const,
  },
};
