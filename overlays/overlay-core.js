import { getTemplateById } from "../templates/template-registry.js";

const DEFAULT_THEME = {
  primaryColor: "#ff7a18",
  secondaryColor: "#101827",
  homeColor: "#f97316",
  awayColor: "#3b82f6",
  textColor: "#f8fafc",
  accentColor: "#fb923c",
  backgroundOpacity: 0.78,
  borderRadius: 16,
  shadowIntensity: 0.45,
  glowIntensity: 0.3,
  fontFamily: "'Rajdhani', 'Segoe UI', sans-serif",
  logoSlotSize: 42,
  scoreboardScale: 1,
  borderWidth: 1.6,
  glassBlur: 10,
  animationStyle: "smooth-broadcast"
};

const SLOT_FIELDS = {
  common: [
    "eventLogo",
    "eventName",
    "homeLogo",
    "awayLogo",
    "homeName",
    "awayName",
    "homeShortName",
    "awayShortName",
    "homeScore",
    "awayScore",
    "gameClock",
    "periodLabel",
    "statusLabel"
  ],
  football: ["addedTime", "aggregateScore", "penaltyScore", "goalScorerList", "cardInfo"],
  basketball: [
    "quarterLabel",
    "shotClock",
    "homeFouls",
    "awayFouls",
    "homeTimeouts",
    "awayTimeouts",
    "possession",
    "bonus",
    "quarterBreakdown",
    "topScorer"
  ]
};

const EXTRA_LABELS = {
  addedTime: "Added Time",
  aggregateScore: "Aggregate",
  penaltyScore: "Penalty",
  goalScorerList: "Goal Scorers",
  cardInfo: "Card Info",
  quarterLabel: "Quarter",
  shotClock: "Shot Clock",
  homeFouls: "Home Fouls",
  awayFouls: "Away Fouls",
  homeTimeouts: "Home Timeout",
  awayTimeouts: "Away Timeout",
  possession: "Possession",
  bonus: "Bonus",
  quarterBreakdown: "Quarter Breakdown",
  topScorer: "Top Scorer"
};

const FALLBACK_MOCK = {
  football: {
    sport: "football",
    eventName: "PEPS LIVE CUP",
    homeName: "Dragon FC",
    awayName: "Tiger FC",
    homeShortName: "DRA",
    awayShortName: "TIG",
    homeScore: 2,
    awayScore: 1,
    gameClock: "45:00",
    periodLabel: "1H",
    statusLabel: "LIVE",
    addedTime: "+2",
    aggregateScore: "3-2",
    penaltyScore: "4-3",
    goalScorerList: "12' Aran, 39' Krit",
    cardInfo: "DRA 1Y | TIG 2Y 1R",
    homeLogo: "",
    awayLogo: "",
    eventLogo: ""
  },
  basketball: {
    sport: "basketball",
    eventName: "PEPS HOOPS",
    homeName: "Orange Wolves",
    awayName: "Blue Hawks",
    homeShortName: "WOL",
    awayShortName: "HAW",
    homeScore: 78,
    awayScore: 74,
    gameClock: "02:18",
    periodLabel: "Q4",
    statusLabel: "LIVE",
    quarterLabel: "Q4",
    shotClock: "14",
    homeFouls: 4,
    awayFouls: 3,
    homeTimeouts: 2,
    awayTimeouts: 1,
    possession: "home",
    bonus: "away",
    quarterBreakdown: "Q1 20-18 | Q2 41-39 | Q3 61-58 | Q4 78-74",
    topScorer: "WOL #11 24 PTS",
    homeLogo: "",
    awayLogo: "",
    eventLogo: ""
  }
};

let mockDataPromise = null;
let currentSkinId = null;
let currentTheme = { ...DEFAULT_THEME };
let currentAnimation = DEFAULT_THEME.animationStyle;
let currentData = null;

function parseQueryParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    skinId: params.get("skin") || "FB-LIVE-01",
    animationStyle: params.get("animation") || null,
    themeRaw: params.get("theme")
  };
}

