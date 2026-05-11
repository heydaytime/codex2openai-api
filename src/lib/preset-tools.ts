import type { AiToolCall } from "./page-config";

export type PresetTool = {
  id: string;
  title: string;
  description: string;
  tags: string[];
  operations: AiToolCall[];
};

export type PresetSearchResult = Pick<PresetTool, "id" | "title" | "description" | "tags"> & {
  score: number;
};

const backgroundStyles = [
  ["electric-rainbow-burst", "Electric Rainbow Burst", "Explodes the page into an RGB club-light background with overlapping red, blue, green, and violet radial glows. Great for chaotic colorful prompts, dice-roll color changes, streamer vibes, and loud experimental pages.", ["rgb", "rainbow", "colorful", "club", "neon", "random"], "#080014", "radial-gradient(circle at 12% 18%, rgba(255,0,102,.95), transparent 28%), radial-gradient(circle at 82% 12%, rgba(0,255,204,.9), transparent 26%), radial-gradient(circle at 65% 88%, rgba(68,0,255,.9), transparent 30%), linear-gradient(135deg, #080014 0%, #110033 45%, #001a24 100%)", "cyberpunk", "cyan"],
  ["starry-founder-night", "Starry Founder Night", "Sets a polished dark navy background with subtle star-like speckles and a calm executive glow. Works for founder, investor, SaaS, launch, and professional night-mode pages that still need atmosphere.", ["founder", "investor", "starry", "professional", "dark", "saas"], "#050816", "radial-gradient(circle at 50% -10%, rgba(96,165,250,.32), transparent 36%), radial-gradient(circle at 20% 25%, rgba(255,255,255,.18) 0 1px, transparent 1px), linear-gradient(180deg, #050816 0%, #0b1020 55%, #020617 100%)", "minimal", "blue"],
  ["sunset-product-launch", "Sunset Product Launch", "Creates a warm premium launch backdrop with orange, rose, and violet gradients that feels optimistic and high-conversion. Best for launches, makers, indie hackers, product drops, and announcement pages.", ["launch", "sunset", "warm", "product", "maker", "optimistic"], "#251003", "radial-gradient(circle at 25% 18%, rgba(251,146,60,.85), transparent 34%), radial-gradient(circle at 75% 20%, rgba(236,72,153,.65), transparent 30%), linear-gradient(145deg, #251003 0%, #4a044e 48%, #111827 100%)", "warm", "orange"],
  ["mint-clean-room", "Mint Clean Room", "Turns the page into a clean airy mint-and-white gradient with soft product-design energy. Useful for wellness, coaching, productivity, health, and simple professional pages that should feel fresh.", ["clean", "mint", "fresh", "wellness", "professional", "bright"], "#ecfdf5", "linear-gradient(145deg, #ecfdf5 0%, #dbeafe 48%, #ffffff 100%)", "clean", "green"],
  ["purple-vaporwave-mist", "Purple Vaporwave Mist", "Adds a saturated vaporwave fog of purple, magenta, and electric blue with a nostalgic internet-art feel. Good for DJs, artists, gaming profiles, synthwave, and dreamy late-night brands.", ["vaporwave", "purple", "synthwave", "artist", "gaming", "retro"], "#120022", "radial-gradient(circle at 28% 22%, rgba(217,70,239,.72), transparent 34%), radial-gradient(circle at 75% 72%, rgba(59,130,246,.62), transparent 35%), linear-gradient(135deg, #120022 0%, #312e81 52%, #020617 100%)", "cosmic", "purple"],
  ["black-gold-luxury", "Black Gold Luxury", "Creates a black and brushed-gold luxury atmosphere with a quiet spotlight. Strong for premium creators, consultants, high-ticket services, fashion, rap, luxury merch, and VIP pages.", ["luxury", "black", "gold", "premium", "vip", "rapper"], "#030303", "radial-gradient(circle at 50% 0%, rgba(250,204,21,.35), transparent 28%), linear-gradient(160deg, #030303 0%, #14110a 48%, #000000 100%)", "luxury", "gold"],
  ["ocean-glass-depth", "Ocean Glass Depth", "Applies a deep ocean-blue glassy gradient with cyan light falling through water. Ideal for calm portfolios, travel, photography, ambient music, ocean themes, and polished creator pages.", ["ocean", "blue", "glass", "calm", "travel", "ambient"], "#02111f", "radial-gradient(circle at 50% 0%, rgba(34,211,238,.4), transparent 33%), linear-gradient(180deg, #042f4b 0%, #02111f 55%, #000814 100%)", "dark", "cyan"],
  ["cream-editorial-paper", "Cream Editorial Paper", "Gives the page a warm cream editorial-paper look that feels human, literary, and sophisticated. Best for writers, founders with taste, designers, newsletters, and portfolio pages that should not feel techy.", ["cream", "editorial", "paper", "writer", "newsletter", "warm"], "#fff7ed", "linear-gradient(135deg, #fff7ed 0%, #fffbeb 48%, #fef3c7 100%)", "clean", "gold"],
  ["pink-pop-candy", "Pink Pop Candy", "Makes a bright candy-pink pop background with playful bubblegum energy. Great for Gen Z creators, beauty, lifestyle, playful shops, colorful personal brands, and fun social pages.", ["pink", "pop", "candy", "playful", "beauty", "genz"], "#500724", "radial-gradient(circle at 20% 18%, rgba(244,114,182,.9), transparent 31%), radial-gradient(circle at 82% 80%, rgba(251,207,232,.7), transparent 28%), linear-gradient(140deg, #500724 0%, #be185d 55%, #f9a8d4 100%)", "playful", "fuchsia"],
  ["forest-morning-fog", "Forest Morning Fog", "Creates a deep green forest gradient with misty light, grounded and organic without becoming dull. Useful for outdoor creators, sustainability, wellness, nature brands, coffee, and calm personal pages.", ["forest", "green", "nature", "wellness", "organic", "mist"], "#052e16", "radial-gradient(circle at 55% 0%, rgba(187,247,208,.28), transparent 30%), linear-gradient(180deg, #064e3b 0%, #052e16 58%, #020617 100%)", "warm", "green"],
  ["fire-neon-ember", "Fire Neon Ember", "Adds a dark ember background with orange and red neon heat around the edges. Strong for bold music pages, gyms, spicy launches, intense creators, nightlife, and high-energy brands.", ["fire", "ember", "orange", "red", "music", "bold"], "#120600", "radial-gradient(circle at 25% 80%, rgba(239,68,68,.75), transparent 30%), radial-gradient(circle at 75% 25%, rgba(249,115,22,.65), transparent 28%), linear-gradient(145deg, #120600 0%, #2b0505 55%, #020617 100%)", "dark", "orange"],
  ["soft-blue-recruiter", "Soft Blue Recruiter", "Applies a restrained soft-blue professional gradient that feels trustworthy and clear. Ideal for resumes, recruiter pages, consultants, engineers, students, and people who want clean credibility.", ["recruiter", "professional", "blue", "trust", "resume", "clean"], "#eff6ff", "linear-gradient(145deg, #eff6ff 0%, #dbeafe 52%, #ffffff 100%)", "minimal", "blue"],
  ["cyber-grid-terminal", "Cyber Grid Terminal", "Switches to a dark cyber grid energy with cyan and fuchsia lighting, like a club terminal interface. Useful for techno, AI, hacker, cyberpunk, DJ, and futuristic prompts.", ["cyberpunk", "grid", "terminal", "hacker", "dj", "future"], "#030014", "linear-gradient(rgba(34,211,238,.14) 1px, transparent 1px), linear-gradient(90deg, rgba(217,70,239,.12) 1px, transparent 1px), radial-gradient(circle at 50% 0%, rgba(34,211,238,.28), transparent 32%)", "cyberpunk", "cyan"],
  ["white-minimal-gallery", "White Minimal Gallery", "Turns the page into a crisp white gallery wall with almost no visual noise. Best for luxury minimalists, architects, designers, photographers, portfolios, and professional pages that need restraint.", ["white", "minimal", "gallery", "portfolio", "designer", "clean"], "#ffffff", "linear-gradient(145deg, #ffffff 0%, #f8fafc 50%, #eef2ff 100%)", "minimal", "mono"],
  ["cosmic-ultraviolet", "Cosmic Ultraviolet", "Adds a rich ultraviolet cosmic field with a glowing center and deep-space edges. Great for mystical creators, astrology, music, art, gaming, and pages that should feel otherworldly.", ["cosmic", "ultraviolet", "space", "mystic", "artist", "glow"], "#120020", "radial-gradient(circle at 50% 35%, rgba(168,85,247,.72), transparent 30%), radial-gradient(circle at 72% 76%, rgba(14,165,233,.42), transparent 26%), linear-gradient(180deg, #120020 0%, #1e1b4b 55%, #020617 100%)", "cosmic", "purple"],
  ["retro-orange-computer", "Retro Orange Computer", "Creates a nostalgic orange-and-brown early-computer gradient with warm terminal charm. Works for retro apps, indie hackers, makers, vintage music, zines, and playful tech pages.", ["retro", "orange", "computer", "maker", "vintage", "indie"], "#2a1200", "radial-gradient(circle at 20% 15%, rgba(251,146,60,.62), transparent 31%), linear-gradient(135deg, #2a1200 0%, #78350f 50%, #111827 100%)", "warm", "orange"]
] as const;

