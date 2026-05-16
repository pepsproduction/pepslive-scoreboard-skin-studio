import { getTemplateById } from "../templates/template-registry.js";
import { validateIncomingPayload } from "../src/payload-validator.js";
import { PEPSLIVE_MESSAGE_TYPES, PEPSLIVE_SCOREBOARD_PROTOCOL, createProtocolPayload } from "../src/pepslive-payload-protocol.js";
import { SharedStateBridge, getSharedOverlayState } from "../src/shared-state-bridge.js";
import { evaluateRenderedSlots, getRenderContractByTemplateId } from "../src/template-render-contract.js";

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

const EXTRA_LABELS = {
  addedTime: "Added Time",
  aggregateScore: "Aggregate",
  penaltyScore: "Penalty",
  goalScorerList: "Goal Scorers",
  cardInfo: "Card Info",
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

const SPORT_EXTRAS = {
  football: ["addedTime", "aggregateScore", "penaltyScore", "goalScorerList", "cardInfo"],
  basketball: ["shotClock", "homeFouls", "awayFouls", "homeTimeouts", "awayTimeouts", "possession", "bonus", "quarterBreakdown", "topScorer"]
};

const SLOT_INSPECTOR_CLASS_MAP = {
  Off: "slot-inspector-off",
  "Core Slots": "slot-inspector-core",
  "All Slots": "slot-inspector-all"
};

const VISUAL_QA_CLASS_MAP = {
  Off: "qa-off",
  "Slot Grid": "qa-slot-grid",
  "Contrast Boost": "qa-contrast-boost",
  "Overflow Check": "qa-overflow-check"
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

let mockDataCache = null;
let sharedBridge = null;
let currentSkinId = "FB-LIVE-01";
let currentAnimation = "smooth-broadcast";
let currentTheme = { ...DEFAULT_THEME };
let currentData = null;
let debugEnabled = false;
let debugElement = null;
let slotInspectorMode = "Off";
let visualQaMode = "Off";
let lastContractReport = null;
let currentSourceLabel = "Mock Data";

function parseQueryParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    skinId: params.get("skin"),
    animationStyle: params.get("animation"),
    themeRaw: params.get("theme"),
    debug: params.get("debug") === "1"
  };
}

function parseThemeFromQuery(themeRaw) {
  if (!themeRaw) {
    return null;
  }
  try {
    return JSON.parse(decodeURIComponent(themeRaw));
  } catch (_error) {
    return null;
  }
}

function getStoredTheme(skinId) {
  try {
    const parsed = JSON.parse(localStorage.getItem("pepslive:customThemes") || "{}");
    return parsed[skinId] || null;
  } catch (_error) {
    return null;
  }
}

