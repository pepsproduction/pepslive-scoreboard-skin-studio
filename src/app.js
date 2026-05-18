import { getTemplateById, TEMPLATE_REGISTRY } from "../templates/template-registry.js";
import { createDefaultAdapters } from "./external-data-adapters.js";
import { getMockDataBySport } from "./mock-data.js";
import { ObsSourceManager } from "./obs-source-manager.js";
import { OVERLAY_MODULE_REGISTRY } from "./overlay-module-registry.js";
import { validateIncomingPayload } from "./payload-validator.js";
import {
  PEPSLIVE_CUSTOM_EVENT_UPDATED,
  PEPSLIVE_MESSAGE_TYPES,
  PEPSLIVE_SCOREBOARD_PROTOCOL,
  createProtocolPayload
} from "./pepslive-payload-protocol.js";
import { PreviewEngine } from "./preview-engine.js";
import {
  duplicateSkin,
  exportSkinJson,
  getCurrentSkin,
  getFavorites,
  getObsConfig,
  getRecentlyUsed,
  getThemeBySkinId,
  pushRecentlyUsed,
  resetSkin,
  setCurrentSkin,
  setThemeBySkinId,
  toggleFavorite,
  listSkinPresets,
  saveSkinPreset,
  deleteSkinPreset,
  getRelayConfig,
  setRelayConfig
} from "./skin-storage.js";
import { SharedStateBridge, getSharedOverlayState } from "./shared-state-bridge.js";
import { auditTemplateContracts, getRenderContractByTemplateId } from "./template-render-contract.js";
import { TemplateGallery } from "./template-gallery.js";
import { DEFAULT_THEME, ThemeEditor } from "./theme-editor.js";
import {
  ANIMATION_PRESETS,
  BACKGROUND_MODES,
  DEFAULT_DISPLAY_OPTIONS,
  SAFE_AREA_MODES,
  SLOT_INSPECTOR_MODES,
  STYLE_TAGS,
  VISUAL_QA_MODES,
  downloadJson,
  generateOverlayUrl,
  generatePortableOverlayUrl,
  generateRelayOverlayUrl,
  nowIso,
  setButtonGroupActive
} from "./utils.js";
import { broadcastSkinUrls, closeStudioDockBridge, postStudioEmbedReady } from "./studio-dock-bridge.js";

const adapters = createDefaultAdapters();
const dockAdapter = adapters.find((item) => item.source === "pepslive-dock");
const pageQuery = new URLSearchParams(window.location.search);
const IS_EMBED_MODE = pageQuery.get("embed") === "1" || pageQuery.get("dockEmbed") === "1";

if (IS_EMBED_MODE) {
  document.documentElement.classList.add("skin-studio-embed");
  document.body?.classList.add("skin-studio-embed");
}

const INTEGRATION_MODES = ["Off", "Listen Only", "Manual Test"];
const INTEGRATION_DATA_SOURCES = {
  MOCK: "Mock Data",
  DOCK: "PepsLive Dock",
  LOCALSTORAGE: "LocalStorage Fallback",
  BROADCAST: "BroadcastChannel"
};

const state = {
  selectedTemplate: null,
  currentTheme: { ...DEFAULT_THEME },
  animationStyle: DEFAULT_THEME.animationStyle,
  favorites: getFavorites(),
  recentlyUsed: getRecentlyUsed(),
  presets: [],
  currentSkin: getCurrentSkin(),
  activeMatchData: null,
  bridge: null,
  lastValidation: null,
  applyingRemote: false,
  lastProtocolPayload: null,
  slotInspectorMode: SLOT_INSPECTOR_MODES[0],
  visualQaMode: VISUAL_QA_MODES[0],
  obsLivePreset: "live-compact",
  obsSummaryPreset: "summary-fhd",
  obsUrlVersion: Date.now(),
  obsLastHealthResult: null,
  messageTimer: null,
  lastStableMessage: "Ready: choose template and use skin",
  integrationMode: "Listen Only",
  integrationDataSource: INTEGRATION_DATA_SOURCES.MOCK,
  integrationLastDockUpdate: "",
  integrationLastPayloadSource: "",
  integrationPayloadStatus: "Payload Status: waiting",
  displayOptions: { ...DEFAULT_DISPLAY_OPTIONS },
  eventLogoDataUrl: "",
  eventLogoPalette: [],
  settingsByType: mergeStoredTypeSettings(getCurrentSkin()?.typeSettings || {}),
  publishTimer: 0,
  galleryPreviewTimer: 0,
  // Phase 4.4
  skinPresets: [],
  relayConfig: { url: "", intervalSec: 5 }
};

const OBS_CUSTOM_CSS = "body { background-color: rgba(0, 0, 0, 0); margin: 0; overflow: hidden; }";
const LIVE_SOURCE_PRESETS = {
  "live-compact": { label: "Compact 900x180", width: 900, height: 180 },
  "live-wide": { label: "Wide 1280x220", width: 1280, height: 220 },
  "live-fhd-canvas": { label: "Full HD Transparent Canvas 1920x1080", width: 1920, height: 1080 }
};
const SUMMARY_SOURCE_PRESETS = {
  "summary-fhd": { label: "Full HD 1920x1080", width: 1920, height: 1080 },
  "summary-vertical": { label: "Vertical 1080x1920", width: 1080, height: 1920 },
  "summary-square": { label: "Square 1080x1080", width: 1080, height: 1080 }
};

const ui = {};
let gallery = null;
let previewEngine = null;
let themeEditor = null;
let obsManager = null;

function hasObjectValues(value) {
  return !!value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length > 0;
}

function createSettingsProfile(overrides = {}) {
  return {
    theme: { ...DEFAULT_THEME, ...(overrides.theme || {}) },
    animationStyle: overrides.animationStyle || overrides.animation?.style || overrides.animation || DEFAULT_THEME.animationStyle,
    displayOptions: { ...DEFAULT_DISPLAY_OPTIONS, ...(overrides.displayOptions || {}) },
    eventLogoDataUrl: overrides.eventLogoDataUrl || overrides.eventLogo || "",
    eventLogoPalette: Array.isArray(overrides.eventLogoPalette) ? [...overrides.eventLogoPalette] : []
  };
}

function mergeStoredTypeSettings(stored = {}) {
  return {
    live: createSettingsProfile(stored.live || {}),
    summary: createSettingsProfile(stored.summary || {})
  };
}

function notify(message, level = "info") {
  if (!ui.message) {
    return;
  }
  if (state.messageTimer) {
    window.clearTimeout(state.messageTimer);
    state.messageTimer = null;
  }
  ui.message.textContent = message;
  ui.message.dataset.level = level;
  state.lastStableMessage = message;
}

function flashMessage(message, level = "info", duration = 1400) {
  if (!ui.message) {
    return;
  }
  if (state.messageTimer) {
    window.clearTimeout(state.messageTimer);
  }
  ui.message.textContent = message;
  ui.message.dataset.level = level;
  state.messageTimer = window.setTimeout(() => {
    if (!ui.message) {
      return;
    }
    ui.message.textContent = state.lastStableMessage;
    ui.message.dataset.level = "info";
    state.messageTimer = null;
  }, duration);
}

function flashCopyButton(button) {
  if (!button) {
    return;
  }
  if (button._copyTimer) {
    window.clearTimeout(button._copyTimer);
  }
  const originalLabel = button.dataset.originalLabel || button.textContent;
  button.dataset.originalLabel = originalLabel;
  button.textContent = "Copied";
  button.classList.add("is-copying");
  button._copyTimer = window.setTimeout(() => {
    button.textContent = originalLabel;
    button.classList.remove("is-copying");
    button._copyTimer = null;
  }, 1100);
}

function updateCurrentSkinLabel() {
  if (!ui.currentSkinLabel || !state.selectedTemplate) {
    return;
  }
  ui.currentSkinLabel.textContent = `${state.selectedTemplate.id} - ${state.selectedTemplate.name}`;
}

function updatePreviewSummary(template = state.selectedTemplate) {
  if (ui.previewSkinText) {
    ui.previewSkinText.textContent = template ? `${template.id} - ${template.name}` : "-";
  }
  if (ui.previewSportTypeText) {
    ui.previewSportTypeText.textContent = template ? `${template.sport} / ${template.type}` : "-";
  }
  if (ui.previewSourceSizeText) {
    const sourcePreset = template ? getSourcePreset(template.type) : null;
    ui.previewSourceSizeText.textContent = sourcePreset ? sourcePreset.label : "-";
    if (sourcePreset && ui.previewStage) {
      ui.previewStage.style.setProperty("--preview-aspect-ratio", `${sourcePreset.width} / ${sourcePreset.height}`);
      ui.previewStage.style.setProperty("--preview-aspect-ratio-value", String(sourcePreset.width / sourcePreset.height));
      ui.previewStage.dataset.sourceType = template.type;
    }
  }
}

function syncDisplayOptionControls() {
  if (!ui.displayOptionsForm) {
    return;
  }
  const options = { ...DEFAULT_DISPLAY_OPTIONS, ...(state.displayOptions || {}) };
  ui.displayOptionsForm.querySelectorAll("input[data-display-option]").forEach((input) => {
    const key = input.dataset.displayOption;
    if (input.type === "checkbox") {
      input.checked = options[key] !== false;
      return;
    }
    input.value = options[key] ?? DEFAULT_DISPLAY_OPTIONS[key] ?? input.value;
  });
  ui.displayOptionsForm.querySelectorAll("select[data-display-option]").forEach((select) => {
    select.value = options[select.dataset.displayOption] || DEFAULT_DISPLAY_OPTIONS[select.dataset.displayOption] || "full";
  });
  if (ui.teamNameAlignGroup) {
    const allowedNameAlign = ["same-left", "same-right", "outer", "inner"];
    setButtonGroupActive(ui.teamNameAlignGroup, allowedNameAlign.includes(options.teamNameAlign) ? options.teamNameAlign : "outer");
  }
}

function updateEventLogoUi() {
  if (ui.eventLogoPreview) {
    ui.eventLogoPreview.innerHTML = state.eventLogoDataUrl
      ? `<img src="${state.eventLogoDataUrl}" alt="Event logo preview" />`
      : `<span>No event logo</span>`;
  }
  if (ui.eventPaletteSwatches) {
    ui.eventPaletteSwatches.innerHTML = state.eventLogoPalette.length
      ? state.eventLogoPalette.map((color) => `<button type="button" class="palette-swatch" data-color="${color}" style="--swatch:${color}" title="${color}"></button>`).join("")
      : `<span class="tiny-note">Upload a logo to extract colors.</span>`;
  }
  if (ui.eventLogoStatusText) {
    ui.eventLogoStatusText.textContent = state.eventLogoDataUrl
      ? "Event logo is active for preview/current skin."
      : "No event logo override.";
  }
}

function applyEventLogoToMatchData(matchData, eventLogoOverride = state.eventLogoDataUrl) {
  if (!matchData) {
    return matchData;
  }
  return {
    ...matchData,
    eventLogo: eventLogoOverride || matchData.eventLogo || ""
  };
}

function captureCurrentTypeSettings(type = state.selectedTemplate?.type) {
  if (!type || !["live", "summary"].includes(type)) {
    return;
  }
  state.settingsByType[type] = createSettingsProfile({
    theme: state.currentTheme,
    animationStyle: state.animationStyle,
    displayOptions: state.displayOptions,
    eventLogoDataUrl: state.eventLogoDataUrl,
    eventLogoPalette: state.eventLogoPalette
  });
}

function getTypeSettings(type = "live") {
  if (!state.settingsByType[type]) {
    state.settingsByType[type] = createSettingsProfile();
  }
  return state.settingsByType[type];
}

function getSettingsSnapshotForType(type = "live", template = null) {
  if (state.selectedTemplate?.type === type) {
    captureCurrentTypeSettings(type);
  }
  const profile = getTypeSettings(type);
  return createSettingsProfile({
    ...profile,
    theme: getThemeBySkinId(template?.id || "") || profile.theme
  });
}

function applySettingsProfile(profile) {
  const nextProfile = createSettingsProfile(profile);
  state.currentTheme = nextProfile.theme;
  state.animationStyle = nextProfile.animationStyle || nextProfile.theme.animationStyle || DEFAULT_THEME.animationStyle;
  state.currentTheme = { ...state.currentTheme, animationStyle: state.animationStyle };
  state.displayOptions = nextProfile.displayOptions;
  state.eventLogoDataUrl = nextProfile.eventLogoDataUrl;
  state.eventLogoPalette = nextProfile.eventLogoPalette;
}

function getSourcePreset(type) {
  if (type === "summary") {
    return SUMMARY_SOURCE_PRESETS[state.obsSummaryPreset] || SUMMARY_SOURCE_PRESETS["summary-fhd"];
  }
  return LIVE_SOURCE_PRESETS[state.obsLivePreset] || LIVE_SOURCE_PRESETS["live-compact"];
}

function resolveTemplateForObsType(type) {
  if (state.selectedTemplate?.type === type) {
    return state.selectedTemplate;
  }
  const preferredSport = state.selectedTemplate?.sport || state.currentSkin?.sport || "football";
  return (
    TEMPLATE_REGISTRY.find((item) => item.type === type && item.sport === preferredSport) ||
    TEMPLATE_REGISTRY.find((item) => item.type === type) ||
    TEMPLATE_REGISTRY[0]
  );
}