const sceneStyles = [
  ["floating-money-rain", "Floating Money Rain", "Drops animated money symbols through the background for flex, sales, business wins, and celebratory revenue pages. The motion is light and playful rather than cluttered.", ["money", "rain", "sales", "business", "celebration", "cash"], "💸"],
  ["music-notes-drift", "Music Notes Drift", "Adds drifting music notes that float diagonally behind the links, perfect for artists, Spotify pages, producers, DJs, and song launch pages.", ["music", "notes", "spotify", "artist", "producer", "dj"], "♪"],
  ["heart-bubble-float", "Heart Bubble Float", "Sends soft hearts upward in the background for romantic, cute, creator, beauty, and fan-community pages. The scene feels affectionate without overpowering the content.", ["hearts", "cute", "love", "beauty", "fan", "soft"], "♥"],
  ["star-sparkle-field", "Star Sparkle Field", "Places animated sparkles around the page that slowly pulse and float, making the background pop for magical, celebratory, and creator-brand prompts.", ["sparkle", "stars", "magic", "celebration", "pop", "glitter"], "✦"],
  ["rocket-launch-path", "Rocket Launch Path", "Adds a small rocket flying upward with trailing stars, ideal for launches, startup founders, product announcements, and ambitious portfolio pages.", ["rocket", "startup", "launch", "founder", "growth", "space"], "🚀"],
  ["clouds-slow-drift", "Clouds Slow Drift", "Adds soft drifting clouds for a dreamy, calm, sky-like background. Useful for wellness, ambient music, cozy creators, and soft pastel pages.", ["clouds", "dreamy", "calm", "sky", "soft", "float"], "☁"],
  ["confetti-party-pop", "Confetti Party Pop", "Scatters animated confetti across the background for birthday, drop, launch, celebration, and party prompts. It adds movement and excitement without changing links.", ["confetti", "party", "birthday", "launch", "celebration", "fun"], "◆"],
  ["butterfly-garden-flight", "Butterfly Garden Flight", "Adds gentle butterflies floating across the page for garden, beauty, nature, soft feminine, and spring-themed pages.", ["butterfly", "garden", "spring", "nature", "beauty", "soft"], "🦋"],
  ["lightning-cyber-strikes", "Lightning Cyber Strikes", "Adds sharp neon lightning text shapes that flash and slide in the background, great for energetic music, esports, cyberpunk, and dramatic pages.", ["lightning", "neon", "cyberpunk", "energy", "esports", "dramatic"], "⚡"],
  ["ufo-night-scan", "UFO Night Scan", "Adds a playful UFO drifting across the top with tiny star pulses, ideal for weird internet, alien, cosmic, gaming, and meme creator pages.", ["ufo", "alien", "cosmic", "weird", "gaming", "fun"], "🛸"]
] as const;