function applyTheme(theme) {
  const merged = { ...DEFAULT_THEME, ...(theme || {}) };
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

function modeFromBody() {
  return document.body.dataset.overlayMode || "live";
}

function textOrFallback(value, fallback = "-") {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  return String(value);
}

function getLogoFallback(data, which) {
  if (which === "homeLogo") {
    return textOrFallback(data.homeShortName, "HOM").slice(0, 3).toUpperCase();
  }
  if (which === "awayLogo") {
    return textOrFallback(data.awayShortName, "AWY").slice(0, 3).toUpperCase();
  }
  return textOrFallback(data.eventName, "EVT").slice(0, 3).toUpperCase();
}

function createLogoMarkup(value, fallbackText, slotName) {
  if (value) {
    return `<span class="logo-slot" data-slot="${slotName}"><img src="${value}" alt="${fallbackText}" /></span>`;
  }
  return `<span class="logo-slot placeholder" data-slot="${slotName}" aria-label="${fallbackText}"><span class="logo-fallback-badge">${fallbackText}</span></span>`;
}

function extraItemsMarkup(sport, data) {
  return (SPORT_EXTRAS[sport] || [])
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

function applyInspectorAndQaClass(root) {
  const inspectorClasses = Object.values(SLOT_INSPECTOR_CLASS_MAP);
  const qaClasses = Object.values(VISUAL_QA_CLASS_MAP);
  root.classList.remove(...inspectorClasses, ...qaClasses);
  root.classList.add(SLOT_INSPECTOR_CLASS_MAP[slotInspectorMode] || SLOT_INSPECTOR_CLASS_MAP.Off);
  root.classList.add(VISUAL_QA_CLASS_MAP[visualQaMode] || VISUAL_QA_CLASS_MAP.Off);
}

function collectRenderedSlotNames(root) {
  return Array.from(root.querySelectorAll("[data-slot]"))
    .map((node) => node.getAttribute("data-slot"))
    .filter(Boolean);
}

function publishContractReport(report) {
  lastContractReport = report;
  try {
    window.parent?.postMessage(
      {
        type: "pepslive:render-contract-report",
        report
      },
      "*"
    );
  } catch (_error) {
    // ignore cross-window issues
  }
}

function renderScoreboard(template, data) {
  const root = document.getElementById("overlay-root");
  if (!root) {
    return;
  }
  const mode = modeFromBody();
  root.className = `${mode === "summary" ? "mode-summary" : "mode-live"} skin-${template.id} anim-${currentAnimation}`;
  root.innerHTML = `
    <section class="scoreboard-shell">
      <div class="event-row" data-slot="eventRow">
        <div class="event-meta">
          ${createLogoMarkup(data.eventLogo, getLogoFallback(data, "eventLogo"), "eventLogo")}
          <span class="event-name" data-slot="eventName">${textOrFallback(data.eventName)}</span>
        </div>
        <span class="status-badge" data-slot="statusLabel">${textOrFallback(data.statusLabel)}</span>
      </div>
      <div class="teams-row" data-slot="teamsRow">
        <div class="team-block home" data-slot="homeTeam">
          ${createLogoMarkup(data.homeLogo, getLogoFallback(data, "homeLogo"), "homeLogo")}
          <div class="team-name-box">
            <span class="team-name" data-slot="homeName">${textOrFallback(data.homeName)}</span>
            <span class="team-short" data-slot="homeShortName">${textOrFallback(data.homeShortName)}</span>
          </div>
        </div>
        <div class="score-block" data-slot="score">
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
        <div class="team-block away" data-slot="awayTeam">
          ${createLogoMarkup(data.awayLogo, getLogoFallback(data, "awayLogo"), "awayLogo")}
          <div class="team-name-box">
            <span class="team-name" data-slot="awayName">${textOrFallback(data.awayName)}</span>
            <span class="team-short" data-slot="awayShortName">${textOrFallback(data.awayShortName)}</span>
          </div>
        </div>
      </div>
      <div class="extra-row" data-slot="extraRow">${extraItemsMarkup(data.sport, data)}</div>
    </section>
  `;

  applyInspectorAndQaClass(root);

  const slotNames = collectRenderedSlotNames(root);
  const contractReport = evaluateRenderedSlots(template.id, slotNames);
  publishContractReport(contractReport);
}

async function loadMockData() {
  if (mockDataCache) {
    return mockDataCache;
  }
  mockDataCache = fetch("../data/mock-match-data.json")
    .then((response) => (response.ok ? response.json() : FALLBACK_MOCK))
    .catch(() => FALLBACK_MOCK);
  return mockDataCache;
}

async function getMockBySport(sport) {
  const loaded = await loadMockData();
  return loaded[sport] || FALLBACK_MOCK[sport] || FALLBACK_MOCK.football;
}

function ensureDebugBox() {
  if (!debugEnabled) {
    return;
  }
  if (debugElement) {
    return;
  }
  debugElement = document.createElement("aside");
  debugElement.id = "overlay-debug-box";
  debugElement.style.position = "fixed";
  debugElement.style.right = "10px";
  debugElement.style.bottom = "10px";
  debugElement.style.maxWidth = "300px";
  debugElement.style.background = "rgba(2, 6, 23, 0.72)";
  debugElement.style.color = "#e2e8f0";
  debugElement.style.border = "1px solid rgba(148, 163, 184, 0.45)";
  debugElement.style.borderRadius = "10px";
  debugElement.style.padding = "8px 10px";
  debugElement.style.fontSize = "11px";
  debugElement.style.fontFamily = "monospace";
  debugElement.style.zIndex = "9999";
  debugElement.style.pointerEvents = "none";
  document.body.append(debugElement);
}

function updateDebugBox({ protocolStatus, validationStatus, updateTime, template, sport, type }) {
  if (!debugEnabled) {
    return;
  }
  ensureDebugBox();
  if (!debugElement) {
    return;
  }
  const missingCritical = lastContractReport?.missingCritical?.length || 0;
  debugElement.innerHTML = `
    <div><strong>Protocol:</strong> ${protocolStatus}</div>
    <div><strong>Source:</strong> ${currentSourceLabel}</div>
    <div><strong>Validation:</strong> ${validationStatus}</div>
    <div><strong>Last Update:</strong> ${updateTime || "-"}</div>
    <div><strong>Skin:</strong> ${template?.id || "-"}</div>
    <div><strong>Sport/Type:</strong> ${sport || "-"}/${type || "-"}</div>
    <div><strong>Inspector/QA:</strong> ${slotInspectorMode} / ${visualQaMode}</div>
    <div><strong>Missing Critical:</strong> ${missingCritical}</div>
  `;
}

function resolveSourceLabel(sourceValue = "") {
  const source = String(sourceValue || "").toLowerCase();
  if (source.includes("dock")) {
    return "PepsLive Dock";
  }
  if (source.includes("storage")) {
    return "LocalStorage Fallback";
  }
  if (source.includes("bridge")) {
    return "BroadcastChannel";
  }
  if (source.includes("postmessage")) {
    return "PostMessage";
  }
  if (source.includes("overlay-local") || source.includes("initial")) {
    return "Mock Data";
  }
  return sourceValue || "Unknown";
}

async function fallbackRender(reason) {
  const template = getTemplateById(currentSkinId || "FB-LIVE-01");
  const mock = await getMockBySport(template.sport);
  currentData = mock;
  currentSourceLabel = "Mock Data";
  renderScoreboard(template, currentData);
  updateDebugBox({
    protocolStatus: PEPSLIVE_SCOREBOARD_PROTOCOL,
    validationStatus: `fallback (${reason})`,
    updateTime: new Date().toISOString(),
    template,
    sport: template.sport,
    type: template.type
  });
}

async function applyProtocolPayload(rawPayload, sourceLabel = "unknown") {
  const validation = await validateIncomingPayload(rawPayload);
  if (!validation.isValid || !validation.normalizedPayload) {
    currentSourceLabel = resolveSourceLabel(rawPayload?.source || sourceLabel);
    await fallbackRender(`invalid payload via ${sourceLabel}`);
    return;
  }

  const payload = validation.normalizedPayload;
  currentSourceLabel = resolveSourceLabel(payload.source || sourceLabel);
  currentSkinId = payload.skinId;
  currentAnimation = payload.animation?.style || currentAnimation;
  applyTheme(payload.theme || {});
  currentData = payload.matchData;

  const template = getTemplateById(payload.skinId);
  renderScoreboard(template, currentData);
  updateDebugBox({
    protocolStatus: payload.protocol,
    validationStatus: validation.warnings.length ? `valid with warnings (${validation.warnings.length})` : "valid",
    updateTime: payload.timestamp,
    template,
    sport: payload.sport,
    type: payload.type
  });
}

function buildPayloadFromLocalState() {
  const template = getTemplateById(currentSkinId || "FB-LIVE-01");
  return createProtocolPayload({
    source: "overlay-local",
    sport: template.sport,
    skinId: template.id,
    type: template.type,
    theme: currentTheme,
    animation: { style: currentAnimation },
    matchData: currentData || {}
  });
}

function setupSharedBridge() {
  sharedBridge = new SharedStateBridge({
    role: "overlay",
    onRemoteEvent: async (message, transport) => {
      if (transport === "local") {
        return;
      }
      if (message.type === PEPSLIVE_MESSAGE_TYPES.PING || message.type === PEPSLIVE_MESSAGE_TYPES.PONG) {
        const activeTemplate = getTemplateById(currentSkinId || "FB-LIVE-01");
        updateDebugBox({
          protocolStatus: message.protocol || PEPSLIVE_SCOREBOARD_PROTOCOL,
          validationStatus: message.type,
          updateTime: message.timestamp,
          template: activeTemplate,
          sport: activeTemplate.sport,
          type: activeTemplate.type
        });
        return;
      }
      const snapshot = sharedBridge.getState();
      if (snapshot.currentPayload) {
        await applyProtocolPayload(snapshot.currentPayload, "shared-bridge");
      }
    },
    onStateChange: async (snapshot) => {
      if (snapshot.currentPayload) {
        await applyProtocolPayload(snapshot.currentPayload, "shared-state");
      }
    }
  });
  sharedBridge.start();
}

function setupPostMessageBridge() {
  window.addEventListener("message", async (event) => {
    const payload = event.data || {};
    const template = getTemplateById(currentSkinId || "FB-LIVE-01");

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
      currentData = { ...(currentData || {}), ...payload.data };
    }
    if (payload.type === "pepslive:set-slot-inspector") {
      slotInspectorMode = payload.mode || "Off";
    }
    if (payload.type === "pepslive:set-visual-qa-mode") {
      visualQaMode = payload.mode || "Off";
    }

    const activeTemplate = getTemplateById(currentSkinId || template.id);
    const composedPayload = createProtocolPayload({
      source: "overlay-postmessage",
      sport: activeTemplate.sport,
      skinId: activeTemplate.id,
      type: activeTemplate.type,
      theme: currentTheme,
      animation: { style: currentAnimation },
      matchData: currentData || {}
    });
    await applyProtocolPayload(composedPayload, "post-message");
    sharedBridge?.publishState(composedPayload);
  });
}

async function initOverlay() {
  const query = parseQueryParams();
  debugEnabled = query.debug;
  ensureDebugBox();

  const sharedState = getSharedOverlayState();
  const sharedPayload = sharedState.currentPayload;
  currentSkinId = query.skinId || sharedPayload?.skinId || "FB-LIVE-01";
  currentAnimation = query.animationStyle || sharedPayload?.animation?.style || currentAnimation;

  const contract = getRenderContractByTemplateId(currentSkinId);
  if (!contract) {
    currentSkinId = "FB-LIVE-01";
  }

  const queryTheme = parseThemeFromQuery(query.themeRaw);
  const storedTheme = getStoredTheme(currentSkinId);
  applyTheme({ ...storedTheme, ...(sharedPayload?.theme || {}), ...queryTheme });

  currentData = sharedPayload?.matchData || null;
  if (!currentData) {
    const fallbackTemplate = getTemplateById(currentSkinId);
    currentData = await getMockBySport(fallbackTemplate.sport);
  }

  const initialPayload = buildPayloadFromLocalState();
  await applyProtocolPayload(initialPayload, "initial");

  setupSharedBridge();
  setupPostMessageBridge();

  const storagePayload = getSharedOverlayState().currentPayload;
  if (storagePayload) {
    await applyProtocolPayload(storagePayload, "storage-bootstrap");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initOverlay().catch(() => {
    fallbackRender("init-error");
  });
});