function buildOverlayUrlByType(type, { debug = false, cacheBust = false, forceVersion = null } = {}) {
  const template = resolveTemplateForObsType(type);
  const settings = getSettingsSnapshotForType(type, template);
  const versionValue = forceVersion ?? state.obsUrlVersion;
  return generateOverlayUrl({
    skinId: template.id,
    type,
    animationStyle: settings.animationStyle,
    theme: settings.theme,
    displayOptions: settings.displayOptions,
    cacheBust,
    absolute: true,
    debug,
    stateKey: versionValue ? `obs-${versionValue}` : ""
  });
}

/**
 * Phase 4.3 – Build a portable overlay URL that encodes skin/theme/displayOptions
 * into the ?state= query param, making it work without localStorage sync.
 * @returns {{ url: string, warning: string|null }}
 */
function buildPortableUrlByType(type, { debug = false, cacheBust = true, forceVersion = null } = {}) {
  const template = resolveTemplateForObsType(type);
  const settings = getSettingsSnapshotForType(type, template);
  const payload = buildProtocolPayloadFromState({
    skinId: template.id,
    sport: template.sport,
    type,
    theme: settings.theme,
    animation: { style: settings.animationStyle },
    displayOptions: settings.displayOptions,
    eventLogo: settings.eventLogoDataUrl
  });
  return generatePortableOverlayUrl({
    skinId: template.id,
    type,
    sport: template.sport,
    animationStyle: settings.animationStyle,
    theme: settings.theme,
    displayOptions: settings.displayOptions,
    eventLogo: settings.eventLogoDataUrl || "",
    matchData: payload.matchData,
    debug,
    absolute: true,
    cacheBust,
    version: forceVersion ?? state.obsUrlVersion ?? Date.now()
  });
}

function refreshObsUrlsPanel() {
  const versionValue = state.obsUrlVersion || Date.now();
  const liveDirect = buildOverlayUrlByType("live", { debug: false, cacheBust: false });
  const summaryDirect = buildOverlayUrlByType("summary", { debug: false, cacheBust: false });

  const portableLiveResult = buildPortableUrlByType("live", { debug: false, forceVersion: versionValue });
  const portableLiveDebugResult = buildPortableUrlByType("live", { debug: true, forceVersion: versionValue });
  const portableSummaryResult = buildPortableUrlByType("summary", { debug: false, forceVersion: versionValue });
  const portableSummaryDebugResult = buildPortableUrlByType("summary", { debug: true, forceVersion: versionValue });

  const liveProd = portableLiveResult.url;
  const liveDebug = portableLiveDebugResult.url;
  const summaryProd = portableSummaryResult.url;
  const summaryDebug = portableSummaryDebugResult.url;

  if (ui.liveProductionUrlText) {
    ui.liveProductionUrlText.value = liveProd;
  }
  if (ui.summaryProductionUrlText) {
    ui.summaryProductionUrlText.value = summaryProd;
  }
  if (ui.portableLiveUrlText) {
    ui.portableLiveUrlText.value = portableLiveResult.url;
  }
  if (ui.portableSummaryUrlText) {
    ui.portableSummaryUrlText.value = portableSummaryResult.url;
  }
  if (ui.obsSelectedSkinText) {
    ui.obsSelectedSkinText.textContent = state.selectedTemplate ? `${state.selectedTemplate.id} - ${state.selectedTemplate.name}` : "-";
  }
  if (ui.obsSelectedLivePresetText) {
    ui.obsSelectedLivePresetText.textContent = getSourcePreset("live").label;
  }
  if (ui.obsSelectedSummaryPresetText) {
    ui.obsSelectedSummaryPresetText.textContent = getSourcePreset("summary").label;
  }

  const urls = {
    liveProd,
    liveDebug,
    summaryProd,
    summaryDebug,
    liveDirect,
    summaryDirect,
    portableLive: portableLiveResult.url,
    portableLiveWarning: portableLiveResult.warning,
    portableSummary: portableSummaryResult.url,
    portableSummaryWarning: portableSummaryResult.warning
  };

  // Phase 5.0: broadcast skin URLs to any open Dock V1 instance
  try { broadcastSkinUrlsToDock(urls); } catch (_e) {}

  return urls;
}

function syncGalleryPreviewContext({ refreshFrames = false } = {}) {
  gallery?.setPreviewContext?.(
    {
      theme: state.currentTheme,
      displayOptions: state.displayOptions,
      eventLogo: state.eventLogoDataUrl
    },
    { refreshFrames }
  );
}

function scheduleGalleryPreviewRefresh(delay = 650) {
  if (!gallery) {
    return;
  }
  if (state.galleryPreviewTimer) {
    window.clearTimeout(state.galleryPreviewTimer);
  }
  state.galleryPreviewTimer = window.setTimeout(() => {
    state.galleryPreviewTimer = 0;
    syncGalleryPreviewContext({ refreshFrames: true });
  }, delay);
}

/**
 * Phase 5.0 — Broadcast current skin overlay URLs to PepsLive Dock V1
 * via BroadcastChannel("PEPSLIVE_STUDIO_SYNC").
 * Called whenever skin, theme, or display options change.
 */
function broadcastSkinUrlsToDock(urls = null) {
  const liveTemplate = resolveTemplateForObsType("live");
  const summaryTemplate = resolveTemplateForObsType("summary");
  const livePreset = getSourcePreset("live");
  const summaryPreset = getSourcePreset("summary");
  const nextUrls = urls || refreshObsUrlsPanel();
  broadcastSkinUrls({
    liveUrl: nextUrls.liveProd,
    liveDebugUrl: nextUrls.liveDebug,
    summaryUrl: nextUrls.summaryProd,
    summaryDebugUrl: nextUrls.summaryDebug,
    liveSkinId: liveTemplate.id,
    summarySkinId: summaryTemplate.id,
    skinId: liveTemplate.id,
    sport: liveTemplate.sport,
    skinName: liveTemplate.name || liveTemplate.id,
    liveSource: { width: livePreset.width, height: livePreset.height },
    summarySource: { width: summaryPreset.width, height: summaryPreset.height },
    obsWidth: livePreset.width,
    obsHeight: livePreset.height,
    embedMode: IS_EMBED_MODE,
    theme: state.currentTheme,
    displayOptions: state.displayOptions
  });
}

async function copyText(value, fallbackTarget = null) {
  if (!value) {
    return false;
  }
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch (_error) {
    if (fallbackTarget) {
      fallbackTarget.value = value;
    }
    return false;
  }
}

function updateBridgeStatus(message, level = "ok") {
  if (!ui.bridgeStatusText) {
    return;
  }
  ui.bridgeStatusText.textContent = message;
  ui.bridgeStatusText.dataset.state = level;
}

function updateContractStatus(message, level = "ok") {
  if (!ui.contractStatusText) {
    return;
  }
  ui.contractStatusText.textContent = message;
  ui.contractStatusText.dataset.state = level;
}

function updateProtocolMeta(payload = null, syncTime = null) {
  if (ui.currentProtocolText) {
    ui.currentProtocolText.textContent = PEPSLIVE_SCOREBOARD_PROTOCOL;
  }
  if (ui.lastSyncTimeText) {
    ui.lastSyncTimeText.textContent = syncTime || payload?.timestamp || "-";
  }
  if (ui.lastReceivedPayloadArea) {
    ui.lastReceivedPayloadArea.value = payload ? JSON.stringify(payload, null, 2) : "";
  }
}

function setIntegrationPayloadStatus(text, level = "ok") {
  state.integrationPayloadStatus = text;
  if (!ui.integrationPayloadStatusText) {
    return;
  }
  ui.integrationPayloadStatusText.textContent = text;
  ui.integrationPayloadStatusText.dataset.state = level;
}

function resolveIntegrationDataSource(sourceLabel = "", transport = "") {
  const source = String(sourceLabel || "").toLowerCase();
  const channel = String(transport || "").toLowerCase();

  if (source.includes("dock")) {
    return INTEGRATION_DATA_SOURCES.DOCK;
  }
  if (channel.includes("storage")) {
    return INTEGRATION_DATA_SOURCES.LOCALSTORAGE;
  }
  if (channel.includes("broadcast")) {
    return INTEGRATION_DATA_SOURCES.BROADCAST;
  }
  if (source.includes("manual") || source.includes("sample")) {
    return INTEGRATION_DATA_SOURCES.MOCK;
  }
  return state.integrationDataSource || INTEGRATION_DATA_SOURCES.MOCK;
}

function updateIntegrationPanel(payload = null, options = {}) {
  const dataSource = options.dataSource || state.integrationDataSource || INTEGRATION_DATA_SOURCES.MOCK;
  const payloadSource = payload?.source || options.payloadSource || state.integrationLastPayloadSource || "-";
  const lastUpdate = options.lastUpdate || payload?.timestamp || state.integrationLastDockUpdate || "-";
  const sport = payload?.sport || state.selectedTemplate?.sport || "-";
  const skin = payload?.skinId || (state.selectedTemplate ? `${state.selectedTemplate.id} - ${state.selectedTemplate.name}` : "-");
  const matchPreview = payload?.matchData || state.activeMatchData || {};

  state.integrationDataSource = dataSource;
  state.integrationLastPayloadSource = payloadSource;
  state.integrationLastDockUpdate = lastUpdate;

  if (ui.integrationDataSourceText) {
    ui.integrationDataSourceText.textContent = dataSource;
  }
  if (ui.integrationLastDockUpdateText) {
    ui.integrationLastDockUpdateText.textContent = lastUpdate;
  }
  if (ui.integrationLastPayloadSourceText) {
    ui.integrationLastPayloadSourceText.textContent = payloadSource;
  }
  if (ui.integrationCurrentSportText) {
    ui.integrationCurrentSportText.textContent = sport;
  }
  if (ui.integrationCurrentSkinText) {
    ui.integrationCurrentSkinText.textContent = skin;
  }
  if (ui.integrationCurrentMatchPreviewArea) {
    ui.integrationCurrentMatchPreviewArea.value = JSON.stringify(matchPreview, null, 2);
  }
}

function shouldListenRemoteUpdates() {
  return state.integrationMode !== "Off";
}

function renderValidationResult(result) {
  state.lastValidation = result;
  if (!ui.payloadValidationResult) {
    return;
  }

  const lines = [];
  lines.push(result.isValid ? "VALIDATION: PASS" : "VALIDATION: FAIL");
  lines.push(`Compatible: ${result.isCompatible ? "yes" : "no"}`);
  if (result.shape) {
    lines.push(`Shape: ${result.shape}`);
  }
  if (result.errors?.length) {
    lines.push("Errors:");
    result.errors.forEach((item) => lines.push(`- ${item}`));
  }
  if (result.warnings?.length) {
    lines.push("Warnings:");
    result.warnings.forEach((item) => lines.push(`- ${item}`));
  }

  ui.payloadValidationResult.value = lines.join("\n");
}

function renderContractReport(report) {
  if (!ui.contractReportArea) {
    return;
  }
  if (!report) {
    ui.contractReportArea.value = "";
    return;
  }

  const lines = [];
  lines.push(`Template: ${report.templateId || "-"}`);
  lines.push(`Sport/Type: ${report.sport || "-"}/${report.type || "-"}`);
  lines.push(`Contract Version: ${report.contractVersion || "-"}`);
  lines.push(`Status: ${report.isPass ? "PASS" : "FAIL"}`);
  lines.push(`Required Slots: ${report.requiredSlots?.length || 0}`);
  lines.push(`Rendered Slots: ${report.renderedSlots?.length || 0}`);
  lines.push(`Missing Required: ${(report.missingRequired || []).join(", ") || "-"}`);
  lines.push(`Missing Critical: ${(report.missingCritical || []).join(", ") || "-"}`);
  if (Array.isArray(report.warnings) && report.warnings.length > 0) {
    lines.push("Warnings:");
    report.warnings.forEach((item) => lines.push(`- ${item}`));
  }
  ui.contractReportArea.value = lines.join("\n");
}

function applyContractReport(report) {
  renderContractReport(report);
  if (!report) {
    updateContractStatus("Render Contract: waiting preview report", "warn");
    return;
  }
  if (report.missingCritical?.length) {
    updateContractStatus(`Render Contract: critical missing (${report.missingCritical.length})`, "error");
    return;
  }
  if (report.missingRequired?.length) {
    updateContractStatus(`Render Contract: warning (${report.missingRequired.length} slots missing)`, "warn");
    return;
  }
  updateContractStatus("Render Contract: PASS", "ok");
}

function buildProtocolPayloadFromState(partial = {}) {
  const template = partial.skinId
    ? getTemplateById(partial.skinId)
    : partial.type
      ? resolveTemplateForObsType(partial.type)
      : state.selectedTemplate || TEMPLATE_REGISTRY[0];
  const settings = getSettingsSnapshotForType(partial.type || template.type, template);
  const eventLogo = partial.eventLogo ?? settings.eventLogoDataUrl ?? state.eventLogoDataUrl;
  const matchData = applyEventLogoToMatchData(partial.matchData || state.activeMatchData || {}, eventLogo);
  return createProtocolPayload({
    source: partial.source || "PepsLiveScoreboardSkinStudio",
    timestamp: partial.timestamp || nowIso(),
    sport: partial.sport || template.sport,
    skinId: partial.skinId || template.id,
    type: partial.type || template.type,
    theme: partial.theme || settings.theme,
    animation: partial.animation || { style: settings.animationStyle },
    matchData,
    displayOptions: partial.displayOptions || settings.displayOptions
  });
}