const fullKits = [
  ["clean-founder-investor-kit", "Clean Founder Investor Kit", "Applies a credible investor-ready visual system: clean background, modern font, soft links, restrained blue accent, and a concise founder bio direction. Best when the user asks to look professional, fundable, or trustworthy.", ["founder", "investor", "professional", "clean", "saas", "trust"], "white", "minimal", "blue", "modern", "soft", "soft"],
  ["neon-spotify-artist-kit", "Neon Spotify Artist Kit", "Creates a neon music landing page with cyberpunk colors, mono typography, glowing buttons, and Spotify-friendly emphasis. Best for musicians, DJs, producers, techno, rave, and release pages.", ["spotify", "music", "neon", "artist", "dj", "cyberpunk"], "cyber-grid", "cyberpunk", "cyan", "mono", "glass", "glow"],
  ["luxury-rapper-merch-kit", "Luxury Rapper Merch Kit", "Builds a black-and-gold luxury performer page with bold typography, premium surfaces, and strong button depth. Great for rappers, merch drops, VIP links, nightlife, and expensive-feeling brands.", ["rapper", "luxury", "merch", "gold", "vip", "bold"], "black", "luxury", "gold", "bold", "solid", "strong"],
  ["soft-wellness-coach-kit", "Soft Wellness Coach Kit", "Applies a calm wellness look with gentle color, rounded buttons, airy spacing, and warm approachable typography. Best for coaches, therapists, yoga, nutrition, creators, and health pages.", ["wellness", "coach", "calm", "soft", "health", "warm"], "cream", "warm", "green", "rounded", "soft", "soft"],
  ["playful-gen-z-creator-kit", "Playful Gen Z Creator Kit", "Turns the page into a bright playful creator profile with pink pop energy, rounded type, pill buttons, and animated lift. Great for lifestyle, TikTok, beauty, social, and colorful personal brands.", ["genz", "creator", "playful", "pink", "social", "colorful"], "pink-pop", "playful", "fuchsia", "rounded", "glass", "glow"],
  ["minimal-resume-recruiter-kit", "Minimal Resume Recruiter Kit", "Creates a restrained recruiter-friendly page with white background, dark text, modern typography, compact spacing, and soft links. Best for job seekers, engineers, students, consultants, and portfolios.", ["resume", "recruiter", "minimal", "job", "engineer", "portfolio"], "white", "minimal", "blue", "modern", "soft", "soft"],
  ["cosmic-streamer-gaming-kit", "Cosmic Streamer Gaming Kit", "Applies a deep cosmic streamer aesthetic with purple accents, glowing card surfaces, bold type, and hover lift. Great for gaming, Twitch, Discord, YouTube, and internet personality pages.", ["streamer", "gaming", "cosmic", "twitch", "discord", "purple"], "purple-radial", "cosmic", "purple", "bold", "glass", "glow"],
  ["editorial-writer-newsletter-kit", "Editorial Writer Newsletter Kit", "Sets a warm editorial newsletter aesthetic with cream background, serif-like editorial typography, paper surfaces, and polished understated links. Best for writers, journalists, essays, newsletters, and thought leaders.", ["writer", "newsletter", "editorial", "essays", "paper", "thought-leader"], "cream", "clean", "gold", "editorial", "soft", "soft"]
] as const;

const linkLooks = [
  ["glass-pill-hover-links", "Glass Pill Hover Links", "Makes every link feel like a translucent glass pill with lift animation and soft glow, useful for modern creator pages that should feel polished and tappable.", ["links", "glass", "pill", "hover", "modern", "creator"], "pill", "glass", "md", "glow", "lift"],
  ["bold-square-brutalist-links", "Bold Square Brutalist Links", "Changes links into square solid blocks with strong shadow for a blunt, poster-like, underground, editorial, or brutalist look.", ["links", "brutalist", "square", "bold", "poster", "solid"], "square", "solid", "lg", "strong", "none"],
  ["soft-rounded-professional-links", "Soft Rounded Professional Links", "Applies rounded soft links with subtle shadow, ideal for professional, founder, recruiter, coaching, and clean personal pages.", ["links", "professional", "soft", "rounded", "clean", "subtle"], "rounded", "soft", "md", "soft", "lift"],
  ["tiny-compact-utility-links", "Tiny Compact Utility Links", "Shrinks links into compact tight controls for dense pages, utility dashboards, simple link lists, and requests to make buttons smaller.", ["links", "compact", "small", "tight", "utility", "minimal"], "rounded", "outline", "sm", "none", "none"],
  ["large-featured-cta-links", "Large Featured CTA Links", "Makes links larger with strong depth and motion so important calls-to-action feel obvious. Good for sales pages, launches, merch, tickets, and lead magnets.", ["links", "cta", "large", "sales", "launch", "standout"], "pill", "solid", "lg", "strong", "pulse-featured"],
  ["neon-outline-links", "Neon Outline Links", "Creates outlined links with glow and lift animation, matching cyberpunk, music, rave, gamer, and RGB prompts without needing custom CSS.", ["links", "neon", "outline", "glow", "music", "rgb"], "pill", "outline", "md", "glow", "lift"]
] as const;

