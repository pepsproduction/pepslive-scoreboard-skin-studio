export const STYLE_TAGS = ["Minimal", "Broadcast", "Premium", "Neon", "Glass", "Local", "Tournament", "Social", "Compact", "Large"];
export const LIST_FILTERS = ["All", "Favorites", "Recently Used"];
export const SAFE_AREA_MODES = ["Off", "16:9 Safe Area", "9:16 Safe Area", "YouTube Safe Area", "Facebook Live Safe Area", "OBS Corner Guide"];
export const BACKGROUND_MODES = [
  "Transparent Grid",
  "Football Field",
  "Basketball Court",
  "Dark Camera",
  "Bright Camera",
  "Crowd Scene",
  "Studio Dark"
];

export const ANIMATION_PRESETS = ["none", "fade", "slide-left", "slide-top", "pop-bounce", "smooth-broadcast", "neon-pulse", "glass-reveal"];

export const SLOT_INSPECTOR_MODES = ["Off", "Core Slots", "All Slots"];
export const VISUAL_QA_MODES = ["Off", "Slot Grid", "Contrast Boost", "Overflow Check"];

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function safeJsonParse(raw, fallback) {
  if (!raw) {
    return fallback;
  }
  try {
    return JSON.parse(raw);
  } catch (_error) {
    return fallback;
  }
}

export function setButtonGroupActive(container, value) {
  if (!container) {
    return;
  }
  const buttons = container.querySelectorAll("[data-value]");
  buttons.forEach((button) => {
    const active = button.dataset.value === value;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

export function getProjectBasePath() {
  const path = window.location.pathname;
  if (path.endsWith("/")) {
    return path;
  }
  const lastSlash = path.lastIndexOf("/");
  return lastSlash >= 0 ? path.slice(0, lastSlash + 1) : "/";
}

export function getProjectRootPath() {
  const path = window.location.pathname || "/";
  const markers = ["/overlays/", "/src/", "/styles/", "/templates/", "/data/"];
  const markerIndex = markers
    .map((marker) => path.indexOf(marker))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)[0];

  if (markerIndex >= 0) {
    return `${path.slice(0, markerIndex + 1)}`;
  }

  const cleaned = path.endsWith("/") ? path : path.slice(0, path.lastIndexOf("/") + 1);
  return cleaned || "/";
}

export function stringifyTheme(theme) {
  return encodeURIComponent(JSON.stringify(theme));
}

export function parseThemeString(value) {
  if (!value) {
    return null;
  }
  try {
    return JSON.parse(decodeURIComponent(value));
  } catch (_error) {
    return null;
  }
}

export function generateOverlayUrl({
  skinId,
  type,
  animationStyle,
  theme,
  cacheBust = true,
  absolute = true,
  debug = false,
  stateKey = ""
}) {
  const overlayFile = type === "summary" ? "overlays/summary.html" : "overlays/live.html";
  const basePath = getProjectRootPath();
  const url = new URL(`${basePath}${overlayFile}`, window.location.href);
  url.searchParams.set("skin", skinId);

  if (animationStyle) {
    url.searchParams.set("animation", animationStyle);
  }

  if (theme && Object.keys(theme).length > 0) {
    url.searchParams.set("theme", stringifyTheme(theme));
  }

  if (debug) {
    url.searchParams.set("debug", "1");
  }

  if (stateKey) {
    url.searchParams.set("stateKey", stateKey);
  }

  if (cacheBust) {
    url.searchParams.set("v", `${Date.now()}`);
  }

  if (absolute) {
    return url.toString();
  }

  return `${url.pathname}${url.search}`;
}

export function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function nowIso() {
  return new Date().toISOString();
}