function saveSkinState() {
  if (!state.selectedTemplate) {
    return;
  }
  captureCurrentTypeSettings(state.selectedTemplate.type);
  const payload = setCurrentSkin({
    skinId: state.selectedTemplate.id,
    sport: state.selectedTemplate.sport,
    type: state.selectedTemplate.type,
    theme: state.currentTheme,
    animation: {
      style: state.animationStyle
    },
    displayOptions: state.displayOptions,
    typeSettings: state.settingsByType,
    eventLogo: state.eventLogoDataUrl
  });
  state.currentSkin = payload;
}

async function resolveMatchDataForTemplate(template, { forceMock = false } = {}) {
  const sharedState = getSharedOverlayState();
  const sharedPayload = sharedState.currentPayload;
  if (!forceMock && sharedPayload?.matchData?.sport === template.sport) {
    return sharedPayload.matchData;
  }
  return getMockDataBySport(template.sport);
}

async function applyTemplate(template, options = {}) {
  const {
    markRecent = false,
    broadcast = true,
    forceMock = false,
    matchDataOverride = null,
    settingsProfileOverride = null
  } = options;
  const previousTemplateId = state.selectedTemplate?.id || "";
  const previousTemplateType = state.selectedTemplate?.type || "";
  const templateChanged = previousTemplateId !== template.id;
  if (previousTemplateType) {
    captureCurrentTypeSettings(previousTemplateType);
  }

  const nextProfile = settingsProfileOverride
    ? createSettingsProfile(settingsProfileOverride)
    : getSettingsSnapshotForType(template.type, template);
  state.selectedTemplate = template;
  applySettingsProfile(nextProfile);
  state.activeMatchData = applyEventLogoToMatchData(matchDataOverride || (await resolveMatchDataForTemplate(template, { forceMock })));

  previewEngine.setTheme(state.currentTheme);
  previewEngine.setAnimation(state.animationStyle);
  previewEngine.setSlotInspectorMode(state.slotInspectorMode);
  previewEngine.setVisualQaMode(state.visualQaMode);
  previewEngine.setDisplayOptions(state.displayOptions);
  previewEngine.setMatchData(state.activeMatchData);
  previewEngine.setTemplate(template);
  themeEditor.setTheme(state.currentTheme, { silent: true });
  ui.animationPreset.value = state.animationStyle;
  ui.slotInspectorSelect.value = state.slotInspectorMode;
  ui.visualQaModeSelect.value = state.visualQaMode;
  syncDisplayOptionControls();
  updateEventLogoUi();
  updateCurrentSkinLabel();
  updatePreviewSummary(template);
  if (templateChanged) {
    gallery?.setSelectedTemplateId?.(template.id);
  }
  refreshObsUrlsPanel();
  saveSkinState();

  updateIntegrationPanel(buildProtocolPayloadFromState(), {
    dataSource: matchDataOverride ? state.integrationDataSource : INTEGRATION_DATA_SOURCES.MOCK,
    payloadSource: matchDataOverride ? state.integrationLastPayloadSource || "external" : "mock-data",
    lastUpdate: nowIso()
  });
  const contract = getRenderContractByTemplateId(template.id);
  renderContractReport({
    templateId: contract.id,
    sport: contract.sport,
    type: contract.type,
    contractVersion: contract.contractVersion,
    requiredSlots: contract.requiredSlots,
    renderedSlots: [],
    missingRequired: [],
    missingCritical: [],
    warnings: ["Waiting for overlay render report"],
    isPass: false
  });
  updateContractStatus("Render Contract: waiting preview report", "warn");

  if (markRecent) {
    state.recentlyUsed = pushRecentlyUsed(template.id);
    gallery.setCollections({ favorites: state.favorites, recentlyUsed: state.recentlyUsed });
  }

  if (broadcast && state.bridge && !state.applyingRemote) {
    publishCurrentStateIfReady();
  }
}

async function applyNormalizedProtocolPayload(protocolPayload, sourceLabel, options = {}) {
  const { broadcast = true, dataSource = "", payloadSource = "" } = options;

  const template = getTemplateById(protocolPayload.skinId);
  const existingProfile = getTypeSettings(template.type);
  const profileOverride = createSettingsProfile({
    theme: hasObjectValues(protocolPayload.theme) ? protocolPayload.theme : existingProfile.theme,
    animation: hasObjectValues(protocolPayload.animation) ? protocolPayload.animation : existingProfile.animationStyle,
    displayOptions: hasObjectValues(protocolPayload.displayOptions) ? protocolPayload.displayOptions : existingProfile.displayOptions,
    eventLogo: protocolPayload.matchData?.eventLogo || existingProfile.eventLogoDataUrl
  });

  await applyTemplate(template, {
    markRecent: false,
    broadcast,
    forceMock: false,
    matchDataOverride: protocolPayload.matchData,
    settingsProfileOverride: profileOverride
  });

  updateProtocolMeta(protocolPayload, protocolPayload.timestamp);
  updateIntegrationPanel(protocolPayload, {
    dataSource: dataSource || resolveIntegrationDataSource(sourceLabel),
    payloadSource: payloadSource || protocolPayload.source || sourceLabel,
    lastUpdate: protocolPayload.timestamp
  });
  setIntegrationPayloadStatus("Payload Status: synced", "ok");
  notify(`Payload applied (${sourceLabel})`);
}

function isPepsLiveDockPayload(payload = null, sourceLabel = "") {
  return `${payload?.source || ""} ${sourceLabel || ""}`.toLowerCase().includes("pepslive-dock");
}

async function applyMatchDataOnlyPayload(protocolPayload, sourceLabel, options = {}) {
  const template = state.selectedTemplate || getTemplateById(protocolPayload.skinId) || TEMPLATE_REGISTRY[0];
  const sport = protocolPayload.matchData?.sport || protocolPayload.sport || template.sport || "football";
  const fallback = await getMockDataBySport(sport);
  const matchData = applyEventLogoToMatchData({
    ...fallback,
    ...(protocolPayload.matchData || {}),
    sport
  });
  const timestamp = protocolPayload.timestamp || nowIso();

  state.activeMatchData = matchData;
  previewEngine.setMatchData(matchData);

  const panelPayload = buildProtocolPayloadFromState({
    source: protocolPayload.source || sourceLabel || "pepslive-dock",
    timestamp,
    sport: matchData.sport || template.sport,
    skinId: template.id,
    type: template.type,
    theme: state.currentTheme,
    animation: { style: state.animationStyle },
    matchData,
    displayOptions: state.displayOptions
  });

  updateProtocolMeta(panelPayload, timestamp);
  updateIntegrationPanel(panelPayload, {
    dataSource: options.dataSource || resolveIntegrationDataSource(protocolPayload.source || sourceLabel, options.transport || ""),
    payloadSource: protocolPayload.source || sourceLabel,
    lastUpdate: timestamp
  });
  setIntegrationPayloadStatus("Payload Status: match data synced", "ok");
  refreshObsUrlsPanel();
}

async function validateRawPayload(rawPayload) {
  if (!dockAdapter) {
    return {
      isValid: false,
      isCompatible: false,
      errors: ["Dock adapter not available"],
      warnings: [],
      normalizedPayload: null,
      shape: "unknown"
    };
  }

  const adapterResult = await dockAdapter.ingest(rawPayload);
  if (!adapterResult.accepted) {
    return {
      isValid: false,
      isCompatible: false,
      errors: adapterResult.errors || ["Payload rejected"],
      warnings: adapterResult.warnings || [],
      normalizedPayload: null,
      shape: adapterResult.shape
    };
  }

  const validation = await validateIncomingPayload(adapterResult.payload);
  const mergedWarnings = [...new Set([...(adapterResult.warnings || []), ...(validation.warnings || [])])];
  const mergedErrors = [...new Set([...(adapterResult.errors || []), ...(validation.errors || [])])];
  return {
    ...validation,
    warnings: mergedWarnings,
    errors: mergedErrors,
    shape: adapterResult.shape
  };
}

async function handlePayloadValidation(rawPayload) {
  const result = await validateRawPayload(rawPayload);
  renderValidationResult(result);
  if (!result.isValid) {
    updateBridgeStatus("Payload rejected by validator", "warn");
  } else {
    updateBridgeStatus("Payload validation passed", "ok");
  }
  return result;
}

async function handlePayloadIngest(rawPayload, sourceLabel, options = {}) {
  const validation = await handlePayloadValidation(rawPayload);
  if (!validation.isValid || !validation.normalizedPayload) {
    setIntegrationPayloadStatus("Payload Status: rejected", "warn");
    notify(`Payload rejected (${sourceLabel})`, "warn");
    return;
  }
  if (options.matchDataOnly || isPepsLiveDockPayload(validation.normalizedPayload, sourceLabel)) {
    await applyMatchDataOnlyPayload(validation.normalizedPayload, sourceLabel, {
      dataSource: options.dataSource || resolveIntegrationDataSource(sourceLabel, options.transport || ""),
      transport: options.transport || ""
    });
    return;
  }
  await applyNormalizedProtocolPayload(validation.normalizedPayload, sourceLabel, {
    broadcast: options.broadcast ?? true,
    dataSource: options.dataSource || resolveIntegrationDataSource(sourceLabel, options.transport || ""),
    payloadSource: validation.normalizedPayload.source || sourceLabel
  });
}

async function loadSamplePayload(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Cannot load ${path}`);
  }
  return response.json();
}

async function copyOverlayUrlForTemplate(template, { debug = false, feedbackButton = null, fallbackTarget = ui.skinJsonArea } = {}) {
  if (!template || !previewEngine) {
    return false;
  }
  const result = buildPortableUrlByType(template.type, { debug, forceVersion: Date.now() });
  const url = result.url;
  if (result.warning) {
    notify(result.warning, "warn");
  }
  const copied = await copyText(url, fallbackTarget);
  if (copied) {
    flashCopyButton(feedbackButton);
    flashMessage(`Copied ${debug ? "Debug" : "Production"} URL`, "info");
  } else {
    notify("Clipboard unavailable. URL written to JSON area", "warn");
  }
  return copied;
}

async function copyCurrentOverlayUrl(template = state.selectedTemplate, options = {}) {
  return copyOverlayUrlForTemplate(template, { ...options, debug: false });
}

async function copyCurrentOverlayDebugUrl(template = state.selectedTemplate, options = {}) {
  return copyOverlayUrlForTemplate(template, { ...options, debug: true });
}

function openSettingsModal() {
  if (!ui.settingsModal) {
    return;
  }
  if (typeof ui.settingsModal.showModal === "function") {
    ui.settingsModal.showModal();
  } else {
    ui.settingsModal.setAttribute("open", "");
  }
  window.requestAnimationFrame(() => {
    previewEngine?.postLiveUpdate?.();
  });
}

function closeSettingsModal() {
  if (!ui.settingsModal) {
    return;
  }
  if (typeof ui.settingsModal.close === "function") {
    ui.settingsModal.close();
  } else {
    ui.settingsModal.removeAttribute("open");
  }
}

function publishCurrentStateIfReady() {
  if (state.publishTimer) {
    window.clearTimeout(state.publishTimer);
    state.publishTimer = 0;
  }
  if (!state.bridge || !state.selectedTemplate || state.applyingRemote) {
    return;
  }
  const payload = buildProtocolPayloadFromState();
  state.lastProtocolPayload = payload;
  state.bridge.publishState(payload);
  updateProtocolMeta(payload, payload.timestamp);
}

function scheduleCurrentStatePublish(delay = 160) {
  if (state.publishTimer) {
    window.clearTimeout(state.publishTimer);
  }
  state.publishTimer = window.setTimeout(() => {
    state.publishTimer = 0;
    publishCurrentStateIfReady();
  }, delay);
}

function rgbToHex(r, g, b) {
  return `#${[r, g, b].map((value) => Math.max(0, Math.min(255, value)).toString(16).padStart(2, "0")).join("")}`;
}

function extractPaletteFromPixels(pixels) {
  const buckets = new Map();
  for (let index = 0; index < pixels.length; index += 16) {
    const alpha = pixels[index + 3];
    if (alpha < 160) {
      continue;
    }
    const r = pixels[index];
    const g = pixels[index + 1];
    const b = pixels[index + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const saturation = max - min;
    if (saturation < 18 && max > 220) {
      continue;
    }
    const qr = Math.round(r / 32) * 32;
    const qg = Math.round(g / 32) * 32;
    const qb = Math.round(b / 32) * 32;
    const key = `${qr},${qg},${qb}`;
    const current = buckets.get(key) || { count: 0, score: 0, color: rgbToHex(qr, qg, qb) };
    current.count += 1;
    current.score += saturation + Math.abs(128 - max) * 0.15;
    buckets.set(key, current);
  }
  return Array.from(buckets.values())
    .sort((a, b) => b.count * b.score - a.count * a.score)
    .map((item) => item.color)
    .filter((color, index, list) => list.indexOf(color) === index)
    .slice(0, 5);
}

function drawImageToAnalysisCanvas(image, maxSize = 256) {
  const canvas = document.createElement("canvas");
  const naturalWidth = image.naturalWidth || image.width || maxSize;
  const naturalHeight = image.naturalHeight || image.height || maxSize;
  const scale = Math.min(maxSize / naturalWidth, maxSize / naturalHeight, 1);
  canvas.width = Math.max(1, Math.round(naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(naturalHeight * scale));
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return { dataUrl: "", colors: [] };
  }
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  return {
    dataUrl: canvas.toDataURL("image/png"),
    colors: extractPaletteFromPixels(pixels)
  };
}

function extractPaletteFromDataUrl(dataUrl) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      resolve(drawImageToAnalysisCanvas(image, 128).colors);
    };
    image.onerror = () => resolve([]);
    image.src = dataUrl;
  });
}

