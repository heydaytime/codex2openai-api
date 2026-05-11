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
  selectedElement,
  onSelectElement
}: {
  config: PageConfig;
  fit?: boolean;
  selectedElement?: PreviewSelection;
  onSelectElement?: (element: PreviewSelection) => void;
}) {
  const accent = accentClasses[config.theme.accent];
  const shellClass = [
    "relative w-full min-w-0 overflow-hidden rounded-[2rem] border border-white/10 shadow-2xl [contain:layout_paint]",
    fit ? "h-full" : "h-[720px] max-h-[80vh] min-h-[560px]",
    backgroundClasses[config.theme.background],
    textClasses[config.theme.text],
    fontClasses[config.theme.font],
    paddingClasses[config.layout.padding ?? "normal"]
  ].join(" ");

  const contentClass = getContentClass(config);
  const customBackgroundStyle = getCustomBackgroundStyle(config);
  const customTypographyStyle = getCustomTypographyStyle(config);

  return (
    <section
      className={[
        shellClass,
        onSelectElement ? "cursor-pointer" : ""
      ].join(" ")}
      onClick={() => onSelectElement?.("page")}
      style={{ ...customBackgroundStyle, ...customTypographyStyle }}
    >
      <CreativeScene config={config} />
      <div className="relative z-10 h-full min-w-0 overflow-hidden">
        <div
          className={[contentClass, "rounded-[2rem] transition", selectionClass(selectedElement === "layout")].join(" ")}
          onClick={(event) => {
            if (!onSelectElement) return;
            event.stopPropagation();
            onSelectElement("layout");
          }}
        >
          <ProfileBlock config={config} onSelectElement={onSelectElement} selectedElement={selectedElement} />
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
                    (link.style?.animation ?? config.linkStyle.animation) === "lift" ? "hover:-translate-y-1" : "",
                    (link.style?.animation ?? config.linkStyle.animation) === "pulse-featured" && featured ? "animate-pulse" : "",
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

function getContentClass(config: PageConfig) {
  const width = widthClasses[config.layout.width];
  const align = config.layout.alignment === "center" ? "items-center text-center" : "items-start text-left";

  if (config.layout.preset === "split-hero") {
    return "mx-auto grid h-full min-w-0 max-w-5xl items-center gap-8 overflow-hidden md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]";
  }
  if (config.layout.preset === "poster-card") {
    return ["mx-auto flex h-full min-w-0 flex-col justify-center overflow-hidden rounded-[2rem] border p-6", width, surfaceClasses[config.theme.surface]].join(" ");
  }
  if (config.layout.preset === "compact") {
    return ["mx-auto flex h-full min-w-0 flex-col justify-center overflow-hidden", width, align].join(" ");
  }
  if (config.layout.preset === "bold-banner") {
    return ["mx-auto flex h-full min-w-0 max-w-3xl flex-col justify-center overflow-hidden", align].join(" ");
  }
  return ["mx-auto flex h-full min-w-0 flex-col justify-center overflow-hidden", width, align].join(" ");
}

function ProfileBlock({
  config,
  selectedElement,
  onSelectElement
}: {
  config: PageConfig;
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
      <p className="mb-3 text-xs uppercase tracking-[0.35em] opacity-70">linkqt.me/{config.slug}</p>
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
