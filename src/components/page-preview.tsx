"use client";

import type { CSSProperties } from "react";
import type { PageConfig, SceneElement } from "@/lib/page-config";
import {
  accentClasses,
  backgroundClasses,
  fontClasses,
  linkFillClasses,
  linkShadowClasses,
  linkShapeClasses,
  linkSizeClasses,
  paddingClasses,
  profileSizeClasses,
  spacingClasses,
  surfaceClasses,
  textClasses,
  widthClasses
} from "@/lib/theme-classes";

export type PreviewSelection = "page" | "title" | "bio" | "layout" | "all-links" | `link:${string}`;

export function PagePreview({
  config,
  fit = false,
  fullPage = false,
  publicSlug,
  selectedElement,
  onSelectElement
}: {
  config: PageConfig;
  fit?: boolean;
  fullPage?: boolean;
  publicSlug?: string;
  selectedElement?: PreviewSelection;
  onSelectElement?: (element: PreviewSelection) => void;
}) {
  const accent = accentClasses[config.theme.accent];
  const shellClass = [
    "relative w-full min-w-0 overflow-hidden [contain:layout_paint]",
    fullPage
      ? "min-h-screen rounded-none border-0 shadow-none"
      : "rounded-[2rem] border border-white/10 shadow-2xl",
    fullPage ? "" : fit ? "h-full" : "h-[720px] max-h-[80vh] min-h-[560px]",
    backgroundClasses[config.theme.background],
    getBackgroundMotionClass(config),
    textClasses[config.theme.text],
    fontClasses[config.theme.font],
    paddingClasses[config.layout.padding ?? "normal"]
  ].join(" ");

  const contentClass = getContentClass(config, fullPage);
  const customBackgroundStyle = getCustomBackgroundStyle(config);
  const backgroundMotionStyle = getBackgroundMotionStyle(config);
  const customTypographyStyle = getCustomTypographyStyle(config);

  return (
    <section
      className={[
        shellClass,
        onSelectElement ? "cursor-pointer" : ""
      ].join(" ")}
      onClick={onSelectElement ? () => onSelectElement("page") : undefined}
      style={{ ...customBackgroundStyle, ...backgroundMotionStyle, ...customTypographyStyle }}
    >
      <CreativeScene config={config} />
      <BackgroundMotionStyles />
      <div className={["relative z-10 min-w-0 overflow-hidden", fullPage ? "min-h-screen" : "h-full"].join(" ")}>
        <div
          className={[contentClass, "rounded-[2rem] transition", selectionClass(selectedElement === "layout")].join(" ")}
          onClick={(event) => {
            if (!onSelectElement) return;
            event.stopPropagation();
            onSelectElement("layout");
          }}
        >
          <ProfileBlock config={config} onSelectElement={onSelectElement} publicSlug={publicSlug} selectedElement={selectedElement} />
          <div
            className={[
              "w-full",
              spacingClasses[config.layout.spacing],
              "flex flex-col rounded-[1.5rem] transition",
              selectionClass(selectedElement === "all-links")
            ].join(" ")}
            onClick={(event) => {
              if (!onSelectElement) return;
              event.stopPropagation();
              onSelectElement("all-links");
            }}
          >
            {config.links.map((link) => {
              const featured = config.emphasis.featuredLinkId === link.id || link.featured;
              const selected = selectedElement === `link:${link.id}`;
              return (
                <a
                  className={[
                    "group flex w-full items-center justify-between text-left transition duration-300",
                    linkShapeClasses[link.style?.shape ?? config.linkStyle.shape],
                    linkFillClasses[link.style?.fill ?? config.linkStyle.fill],
                    linkSizeClasses[link.style?.size ?? config.linkStyle.size],
                    linkShadowClasses[link.style?.shadow ?? config.linkStyle.shadow],
                    fontClasses[link.style?.font ?? config.theme.font],
                    (link.style?.shadow ?? config.linkStyle.shadow) === "glow" ? accent.glow : "",
                    getLinkAnimationClass(link.style?.animation ?? config.linkStyle.animation, featured),
                    featured ? getFeaturedClass(config) : "",
                    selectionClass(selected)
                  ].join(" ")}
                  href={link.url}
                  key={link.id}
                  onClick={(event) => {
                    if (!onSelectElement) return;
                    event.preventDefault();
                    event.stopPropagation();
                    onSelectElement(`link:${link.id}`);
                  }}
                  rel="noreferrer"
                  target="_blank"
                >
                  <span className="min-w-0">
                    <span className="mb-1 block text-xs uppercase tracking-[0.22em] opacity-60">{link.kind}</span>
                    <span className="block break-words font-black">{link.label}</span>
                  </span>
                  <span className={["transition group-hover:translate-x-1", featured && config.emphasis.featuredStyle === "badge" ? `${accent.badge} rounded-full px-3 py-1 text-xs font-black` : "text-xl opacity-70"].join(" ")}>{featured && config.emphasis.featuredStyle === "badge" ? "Featured" : "->"}</span>
                </a>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function BackgroundMotionStyles() {
  return (
    <style>{`
      @media (prefers-reduced-motion: no-preference) {
        .bg-motion-slow-gradient-shift { animation: bg-gradient-shift var(--bg-motion-duration, 18s) ease-in-out infinite alternate; background-size: 140% 140%; }
        .bg-motion-aurora-drift::before { content: ""; position: absolute; inset: -30%; pointer-events: none; background: radial-gradient(circle at 20% 30%, rgba(34,211,238,var(--bg-motion-alpha,.18)), transparent 30%), radial-gradient(circle at 80% 20%, rgba(217,70,239,var(--bg-motion-alpha,.18)), transparent 28%), radial-gradient(circle at 50% 80%, rgba(250,204,21,var(--bg-motion-alpha,.18)), transparent 32%); filter: blur(34px); animation: bg-aurora-drift var(--bg-motion-duration, 18s) ease-in-out infinite alternate; }
        .bg-motion-spotlight-pan::before { content: ""; position: absolute; inset: 0; pointer-events: none; background: radial-gradient(circle at 15% 20%, rgba(255,255,255,var(--bg-motion-alpha,.18)), transparent 34%); mix-blend-mode: screen; animation: bg-spotlight-pan var(--bg-motion-duration, 18s) ease-in-out infinite alternate; }
        .bg-motion-subtle-breathe { animation: bg-subtle-breathe var(--bg-motion-duration, 18s) ease-in-out infinite alternate; }
        .bg-motion-star-twinkle::before { content: ""; position: absolute; inset: 0; pointer-events: none; background-image: radial-gradient(circle, rgba(255,255,255,var(--bg-motion-alpha,.18)) 0 1px, transparent 1px), radial-gradient(circle, rgba(186,230,253,var(--bg-motion-alpha,.18)) 0 1px, transparent 1px); background-position: 0 0, 17px 11px; background-size: 31px 31px, 47px 47px; animation: bg-star-twinkle var(--bg-motion-duration, 18s) ease-in-out infinite alternate; }
        .link-animation-wiggle-featured { animation: link-wiggle-featured 1.8s ease-in-out infinite; }
      }
      @keyframes bg-gradient-shift { from { background-position: 0% 50%; } to { background-position: 100% 50%; } }
      @keyframes bg-aurora-drift { from { transform: translate3d(-4%, -2%, 0) rotate(0deg) scale(1); opacity: .65; } to { transform: translate3d(5%, 3%, 0) rotate(10deg) scale(1.08); opacity: 1; } }
      @keyframes bg-spotlight-pan { from { background-position: 0% 20%; opacity: .45; } to { background-position: 100% 70%; opacity: .9; } }
      @keyframes bg-subtle-breathe { from { filter: saturate(1) brightness(1); } to { filter: saturate(var(--bg-motion-saturate, 1.12)) brightness(var(--bg-motion-brightness, 1.06)); } }
      @keyframes bg-star-twinkle { from { opacity: .35; transform: translateY(0); } to { opacity: .85; transform: translateY(-10px); } }
      @keyframes link-wiggle-featured { 0%, 100% { transform: rotate(0deg); } 25% { transform: rotate(-1deg); } 75% { transform: rotate(1deg); } }
    `}</style>
  );
}

function getBackgroundMotionClass(config: PageConfig) {
  const motion = config.theme.backgroundMotion;
  if (!motion || motion.preset === "none") return "";

  return `bg-motion-${motion.preset}`;
}

function getBackgroundMotionStyle(config: PageConfig): CSSProperties | undefined {
  const motion = config.theme.backgroundMotion;
  if (!motion || motion.preset === "none") return undefined;

  const speed = motion.speed ?? "normal";
  const intensity = motion.intensity ?? "medium";
  return {
    "--bg-motion-duration": speed === "slow" ? "24s" : speed === "fast" ? "10s" : "16s",
    "--bg-motion-alpha": intensity === "subtle" ? ".12" : intensity === "bold" ? ".3" : ".2",
    "--bg-motion-saturate": intensity === "subtle" ? "1.06" : intensity === "bold" ? "1.22" : "1.14",
    "--bg-motion-brightness": intensity === "subtle" ? "1.03" : intensity === "bold" ? "1.1" : "1.06"
  } as CSSProperties;
}

function getLinkAnimationClass(animation: PageConfig["linkStyle"]["animation"], featured: boolean) {
  if (animation === "lift") return "hover:-translate-y-1";
  if (animation === "pulse-featured" && featured) return "animate-pulse";
  if (animation === "hover-tilt") return "hover:-translate-y-1 hover:rotate-1 hover:scale-[1.015]";
  if (animation === "hover-shine") return "relative overflow-hidden before:absolute before:inset-y-0 before:-left-1/2 before:w-1/3 before:skew-x-[-18deg] before:bg-white/30 before:opacity-0 before:transition-all before:duration-700 hover:before:left-[120%] hover:before:opacity-100";
  if (animation === "press-pop") return "active:scale-[0.97] hover:scale-[1.01]";
  if (animation === "wiggle-featured" && featured) return "link-animation-wiggle-featured";
  return "";
}

function CreativeScene({ config }: { config: PageConfig }) {
  if (!config.creativeLayer.enabled || config.creativeLayer.elements.length === 0) return null;

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      <style>{buildSceneKeyframes(config.creativeLayer.elements)}</style>
      {config.creativeLayer.elements.map((element) => (
        <div className={getSceneElementClass(element)} key={element.id} style={getSceneElementStyle(element)}>
          {element.kind === "emoji" || element.kind === "text" ? element.content : null}
        </div>
      ))}
    </div>
  );
}

function getSceneElementClass(element: SceneElement) {
  const base = "absolute flex items-center justify-center select-none whitespace-nowrap";
  if (element.kind === "circle") return `${base} rounded-full`;
  if (element.kind === "rectangle") return `${base} rounded-xl`;
  if (element.kind === "triangle") return `${base} h-0 w-0 border-l-[var(--scene-half-width)] border-r-[var(--scene-half-width)] border-b-[var(--scene-height)] border-l-transparent border-r-transparent`;
  return base;
}

function getSceneElementStyle(element: SceneElement): CSSProperties {
  const style = {
    left: `${element.left}%`,
    top: `${element.top}%`,
    width: `${element.width}%`,
    height: `${element.height}%`,
    opacity: element.opacity,
    zIndex: element.zIndex,
    color: element.color,
    backgroundColor: element.kind === "triangle" ? undefined : element.backgroundColor,
    filter: element.blur > 0 ? `blur(${element.blur}px)` : undefined,
    fontSize: `${Math.max(element.width, element.height)}vmin`,
    animation: element.animation
      ? `scene-${element.id} ${element.animation.durationMs}ms ${element.animation.easing} ${element.animation.delayMs}ms ${element.animation.loop ? "infinite" : "1"} ${element.animation.alternate ? "alternate" : "normal"} both`
      : undefined,
    "--scene-half-width": `${element.width / 2}vw`,
    "--scene-height": `${element.height}vh`,
    borderBottomColor: element.kind === "triangle" ? (element.backgroundColor ?? element.color ?? "rgba(255,255,255,.7)") : undefined
  } satisfies CSSProperties & Record<string, string | number | undefined>;

  return style;
}

function buildSceneKeyframes(elements: SceneElement[]) {
  return elements
    .filter((element) => element.animation)
    .map((element) => {
      const animation = element.animation!;
      return `@keyframes scene-${element.id}{from{${transformCss(animation.from)}}to{${transformCss(animation.to)}}}`;
    })
    .join("\n");
}

function transformCss(transform: NonNullable<SceneElement["animation"]>["from"]) {
  const x = transform.x ?? 0;
  const y = transform.y ?? 0;
  const scale = transform.scale ?? 1;
  const rotate = transform.rotate ?? 0;
  const opacity = transform.opacity ?? 1;
  return `transform:translate(${x}vw,${y}vh) scale(${scale}) rotate(${rotate}deg);opacity:${opacity};`;
}

function getCustomBackgroundStyle(config: PageConfig): CSSProperties | undefined {
  const css = config.theme.backgroundCss;
  if (config.theme.background !== "custom" || !css) return undefined;

  return {
    backgroundColor: css.backgroundColor,
    backgroundImage: css.backgroundImage,
    backgroundSize: css.backgroundSize,
    backgroundPosition: css.backgroundPosition,
    backgroundRepeat: css.backgroundRepeat
  };
}

function getCustomTypographyStyle(config: PageConfig): CSSProperties | undefined {
  if (!config.theme.textColor) return undefined;
  return { color: config.theme.textColor };
}

function getContentClass(config: PageConfig, fullPage = false) {
  const width = widthClasses[config.layout.width];
  const align = config.layout.alignment === "center" ? "items-center text-center" : "items-start text-left";
  const height = fullPage ? "min-h-screen" : "h-full";

  if (config.layout.preset === "split-hero") {
    return ["mx-auto grid min-w-0 max-w-5xl items-center gap-8 overflow-hidden md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]", height].join(" ");
  }
  if (config.layout.preset === "poster-card") {
    return ["mx-auto flex min-w-0 flex-col justify-center overflow-hidden rounded-[2rem] border p-6", height, width, surfaceClasses[config.theme.surface]].join(" ");
  }
  if (config.layout.preset === "compact") {
    return ["mx-auto flex min-w-0 flex-col justify-center overflow-hidden", height, width, align].join(" ");
  }
  if (config.layout.preset === "bold-banner") {
    return ["mx-auto flex min-w-0 max-w-3xl flex-col justify-center overflow-hidden", height, align].join(" ");
  }
  return ["mx-auto flex min-w-0 flex-col justify-center overflow-hidden", height, width, align].join(" ");
}

function ProfileBlock({
  config,
  publicSlug,
  selectedElement,
  onSelectElement
}: {
  config: PageConfig;
  publicSlug?: string;
  selectedElement?: PreviewSelection;
  onSelectElement?: (element: PreviewSelection) => void;
}) {
  const size = profileSizeClasses[config.profile.profileSize];
  const accent = accentClasses[config.theme.accent];
  const avatarShape = config.profile.avatarStyle === "blob" ? "rounded-[38%_62%_52%_48%/45%_42%_58%_55%]" : "rounded-full";

  return (
    <div className="mb-8 max-w-2xl overflow-hidden">
      {config.profile.avatarStyle !== "hidden" ? (
        <div
          className={[
            "mb-5 inline-flex items-center justify-center overflow-hidden border border-white/20 bg-white/15 font-black shadow-2xl backdrop-blur transition",
            size.avatar,
            avatarShape,
            accent.ring,
            "ring-4",
            selectionClass(selectedElement === "title")
          ].join(" ")}
          onClick={(event) => {
            if (!onSelectElement) return;
            event.stopPropagation();
            onSelectElement("title");
          }}
        >
          {config.profile.avatarUrl ? (
            <img alt="Profile avatar" className="h-full w-full object-cover" src={config.profile.avatarUrl} />
          ) : config.profile.displayName.slice(0, 1).toUpperCase()}
        </div>
      ) : null}
      <p className="mb-3 text-xs uppercase tracking-[0.35em] opacity-70">linkqt.me/{publicSlug ?? config.slug}</p>
      <h1
        className={[
          "break-words rounded-2xl font-black leading-none transition",
          size.title,
          fontClasses[config.profile.titleFont ?? config.theme.font],
          titleTreatmentClass(config.profile.titleTreatment),
          selectionClass(selectedElement === "title")
        ].join(" ")}
        onClick={(event) => {
          if (!onSelectElement) return;
          event.stopPropagation();
          onSelectElement("title");
        }}
      >
        {config.profile.displayName}
      </h1>
      <p
        className={[
          "mt-5 max-w-xl break-words rounded-2xl leading-7 transition",
          size.bio,
          fontClasses[config.profile.bioFont ?? config.theme.font],
          bioTreatmentClass(config.profile.bioTreatment),
          selectionClass(selectedElement === "bio")
        ].join(" ")}
        onClick={(event) => {
          if (!onSelectElement) return;
          event.stopPropagation();
          onSelectElement("bio");
        }}
      >
        {config.profile.bio}
      </p>
    </div>
  );
}

function selectionClass(selected: boolean) {
  return selected ? "ring-2 ring-fuchsia-300 ring-offset-2 ring-offset-black/60" : "";
}

function titleTreatmentClass(treatment: PageConfig["profile"]["titleTreatment"] = "normal") {
  if (treatment === "wide") return "tracking-[0.12em] uppercase";
  if (treatment === "tight") return "tracking-[-0.12em] scale-x-95 origin-left";
  if (treatment === "gradient") return "bg-gradient-to-r from-current via-white to-current bg-clip-text text-transparent drop-shadow";
  if (treatment === "outline") return "text-transparent [-webkit-text-stroke:1px_currentColor]";
  return "";
}

function bioTreatmentClass(treatment: PageConfig["profile"]["bioTreatment"] = "normal") {
  if (treatment === "muted") return "opacity-60";
  if (treatment === "card") return "rounded-2xl border border-white/15 bg-white/10 px-4 py-3 opacity-90 backdrop-blur";
  if (treatment === "caps") return "text-xs font-bold uppercase tracking-[0.25em] opacity-75";
  return "opacity-80";
}

function getFeaturedClass(config: PageConfig) {
  const accent = accentClasses[config.theme.accent];
  if (config.emphasis.featuredStyle === "larger") return "scale-[1.04]";
  if (config.emphasis.featuredStyle === "top-card") return `scale-[1.03] ring-4 ${accent.ring}`;
  if (config.emphasis.featuredStyle === "badge") return `ring-2 ${accent.ring}`;
  if (config.emphasis.featuredStyle === "glow") return `ring-2 ${accent.ring} ${accent.glow}`;
  return "";
}