function prepareEventLogoImage(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      try {
        resolve(drawImageToAnalysisCanvas(image, 256));
      } catch (error) {
        reject(error);
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Cannot decode event logo image"));
    };
    image.src = objectUrl;
  });
}

function applyPaletteToTheme(colors = state.eventLogoPalette, { publish = true } = {}) {
  if (!colors.length) {
    return;
  }
  const nextTheme = {
    ...state.currentTheme,
    primaryColor: colors[0] || state.currentTheme.primaryColor,
    accentColor: colors[1] || colors[0] || state.currentTheme.accentColor,
    homeColor: colors[0] || state.currentTheme.homeColor,
    awayColor: colors[2] || colors[1] || state.currentTheme.awayColor
  };
  if (publish) {
    themeEditor.setTheme(nextTheme);
  } else {
    state.currentTheme = nextTheme;
    state.animationStyle = nextTheme.animationStyle || state.animationStyle;
    themeEditor.setTheme(nextTheme, { silent: true });
    previewEngine.setTheme(nextTheme);
    previewEngine.setAnimation(state.animationStyle);
    if (state.selectedTemplate) {
      setThemeBySkinId(state.selectedTemplate.id, nextTheme);
    }
  }
  notify("Logo palette applied to scoreboard theme");
}

async function handleEventLogoUpload(file) {
  if (!file) {
    return;
  }
  if (!file.type.startsWith("image/")) {
    notify("Please choose an image file for the event logo", "warn");
    return;
  }
  if (ui.eventLogoStatusText) {
    ui.eventLogoStatusText.textContent = "Processing logo and color palette...";
  }
  const prepared = await prepareEventLogoImage(file);
  state.eventLogoDataUrl = prepared.dataUrl;
  state.eventLogoPalette = prepared.colors;
  state.activeMatchData = applyEventLogoToMatchData(state.activeMatchData || {});
  previewEngine.setMatchData(state.activeMatchData);
  updateEventLogoUi();
  if (ui.eventLogoAutoTheme?.checked) {
    applyPaletteToTheme(state.eventLogoPalette, { publish: false });
  }
  saveSkinState();
  refreshObsUrlsPanel();
  syncGalleryPreviewContext({ refreshFrames: true });
  scheduleCurrentStatePublish(220);
  notify("Event logo loaded for current skin");
}

function clearEventLogo() {
  state.eventLogoDataUrl = "";
  state.eventLogoPalette = [];
  if (state.activeMatchData) {
    state.activeMatchData = { ...state.activeMatchData, eventLogo: "" };
    previewEngine.setMatchData(state.activeMatchData);
  }
  updateEventLogoUi();
  saveSkinState();
  refreshObsUrlsPanel();
  syncGalleryPreviewContext({ refreshFrames: true });
  scheduleCurrentStatePublish(220);
  notify("Event logo removed");
}

async function addSourceToObs(template = state.selectedTemplate) {
  if (!template || !previewEngine) {
    return;
  }

  const preset = getSourcePreset(template.type);
  const url = buildPortableUrlByType(template.type, { debug: false, forceVersion: Date.now() }).url;

  if (!obsManager.connected) {
    await copyText(url, ui.skinJsonArea);
    notify("OBS disconnected. Manual mode: copy URL and add Browser Source manually", "warn");
    return;
  }

  try {
    const result = await obsManager.addBrowserSource({
      type: template.type,
      url,
      width: preset.width,
      height: preset.height
    });
    notify(`Add Source success (${result.inputName})`);
    await obsManager.refreshConnectionInfo();
  } catch (error) {
    await copyText(url, ui.skinJsonArea);
    notify(`Add Source failed: ${error.message}`, "error");
  }
}

function bindSidebarFilters() {
  ui.sportFilter.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-value]");
    if (!button) {
      return;
    }
    gallery.setFilter({ sport: button.dataset.value });
    setButtonGroupActive(ui.sportFilter, button.dataset.value);
  });

  ui.typeFilter.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-value]");
    if (!button) {
      return;
    }
    gallery.setFilter({ type: button.dataset.value });
    setButtonGroupActive(ui.typeFilter, button.dataset.value);
  });

  ui.styleFilter.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-value]");
    if (!button) {
      return;
    }
    gallery.setFilter({ styleTag: button.dataset.value === "all" ? "all" : button.dataset.value });
    setButtonGroupActive(ui.styleFilter, button.dataset.value);
  });

  ui.listFilter.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-value]");
    if (!button) {
      return;
    }
    gallery.setFilter({ list: button.dataset.value });
    setButtonGroupActive(ui.listFilter, button.dataset.value);
  });
}

function bindTopActions() {
  ui.copyUrlBtn.addEventListener("click", () => {
    copyCurrentOverlayUrl(undefined, { feedbackButton: ui.copyUrlBtn });
  });

  ui.openSettingsBtn?.addEventListener("click", () => {
    openSettingsModal();
  });

  ui.closeSettingsBtn?.addEventListener("click", () => {
    closeSettingsModal();
  });

  ui.settingsModal?.addEventListener("click", (event) => {
    if (event.target === ui.settingsModal) {
      closeSettingsModal();
    }
  });

  ui.addSourceBtn.addEventListener("click", () => {
    addSourceToObs();
  });

  ui.previewCopyProductionBtn?.addEventListener("click", () => {
    copyCurrentOverlayUrl(undefined, { feedbackButton: ui.previewCopyProductionBtn });
  });

  ui.previewCopyDebugBtn?.addEventListener("click", () => {
    copyCurrentOverlayDebugUrl(undefined, { feedbackButton: ui.previewCopyDebugBtn });
  });

  ui.previewAddSourceBtn?.addEventListener("click", () => {
    addSourceToObs();
  });
}

function collectFrameCss(frameDocument) {
  const chunks = [];
  Array.from(frameDocument.styleSheets || []).forEach((sheet) => {
    try {
      Array.from(sheet.cssRules || []).forEach((rule) => chunks.push(rule.cssText));
    } catch (_error) {
      // Ignore inaccessible stylesheets; overlay assets are same-origin in normal use.
    }
  });
  chunks.push(`
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      width: 100% !important;
      height: 100% !important;
      overflow: hidden !important;
      background: transparent !important;
    }
    #overlay-debug-box,
    #overlay-relay-status {
      display: none !important;
    }
  `);
  return chunks.join("\n");
}

function waitForImageLoad(image) {
  return new Promise((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("PNG renderer could not decode the preview SVG"));
  });
}