function parseThemeFromQuery(themeRaw) {
  if (!themeRaw) {
    return null;
  }
  try {
    const decoded = decodeURIComponent(themeRaw);
    const parsed = JSON.parse(decoded);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (_error) {
    return null;
  }
}

function getStoredTheme(skinId) {
  try {
    const raw = localStorage.getItem("pepslive:customThemes");
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    return parsed && parsed[skinId] ? parsed[skinId] : null;
  } catch (_error) {
    return null;
  }
}

function applyTheme(theme) {
  const merged = { ...DEFAULT_THEME, ...theme };
  const root = document.documentElement;
  root.style.setProperty("--primary-color", merged.primaryColor);
  root.style.setProperty("--secondary-color", merged.secondaryColor);
  root.style.setProperty("--home-color", merged.homeColor);
  root.style.setProperty("--away-color", merged.awayColor);
  root.style.setProperty("--text-color", merged.textColor);
  root.style.setProperty("--accent-color", merged.accentColor);
  root.style.setProperty("--background-opacity", String(merged.backgroundOpacity));
  root.style.setProperty("--border-radius", `${Number(merged.borderRadius)}px`);
  root.style.setProperty("--shadow-intensity", String(merged.shadowIntensity));
  root.style.setProperty("--glow-intensity", String(merged.glowIntensity));
  root.style.setProperty("--font-family", merged.fontFamily);
  root.style.setProperty("--logo-slot-size", `${Number(merged.logoSlotSize)}px`);
  root.style.setProperty("--scoreboard-scale", String(merged.scoreboardScale));
  root.style.setProperty("--border-width", `${Number(merged.borderWidth)}px`);
  root.style.setProperty("--glass-blur", `${Number(merged.glassBlur)}px`);
  currentTheme = merged;
}

function inferModeByDocument() {
  return document.body.dataset.overlayMode || "live";
}

function textOrFallback(value, fallback = "-") {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  return String(value);
}

function createLogoMarkup(value, fallbackText) {
  const safeFallback = textOrFallback(fallbackText, "--");
  if (value) {
    return `<span class="logo-slot"><img src="${value}" alt="${safeFallback}" /></span>`;
  }
  return `<span class="logo-slot">${safeFallback}</span>`;
}

function extraItemsForSport(sport, data) {
  const sportFields = SLOT_FIELDS[sport] || [];
  return sportFields
    .map((field) => {
      const value = textOrFallback(data[field], "-");
      return `
        <div class="extra-item" data-slot="${field}">
          <span class="extra-label">${EXTRA_LABELS[field] || field}</span>
          <span class="extra-value">${value}</span>
        </div>
      `;
    })
    .join("");
}

function getPlaceholderInitial(data, fieldName) {
  if (fieldName === "homeLogo") {
    return textOrFallback(data.homeShortName, "HOME").slice(0, 3).toUpperCase();
  }
  if (fieldName === "awayLogo") {
    return textOrFallback(data.awayShortName, "AWAY").slice(0, 3).toUpperCase();
  }
  return textOrFallback(data.eventName, "EVT").slice(0, 3).toUpperCase();
}

function renderScoreboard(template, data, mode) {
  const root = document.getElementById("overlay-root");
  if (!root) {
    return;
  }

  root.className = `${mode === "summary" ? "mode-summary" : "mode-live"} skin-${template.id} anim-${currentAnimation}`;
  root.innerHTML = `
    <section class="scoreboard-shell">
      <div class="event-row">
        <div class="event-meta">
          ${createLogoMarkup(data.eventLogo, getPlaceholderInitial(data, "eventLogo"))}
          <span class="event-name" data-slot="eventName">${textOrFallback(data.eventName)}</span>
        </div>
        <span class="status-badge" data-slot="statusLabel">${textOrFallback(data.statusLabel)}</span>
      </div>
      <div class="teams-row">
        <div class="team-block home">
          ${createLogoMarkup(data.homeLogo, getPlaceholderInitial(data, "homeLogo"))}
          <div class="team-name-box">
            <span class="team-name" data-slot="homeName">${textOrFallback(data.homeName)}</span>
            <span class="team-short" data-slot="homeShortName">${textOrFallback(data.homeShortName)}</span>
          </div>
        </div>
        <div class="score-block">
          <div class="score-values">
            <span data-slot="homeScore">${textOrFallback(data.homeScore, "0")}</span>
            <span class="score-divider">:</span>
            <span data-slot="awayScore">${textOrFallback(data.awayScore, "0")}</span>
          </div>
          <div class="game-meta">
            <span data-slot="gameClock">${textOrFallback(data.gameClock, "00:00")}</span>
            <span data-slot="periodLabel">${textOrFallback(data.periodLabel, "-")}</span>
          </div>
        </div>
        <div class="team-block away">
          ${createLogoMarkup(data.awayLogo, getPlaceholderInitial(data, "awayLogo"))}
          <div class="team-name-box">
            <span class="team-name" data-slot="awayName">${textOrFallback(data.awayName)}</span>
            <span class="team-short" data-slot="awayShortName">${textOrFallback(data.awayShortName)}</span>
          </div>
        </div>
      </div>
      <div class="extra-row">
        ${extraItemsForSport(data.sport, data)}
      </div>
    </section>
  `;
}

async function loadMockData() {
  if (mockDataPromise) {
    return mockDataPromise;
  }

  mockDataPromise = fetch("../data/mock-match-data.json")
    .then((response) => (response.ok ? response.json() : FALLBACK_MOCK))
    .catch(() => FALLBACK_MOCK);

  return mockDataPromise;
}

async function resolveMatchData(template) {
  const mockData = await loadMockData();
  const bySport = mockData[template.sport];
  if (!bySport) {
    return FALLBACK_MOCK[template.sport] || FALLBACK_MOCK.football;
  }

  const merged = {
    ...bySport,
    sport: template.sport
  };

  currentData = merged;
  return merged;
}

async function renderBySkin(skinId) {
  const template = getTemplateById(skinId);
  const mode = inferModeByDocument();
  const data = await resolveMatchData(template);
  renderScoreboard(template, data, mode);
}

function setupPostMessageBridge() {
  window.addEventListener("message", async (event) => {
    const payload = event.data || {};

    if (payload.type === "pepslive:update-theme" && payload.theme) {
      applyTheme(payload.theme);
    }

    if (payload.type === "pepslive:update-animation" && payload.animationStyle) {
      currentAnimation = payload.animationStyle;
    }

    if (payload.type === "pepslive:update-skin" && payload.skinId) {
      currentSkinId = payload.skinId;
    }

    if (payload.type === "pepslive:update-data" && payload.data && typeof payload.data === "object") {
      currentData = { ...currentData, ...payload.data };
    }

    const template = getTemplateById(currentSkinId || "FB-LIVE-01");
    const mode = inferModeByDocument();
    const data = currentData || (await resolveMatchData(template));
    renderScoreboard(template, data, mode);
  });
}

async function initOverlay() {
  const { skinId, animationStyle, themeRaw } = parseQueryParams();
  currentSkinId = skinId;
  currentAnimation = animationStyle || currentAnimation;
  const queryTheme = parseThemeFromQuery(themeRaw);
  const storedTheme = getStoredTheme(skinId);
  applyTheme({ ...storedTheme, ...queryTheme });
  await renderBySkin(skinId);
  setupPostMessageBridge();
}

document.addEventListener("DOMContentLoaded", () => {
  initOverlay();
});
