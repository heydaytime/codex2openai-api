import type { PageConfig } from "./page-config";

export const backgroundClasses: Record<PageConfig["theme"]["background"], string> = {
  black: "bg-[#030305]",
  white: "bg-zinc-50",
  cream: "bg-[#f4ead8]",
  "warm-gradient": "bg-[radial-gradient(circle_at_top_left,#f9a8d4_0%,#fdba74_38%,#fff7ed_100%)]",
  "purple-radial": "bg-[radial-gradient(circle_at_top,#7c3aed_0%,#111827_42%,#020617_100%)]",
  "sunset-glow": "bg-[radial-gradient(circle_at_top_left,#fb7185_0%,#fdba74_35%,#fff7ed_100%)]",
  "cyber-grid": "bg-[linear-gradient(135deg,#020617_0%,#082f49_48%,#0f172a_100%)]",
  "starry-sky": "bg-[#020617] bg-[radial-gradient(circle,#fff_1px,transparent_1px),radial-gradient(circle,#bae6fd_1px,transparent_1px),linear-gradient(180deg,#020617_0%,#0f172a_100%)] [background-position:0_0,13px_9px,0_0] [background-size:26px_26px,41px_41px,100%_100%]",
  "soft-blue": "bg-[linear-gradient(135deg,#eff6ff_0%,#dbeafe_42%,#bfdbfe_100%)]",
  "pink-pop": "bg-[radial-gradient(circle_at_top,#f9a8d4_0%,#fb7185_32%,#831843_100%)]",
  forest: "bg-[linear-gradient(135deg,#052e16_0%,#14532d_48%,#022c22_100%)]",
  custom: ""
};

export const textClasses: Record<PageConfig["theme"]["text"], string> = {
  light: "text-white",
  dark: "text-zinc-950",
  muted: "text-zinc-200",
  "high-contrast": "text-white"
};

export const accentClasses: Record<PageConfig["theme"]["accent"], { ring: string; badge: string; glow: string }> = {
  fuchsia: { ring: "ring-fuchsia-300/60", badge: "bg-fuchsia-300 text-black", glow: "shadow-fuchsia-500/30" },
  blue: { ring: "ring-blue-300/60", badge: "bg-blue-300 text-black", glow: "shadow-blue-500/30" },
  green: { ring: "ring-emerald-300/60", badge: "bg-emerald-300 text-black", glow: "shadow-emerald-500/30" },
  orange: { ring: "ring-orange-300/60", badge: "bg-orange-300 text-black", glow: "shadow-orange-500/30" },
  red: { ring: "ring-red-300/60", badge: "bg-red-300 text-black", glow: "shadow-red-500/30" },
  gold: { ring: "ring-yellow-300/70", badge: "bg-yellow-300 text-black", glow: "shadow-yellow-500/30" },
  mono: { ring: "ring-zinc-400/50", badge: "bg-zinc-950 text-white", glow: "shadow-zinc-500/20" },
  purple: { ring: "ring-purple-300/60", badge: "bg-purple-300 text-black", glow: "shadow-purple-500/30" },
  cyan: { ring: "ring-cyan-300/60", badge: "bg-cyan-300 text-black", glow: "shadow-cyan-500/30" }
};

export const fontClasses: Record<PageConfig["theme"]["font"], string> = {
  modern: "font-sans tracking-tight",
  editorial: "font-serif tracking-tight",
  mono: "font-mono tracking-tight",
  rounded: "font-sans tracking-normal",
  bold: "font-sans tracking-tight"
};

export const surfaceClasses: Record<PageConfig["theme"]["surface"], string> = {
  flat: "border-transparent bg-transparent",
  glass: "border-white/15 bg-white/10 backdrop-blur-xl",
  paper: "border-black/10 bg-white/70 text-zinc-950",
  ink: "border-white/10 bg-black/45 text-white",
  "glow-card": "border-white/15 bg-white/10 shadow-2xl backdrop-blur-xl"
};

export const widthClasses: Record<PageConfig["layout"]["width"], string> = {
  narrow: "max-w-sm",
  medium: "max-w-md",
  wide: "max-w-2xl"
};

export const spacingClasses: Record<PageConfig["layout"]["spacing"], string> = {
  tight: "gap-2",
  normal: "gap-3",
  airy: "gap-5"
};

export const profileSizeClasses: Record<PageConfig["profile"]["profileSize"], { avatar: string; title: string; bio: string }> = {
  sm: { avatar: "h-16 w-16 text-2xl", title: "text-3xl md:text-4xl", bio: "text-sm md:text-base" },
  md: { avatar: "h-24 w-24 text-4xl", title: "text-4xl md:text-6xl", bio: "text-base md:text-lg" },
  lg: { avatar: "h-32 w-32 text-5xl", title: "text-5xl md:text-7xl", bio: "text-lg md:text-xl" }
};

export const linkShapeClasses: Record<PageConfig["linkStyle"]["shape"], string> = {
  square: "rounded-none",
  rounded: "rounded-2xl",
  pill: "rounded-full"
};

export const linkFillClasses: Record<PageConfig["linkStyle"]["fill"], string> = {
  solid: "bg-zinc-950 text-white hover:bg-zinc-800",
  glass: "border border-white/20 bg-white/10 text-white backdrop-blur hover:bg-white/15",
  outline: "border border-current bg-transparent text-current hover:bg-current hover:text-black",
  soft: "bg-white/70 text-zinc-950 hover:bg-white"
};

export const linkSizeClasses: Record<PageConfig["linkStyle"]["size"], string> = {
  sm: "px-4 py-3 text-sm",
  md: "px-5 py-4 text-base",
  lg: "px-6 py-5 text-lg"
};

export const linkShadowClasses: Record<PageConfig["linkStyle"]["shadow"], string> = {
  none: "shadow-none",
  soft: "shadow-lg shadow-black/10",
  strong: "shadow-2xl shadow-black/30",
  glow: "shadow-2xl"
};