const dynamicBackgroundMotions: PresetTool[] = [
  {
    id: "dynamic-aurora-background-motion",
    title: "Dynamic Aurora Background Motion",
    description: "Makes a static page background feel alive with a slow safe aurora drift: soft cyan, magenta, and gold light clouds move behind the profile and links. Use for animated background, dynamic CSS, moving background, living gradient, aurora, dreamy motion, make the page less static, add subtle background animation, or ambient motion prompts.",
    tags: ["dynamic", "animated background", "moving gradient", "aurora", "ambient", "motion", "css", "safe"],
    operations: [{ tool: "change_background_motion", args: { preset: "aurora-drift", intensity: "medium", speed: "slow" } }]
  },
  {
    id: "slow-gradient-shift-background-motion",
    title: "Slow Gradient Shift Background Motion",
    description: "Animates the current gradient background by slowly shifting its position so the page changes gently over time without adding clutter. Best for make background dynamic, animated gradient, color flow, gradient movement, subtle CSS animation, modern creator page motion, and non-distracting movement requests.",
    tags: ["gradient", "animated gradient", "shift", "background motion", "subtle", "dynamic", "color flow"],
    operations: [{ tool: "change_background_motion", args: { preset: "slow-gradient-shift", intensity: "subtle", speed: "slow" } }]
  },
  {
    id: "spotlight-pan-background-motion",
    title: "Spotlight Pan Background Motion",
    description: "Adds a safe CSS spotlight that slowly pans across the page, creating stage lighting and premium movement while keeping links readable. Use for spotlight, stage, luxury motion, performer page, dynamic lighting, hoverless page motion, cinematic background, and make it feel more alive prompts.",
    tags: ["spotlight", "stage", "cinematic", "lighting", "premium", "performer", "dynamic background"],
    operations: [{ tool: "change_background_motion", args: { preset: "spotlight-pan", intensity: "medium", speed: "normal" } }]
  },
  {
    id: "twinkling-stars-background-motion",
    title: "Twinkling Stars Background Motion",
    description: "Turns static starry or dark pages into a lightly twinkling animated background with safe CSS sparkle movement. Best for starry sky, space, cosmic, night, magical, twinkle, animated stars, background sparkle, dreamy creator, and gaming profile prompts.",
    tags: ["stars", "twinkle", "space", "cosmic", "sparkle", "night", "animated background"],
    operations: [{ tool: "change_background_motion", args: { preset: "star-twinkle", intensity: "medium", speed: "slow" } }]
  }
];

const dynamicLinkMotions: PresetTool[] = [
  {
    id: "hover-shine-link-motion",
    title: "Hover Shine Link Motion",
    description: "Adds a glossy shine sweep when users hover over links, making buttons feel interactive, polished, clickable, and premium without raw CSS. Use for hover effect, shine on hover, dynamic buttons, interactive links, glossy CTA, button shimmer, safe CSS hover animation, and make links do something on hover prompts.",
    tags: ["hover", "shine", "links", "buttons", "interactive", "cta", "dynamic css", "shimmer"],
    operations: [{ tool: "change_link_appearance", args: { animation: "hover-shine" } }]
  },
  {
    id: "hover-tilt-link-motion",
    title: "Hover Tilt Link Motion",
    description: "Makes links gently lift, rotate, and scale on hover so the page feels tactile and responsive. Great for hover animation, buttons move on hover, playful links, interactive profile, dynamic CSS transform, creator page motion, and make it less static requests.",
    tags: ["hover", "tilt", "lift", "scale", "interactive", "links", "motion", "buttons"],
    operations: [{ tool: "change_link_appearance", args: { animation: "hover-tilt" } }]
  },
  {
    id: "press-pop-link-motion",
    title: "Press Pop Link Motion",
    description: "Adds responsive press and tap feedback so links compress slightly when clicked and pop on hover, improving mobile and desktop interactivity. Use for tap feedback, press animation, tactile buttons, mobile-friendly motion, interactive links, button response, and safe dynamic CSS prompts.",
    tags: ["press", "tap", "pop", "mobile", "feedback", "interactive", "links", "buttons"],
    operations: [{ tool: "change_link_appearance", args: { animation: "press-pop" } }]
  },
  {
    id: "featured-wiggle-link-motion",
    title: "Featured Wiggle Link Motion",
    description: "Gives only featured links a small repeating wiggle so an important CTA catches attention without shaking every button. Best for feature my merch, make one link move, animated CTA, draw attention, important link, buy button wiggle, and non-redundant featured motion prompts.",
    tags: ["featured", "wiggle", "cta", "attention", "merch", "important link", "animation"],
    operations: [{ tool: "change_link_appearance", args: { animation: "wiggle-featured" } }]
  }
];

