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
  toggleFavorite
} from "./skin-storage.js";
import { SharedStateBridge, getSharedOverlayState } from "./shared-state-bridge.js";
import { auditTemplateContracts, getRenderContractByTemplateId } from "./template-render-contract.js";
import { TemplateGallery } from "./template-gallery.js";
import { DEFAULT_THEME, ThemeEditor } from "./theme-editor.js";
import {
  ANIMATION_PRESETS,
  BACKGROUND_MODES,
  SAFE_AREA_MODES,
  SLOT_INSPECTOR_MODES,
  STYLE_TAGS,
  VISUAL_QA_MODES,
  downloadJson,
  generateOverlayUrl,
  nowIso,
  setButtonGroupActive
} from "./utils.js";

const adapters = createDefaultAdapters();
const dockAdapter = adapters.find((item) => item.source === "pepslive-dock");
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
  integrationPayloadStatus: "Payload Status: waiting"
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
  }
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
  const versionValue = forceVersion ?? state.obsUrlVersion;
  return generateOverlayUrl({
    skinId: template.id,
    type,
    animationStyle: state.animationStyle,
    theme: state.currentTheme,
    cacheBust,
    absolute: true,
    debug,
    stateKey: versionValue ? `obs-${versionValue}` : ""
  });
}

function refreshObsUrlsPanel() {
  const liveProd = buildOverlayUrlByType("live", { debug: false, cacheBust: false });
  const liveDebug = buildOverlayUrlByType("live", { debug: true, cacheBust: false });
  const summaryProd = buildOverlayUrlByType("summary", { debug: false, cacheBust: false });
  const summaryDebug = buildOverlayUrlByType("summary", { debug: true, cacheBust: false });

  if (ui.liveProductionUrlText) {
    ui.liveProductionUrlText.value = liveProd;
  }
  if (ui.summaryProductionUrlText) {
    ui.summaryProductionUrlText.value = summaryProd;
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

  return {
    liveProd,
    liveDebug,
    summaryProd,
    summaryDebug
  };
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
  const template = state.selectedTemplate || TEMPLATE_REGISTRY[0];
  return createProtocolPayload({
    source: partial.source || "PepsLiveScoreboardSkinStudio",
    timestamp: partial.timestamp || nowIso(),
    sport: partial.sport || template.sport,
    skinId: partial.skinId || template.id,
    type: partial.type || template.type,
    theme: partial.theme || state.currentTheme,
    animation: partial.animation || { style: state.animationStyle },
    matchData: partial.matchData || state.activeMatchData || {}
  });
}

function saveSkinState() {
  if (!state.selectedTemplate) {
    return;
  }
  const payload = setCurrentSkin({
    skinId: state.selectedTemplate.id,
    sport: state.selectedTemplate.sport,
    type: state.selectedTemplate.type,
    theme: state.currentTheme,
    animation: {
      style: state.animationStyle
    }
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
  const { markRecent = false, broadcast = true, forceMock = false, matchDataOverride = null } = options;
  const previousTemplateId = state.selectedTemplate?.id || "";
  const templateChanged = previousTemplateId !== template.id;

  state.selectedTemplate = template;
  state.currentTheme = getThemeBySkinId(template.id) || state.currentTheme || DEFAULT_THEME;
  state.animationStyle = state.currentTheme.animationStyle || state.animationStyle;

  previewEngine.setTemplate(template);
  previewEngine.setTheme(state.currentTheme);
  previewEngine.setAnimation(state.animationStyle);
  previewEngine.setSlotInspectorMode(state.slotInspectorMode);
  previewEngine.setVisualQaMode(state.visualQaMode);
  themeEditor.setTheme(state.currentTheme, { silent: true });
  ui.animationPreset.value = state.animationStyle;
  ui.slotInspectorSelect.value = state.slotInspectorMode;
  ui.visualQaModeSelect.value = state.visualQaMode;
  updateCurrentSkinLabel();
  updatePreviewSummary(template);
  if (templateChanged) {
    gallery?.setSelectedTemplateId?.(template.id);
  }
  refreshObsUrlsPanel();
  saveSkinState();

  state.activeMatchData = matchDataOverride || (await resolveMatchDataForTemplate(template, { forceMock }));
  previewEngine.setMatchData(state.activeMatchData);
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
    const payload = buildProtocolPayloadFromState();
    state.lastProtocolPayload = payload;
    state.bridge.publishState(payload);
    updateProtocolMeta(payload, payload.timestamp);
  }
}

async function applyNormalizedProtocolPayload(protocolPayload, sourceLabel, options = {}) {
  const { broadcast = true, dataSource = "", payloadSource = "" } = options;

  const template = getTemplateById(protocolPayload.skinId);
  state.currentTheme = { ...DEFAULT_THEME, ...(protocolPayload.theme || {}) };
  state.animationStyle = protocolPayload.animation?.style || state.currentTheme.animationStyle || "smooth-broadcast";
  setThemeBySkinId(template.id, state.currentTheme);

  await applyTemplate(template, {
    markRecent: false,
    broadcast,
    forceMock: false,
    matchDataOverride: protocolPayload.matchData
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
  const url = buildOverlayUrlByType(template.type, { debug, cacheBust: true, forceVersion: Date.now() });
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

async function addSourceToObs(template = state.selectedTemplate) {
  if (!template || !previewEngine) {
    return;
  }

  const preset = getSourcePreset(template.type);
  const url = buildOverlayUrlByType(template.type, { debug: false, cacheBust: true, forceVersion: Date.now() });

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
      state.bridge?.publishAnimation({ style: state.animationStyle });
      state.bridge?.publishTheme(state.currentTheme);
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
      createdAt: state.currentSkin?.createdAt
    });
    ui.skinJsonArea.value = JSON.stringify(payload, null, 2);
    downloadJson(`skin-${state.selectedTemplate.id}.json`, payload);
    notify("Export Skin JSON complete");
  });

  ui.importJsonBtn.addEventListener("click", async () => {
    const raw = ui.skinJsonArea.value.trim();
    if (!raw) {
      notify("Paste Skin JSON before import", "warn");
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      const template = getTemplateById(parsed.skinId);
      state.currentTheme = { ...DEFAULT_THEME, ...(parsed.theme || {}) };
      state.animationStyle = parsed.animation?.style || state.currentTheme.animationStyle || "smooth-broadcast";
      setThemeBySkinId(template.id, state.currentTheme);
      await applyTemplate(template, { markRecent: true, broadcast: true, forceMock: false });
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
      animation: { style: DEFAULT_THEME.animationStyle }
    });
    state.currentSkin = resetPayload;
    state.currentTheme = { ...DEFAULT_THEME };
    state.animationStyle = DEFAULT_THEME.animationStyle;
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
  const url = buildOverlayUrlByType(type, { debug: false, cacheBust: true, forceVersion: Date.now() });
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
    refreshObsUrlsPanel();
  });

  ui.summaryPresetSelect.addEventListener("change", () => {
    state.obsSummaryPreset = ui.summaryPresetSelect.value;
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
  ui.previewCopyProductionBtn = document.getElementById("previewCopyProductionBtn");
  ui.previewCopyDebugBtn = document.getElementById("previewCopyDebugBtn");
  ui.previewAddSourceBtn = document.getElementById("previewAddSourceBtn");
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
  ui.contractStatusText = document.getElementById("contractStatusText");
  ui.contractReportArea = document.getElementById("contractReportArea");

  ui.exportJsonBtn = document.getElementById("exportJsonBtn");
  ui.importJsonBtn = document.getElementById("importJsonBtn");
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
    onPreview: async (template) => applyTemplate(template, { markRecent: false, broadcast: false, forceMock: false }),
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
      if (!state.applyingRemote) {
        state.bridge?.publishTheme(theme);
        state.bridge?.publishAnimation({ style: state.animationStyle });
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

  setButtonGroupActive(ui.sportFilter, "all");
  setButtonGroupActive(ui.typeFilter, "all");
  setButtonGroupActive(ui.listFilter, "All");

  const sharedState = getSharedOverlayState();
  const sharedPayload = sharedState.currentPayload;
  const initialTemplate = state.currentSkin?.skinId
    ? getTemplateById(state.currentSkin.skinId)
    : sharedPayload?.skinId
      ? getTemplateById(sharedPayload.skinId)
      : TEMPLATE_REGISTRY[0];

  const initialTheme = getThemeBySkinId(initialTemplate.id) || sharedPayload?.theme || state.currentSkin?.theme || DEFAULT_THEME;
  state.currentTheme = { ...DEFAULT_THEME, ...initialTheme };
  state.animationStyle = sharedPayload?.animation?.style || state.currentTheme.animationStyle || DEFAULT_THEME.animationStyle;

  await applyTemplate(initialTemplate, {
    markRecent: false,
    broadcast: false,
    forceMock: false,
    matchDataOverride: sharedPayload?.matchData || null
  });

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
  notify("Ready: choose template and use skin");
}

window.addEventListener("beforeunload", () => {
  state.bridge?.stop();
  previewEngine?.dispose?.();
});

document.addEventListener("DOMContentLoaded", () => {
  initApp();
});
