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

export const DEFAULT_DISPLAY_OPTIONS = {
  eventLogo: true,
  eventName: true,
  teamLogos: true,
  teamLogoPosition: "same-left",
  teamShortNames: true,
  gameClock: true,
  periodLabel: true,
  statusLabel: true,
  extraRow: true,
  textMode: "full"
};

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

export function stringifyDisplayOptions(displayOptions) {
  return JSON.stringify(displayOptions || {});
}

export function parseDisplayOptionsString(value) {
  if (!value) {
    return null;
  }
  try {
    return JSON.parse(value);
  } catch (_error) {
    try {
      return JSON.parse(decodeURIComponent(value));
    } catch (_decodeError) {
      return null;
    }
  }
}

export function generateOverlayUrl({
  skinId,
  type,
  animationStyle,
  theme,
  displayOptions,
  cacheBust = true,
  absolute = true,
  debug = false,
  stateKey = "",
  isolated = false
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

  const hasCustomDisplayOptions =
    displayOptions &&
    Object.entries(displayOptions).some(([key, value]) => DEFAULT_DISPLAY_OPTIONS[key] !== value);
  if (hasCustomDisplayOptions) {
    url.searchParams.set("slots", stringifyDisplayOptions(displayOptions));
  }

  if (debug) {
    url.searchParams.set("debug", "1");
  }

  if (stateKey) {
    url.searchParams.set("stateKey", stateKey);
  }

  if (isolated) {
    url.searchParams.set("isolated", "1");
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

// ---------------------------------------------------------------------------
// Phase 4.3 – Portable State URL
// ---------------------------------------------------------------------------

/** Max byte length for the base64url state param before a warning is issued. */
export const PORTABLE_STATE_SIZE_LIMIT = 4096;

/**
 * Encode a plain-object state into a compact base64url string.
 * Omits undefined/null values and optionally strips the eventLogo data-URL
 * if the resulting payload would exceed PORTABLE_STATE_SIZE_LIMIT.
 *
 * @param {object} stateObj
 * @param {{ includeEventLogo?: boolean }} [opts]
 * @returns {{ encoded: string, size: number, oversized: boolean, dropped: string[] }}
 */
export function encodePortableState(stateObj, { includeEventLogo = false } = {}) {
  const dropped = [];
  const clean = {};
  for (const [key, value] of Object.entries(stateObj)) {
    if (value === undefined || value === null) {
      continue;
    }
    clean[key] = value;
  }

  // Always attempt without eventLogo first to check size
  const withoutLogo = { ...clean };
  delete withoutLogo.eventLogo;

  const jsonWithoutLogo = JSON.stringify(withoutLogo);
  let jsonToEncode = jsonWithoutLogo;

  if (includeEventLogo && clean.eventLogo) {
    const jsonWithLogo = JSON.stringify(clean);
    if (jsonWithLogo.length <= PORTABLE_STATE_SIZE_LIMIT) {
      jsonToEncode = jsonWithLogo;
    } else {
      dropped.push("eventLogo");
    }
  }

  const encoded = btoa(unescape(encodeURIComponent(jsonToEncode)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  return {
    encoded,
    size: encoded.length,
    oversized: encoded.length > PORTABLE_STATE_SIZE_LIMIT,
    dropped
  };
}

/**
 * Decode a base64url portable state string back to a plain object.
 * Returns null (never throws) on any decode/parse failure.
 *
 * @param {string} raw
 * @returns {object|null}
 */
export function decodePortableState(raw) {
  if (!raw || typeof raw !== "string") {
    return null;
  }
  try {
    const base64 = raw.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(escape(atob(base64)));
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    return parsed;
  } catch (_error) {
    return null;
  }
}

/**
 * Generate a "portable" overlay URL that embeds skin/theme/displayOptions in
 * a `state` query parameter so that the overlay works without localStorage.
 *
 * @param {{
 *   skinId: string,
 *   type: string,
 *   sport?: string,
 *   animationStyle?: string,
 *   theme?: object,
 *   displayOptions?: object,
 *   textMode?: string,
 *   teamLogoPosition?: string,
 *   eventLogo?: string,
 *   debug?: boolean,
 *   absolute?: boolean
 * }} opts
 * @returns {{ url: string, warning: string|null }}
 */
export function generatePortableOverlayUrl(opts) {
  const {
    skinId,
    type,
    sport,
    animationStyle,
    theme,
    displayOptions,
    eventLogo,
    debug = false,
    absolute = true
  } = opts;

  const stateObj = {};
  if (skinId) stateObj.skinId = skinId;
  if (sport) stateObj.sport = sport;
  if (type) stateObj.type = type;
  if (animationStyle) stateObj.animation = animationStyle;
  if (theme && Object.keys(theme).length > 0) stateObj.theme = theme;
  if (displayOptions && Object.keys(displayOptions).length > 0) stateObj.displayOptions = displayOptions;
  if (eventLogo) stateObj.eventLogo = eventLogo;

  const { encoded, size, oversized, dropped } = encodePortableState(stateObj, { includeEventLogo: !!eventLogo });

  const overlayFile = type === "summary" ? "overlays/summary.html" : "overlays/live.html";
  const basePath = getProjectRootPath();
  const url = new URL(`${basePath}${overlayFile}`, window.location.href);
  url.searchParams.set("state", encoded);
  if (debug) url.searchParams.set("debug", "1");

  let warning = null;
  if (oversized) {
    warning = `Portable URL state is ${size} chars (limit: ${PORTABLE_STATE_SIZE_LIMIT}). Consider using same-origin localStorage sync instead.`;
  } else if (dropped.length > 0) {
    warning = `Fields dropped from portable state (too large): ${dropped.join(", ")}. Use same-origin sync for full data.`;
  }

  return {
    url: absolute ? url.toString() : `${url.pathname}${url.search}`,
    warning
  };
}

// ---------------------------------------------------------------------------
// Phase 4.4 – Relay Overlay URL
// ---------------------------------------------------------------------------

/**
 * Generate an overlay URL that includes a `?relay=` parameter pointing to a
 * remote JSON state endpoint. The overlay will poll that URL for live updates.
 *
 * Can be combined with `?state=` (portable skin config) so the overlay loads
 * the correct skin immediately while waiting for the first relay poll.
 *
 * @param {{
 *   skinId: string,
 *   type: string,
 *   relayUrl: string,
 *   sport?: string,
 *   animationStyle?: string,
 *   theme?: object,
 *   displayOptions?: object,
 *   debug?: boolean,
 *   absolute?: boolean,
 *   embedPortableState?: boolean
 * }} opts
 * @returns {{ url: string, warning: string|null }}
 */
export function generateRelayOverlayUrl(opts) {
  const {
    skinId,
    type,
    relayUrl,
    sport,
    animationStyle,
    theme,
    displayOptions,
    debug = false,
    absolute = true,
    embedPortableState = true
  } = opts;

  if (!relayUrl) {
    return { url: "", warning: "Relay URL is required." };
  }

  let sanitizedRelay;
  try {
    const parsed = new URL(relayUrl.trim());
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return { url: "", warning: "Relay URL must use http:// or https://" };
    }
    sanitizedRelay = parsed.toString();
  } catch (_error) {
    return { url: "", warning: "Relay URL is not a valid URL." };
  }

  const overlayFile = type === "summary" ? "overlays/summary.html" : "overlays/live.html";
  const basePath = getProjectRootPath();
  const url = new URL(`${basePath}${overlayFile}`, window.location.href);
  url.searchParams.set("relay", encodeURIComponent(sanitizedRelay));

  let warning = null;

  // Optionally also embed portable skin config so the overlay loads correctly
  // on first render even before the first relay poll completes.
  if (embedPortableState && skinId) {
    const stateObj = {};
    if (skinId) stateObj.skinId = skinId;
    if (sport) stateObj.sport = sport;
    if (type) stateObj.type = type;
    if (animationStyle) stateObj.animation = animationStyle;
    if (theme && Object.keys(theme).length > 0) stateObj.theme = theme;
    if (displayOptions && Object.keys(displayOptions).length > 0) stateObj.displayOptions = displayOptions;

    const { encoded, oversized, dropped } = encodePortableState(stateObj);
    url.searchParams.set("state", encoded);

    if (oversized) {
      warning = `Portable state is oversized (${encoded.length} chars). Relay will still work for live scores.`;
    } else if (dropped.length > 0) {
      warning = `Fields dropped from portable state: ${dropped.join(", ")}.`;
    }
  }

  if (debug) url.searchParams.set("debug", "1");

  return {
    url: absolute ? url.toString() : `${url.pathname}${url.search}`,
    warning
  };
}