const outcomeKits: PresetTool[] = [
  {
    id: "sell-more-products-cta-kit",
    title: "Sell More Products CTA Kit",
    description: "Conversion-focused shop and merch styling with warm color, bigger tappable links, strong CTA depth, and friendly sales energy. Use for sell more, make merch pop, product drop, shop link, store, buy, and conversion prompts. Pair with feature_link or change_individual_link_style for the exact merch/shop link.",
    tags: ["sales", "shop", "merch", "product", "cta", "conversion", "buy"],
    operations: [
      { tool: "change_background", args: { preset: "warm-gradient" } },
      { tool: "change_theme", args: { mood: "warm", accent: "orange", surface: "paper", text: "dark" } },
      { tool: "change_link_appearance", args: { shape: "pill", fill: "solid", size: "lg", shadow: "strong", animation: "pulse-featured" } },
      { tool: "change_layout", args: { spacing: "normal", padding: "roomy", width: "medium" } }
    ]
  },
  {
    id: "booking-consultation-cta-kit",
    title: "Booking Consultation CTA Kit",
    description: "Trustworthy client-booking page styling for coaches, consultants, freelancers, agencies, calls, Calendly, and booking links. Makes the page credible, calm, and conversion-oriented. Pair with feature_link for booking or call links.",
    tags: ["booking", "consultation", "clients", "call", "calendar", "trust", "professional"],
    operations: [
      { tool: "change_background", args: { preset: "soft-blue" } },
      { tool: "change_theme", args: { mood: "minimal", accent: "blue", surface: "paper", text: "dark" } },
      { tool: "change_typography", args: { font: "modern" } },
      { tool: "change_link_appearance", args: { shape: "rounded", fill: "soft", size: "lg", shadow: "soft", animation: "lift" } },
      { tool: "change_layout", args: { spacing: "airy", padding: "roomy", width: "medium" } }
    ]
  },
  {
    id: "newsletter-signup-cta-kit",
    title: "Newsletter Signup CTA Kit",
    description: "Editorial signup-focused layout for newsletters, essays, Substack, writing, email list growth, and thought leadership. Warm paper styling with elegant title and readable description.",
    tags: ["newsletter", "substack", "email", "signup", "writer", "essays", "list"],
    operations: [
      { tool: "change_background", args: { preset: "cream" } },
      { tool: "change_theme", args: { mood: "clean", accent: "gold", surface: "paper", text: "dark" } },
      { tool: "change_profile", args: { titleFont: "elegant", bioFont: "serif", titleTreatment: "tight", bioTreatment: "card" } },
      { tool: "change_link_appearance", args: { shape: "rounded", fill: "soft", size: "md", shadow: "soft", animation: "lift" } }
    ]
  },
  {
    id: "drive-music-streams-kit",
    title: "Drive Music Streams Kit",
    description: "Music streaming conversion kit for Spotify, Apple Music, SoundCloud, release, album, DJ, producer, and artist pages. Neon glow plus music motion to push listening links.",
    tags: ["music", "spotify", "stream", "release", "album", "artist", "producer", "dj"],
    operations: [
      { tool: "change_background", args: { preset: "cyber-grid" } },
      { tool: "change_theme", args: { mood: "cyberpunk", accent: "cyan", surface: "glow-card", text: "light" } },
      { tool: "change_typography", args: { font: "tech" } },
      { tool: "change_link_appearance", args: { shape: "pill", fill: "glass", size: "lg", shadow: "glow", animation: "pulse-featured" } }
    ]
  },
  {
    id: "grow-community-kit",
    title: "Grow Community Kit",
    description: "Community growth kit for Discord, Patreon, memberships, fan clubs, group chats, waitlists, and join prompts. Friendly high-contrast styling with playful but readable energy.",
    tags: ["community", "discord", "patreon", "membership", "fans", "join", "waitlist"],
    operations: [
      { tool: "change_background", args: { preset: "purple-radial" } },
      { tool: "change_theme", args: { mood: "cosmic", accent: "purple", surface: "glass", text: "light" } },
      { tool: "change_profile", args: { titleFont: "display", bioFont: "rounded", titleTreatment: "wide" } },
      { tool: "change_link_appearance", args: { shape: "pill", fill: "glass", size: "md", shadow: "glow", animation: "lift" } }
    ]
  }
];

const repairAndLayoutKits: PresetTool[] = [
  {
    id: "tone-down-clean-readable-kit",
    title: "Tone Down Clean Readable Kit",
    description: "Calms down a page that is too busy, too flashy, too neon, too childish, unreadable, or overwhelming. Removes heavy visual energy and restores clean professional readability.",
    tags: ["tone down", "less flashy", "clean", "readable", "professional", "remove glow", "calm"],
    operations: [
      { tool: "change_background", args: { preset: "white" } },
      { tool: "change_theme", args: { mood: "minimal", accent: "blue", surface: "paper", text: "dark" } },
      { tool: "change_typography", args: { font: "modern", text: "dark" } },
      { tool: "change_link_appearance", args: { shape: "rounded", fill: "soft", size: "md", shadow: "soft", animation: "lift" } },
      { tool: "change_creative_layer", args: { enabled: false, elements: [] } }
    ]
  },
  {
    id: "compact-mobile-link-list-kit",
    title: "Compact Mobile Link List Kit",
    description: "Makes the page tighter and more mobile-friendly with compact spacing, compact padding, smaller links, and a utility link-list feel. Use for too tall, fit more links, compact, dense, dashboard, or mobile prompts.",
    tags: ["compact", "mobile", "tight", "small", "dense", "utility", "fit"],
    operations: [
      { tool: "change_layout", args: { preset: "compact", spacing: "tight", padding: "compact", width: "narrow" } },
      { tool: "change_link_appearance", args: { shape: "rounded", fill: "outline", size: "sm", shadow: "none", animation: "none" } },
      { tool: "change_profile", args: { profileSize: "sm", bioTreatment: "muted" } }
    ]
  },
  {
    id: "wide-landing-page-kit",
    title: "Wide Landing Page Kit",
    description: "Turns the page into a wider landing-page style with more horizontal breathing room, split hero layout, roomy padding, and larger profile presence. Use for landing page, website, hero, wider, or premium homepage prompts.",
    tags: ["landing", "wide", "hero", "website", "homepage", "premium", "spacious"],
    operations: [
      { tool: "change_layout", args: { preset: "split-hero", spacing: "airy", padding: "roomy", width: "wide" } },
      { tool: "change_profile", args: { profileSize: "lg", titleFont: "display", titleTreatment: "tight" } },
      { tool: "change_link_appearance", args: { shape: "rounded", fill: "glass", size: "lg", shadow: "soft", animation: "lift" } }
    ]
  },
  {
    id: "poster-title-stretch-kit",
    title: "Poster Title Stretch Kit",
    description: "Makes the title more stylish like a poster: stretched wide lettering, strong display font, bold banner layout, and punchy links. Good for make title stylish, stretch title, poster, banner, or dramatic heading prompts.",
    tags: ["title", "stretch", "poster", "banner", "heading", "stylish", "display"],
    operations: [
      { tool: "change_layout", args: { preset: "bold-banner", spacing: "normal", padding: "roomy", width: "wide" } },
      { tool: "change_profile", args: { titleFont: "display", bioFont: "modern", titleTreatment: "wide", bioTreatment: "caps" } },
      { tool: "change_link_appearance", args: { shape: "square", fill: "solid", size: "md", shadow: "strong", animation: "lift" } }
    ]
  }
];