function escapeXmlAttribute(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function exportCurrentPreviewPng() {
  if (!state.selectedTemplate || !ui.previewFrame?.contentDocument) {
    notify("Preview is not ready for PNG export", "warn");
    return;
  }

  previewEngine?.postLiveUpdate?.();
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  const frameDocument = ui.previewFrame.contentDocument;
  const preset = getSourcePreset(state.selectedTemplate.type);
  const width = preset.width;
  const height = preset.height;
  const bodyClone = frameDocument.body.cloneNode(true);
  bodyClone.querySelector("#overlay-debug-box")?.remove();
  bodyClone.querySelector("#overlay-relay-status")?.remove();
  bodyClone.querySelectorAll("script").forEach((node) => node.remove());
  bodyClone.setAttribute(
    "style",
    `margin:0;padding:0;width:${width}px;height:${height}px;overflow:hidden;background:transparent !important;`
  );

  const htmlStyle = escapeXmlAttribute(frameDocument.documentElement.getAttribute("style") || "");
  const serializer = new XMLSerializer();
  const css = collectFrameCss(frameDocument);
  const safeCss = css.replace(/\]\]>/g, "]]]]><![CDATA[>");
  const serializedBody = serializer.serializeToString(bodyClone);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <foreignObject width="100%" height="100%">
        <html xmlns="http://www.w3.org/1999/xhtml" style="${htmlStyle}">
          <head><style><![CDATA[${safeCss}]]></style></head>
          ${serializedBody}
        </html>
      </foreignObject>
    </svg>
  `;

  const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const svgUrl = URL.createObjectURL(svgBlob);
  const image = new Image();
  image.decoding = "async";
  const imageLoad = waitForImageLoad(image);
  image.src = svgUrl;

  try {
    await imageLoad;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Canvas is not available");
    }
    context.clearRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    const pngBlob = await new Promise((resolve) => {
      if (canvas.toBlob) {
        canvas.toBlob((blob) => resolve(blob), "image/png");
        return;
      }
      resolve(null);
    });
    const pngUrl = pngBlob ? URL.createObjectURL(pngBlob) : canvas.toDataURL("image/png");
    const anchor = document.createElement("a");
    anchor.href = pngUrl;
    anchor.download = `pepslive-${state.selectedTemplate.id}-${width}x${height}.png`;
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    if (pngBlob) {
      window.setTimeout(() => URL.revokeObjectURL(pngUrl), 1000);
    }
    notify("PNG exported from current preview");
  } catch (error) {
    notify(`PNG export failed: ${error.message}`, "error");
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

function bindPreviewTools() {
  ui.backgroundMode.addEventListener("change", () => {
    previewEngine.setBackgroundMode(ui.backgroundMode.value);
  });

  ui.safeAreaMode.addEventListener("change", () => {
    previewEngine.setSafeAreaMode(ui.safeAreaMode.value);
  });

  ui.animationPreset.addEventListener("change", () => {
    state.animationStyle = ui.animationPreset.value;
    state.currentTheme = { ...state.currentTheme, animationStyle: state.animationStyle };
    previewEngine.setAnimation(state.animationStyle);
    previewEngine.setTheme(state.currentTheme);
    if (state.selectedTemplate) {
      setThemeBySkinId(state.selectedTemplate.id, state.currentTheme);
      saveSkinState();
    }
    if (!state.applyingRemote) {
      scheduleCurrentStatePublish();
    }
  });

  ui.slotInspectorSelect.addEventListener("change", () => {
    state.slotInspectorMode = ui.slotInspectorSelect.value;
    previewEngine.setSlotInspectorMode(state.slotInspectorMode);
  });

  ui.visualQaModeSelect.addEventListener("change", () => {
    state.visualQaMode = ui.visualQaModeSelect.value;
    previewEngine.setVisualQaMode(state.visualQaMode);
  });

  ui.previewExportPngBtn?.addEventListener("click", () => {
    exportCurrentPreviewPng();
  });

  const handleDisplayOptionInput = (event) => {
    const input = event.target.closest("input[data-display-option]");
    const select = event.target.closest("select[data-display-option]");
    if (!input && !select) {
      return;
    }
    const key = input?.dataset.displayOption || select?.dataset.displayOption;
    let value = select ? select.value : input.checked;
    if (input && input.type !== "checkbox") {
      const parsed = Number(input.value);
      value = Number.isFinite(parsed) ? parsed : input.value;
    }
    state.displayOptions = {
      ...DEFAULT_DISPLAY_OPTIONS,
      ...state.displayOptions,
      [key]: value
    };
    previewEngine.setDisplayOptions(state.displayOptions);
    refreshObsUrlsPanel();
    scheduleGalleryPreviewRefresh();
    saveSkinState();
    scheduleCurrentStatePublish();
  };

  ui.displayOptionsForm?.addEventListener("input", handleDisplayOptionInput);
  ui.displayOptionsForm?.addEventListener("change", handleDisplayOptionInput);

  // Phase 5.0: Team Name Alignment button group
  ui.teamNameAlignGroup?.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-value]");
    if (!btn) return;
    const alignValue = btn.dataset.value;
    state.displayOptions = {
      ...DEFAULT_DISPLAY_OPTIONS,
      ...state.displayOptions,
      teamNameAlign: alignValue
    };
    setButtonGroupActive(ui.teamNameAlignGroup, alignValue);
    previewEngine.setDisplayOptions(state.displayOptions);
    refreshObsUrlsPanel();
    scheduleGalleryPreviewRefresh();
    saveSkinState();
    scheduleCurrentStatePublish();
  });

  ui.eventLogoInput?.addEventListener("change", async () => {
    const file = ui.eventLogoInput.files?.[0];
    try {
      await handleEventLogoUpload(file);
    } catch (error) {
      notify(`Event logo failed: ${error.message}`, "error");
    } finally {
      ui.eventLogoInput.value = "";
    }
  });

  ui.clearEventLogoBtn?.addEventListener("click", () => {
    clearEventLogo();
  });

  ui.applyEventPaletteBtn?.addEventListener("click", () => {
    applyPaletteToTheme();
  });

  ui.eventPaletteSwatches?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-color]");
    if (!button) {
      return;
    }
    const color = button.dataset.color;
    themeEditor.setTheme({ ...state.currentTheme, primaryColor: color, accentColor: color });
  });
}

async function importSkinSettingsPayload(parsed) {
  const template = getTemplateById(parsed.skinId);
  state.settingsByType = mergeStoredTypeSettings(parsed.typeSettings || state.settingsByType);
  state.settingsByType[template.type] = createSettingsProfile({
    theme: parsed.theme || state.settingsByType[template.type]?.theme,
    animation: parsed.animation || state.settingsByType[template.type]?.animationStyle,
    displayOptions: parsed.displayOptions || state.settingsByType[template.type]?.displayOptions,
    eventLogo: parsed.eventLogo || state.settingsByType[template.type]?.eventLogoDataUrl
  });
  applySettingsProfile(state.settingsByType[template.type]);
  state.eventLogoPalette = state.eventLogoDataUrl ? await extractPaletteFromDataUrl(state.eventLogoDataUrl) : [];
  state.settingsByType[template.type].eventLogoPalette = state.eventLogoPalette;
  syncDisplayOptionControls();
  updateEventLogoUi();
  setThemeBySkinId(template.id, state.currentTheme);
  await applyTemplate(template, { markRecent: true, broadcast: true, forceMock: false });
  return template;
}

function bindSkinJsonActions() {
  ui.exportJsonBtn.addEventListener("click", () => {
    if (!state.selectedTemplate) {
      return;
    }
    const payload = exportSkinJson({
      skinId: state.selectedTemplate.id,
      sport: state.selectedTemplate.sport,
      type: state.selectedTemplate.type,
      theme: state.currentTheme,
      animation: {
        style: state.animationStyle
      },
      displayOptions: state.displayOptions,
      typeSettings: state.settingsByType,
      eventLogo: state.eventLogoDataUrl,
      createdAt: state.currentSkin?.createdAt
    });
    ui.skinJsonArea.value = JSON.stringify(payload, null, 2);
    downloadJson(`skin-${state.selectedTemplate.id}.json`, payload);
    notify("Export Skin JSON complete");
  });

  ui.loadSkinJsonFileBtn?.addEventListener("click", () => {
    ui.skinJsonFileInput?.click();
  });

  ui.skinJsonFileInput?.addEventListener("change", async () => {
    const file = ui.skinJsonFileInput.files?.[0];
    if (!file) {
      return;
    }
    try {
      const raw = await file.text();
      const parsed = JSON.parse(raw);
      ui.skinJsonArea.value = JSON.stringify(parsed, null, 2);
      const template = await importSkinSettingsPayload(parsed);
      notify(`Settings file imported: ${template.id}`);
    } catch (error) {
      notify(`Open settings file failed: ${error.message}`, "error");
    } finally {
      ui.skinJsonFileInput.value = "";
    }
  });

  ui.importJsonBtn.addEventListener("click", async () => {
    const raw = ui.skinJsonArea.value.trim();
    if (!raw) {
      notify("Paste Skin JSON before import", "warn");
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      const template = await importSkinSettingsPayload(parsed);
      notify(`Import Skin success: ${template.id}`);
    } catch (error) {
      notify(`Import JSON failed: ${error.message}`, "error");
    }
  });

  ui.resetSkinBtn.addEventListener("click", async () => {
    if (!state.selectedTemplate) {
      return;
    }
    const resetPayload = resetSkin({
      skinId: state.selectedTemplate.id,
      sport: state.selectedTemplate.sport,
      type: state.selectedTemplate.type,
      theme: DEFAULT_THEME,
      animation: { style: DEFAULT_THEME.animationStyle },
      displayOptions: { ...DEFAULT_DISPLAY_OPTIONS },
      typeSettings: {
        ...state.settingsByType,
        [state.selectedTemplate.type]: createSettingsProfile()
      },
      eventLogo: ""
    });
    state.currentSkin = resetPayload;
    state.currentTheme = { ...DEFAULT_THEME };
    state.animationStyle = DEFAULT_THEME.animationStyle;
    state.displayOptions = { ...DEFAULT_DISPLAY_OPTIONS };
    state.eventLogoDataUrl = "";
    state.eventLogoPalette = [];
    state.settingsByType[state.selectedTemplate.type] = createSettingsProfile();
    syncDisplayOptionControls();
    updateEventLogoUi();
    setThemeBySkinId(state.selectedTemplate.id, state.currentTheme);
    await applyTemplate(state.selectedTemplate, { markRecent: false, broadcast: true, forceMock: false });
    notify("Reset Skin complete");
  });

  ui.duplicateSkinBtn.addEventListener("click", () => {
    if (!state.currentSkin) {
      return;
    }
    const cloned = duplicateSkin(state.currentSkin);
    state.currentSkin = cloned;
    ui.skinJsonArea.value = JSON.stringify(cloned, null, 2);
    notify("Duplicate Skin complete");
  });
}

function updateObsStatus(statusInput) {
  const status = typeof statusInput === "boolean" ? { connected: statusInput } : statusInput || {};
  const connected = !!status.connected;
  const errorMessage = status.errorMessage || "";
  const sceneName = status.sceneName || "-";

  if (ui.obsStatusText) {
    ui.obsStatusText.textContent = connected ? "Connected" : "Disconnected";
    ui.obsStatusText.classList.toggle("connected", connected);
    ui.obsStatusText.classList.toggle("disconnected", !connected);
  }

  if (ui.obsPanelStatusText) {
    if (connected) {
      ui.obsPanelStatusText.textContent = `connected ${status.endpoint || ""}`.trim();
      ui.obsPanelStatusText.dataset.state = "ok";
    } else if (status.available === false) {
      ui.obsPanelStatusText.textContent = "websocket unavailable";
      ui.obsPanelStatusText.dataset.state = "error";
    } else {
      ui.obsPanelStatusText.textContent = "manual mode";
      ui.obsPanelStatusText.dataset.state = "warn";
    }
  }

  if (ui.obsCurrentSceneText) {
    ui.obsCurrentSceneText.textContent = sceneName;
  }
  if (ui.obsConnectionErrorText) {
    ui.obsConnectionErrorText.textContent = errorMessage || "-";
  }

  if (ui.obsConnectBtn) {
    ui.obsConnectBtn.disabled = connected;
  }
  if (ui.obsDisconnectBtn) {
    ui.obsDisconnectBtn.disabled = !connected;
  }

  if (ui.obsManualGuideText) {
    ui.obsManualGuideText.textContent = connected
      ? "OBS connected. You can add or refresh Browser Sources directly from this panel."
      : "OBS disconnected. Use Manual Mode: copy Production URL and add Browser Source in OBS with the recommended width/height.";
  }
}

function evaluateObsHealthReport({ urls, liveHealth, summaryHealth }) {
  const items = [];
  const templateExists = !!(state.selectedTemplate && TEMPLATE_REGISTRY.some((item) => item.id === state.selectedTemplate.id));
  const livePreset = getSourcePreset("live");
  const summaryPreset = getSourcePreset("summary");
  const contractPass = (ui.contractStatusText?.textContent || "").toUpperCase().includes("PASS");

  const pushItem = (level, text) => items.push({ level, text });

  const isValidUrl = (value) => {
    try {
      return !!new URL(value);
    } catch (_error) {
      return false;
    }
  };

  pushItem(isValidUrl(urls.liveProd) && isValidUrl(urls.summaryProd) ? "ok" : "error", "Overlay URL valid");
  pushItem(templateExists ? "ok" : "error", "Selected skin exists");
  pushItem(livePreset && summaryPreset ? "ok" : "error", "Source size preset selected");
  pushItem(obsManager.connected ? "ok" : "warning", obsManager.connected ? "OBS connected" : "OBS manual mode");
  pushItem(contractPass ? "ok" : "warning", "Current template contract status");
  pushItem("ok", "Transparent background reminder: keep OBS source CSS transparent");
  pushItem(urls.liveProd.includes("debug=1") || urls.summaryProd.includes("debug=1") ? "warning" : "ok", "Debug mode off for production URL");
  const githubReady =
    urls.liveProd.includes("/overlays/live.html") &&
    urls.summaryProd.includes("/overlays/summary.html") &&
    !urls.liveProd.includes("/src/") &&
    !urls.summaryProd.includes("/src/");
  pushItem(githubReady ? "ok" : "error", "GitHub Pages URL ready");

  if (obsManager.connected) {
    pushItem(liveHealth?.sourceExists ? "ok" : "warning", `Live source: ${liveHealth?.sourceExists ? "found" : "not found"}`);
    pushItem(summaryHealth?.sourceExists ? "ok" : "warning", `Summary source: ${summaryHealth?.sourceExists ? "found" : "not found"}`);
    if (liveHealth && !liveHealth.urlMatch) {
      pushItem("warning", "Live source URL mismatch");
    }
    if (summaryHealth && !summaryHealth.urlMatch) {
      pushItem("warning", "Summary source URL mismatch");
    }
  }

  const severity = items.some((item) => item.level === "error")
    ? "error"
    : items.some((item) => item.level === "warning")
      ? "warn"
      : "ok";
  const summaryText = severity === "error" ? "Health status: Error" : severity === "warn" ? "Health status: Warning" : "Health status: OK";

  return { severity, summaryText, items };
}

function renderObsHealthReport(report) {
  state.obsLastHealthResult = report;
  if (ui.obsHealthStatusText) {
    ui.obsHealthStatusText.textContent = report.summaryText;
    ui.obsHealthStatusText.dataset.state = report.severity;
  }
  if (ui.obsHealthResultArea) {
    ui.obsHealthResultArea.value = report.items
      .map((item) => {
        const tag = item.level === "ok" ? "OK" : item.level === "warning" ? "Warning" : "Error";
        return `[${tag}] ${item.text}`;
      })
      .join("\n");
  }
}

async function runObsHealthCheck() {
  const urls = refreshObsUrlsPanel();
  let liveHealth = null;
  let summaryHealth = null;
  if (obsManager.connected) {
    liveHealth = await obsManager.healthCheck({ type: "live", expectedUrl: urls.liveProd });
    summaryHealth = await obsManager.healthCheck({ type: "summary", expectedUrl: urls.summaryProd });
  }
  const report = evaluateObsHealthReport({ urls, liveHealth, summaryHealth });
  renderObsHealthReport(report);
  notify(report.summaryText, report.severity === "error" ? "error" : report.severity === "warn" ? "warn" : "info");
}

async function addObsSourceForType(type) {
  const template = resolveTemplateForObsType(type);
  const preset = getSourcePreset(type);
  const url = buildPortableUrlByType(type, { debug: false, forceVersion: Date.now() }).url;
  if (!obsManager.connected) {
    await copyText(url, ui.skinJsonArea);
    notify(`OBS disconnected. Manual mode: copy ${type} URL and add Browser Source manually`, "warn");
    return;
  }
  const result = await obsManager.addBrowserSource({
    type,
    url,
    width: preset.width,
    height: preset.height
  });
  notify(`Add ${type} source success (${result.inputName})`);
  await obsManager.refreshConnectionInfo();
  refreshObsUrlsPanel();
}

function bindObsPanel() {
  const requiredObsNodes = [
    ui.obsHost,
    ui.obsPort,
    ui.obsPassword,
    ui.obsConnectBtn,
    ui.obsDisconnectBtn,
    ui.obsTestBtn,
    ui.livePresetSelect,
    ui.summaryPresetSelect,
    ui.obsRefreshTargetSelect,
    ui.refreshSelectedSourceBtn,
    ui.forceRefreshSourceBtn,
    ui.regenerateUrlBtn,
    ui.copyFreshUrlBtn,
    ui.obsHealthBtn
  ];
  if (requiredObsNodes.some((node) => !node)) {
    notify("OBS Source Manager UI missing some elements. Manual URL copy is still available.", "warn");
    return;
  }

  const obsConfig = getObsConfig();
  ui.obsHost.value = obsConfig.host;
  ui.obsPort.value = obsConfig.port;
  ui.obsPassword.value = obsConfig.password;
  ui.obsCustomCssText.value = OBS_CUSTOM_CSS;
  ui.livePresetSelect.innerHTML = Object.entries(LIVE_SOURCE_PRESETS)
    .map(([key, item]) => `<option value="${key}">${item.label}</option>`)
    .join("");
  ui.summaryPresetSelect.innerHTML = Object.entries(SUMMARY_SOURCE_PRESETS)
    .map(([key, item]) => `<option value="${key}">${item.label}</option>`)
    .join("");
  ui.livePresetSelect.value = state.obsLivePreset;
  ui.summaryPresetSelect.value = state.obsSummaryPreset;
  refreshObsUrlsPanel();
  updateObsStatus({ connected: false, errorMessage: "" });

  ui.obsConnectBtn.addEventListener("click", async () => {
    const connected = await obsManager.connect({
      host: ui.obsHost.value.trim() || "localhost",
      port: ui.obsPort.value.trim() || "4455",
      password: ui.obsPassword.value
    });
    if (connected) {
      await obsManager.refreshConnectionInfo();
    }
    updateObsStatus(obsManager.statusSnapshot());
    notify(connected ? "OBS connected" : "OBS connect failed: manual mode", connected ? "info" : "warn");
  });

  ui.obsDisconnectBtn.addEventListener("click", async () => {
    await obsManager.disconnect();
    updateObsStatus(obsManager.statusSnapshot());
    notify("OBS disconnected. Manual mode enabled", "warn");
  });

  ui.obsTestBtn.addEventListener("click", async () => {
    try {
      const version = await obsManager.testConnection();
      await obsManager.getCurrentSceneName().catch(() => "");
      updateObsStatus(obsManager.statusSnapshot());
      notify(`OBS test OK | ${version.obsVersion || "unknown"}`);
    } catch (error) {
      updateObsStatus({ ...obsManager.statusSnapshot(), errorMessage: error.message });
      notify(`OBS test failed: ${error.message}`, "error");
    }
  });

  ui.livePresetSelect.addEventListener("change", () => {
    state.obsLivePreset = ui.livePresetSelect.value;
    updatePreviewSummary();
    refreshObsUrlsPanel();
  });

  ui.summaryPresetSelect.addEventListener("change", () => {
    state.obsSummaryPreset = ui.summaryPresetSelect.value;
    updatePreviewSummary();
    refreshObsUrlsPanel();
  });

  ui.addLiveSourceBtn.addEventListener("click", async () => {
    try {
      await addObsSourceForType("live");
    } catch (error) {
      notify(`Add live source failed: ${error.message}`, "error");
    }
  });

  ui.addSummarySourceBtn.addEventListener("click", async () => {
    try {
      await addObsSourceForType("summary");
    } catch (error) {
      notify(`Add summary source failed: ${error.message}`, "error");
    }
  });

  ui.addBothSourcesBtn.addEventListener("click", async () => {
    try {
      await addObsSourceForType("live");
      await addObsSourceForType("summary");
    } catch (error) {
      notify(`Add both sources failed: ${error.message}`, "error");
    }
  });

  ui.refreshSelectedSourceBtn.addEventListener("click", async () => {
    const selectedType = ui.obsRefreshTargetSelect.value || "live";
    if (!obsManager.connected) {
      notify("OBS disconnected. Please refresh source cache manually in OBS", "warn");
      return;
    }
    try {
      await obsManager.refreshBrowserSource(selectedType);
      notify(`Refresh ${selectedType} source success`);
    } catch (error) {
      notify(`Refresh ${selectedType} source failed: ${error.message}`, "error");
    }
  });

  ui.forceRefreshSourceBtn.addEventListener("click", async () => {
    const selectedType = ui.obsRefreshTargetSelect.value || "live";
    if (!obsManager.connected) {
      notify("OBS disconnected. Use OBS Browser Source 'Refresh cache of current page'", "warn");
      return;
    }
    try {
      await obsManager.refreshBrowserSource(selectedType);
      state.obsUrlVersion = Date.now();
      refreshObsUrlsPanel();
      notify(`Force refresh ${selectedType} source success`);
    } catch (error) {
      notify(`Force refresh failed: ${error.message}`, "error");
    }
  });

  ui.regenerateUrlBtn.addEventListener("click", () => {
    state.obsUrlVersion = Date.now();
    refreshObsUrlsPanel();
    notify("Regenerated URL with fresh cache buster");
  });

  ui.copyFreshUrlBtn.addEventListener("click", async () => {
    state.obsUrlVersion = Date.now();
    const urls = refreshObsUrlsPanel();
    const selectedType = ui.obsRefreshTargetSelect.value || "live";
    const url = selectedType === "summary" ? urls.summaryProd : urls.liveProd;
    const copied = await copyText(url, ui.skinJsonArea);
    if (copied) {
      flashCopyButton(ui.copyFreshUrlBtn);
      flashMessage("Copied fresh URL", "info");
    } else {
      notify("Clipboard unavailable. URL written to JSON area", "warn");
    }
  });

  ui.copyLiveProductionUrlBtn.addEventListener("click", async () => {
    const urls = refreshObsUrlsPanel();
    const copied = await copyText(urls.liveProd, ui.skinJsonArea);
    if (copied) {
      flashCopyButton(ui.copyLiveProductionUrlBtn);
      flashMessage("Copied Live Production URL", "info");
    } else {
      notify("Clipboard unavailable. URL written to JSON area", "warn");
    }
  });

  ui.copyLiveDebugUrlBtn.addEventListener("click", async () => {
    const urls = refreshObsUrlsPanel();
    const copied = await copyText(urls.liveDebug, ui.skinJsonArea);
    if (copied) {
      flashCopyButton(ui.copyLiveDebugUrlBtn);
      flashMessage("Copied Live Debug URL", "info");
    } else {
      notify("Clipboard unavailable. URL written to JSON area", "warn");
    }
  });

  ui.copySummaryProductionUrlBtn.addEventListener("click", async () => {
    const urls = refreshObsUrlsPanel();
    const copied = await copyText(urls.summaryProd, ui.skinJsonArea);
    if (copied) {
      flashCopyButton(ui.copySummaryProductionUrlBtn);
      flashMessage("Copied Summary Production URL", "info");
    } else {
      notify("Clipboard unavailable. URL written to JSON area", "warn");
    }
  });

  ui.copySummaryDebugUrlBtn.addEventListener("click", async () => {
    const urls = refreshObsUrlsPanel();
    const copied = await copyText(urls.summaryDebug, ui.skinJsonArea);
    if (copied) {
      flashCopyButton(ui.copySummaryDebugUrlBtn);
      flashMessage("Copied Summary Debug URL", "info");
    } else {
      notify("Clipboard unavailable. URL written to JSON area", "warn");
    }
  });

  ui.copyObsCssBtn.addEventListener("click", async () => {
    const copied = await copyText(OBS_CUSTOM_CSS, ui.skinJsonArea);
    if (copied) {
      flashCopyButton(ui.copyObsCssBtn);
      flashMessage("Copied OBS Custom CSS", "info");
    } else {
      notify("Clipboard unavailable. CSS written to JSON area", "warn");
    }
  });

  ui.copyLiveUrlBtn.addEventListener("click", async () => {
    const urls = refreshObsUrlsPanel();
    const copied = await copyText(urls.liveProd, ui.skinJsonArea);
    if (copied) {
      flashCopyButton(ui.copyLiveUrlBtn);
      flashMessage("Copied Live URL", "info");
    } else {
      notify("Clipboard unavailable. URL written to JSON area", "warn");
    }
  });

  ui.copySummaryUrlBtn.addEventListener("click", async () => {
    const urls = refreshObsUrlsPanel();
    const copied = await copyText(urls.summaryProd, ui.skinJsonArea);
    if (copied) {
      flashCopyButton(ui.copySummaryUrlBtn);
      flashMessage("Copied Summary URL", "info");
    } else {
      notify("Clipboard unavailable. URL written to JSON area", "warn");
    }
  });

  ui.obsHealthBtn.addEventListener("click", async () => {
    try {
      await runObsHealthCheck();
    } catch (error) {
      notify(`Health Check failed: ${error.message}`, "error");
    }
  });

  // Phase 4.3: Copy Portable Live URL
  ui.copyPortableLiveUrlBtn?.addEventListener("click", async () => {
    const urls = refreshObsUrlsPanel();
    if (urls.portableLiveWarning) {
      notify(urls.portableLiveWarning, "warn");
    }
    const copied = await copyText(urls.portableLive, ui.portableLiveUrlText);
    if (copied) {
      flashCopyButton(ui.copyPortableLiveUrlBtn);
      flashMessage("Copied Portable Live URL", "info");
    } else {
      notify("Clipboard unavailable. URL written to text area", "warn");
    }
  });

  // Phase 4.3: Copy Portable Summary URL
  ui.copyPortableSummaryUrlBtn?.addEventListener("click", async () => {
    const urls = refreshObsUrlsPanel();
    if (urls.portableSummaryWarning) {
      notify(urls.portableSummaryWarning, "warn");
    }
    const copied = await copyText(urls.portableSummary, ui.portableSummaryUrlText);
    if (copied) {
      flashCopyButton(ui.copyPortableSummaryUrlBtn);
      flashMessage("Copied Portable Summary URL", "info");
    } else {
      notify("Clipboard unavailable. URL written to text area", "warn");
    }
  });
}

// ---------------------------------------------------------------------------
// Phase 4.4 – Named Skin Presets panel
// ---------------------------------------------------------------------------

function renderPresetsPanel() {
  if (!ui.presetListEl) return;
  state.skinPresets = listSkinPresets();
  if (state.skinPresets.length === 0) {
    ui.presetListEl.innerHTML = '<li class="preset-empty tiny-note">No presets saved yet.</li>';
    return;
  }
  ui.presetListEl.innerHTML = state.skinPresets
    .map(
      (preset) => `
      <li class="preset-item" data-preset-id="${preset.id}">
        <div class="preset-info">
          <strong class="preset-name">${preset.name}</strong>
          <span class="preset-meta tiny-note">${preset.skinId} · ${preset.sport} · ${preset.type}</span>
        </div>
        <div class="preset-actions">
          <button type="button" class="capsule-btn preset-load-btn" data-preset-id="${preset.id}">Load</button>
          <button type="button" class="capsule-btn preset-delete-btn" data-preset-id="${preset.id}">Delete</button>
        </div>
      </li>`
    )
    .join("");
}

async function loadPreset(id) {
  const preset = state.skinPresets.find((p) => p.id === id);
  if (!preset) return;

  const template = getTemplateById(preset.skinId);
  state.currentTheme = { ...DEFAULT_THEME, ...(preset.theme || {}) };
  state.animationStyle = typeof preset.animation === "string" ? preset.animation : (preset.animation?.style || DEFAULT_THEME.animationStyle);
  state.displayOptions = { ...DEFAULT_DISPLAY_OPTIONS, ...(preset.displayOptions || {}) };
  state.eventLogoDataUrl = preset.eventLogo || "";
  state.eventLogoPalette = state.eventLogoDataUrl ? await extractPaletteFromDataUrl(state.eventLogoDataUrl) : [];

  setThemeBySkinId(template.id, state.currentTheme);
  syncDisplayOptionControls();
  updateEventLogoUi();

  await applyTemplate(template, { markRecent: true, broadcast: true, forceMock: false });
  notify(`Preset loaded: ${preset.name}`);
}

function bindPresetsPanel() {
  if (!ui.presetListEl || !ui.savePresetBtn || !ui.presetNameInput) return;

  renderPresetsPanel();

  ui.savePresetBtn.addEventListener("click", () => {
    if (!state.selectedTemplate) {
      notify("Select a skin before saving a preset", "warn");
      return;
    }
    const name = (ui.presetNameInput?.value || "").trim() || `Preset ${nowIso().slice(0, 10)}`;
    saveSkinPreset({
      name,
      skinId: state.selectedTemplate.id,
      sport: state.selectedTemplate.sport,
      type: state.selectedTemplate.type,
      theme: state.currentTheme,
      animation: state.animationStyle,
      displayOptions: state.displayOptions,
      eventLogo: state.eventLogoDataUrl
    });
    if (ui.presetNameInput) ui.presetNameInput.value = "";
    renderPresetsPanel();
    notify(`Preset saved: ${name}`);
  });

  ui.presetListEl.addEventListener("click", async (event) => {
    const loadBtn = event.target.closest(".preset-load-btn");
    const deleteBtn = event.target.closest(".preset-delete-btn");
    if (loadBtn) {
      await loadPreset(loadBtn.dataset.presetId);
    } else if (deleteBtn) {
      const id = deleteBtn.dataset.presetId;
      const preset = state.skinPresets.find((p) => p.id === id);
      deleteSkinPreset(id);
      renderPresetsPanel();
      notify(`Preset deleted: ${preset?.name || id}`);
    }
  });
}

// ---------------------------------------------------------------------------
// Phase 4.4 – Relay Config panel
// ---------------------------------------------------------------------------

function buildRelayUrlByType(type, { debug = false } = {}) {
  const template = resolveTemplateForObsType(type);
  const relayUrl = (ui.relayUrlInput?.value || state.relayConfig.url || "").trim();
  if (!relayUrl) return { url: "", warning: "Enter a relay URL first." };
  const settings = getSettingsSnapshotForType(type, template);
  const payload = buildProtocolPayloadFromState({
    skinId: template.id,
    sport: template.sport,
    type,
    theme: settings.theme,
    animation: { style: settings.animationStyle },
    displayOptions: settings.displayOptions,
    eventLogo: settings.eventLogoDataUrl
  });
  return generateRelayOverlayUrl({
    skinId: template.id,
    type,
    sport: template.sport,
    relayUrl,
    animationStyle: settings.animationStyle,
    theme: settings.theme,
    displayOptions: settings.displayOptions,
    matchData: payload.matchData,
    pollIntervalSec: state.relayConfig.intervalSec || 1,
    debug,
    absolute: true,
    embedPortableState: true
  });
}

function exportStateAsRelayJson() {
  if (!state.selectedTemplate) {
    notify("Select a skin first", "warn");
    return;
  }
  const payload = buildProtocolPayloadFromState();
  downloadJson(`relay-state-${state.selectedTemplate.id}-${nowIso().slice(0, 10)}.json`, payload);
  notify("Relay JSON exported. Host this file at a public URL to use as relay endpoint.");
}

async function testRelayUrl(rawUrl) {
  const url = rawUrl?.trim();
  if (!url) {
    if (ui.relayTestStatusText) {
      ui.relayTestStatusText.textContent = "Enter a relay URL first.";
      ui.relayTestStatusText.dataset.state = "warn";
    }
    return;
  }
  if (ui.relayTestStatusText) {
    ui.relayTestStatusText.textContent = "Testing...";
    ui.relayTestStatusText.dataset.state = "warn";
  }
  try {
    const response = await fetch(url, { method: "GET", cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const hasProtocol = data && typeof data === "object" && data.protocol;
    const hasSport = data && typeof data === "object" && typeof data.sport === "string";
    const usable = hasProtocol || hasSport;
    if (ui.relayTestStatusText) {
      ui.relayTestStatusText.textContent = usable
        ? `OK — ${hasProtocol ? "full protocol payload" : "flat matchData"} detected`
        : "URL reachable but payload format not recognised";
      ui.relayTestStatusText.dataset.state = usable ? "ok" : "warn";
    }
  } catch (error) {
    if (ui.relayTestStatusText) {
      ui.relayTestStatusText.textContent = `Error: ${error.message}`;
      ui.relayTestStatusText.dataset.state = "error";
    }
  }
}

function bindRelayPanel() {
  const relayConfig = getRelayConfig();
  state.relayConfig = relayConfig;
  if (ui.relayUrlInput) ui.relayUrlInput.value = relayConfig.url;
  if (ui.relayIntervalInput) ui.relayIntervalInput.value = String(relayConfig.intervalSec);

  const saveRelay = () => {
    const url = (ui.relayUrlInput?.value || "").trim();
    const intervalSec = Number(ui.relayIntervalInput?.value) || 1;
    state.relayConfig = setRelayConfig({ url, intervalSec });
  };

  ui.relayUrlInput?.addEventListener("change", saveRelay);
  ui.relayIntervalInput?.addEventListener("change", saveRelay);

  ui.copyRelayLiveUrlBtn?.addEventListener("click", async () => {
    saveRelay();
    const result = buildRelayUrlByType("live");
    if (!result.url) { notify(result.warning || "Cannot build relay URL", "warn"); return; }
    if (result.warning) notify(result.warning, "warn");
    const copied = await copyText(result.url, ui.skinJsonArea);
    if (copied) { flashCopyButton(ui.copyRelayLiveUrlBtn); flashMessage("Copied Relay Live URL", "info"); }
    else notify("Clipboard unavailable. URL written to JSON area", "warn");
  });

  ui.copyRelaySummaryUrlBtn?.addEventListener("click", async () => {
    saveRelay();
    const result = buildRelayUrlByType("summary");
    if (!result.url) { notify(result.warning || "Cannot build relay URL", "warn"); return; }
    if (result.warning) notify(result.warning, "warn");
    const copied = await copyText(result.url, ui.skinJsonArea);
    if (copied) { flashCopyButton(ui.copyRelaySummaryUrlBtn); flashMessage("Copied Relay Summary URL", "info"); }
    else notify("Clipboard unavailable. URL written to JSON area", "warn");
  });

  ui.exportStateRelayBtn?.addEventListener("click", () => {
    exportStateAsRelayJson();
  });

  ui.testRelayUrlBtn?.addEventListener("click", () => {
    saveRelay();
    testRelayUrl((ui.relayUrlInput?.value || "").trim());
  });
}

function renderPhaseRoadmap() {
  if (!ui.moduleRoadmapList || !ui.hookStatusList) {
    return;
  }
  ui.moduleRoadmapList.innerHTML = OVERLAY_MODULE_REGISTRY.map(
    (item) => `
      <li>
        <strong>${item.name}</strong>
        <span>${item.description}</span>
      </li>
    `
  ).join("");

  ui.hookStatusList.innerHTML = adapters
    .map(
      (adapter) => `
      <li>
        <strong>${adapter.source}</strong>
        <span class="hook-${adapter.status}">${adapter.status}</span>
      </li>
    `
    )
    .join("");
}

function bindDataBridgePanel() {
  ui.validatePayloadBtn.addEventListener("click", async () => {
    const raw = ui.externalPayloadArea.value.trim();
    if (!raw) {
      notify("Paste payload JSON before validation", "warn");
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      await handlePayloadValidation(parsed);
    } catch (error) {
      renderValidationResult({
        isValid: false,
        isCompatible: false,
        errors: [`JSON parse error: ${error.message}`],
        warnings: [],
        normalizedPayload: null
      });
      notify("Payload validation failed", "error");
    }
  });

  ui.ingestPayloadBtn.addEventListener("click", async () => {
    const raw = ui.externalPayloadArea.value.trim();
    if (!raw) {
      notify("Paste payload JSON before ingest", "warn");
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      await handlePayloadIngest(parsed, "manual-json", { broadcast: true });
    } catch (error) {
      notify(`Payload ingest failed: ${error.message}`, "error");
    }
  });

  ui.sendTestFootballBtn.addEventListener("click", async () => {
    try {
      const payload = await loadSamplePayload("./data/sample-payload-football.json");
      ui.externalPayloadArea.value = JSON.stringify(payload, null, 2);
      await handlePayloadIngest(payload, "sample-football", { broadcast: true });
    } catch (error) {
      notify(`Load sample football failed: ${error.message}`, "error");
    }
  });

  ui.sendTestBasketballBtn.addEventListener("click", async () => {
    try {
      const payload = await loadSamplePayload("./data/sample-payload-basketball.json");
      ui.externalPayloadArea.value = JSON.stringify(payload, null, 2);
      await handlePayloadIngest(payload, "sample-basketball", { broadcast: true });
    } catch (error) {
      notify(`Load sample basketball failed: ${error.message}`, "error");
    }
  });
}

function bindBridgeListeners() {
  window.addEventListener(PEPSLIVE_CUSTOM_EVENT_UPDATED, (event) => {
    const detail = event.detail || {};
    const stateSnapshot = detail.state || {};
    const message = detail.message || {};
    const transport = detail.transport || "";
    if (stateSnapshot.lastSyncTime) {
      updateProtocolMeta(stateSnapshot.currentPayload, stateSnapshot.lastSyncTime);
      updateIntegrationPanel(stateSnapshot.currentPayload, {
        dataSource: resolveIntegrationDataSource(message?.payload?.source || stateSnapshot.currentPayload?.source, transport),
        payloadSource: stateSnapshot.currentPayload?.source || message?.payload?.source || "-",
        lastUpdate: stateSnapshot.lastSyncTime
      });
    }
  });
}

function initSharedBridge() {
  state.bridge = new SharedStateBridge({
    role: "dock",
    onRemoteEvent: async (message, transport) => {
      if (transport === "local") {
        return;
      }
      if (!message || !message.payload) {
        return;
      }
      if (!shouldListenRemoteUpdates()) {
        setIntegrationPayloadStatus("Payload Status: integration is Off", "warn");
        updateBridgeStatus(`Remote update ignored (${transport})`, "warn");
        return;
      }
      if (message.type === PEPSLIVE_MESSAGE_TYPES.PING || message.type === PEPSLIVE_MESSAGE_TYPES.PONG) {
        updateBridgeStatus(`Bridge heartbeat via ${transport}`, "ok");
        return;
      }
      if (message.type === PEPSLIVE_MESSAGE_TYPES.RESET) {
        updateBridgeStatus(`Bridge reset via ${transport}`, "warn");
        return;
      }

      const snapshotPayload = state.bridge?.getState()?.currentPayload;
      if (!snapshotPayload) {
        return;
      }

      state.applyingRemote = true;
      try {
        await handlePayloadIngest(snapshotPayload, `bridge-${transport}`, {
          broadcast: false,
          transport,
          dataSource: resolveIntegrationDataSource(snapshotPayload.source, transport)
        });
      } finally {
        state.applyingRemote = false;
      }
      updateBridgeStatus(`Remote update via ${transport}`, "ok");
    },
    onStateChange: (sharedState, mode) => {
      if (sharedState.lastSyncTime) {
        updateProtocolMeta(sharedState.currentPayload, sharedState.lastSyncTime);
        updateIntegrationPanel(sharedState.currentPayload, {
          dataSource: resolveIntegrationDataSource(sharedState.currentPayload?.source, mode),
          payloadSource: sharedState.currentPayload?.source || "-",
          lastUpdate: sharedState.lastSyncTime
        });
        if (
          mode === "storage" &&
          shouldListenRemoteUpdates() &&
          isPepsLiveDockPayload(sharedState.currentPayload, "storage")
        ) {
          state.applyingRemote = true;
          applyMatchDataOnlyPayload(sharedState.currentPayload, "storage", {
            dataSource: resolveIntegrationDataSource(sharedState.currentPayload?.source, mode),
            transport: mode
          }).finally(() => {
            state.applyingRemote = false;
          });
        }
      }
      updateBridgeStatus(`State sync ${mode}`, "ok");
    }
  });
  state.bridge.start();
  updateBridgeStatus("Bridge ready: BroadcastChannel + localStorage fallback", "ok");
}

function bindIntegrationPanel() {
  if (!ui.integrationModeSelect) {
    return;
  }
  ui.integrationModeSelect.innerHTML = INTEGRATION_MODES.map((mode) => `<option value="${mode}">${mode}</option>`).join("");
  ui.integrationModeSelect.value = state.integrationMode;
  ui.integrationModeSelect.addEventListener("change", () => {
    state.integrationMode = ui.integrationModeSelect.value;
    if (state.integrationMode === "Off") {
      setIntegrationPayloadStatus("Payload Status: integration is Off", "warn");
      updateBridgeStatus("Integration mode Off: monitoring paused", "warn");
      return;
    }
    if (state.integrationMode === "Manual Test") {
      setIntegrationPayloadStatus("Payload Status: manual test mode", "ok");
      updateBridgeStatus("Integration mode Manual Test: local ingest enabled", "ok");
      return;
    }
    setIntegrationPayloadStatus("Payload Status: listening", "ok");
    updateBridgeStatus("Integration mode Listen Only: waiting Dock updates", "ok");
  });
}

function cacheElements() {
  ui.message = document.getElementById("dockMessage");
  ui.currentSkinLabel = document.getElementById("currentSkinLabel");
  ui.copyUrlBtn = document.getElementById("copyUrlBtn");
  ui.addSourceBtn = document.getElementById("addSourceBtn");
  ui.obsStatusText = document.getElementById("obsStatusText");
  ui.galleryRoot = document.getElementById("templateGalleryRoot");
  ui.themeEditorRoot = document.getElementById("themeEditorRoot");
  ui.previewStatus = document.getElementById("previewStatusText");
  ui.previewSkinText = document.getElementById("previewSkinText");
  ui.previewSportTypeText = document.getElementById("previewSportTypeText");
  ui.previewSourceSizeText = document.getElementById("previewSourceSizeText");
  ui.openSettingsBtn = document.getElementById("openSettingsBtn");
  ui.closeSettingsBtn = document.getElementById("closeSettingsBtn");
  ui.settingsModal = document.getElementById("settingsModal");
  ui.previewCopyProductionBtn = document.getElementById("previewCopyProductionBtn");
  ui.previewCopyDebugBtn = document.getElementById("previewCopyDebugBtn");
  ui.previewAddSourceBtn = document.getElementById("previewAddSourceBtn");
  ui.previewExportPngBtn = document.getElementById("previewExportPngBtn");
  ui.previewFrame = document.getElementById("overlayPreviewFrame");
  ui.previewStage = document.getElementById("previewStage");
  ui.safeArea = document.getElementById("safeAreaOverlay");

  ui.sportFilter = document.getElementById("sportFilter");
  ui.typeFilter = document.getElementById("typeFilter");
  ui.styleFilter = document.getElementById("styleFilter");
  ui.listFilter = document.getElementById("listFilter");

  ui.backgroundMode = document.getElementById("backgroundModeSelect");
  ui.safeAreaMode = document.getElementById("safeAreaSelect");
  ui.animationPreset = document.getElementById("animationPresetSelect");
  ui.slotInspectorSelect = document.getElementById("slotInspectorSelect");
  ui.visualQaModeSelect = document.getElementById("visualQaModeSelect");
  ui.displayOptionsForm = document.getElementById("displayOptionsForm");
  ui.teamNameAlignGroup = document.getElementById("teamNameAlignGroup"); // Phase 5.0
  ui.eventLogoInput = document.getElementById("eventLogoInput");
  ui.clearEventLogoBtn = document.getElementById("clearEventLogoBtn");
  ui.applyEventPaletteBtn = document.getElementById("applyEventPaletteBtn");
  ui.eventLogoAutoTheme = document.getElementById("eventLogoAutoTheme");
  ui.eventLogoPreview = document.getElementById("eventLogoPreview");
  ui.eventPaletteSwatches = document.getElementById("eventPaletteSwatches");
  ui.eventLogoStatusText = document.getElementById("eventLogoStatusText");
  ui.contractStatusText = document.getElementById("contractStatusText");
  ui.contractReportArea = document.getElementById("contractReportArea");

  ui.exportJsonBtn = document.getElementById("exportJsonBtn");
  ui.importJsonBtn = document.getElementById("importJsonBtn");
  ui.loadSkinJsonFileBtn = document.getElementById("loadSkinJsonFileBtn");
  ui.skinJsonFileInput = document.getElementById("skinJsonFileInput");
  ui.resetSkinBtn = document.getElementById("resetSkinBtn");
  ui.duplicateSkinBtn = document.getElementById("duplicateSkinBtn");
  ui.skinJsonArea = document.getElementById("skinJsonArea");

  ui.obsHost = document.getElementById("obsHost");
  ui.obsPort = document.getElementById("obsPort");
  ui.obsPassword = document.getElementById("obsPassword");
  ui.obsPanelStatusText = document.getElementById("obsPanelStatusText");
  ui.obsCurrentSceneText = document.getElementById("obsCurrentSceneText");
  ui.obsConnectionErrorText = document.getElementById("obsConnectionErrorText");
  ui.obsConnectBtn = document.getElementById("obsConnectBtn");
  ui.obsDisconnectBtn = document.getElementById("obsDisconnectBtn");
  ui.obsTestBtn = document.getElementById("obsTestBtn");
  ui.addLiveSourceBtn = document.getElementById("addLiveSourceBtn");
  ui.addSummarySourceBtn = document.getElementById("addSummarySourceBtn");
  ui.addBothSourcesBtn = document.getElementById("addBothSourcesBtn");
  ui.obsRefreshTargetSelect = document.getElementById("obsRefreshTargetSelect");
  ui.refreshSelectedSourceBtn = document.getElementById("refreshSelectedSourceBtn");
  ui.forceRefreshSourceBtn = document.getElementById("forceRefreshSourceBtn");
  ui.regenerateUrlBtn = document.getElementById("regenerateUrlBtn");
  ui.copyFreshUrlBtn = document.getElementById("copyFreshUrlBtn");
  ui.obsHealthBtn = document.getElementById("obsHealthBtn");
  ui.livePresetSelect = document.getElementById("livePresetSelect");
  ui.summaryPresetSelect = document.getElementById("summaryPresetSelect");
  ui.obsSelectedSkinText = document.getElementById("obsSelectedSkinText");
  ui.obsSelectedLivePresetText = document.getElementById("obsSelectedLivePresetText");
  ui.obsSelectedSummaryPresetText = document.getElementById("obsSelectedSummaryPresetText");
  ui.liveProductionUrlText = document.getElementById("liveProductionUrlText");
  ui.summaryProductionUrlText = document.getElementById("summaryProductionUrlText");
  ui.copyLiveProductionUrlBtn = document.getElementById("copyLiveProductionUrlBtn");
  ui.copyLiveDebugUrlBtn = document.getElementById("copyLiveDebugUrlBtn");
  ui.copySummaryProductionUrlBtn = document.getElementById("copySummaryProductionUrlBtn");
  ui.copySummaryDebugUrlBtn = document.getElementById("copySummaryDebugUrlBtn");
  ui.obsCustomCssText = document.getElementById("obsCustomCssText");
  ui.copyObsCssBtn = document.getElementById("copyObsCssBtn");
  ui.copyLiveUrlBtn = document.getElementById("copyLiveUrlBtn");
  ui.copySummaryUrlBtn = document.getElementById("copySummaryUrlBtn");
  ui.obsHealthStatusText = document.getElementById("obsHealthStatusText");
  ui.obsHealthResultArea = document.getElementById("obsHealthResultArea");
  ui.obsManualGuideText = document.getElementById("obsManualGuideText");

  // Phase 4.3: Portable URL elements
  ui.portableLiveUrlText = document.getElementById("portableLiveUrlText");
  ui.portableSummaryUrlText = document.getElementById("portableSummaryUrlText");
  ui.copyPortableLiveUrlBtn = document.getElementById("copyPortableLiveUrlBtn");
  ui.copyPortableSummaryUrlBtn = document.getElementById("copyPortableSummaryUrlBtn");

  // Phase 4.4: Preset panel elements
  ui.presetNameInput = document.getElementById("presetNameInput");
  ui.savePresetBtn = document.getElementById("savePresetBtn");
  ui.presetListEl = document.getElementById("presetListEl");

  // Phase 4.4: Relay config elements
  ui.relayUrlInput = document.getElementById("relayUrlInput");
  ui.relayIntervalInput = document.getElementById("relayIntervalInput");
  ui.copyRelayLiveUrlBtn = document.getElementById("copyRelayLiveUrlBtn");
  ui.copyRelaySummaryUrlBtn = document.getElementById("copyRelaySummaryUrlBtn");
  ui.exportStateRelayBtn = document.getElementById("exportStateRelayBtn");
  ui.testRelayUrlBtn = document.getElementById("testRelayUrlBtn");
  ui.relayTestStatusText = document.getElementById("relayTestStatusText");

  ui.integrationModeSelect = document.getElementById("integrationModeSelect");
  ui.integrationDataSourceText = document.getElementById("integrationDataSourceText");
  ui.integrationLastDockUpdateText = document.getElementById("integrationLastDockUpdateText");
  ui.integrationLastPayloadSourceText = document.getElementById("integrationLastPayloadSourceText");
  ui.integrationPayloadStatusText = document.getElementById("integrationPayloadStatusText");
  ui.integrationCurrentSportText = document.getElementById("integrationCurrentSportText");
  ui.integrationCurrentSkinText = document.getElementById("integrationCurrentSkinText");
  ui.integrationCurrentMatchPreviewArea = document.getElementById("integrationCurrentMatchPreviewArea");

  ui.bridgeStatusText = document.getElementById("bridgeStatusText");
  ui.externalPayloadArea = document.getElementById("externalPayloadArea");
  ui.validatePayloadBtn = document.getElementById("validatePayloadBtn");
  ui.ingestPayloadBtn = document.getElementById("ingestPayloadBtn");
  ui.sendTestFootballBtn = document.getElementById("sendTestFootballBtn");
  ui.sendTestBasketballBtn = document.getElementById("sendTestBasketballBtn");
  ui.payloadValidationResult = document.getElementById("payloadValidationResult");
  ui.lastReceivedPayloadArea = document.getElementById("lastReceivedPayloadArea");
  ui.currentProtocolText = document.getElementById("currentProtocolText");
  ui.lastSyncTimeText = document.getElementById("lastSyncTimeText");
  ui.moduleRoadmapList = document.getElementById("moduleRoadmapList");
  ui.hookStatusList = document.getElementById("hookStatusList");
}

function renderStaticOptions() {
  ui.styleFilter.innerHTML = `
    <button type="button" class="chip-btn is-active" data-value="all" aria-pressed="true">All</button>
    ${STYLE_TAGS.map((tag) => `<button type="button" class="chip-btn" data-value="${tag}" aria-pressed="false">${tag}</button>`).join("")}
  `;

  ui.backgroundMode.innerHTML = BACKGROUND_MODES.map((item) => `<option value="${item}">${item}</option>`).join("");
  ui.safeAreaMode.innerHTML = SAFE_AREA_MODES.map((item) => `<option value="${item}">${item}</option>`).join("");
  ui.animationPreset.innerHTML = ANIMATION_PRESETS.map((item) => `<option value="${item}">${item}</option>`).join("");
  ui.slotInspectorSelect.innerHTML = SLOT_INSPECTOR_MODES.map((item) => `<option value="${item}">${item}</option>`).join("");
  ui.visualQaModeSelect.innerHTML = VISUAL_QA_MODES.map((item) => `<option value="${item}">${item}</option>`).join("");
}

async function loadThemePresets() {
  try {
    const response = await fetch("./data/theme-presets.json");
    if (!response.ok) {
      state.presets = [];
      return;
    }
    state.presets = await response.json();
  } catch (_error) {
    state.presets = [];
  }
}

function initGallery() {
  gallery = new TemplateGallery({
    root: ui.galleryRoot,
    templates: TEMPLATE_REGISTRY,
    onPreview: async (template) => {
      await applyTemplate(template, { markRecent: false, broadcast: false, forceMock: false });
      openSettingsModal();
    },
    onUse: async (template) => {
      await applyTemplate(template, { markRecent: true, broadcast: true, forceMock: false });
      notify(`Using skin ${template.id}`);
    },
    onFavorite: (template) => {
      state.favorites = toggleFavorite(template.id);
      gallery.setCollections({ favorites: state.favorites, recentlyUsed: state.recentlyUsed });
      notify(`Favorite updated: ${template.id}`);
    },
    onCopyUrl: async (template, feedbackButton = null) => {
      await applyTemplate(template, { markRecent: false, broadcast: false, forceMock: false });
      await copyCurrentOverlayUrl(template, { feedbackButton });
    },
    onAddSource: async (template) => {
      await applyTemplate(template, { markRecent: false, broadcast: false, forceMock: false });
      await addSourceToObs(template);
    }
  });

  gallery.setCollections({ favorites: state.favorites, recentlyUsed: state.recentlyUsed });
  syncGalleryPreviewContext();
  gallery.render();
}

function initPreview() {
  previewEngine = new PreviewEngine({
    stage: ui.previewStage,
    frame: ui.previewFrame,
    safeArea: ui.safeArea,
    statusText: ui.previewStatus,
    onRenderReport: (report) => {
      applyContractReport(report);
    }
  });
  previewEngine.setBackgroundMode(BACKGROUND_MODES[0]);
  previewEngine.setSafeAreaMode(SAFE_AREA_MODES[0]);
  previewEngine.setSlotInspectorMode(state.slotInspectorMode);
  previewEngine.setVisualQaMode(state.visualQaMode);
  previewEngine.setDisplayOptions(state.displayOptions);
}

function initThemeEditor() {
  themeEditor = new ThemeEditor({
    root: ui.themeEditorRoot,
    theme: state.currentTheme,
    presets: state.presets,
    onThemeChange: (theme) => {
      state.currentTheme = { ...theme };
      state.animationStyle = theme.animationStyle || state.animationStyle;
      ui.animationPreset.value = state.animationStyle;
      previewEngine.setTheme(theme);
      previewEngine.setAnimation(state.animationStyle);
      if (state.selectedTemplate) {
        setThemeBySkinId(state.selectedTemplate.id, theme);
        saveSkinState();
      }
      refreshObsUrlsPanel();
      scheduleGalleryPreviewRefresh();
      if (!state.applyingRemote) {
        scheduleCurrentStatePublish();
      }
    },
    onPresetChange: (preset) => {
      notify(`Preset applied: ${preset.name}`);
    }
  });
  themeEditor.render();
}

function initObsManager() {
  obsManager = new ObsSourceManager({
    onStatusChange: (status) => {
      updateObsStatus(status);
    },
    onLog: ({ message, level }) => {
      if (level === "error") {
        notify(message, "error");
      }
    }
  });
  updateObsStatus(false);
}

async function initApp() {
  cacheElements();
  renderStaticOptions();
  await loadThemePresets();
  initPreview();
  initObsManager();
  initSharedBridge();
  bindBridgeListeners();
  initGallery();
  initThemeEditor();
  renderPhaseRoadmap();
  const contractAudit = auditTemplateContracts();
  if (!contractAudit.pass) {
    updateContractStatus(`Render Contract Audit failed (${contractAudit.errors.length} errors)`, "error");
  } else if (contractAudit.warnings.length > 0) {
    updateContractStatus(`Render Contract Audit warning (${contractAudit.warnings.length})`, "warn");
  } else {
    updateContractStatus(`Render Contract Audit pass (${contractAudit.contractCount} templates)`, "ok");
  }

  bindSidebarFilters();
  bindTopActions();
  bindPreviewTools();
  bindSkinJsonActions();
  bindObsPanel();
  bindIntegrationPanel();
  bindDataBridgePanel();
  bindPresetsPanel();
  bindRelayPanel();

  setButtonGroupActive(ui.sportFilter, "all");
  setButtonGroupActive(ui.typeFilter, "all");
  setButtonGroupActive(ui.listFilter, "All");

  const sharedState = getSharedOverlayState();
  const sharedPayload = sharedState.currentPayload;
  const sharedPayloadIsDock = isPepsLiveDockPayload(sharedPayload, "storage");
  const initialTemplate = state.currentSkin?.skinId
    ? getTemplateById(state.currentSkin.skinId)
    : sharedPayload?.skinId && !sharedPayloadIsDock
      ? getTemplateById(sharedPayload.skinId)
      : TEMPLATE_REGISTRY[0];

  if (state.currentSkin && (!state.currentSkin.typeSettings || Object.keys(state.currentSkin.typeSettings).length === 0)) {
    const legacyType = state.currentSkin.type || initialTemplate.type || "live";
    state.settingsByType[legacyType] = createSettingsProfile({
      theme: state.currentSkin.theme || getThemeBySkinId(initialTemplate.id) || DEFAULT_THEME,
      animation: state.currentSkin.animation || DEFAULT_THEME.animationStyle,
      displayOptions: state.currentSkin.displayOptions || DEFAULT_DISPLAY_OPTIONS,
      eventLogo: state.currentSkin.eventLogo || ""
    });
  }

  if (sharedPayload && !sharedPayloadIsDock && !state.currentSkin?.skinId) {
    state.settingsByType[initialTemplate.type] = createSettingsProfile({
      theme: sharedPayload.theme || DEFAULT_THEME,
      animation: sharedPayload.animation || DEFAULT_THEME.animationStyle,
      displayOptions: sharedPayload.displayOptions || DEFAULT_DISPLAY_OPTIONS
    });
  }

  await applyTemplate(initialTemplate, {
    markRecent: false,
    broadcast: false,
    forceMock: false,
    matchDataOverride: sharedPayload?.matchData || null
  });
  if (sharedPayloadIsDock && sharedPayload?.matchData) {
    await applyMatchDataOnlyPayload(sharedPayload, "storage", {
      dataSource: resolveIntegrationDataSource(sharedPayload.source, "storage"),
      transport: "storage"
    });
  }
  syncGalleryPreviewContext({ refreshFrames: true });

  updateProtocolMeta(sharedPayload || buildProtocolPayloadFromState(), sharedState.lastSyncTime || nowIso());
  updateIntegrationPanel(sharedPayload || buildProtocolPayloadFromState(), {
    dataSource: sharedPayload ? resolveIntegrationDataSource(sharedPayload.source, "storage") : INTEGRATION_DATA_SOURCES.MOCK,
    payloadSource: sharedPayload?.source || "mock-data",
    lastUpdate: sharedState.lastSyncTime || nowIso()
  });
  if (state.integrationMode === "Off") {
    setIntegrationPayloadStatus("Payload Status: integration is Off", "warn");
  } else {
    setIntegrationPayloadStatus("Payload Status: listening", "ok");
  }
  if (IS_EMBED_MODE) {
    postStudioEmbedReady({
      app: "PepsLive Scoreboard Skin Studio",
      skinId: state.selectedTemplate?.id || "",
      skinName: state.selectedTemplate?.name || "",
      sport: state.selectedTemplate?.sport || ""
    });
    broadcastSkinUrlsToDock();
  }
  notify("Ready: choose template and use skin");
}

window.addEventListener("beforeunload", () => {
  state.bridge?.stop();
  previewEngine?.dispose?.();
  try { closeStudioDockBridge(); } catch (_e) {}
});

document.addEventListener("DOMContentLoaded", () => {
  initApp();
});