const platformKits: PresetTool[] = [
  {
    id: "youtube-creator-kit",
    title: "YouTube Creator Kit",
    description: "Bold red-and-dark creator kit for YouTube channels, latest video, subscribe, vlog, podcast clips, and video creators. Makes video links feel obvious and energetic.",
    tags: ["youtube", "video", "subscribe", "creator", "vlog", "latest video", "clips"],
    operations: [
      { tool: "change_background", args: { preset: "black" } },
      { tool: "change_theme", args: { mood: "dark", accent: "red", surface: "ink", text: "light" } },
      { tool: "change_profile", args: { titleFont: "bold", titleTreatment: "tight" } },
      { tool: "change_link_appearance", args: { shape: "rounded", fill: "solid", size: "lg", shadow: "strong", animation: "pulse-featured" } }
    ]
  },
  {
    id: "tiktok-lifestyle-pop-kit",
    title: "TikTok Lifestyle Pop Kit",
    description: "Bright social creator kit for TikTok, Instagram, beauty, lifestyle, creator storefronts, and playful personal brands. Pink pop, rounded fonts, and highly tappable buttons.",
    tags: ["tiktok", "instagram", "lifestyle", "beauty", "creator", "pink", "social"],
    operations: [
      { tool: "change_background", args: { preset: "pink-pop" } },
      { tool: "change_theme", args: { mood: "playful", accent: "fuchsia", surface: "glass", text: "light" } },
      { tool: "change_profile", args: { titleFont: "rounded", bioFont: "rounded", titleTreatment: "normal" } },
      { tool: "change_link_appearance", args: { shape: "pill", fill: "glass", size: "md", shadow: "glow", animation: "lift" } }
    ]
  },
  {
    id: "event-ticket-kit",
    title: "Event Ticket Kit",
    description: "High-energy event and ticket sales kit for shows, concerts, webinars, parties, popups, RSVP, and get tickets prompts. Prioritizes large CTA links and celebratory styling.",
    tags: ["event", "tickets", "concert", "show", "rsvp", "webinar", "party"],
    operations: [
      { tool: "change_background", args: { preset: "sunset-glow" } },
      { tool: "change_theme", args: { mood: "playful", accent: "orange", surface: "glass", text: "dark" } },
      { tool: "change_link_appearance", args: { shape: "pill", fill: "solid", size: "lg", shadow: "strong", animation: "pulse-featured" } },
      { tool: "change_layout", args: { spacing: "airy", padding: "roomy" } }
    ]
  }
];

function backgroundPreset([id, title, description, tags, backgroundColor, backgroundImage, mood, accent]: (typeof backgroundStyles)[number]): PresetTool {
  return {
    id,
    title,
    description,
    tags: [...tags],
    operations: [
      { tool: "change_background", args: { css: { backgroundColor, backgroundImage, backgroundSize: "cover", backgroundPosition: "center", backgroundRepeat: "no-repeat" } } },
      { tool: "change_theme", args: { mood, accent, surface: mood === "minimal" || mood === "clean" ? "paper" : "glass", text: backgroundColor === "#ffffff" || backgroundColor.startsWith("#e") ? "dark" : "light" } }
    ] as AiToolCall[]
  };
}

function scenePreset([id, title, description, tags, content]: (typeof sceneStyles)[number]): PresetTool {
  const elements = [0, 1, 2, 3, 4].map((index) => ({
    id: `${id}-${index + 1}`,
    kind: "text" as const,
    content,
    color: index % 2 === 0 ? "#ffffff" : "#22d3ee",
    left: -10 + index * 28,
    top: 18 + ((index * 17) % 62),
    width: 6 + (index % 3) * 2,
    height: 6 + (index % 3) * 2,
    opacity: 0.18 + index * 0.08,
    blur: index % 2,
    zIndex: 2,
    animation: {
      durationMs: 7000 + index * 1300,
      delayMs: index * 350,
      easing: "ease-in-out" as const,
      loop: true,
      alternate: true,
      from: { x: -8 + index * 2, y: 18, scale: 0.8, rotate: -10, opacity: 0.15 },
      to: { x: 16 - index * 2, y: -24, scale: 1.35, rotate: 18, opacity: 0.55 }
    }
  }));

  return {
    id,
    title,
    description,
    tags: [...tags],
    operations: [{ tool: "change_creative_layer", args: { enabled: true, elements } }] as AiToolCall[]
  };
}

function fullKitPreset([id, title, description, tags, background, mood, accent, font, fill, shadow]: (typeof fullKits)[number]): PresetTool {
  return {
    id,
    title,
    description,
    tags: [...tags],
    operations: [
      { tool: "change_background", args: { preset: background } },
      { tool: "change_theme", args: { mood, accent, surface: fill === "soft" ? "paper" : "glass", text: background === "white" || background === "cream" ? "dark" : "light" } },
      { tool: "change_typography", args: { font } },
      { tool: "change_link_appearance", args: { shape: id === "minimal-resume-recruiter-kit" ? "pill" : "rounded", fill, size: id === "minimal-resume-recruiter-kit" ? "sm" : "md", shadow, animation: "lift" } },
      ...(id === "minimal-resume-recruiter-kit" ? [{ tool: "change_layout", args: { preset: "compact", spacing: "tight", padding: "compact", width: "medium" } }] as AiToolCall[] : [])
    ] as AiToolCall[]
  };
}

function linkPreset([id, title, description, tags, shape, fill, size, shadow, animation]: (typeof linkLooks)[number]): PresetTool {
  return {
    id,
    title,
    description,
    tags: [...tags],
    operations: [{ tool: "change_link_appearance", args: { shape, fill, size, shadow, animation } }] as AiToolCall[]
  };
}

const generatedColorDicePresets: PresetTool[] = [
  ["dice-roll-rgb-chaos", "Dice Roll RGB Chaos", "Random-feeling colorful RGB makeover with bold neon contrast, glowing links, and a playful unpredictable palette. Use when the user says roll a dice, surprise me, random colors, RGB, or make it colorful.", ["dice", "random", "rgb", "colorful", "surprise", "chaos"]],
  ["maximum-color-pop", "Maximum Color Pop", "A loud color-pop treatment that makes the whole page feel brighter, more saturated, and more fun, while keeping the structure intact. Great for vague prompts like make it pop or add color.", ["pop", "color", "bright", "saturated", "fun", "loud"]],
  ["tasteful-rainbow-clean", "Tasteful Rainbow Clean", "Adds rainbow energy in a cleaner controlled way: colorful background glow, modern font, glass links, and readable high-contrast text. Good when the user wants colorful but not messy.", ["rainbow", "clean", "tasteful", "colorful", "modern", "readable"]],
  ["rgb-gamer-mode", "RGB Gamer Mode", "Switches into RGB gamer lighting with a dark base, cyan and magenta accents, glowing links, and energetic visual contrast. Strong for gaming, streamers, esports, and neon requests.", ["rgb", "gamer", "streamer", "esports", "neon", "dark"]]
  ].map(([id, title, description, tags], index) => ({
  id: id as string,
  title: title as string,
  description: description as string,
  tags: tags as string[],
  operations: [
    { tool: "change_background", args: { css: { backgroundColor: "#070012", backgroundImage: "radial-gradient(circle at 15% 20%, rgba(255,0,102,.9), transparent 30%), radial-gradient(circle at 80% 18%, rgba(0,255,204,.85), transparent 28%), radial-gradient(circle at 60% 85%, rgba(59,130,246,.85), transparent 32%), linear-gradient(135deg, #070012 0%, #18002f 48%, #001f2e 100%)", backgroundSize: "cover", backgroundPosition: "center", backgroundRepeat: "no-repeat" } } },
    { tool: "change_theme", args: { mood: index === 2 ? "playful" : "cyberpunk", accent: index === 1 ? "fuchsia" : index === 2 ? "orange" : "cyan", surface: index === 2 ? "glass" : "glow-card", text: "light" } },
    { tool: "change_profile", args: { titleFont: index === 0 ? "display" : index === 1 ? "bold" : index === 2 ? "rounded" : "tech", titleTreatment: index === 0 ? "wide" : index === 2 ? "normal" : "tight" } },
    { tool: "change_link_appearance", args: { shape: "pill", fill: index === 2 ? "soft" : "glass", size: index === 2 ? "md" : "lg", shadow: "glow", animation: index === 1 ? "pulse-featured" : "lift" } }
  ] as AiToolCall[]
}));

export const presetTools: PresetTool[] = [
  ...backgroundStyles.map(backgroundPreset),
  ...sceneStyles.map(scenePreset),
  ...fullKits.map(fullKitPreset),
  ...linkLooks.map(linkPreset),
  ...dynamicBackgroundMotions,
  ...dynamicLinkMotions,
  ...outcomeKits,
  ...repairAndLayoutKits,
  ...platformKits,
  ...generatedColorDicePresets,
  ...expandVariants()
];

export function findPresetTool(id: string) {
  return presetTools.find((tool) => tool.id === id);
}

function expandVariants(): PresetTool[] {
  const moods = [
    ["punk-zine", "Punk Zine", "rough underground zine energy", "black", "dark", "red", "bold", "square", "solid", "strong"],
    ["calm-portfolio", "Calm Portfolio", "quiet polished portfolio confidence", "soft-blue", "minimal", "blue", "modern", "rounded", "soft", "soft"],
    ["cute-kawaii", "Cute Kawaii", "soft bubbly cute creator energy", "pink-pop", "playful", "fuchsia", "rounded", "pill", "glass", "glow"],
    ["dark-academia", "Dark Academia", "literary old-library sophistication", "black", "luxury", "gold", "editorial", "rounded", "outline", "soft"],
    ["ai-saas", "AI SaaS", "clean artificial-intelligence startup polish", "white", "clean", "cyan", "modern", "rounded", "soft", "soft"],
    ["nightclub", "Nightclub", "late-night club flyer energy", "cyber-grid", "cyberpunk", "fuchsia", "mono", "pill", "glass", "glow"],
    ["earthy-organic", "Earthy Organic", "grounded nature-first warmth", "forest", "warm", "green", "rounded", "rounded", "soft", "soft"],
    ["sunny-optimist", "Sunny Optimist", "bright upbeat friendly personal brand", "warm-gradient", "playful", "orange", "rounded", "pill", "soft", "soft"]
  ] as const;

  const intents = ["creator", "founder", "musician", "coach", "designer", "developer", "shop", "portfolio", "newsletter", "community", "event", "drop", "podcast", "photographer", "fitness", "foodie", "travel", "student", "consultant", "artist"];

  return moods.flatMap(([slug, label, description, background, mood, accent, font, shape, fill, shadow]) =>
    intents.map((intent) => ({
      id: `${slug}-${intent}-preset`,
      title: `${label} ${titleCase(intent)} Preset`,
      description: `A specific ${label.toLowerCase()} visual preset for a ${intent} page, with ${description}, a ${background} background, ${accent} accent, ${font} typography, and ${fill} links. Use when the user asks for ${slug.replaceAll("-", " ")}, ${intent}, vibe changes, full makeovers, or a more opinionated design direction.`,
      tags: [slug, intent, label.toLowerCase(), background, mood, accent, font, fill],
      operations: [
        { tool: "change_background", args: { preset: background } },
        { tool: "change_theme", args: { mood, accent, surface: fill === "glass" ? "glass" : "paper", text: background === "white" || background === "soft-blue" ? "dark" : "light" } },
        { tool: "change_typography", args: { font } },
        { tool: "change_link_appearance", args: { shape, fill, size: intent === "event" || intent === "drop" || intent === "shop" ? "lg" : "md", shadow, animation: intent === "event" || intent === "drop" ? "pulse-featured" : "lift" } },
        ...intentTweaks(intent)
      ] as AiToolCall[]
    }))
  );
}

function intentTweaks(intent: string): AiToolCall[] {
  const map: Record<string, AiToolCall[]> = {
    creator: [{ tool: "change_profile", args: { titleFont: "display", bioFont: "rounded", titleTreatment: "normal" } }],
    founder: [{ tool: "change_layout", args: { spacing: "airy", padding: "roomy", width: "medium" } }, { tool: "change_profile", args: { titleFont: "modern", bioTreatment: "card" } }],
    musician: [{ tool: "change_profile", args: { titleFont: "tech", titleTreatment: "wide" } }],
    coach: [{ tool: "change_profile", args: { titleFont: "rounded", bioFont: "rounded", bioTreatment: "card" } }],
    designer: [{ tool: "change_layout", args: { preset: "poster-card", padding: "roomy", width: "wide" } }, { tool: "change_profile", args: { titleFont: "elegant", titleTreatment: "tight" } }],
    developer: [{ tool: "change_profile", args: { titleFont: "tech", bioFont: "mono" } }],
    shop: [{ tool: "change_layout", args: { spacing: "normal", padding: "roomy" } }, { tool: "change_profile", args: { titleFont: "bold", bioTreatment: "caps" } }],
    portfolio: [{ tool: "change_layout", args: { preset: "split-hero", width: "wide", padding: "roomy" } }],
    newsletter: [{ tool: "change_profile", args: { titleFont: "elegant", bioFont: "serif", bioTreatment: "card" } }],
    community: [{ tool: "change_profile", args: { titleFont: "rounded", titleTreatment: "wide" } }],
    event: [{ tool: "change_layout", args: { spacing: "airy", padding: "roomy" } }, { tool: "change_profile", args: { titleFont: "display", titleTreatment: "wide" } }],
    drop: [{ tool: "change_layout", args: { preset: "bold-banner", padding: "roomy" } }, { tool: "change_profile", args: { titleFont: "bold", titleTreatment: "gradient" } }],
    podcast: [{ tool: "change_profile", args: { titleFont: "condensed", bioFont: "modern", titleTreatment: "tight" } }],
    photographer: [{ tool: "change_layout", args: { preset: "poster-card", spacing: "airy", width: "wide" } }, { tool: "change_profile", args: { titleFont: "serif", bioTreatment: "muted" } }],
    fitness: [{ tool: "change_profile", args: { titleFont: "condensed", titleTreatment: "wide", bioTreatment: "caps" } }],
    foodie: [{ tool: "change_profile", args: { titleFont: "handwritten", bioFont: "serif" } }],
    travel: [{ tool: "change_layout", args: { spacing: "airy", padding: "roomy", width: "wide" } }, { tool: "change_profile", args: { titleFont: "elegant", bioTreatment: "muted" } }],
    student: [{ tool: "change_layout", args: { preset: "compact", spacing: "tight", padding: "compact" } }, { tool: "change_profile", args: { profileSize: "sm", titleFont: "modern" } }],
    consultant: [{ tool: "change_profile", args: { titleFont: "modern", bioTreatment: "card" } }, { tool: "change_layout", args: { spacing: "airy", padding: "roomy" } }],
    artist: [{ tool: "change_profile", args: { titleFont: "display", titleTreatment: "outline", bioFont: "handwritten" } }]
  };

  return map[intent] ?? [];
}

function titleCase(value: string) {
  return value.slice(0, 1).toUpperCase() + value.slice(1);
}
