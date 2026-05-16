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
  nowIso,
  setButtonGroupActive
} from "./utils.js";

const adapters = createDefaultAdapters();
const dockAdapter = adapters.find((item) => item.source === "pepslive-dock");

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
  visualQaMode: VISUAL_QA_MODES[0]
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
  ui.message.textContent = message;
  ui.message.dataset.level = level;
}

function updateCurrentSkinLabel() {
  if (!ui.currentSkinLabel || !state.selectedTemplate) {
    return;
  }
  ui.currentSkinLabel.textContent = `${state.selectedTemplate.id} - ${state.selectedTemplate.name}`;
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
  saveSkinState();

  state.activeMatchData = matchDataOverride || (await resolveMatchDataForTemplate(template, { forceMock }));
  previewEngine.setMatchData(state.activeMatchData);
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
  const { broadcast = true } = options;

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
  return {
    ...validation,
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
    notify(`Payload rejected (${sourceLabel})`, "warn");
    return;
  }
  await applyNormalizedProtocolPayload(validation.normalizedPayload, sourceLabel, {
    broadcast: options.broadcast ?? true
  });
}

async function loadSamplePayload(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Cannot load ${path}`);
  }
  return response.json();
}

async function copyCurrentOverlayUrl(template = state.selectedTemplate) {
  if (!template || !previewEngine) {
    return;
  }
  const url = previewEngine.getOverlayUrl({ cacheBust: true, absolute: true });
  try {
    await navigator.clipboard.writeText(url);
    notify("Copied Browser Source URL");
  } catch (_error) {
    ui.skinJsonArea.value = url;
    notify("Clipboard unavailable. URL written to JSON area", "warn");
  }
}

async function addSourceToObs(template = state.selectedTemplate) {
  if (!template || !previewEngine) {
    return;
  }

  const url = previewEngine.getOverlayUrl({ cacheBust: true, absolute: true });
  const source = template.recommendedSource;

  if (!obsManager.connected) {
    try {
      await navigator.clipboard.writeText(url);
    } catch (_error) {
      ui.skinJsonArea.value = url;
    }
    notify("OBS disconnected. Manual mode + URL copy fallback", "warn");
    return;
  }

  try {
    const result = await obsManager.addBrowserSource({
      type: template.type,
      url,
      width: source.width,
      height: source.height
    });
    notify(`Add Source success (${result.inputName})`);
  } catch (error) {
    try {
      await navigator.clipboard.writeText(url);
    } catch (_error) {
      ui.skinJsonArea.value = url;
    }
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
    copyCurrentOverlayUrl();
  });

  ui.addSourceBtn.addEventListener("click", () => {
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

function updateObsStatus(connected) {
  ui.obsStatusText.textContent = connected ? "Connected" : "Disconnected";
  ui.obsStatusText.classList.toggle("connected", connected);
  ui.obsStatusText.classList.toggle("disconnected", !connected);
  ui.obsConnectBtn.textContent = connected ? "Disconnect OBS" : "Connect OBS";
}

function bindObsPanel() {
  const obsConfig = getObsConfig();
  ui.obsHost.value = obsConfig.host;
  ui.obsPort.value = obsConfig.port;
  ui.obsPassword.value = obsConfig.password;

  ui.obsConnectBtn.addEventListener("click", async () => {
    if (obsManager.connected) {
      await obsManager.disconnect();
      updateObsStatus(false);
      return;
    }
    const connected = await obsManager.connect({
      host: ui.obsHost.value.trim() || "localhost",
      port: ui.obsPort.value.trim() || "4455",
      password: ui.obsPassword.value
    });
    updateObsStatus(connected);
    notify(connected ? "OBS connected" : "OBS disconnected: manual mode");
  });

  ui.obsTestBtn.addEventListener("click", async () => {
    try {
      const version = await obsManager.testConnection();
      notify(`OBS OK | ${version.obsVersion || "unknown"}`);
    } catch (error) {
      notify(`OBS test failed: ${error.message}`, "error");
    }
  });

  ui.obsRefreshBtn.addEventListener("click", async () => {
    try {
      const type = state.selectedTemplate?.type || "live";
      await obsManager.refreshBrowserSource(type);
      notify("Refresh Browser Source success");
    } catch (error) {
      notify(`Refresh failed: ${error.message}`, "error");
    }
  });

  ui.obsHealthBtn.addEventListener("click", async () => {
    const expected = previewEngine.getOverlayUrl({ cacheBust: false, absolute: true });
    const type = state.selectedTemplate?.type || "live";
    const report = await obsManager.healthCheck({ type, expectedUrl: expected });
    const statusText = report.connected
      ? report.sourceExists
        ? report.urlMatch
          ? "Health Check: OK"
          : "Health Check: URL mismatch"
        : "Health Check: Source not found"
      : "Health Check: OBS disconnected";
    notify(statusText, report.urlMatch ? "info" : "warn");
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
    if (stateSnapshot.lastSyncTime) {
      updateProtocolMeta(stateSnapshot.currentPayload, stateSnapshot.lastSyncTime);
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
        await handlePayloadIngest(snapshotPayload, `bridge-${transport}`, { broadcast: false });
      } finally {
        state.applyingRemote = false;
      }
      updateBridgeStatus(`Remote update via ${transport}`, "ok");
    },
    onStateChange: (sharedState, mode) => {
      if (sharedState.lastSyncTime) {
        updateProtocolMeta(sharedState.currentPayload, sharedState.lastSyncTime);
      }
      updateBridgeStatus(`State sync ${mode}`, "ok");
    }
  });
  state.bridge.start();
  updateBridgeStatus("Bridge ready: BroadcastChannel + localStorage fallback", "ok");
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
  ui.obsConnectBtn = document.getElementById("obsConnectBtn");
  ui.obsTestBtn = document.getElementById("obsTestBtn");
  ui.obsRefreshBtn = document.getElementById("obsRefreshBtn");
  ui.obsHealthBtn = document.getElementById("obsHealthBtn");

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
    onCopyUrl: async (template) => {
      await applyTemplate(template, { markRecent: false, broadcast: false, forceMock: false });
      await copyCurrentOverlayUrl(template);
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
    onStatusChange: ({ connected }) => {
      updateObsStatus(connected);
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
  notify("Ready: choose template and use skin");
}

window.addEventListener("beforeunload", () => {
  state.bridge?.stop();
  previewEngine?.dispose?.();
});

document.addEventListener("DOMContentLoaded", () => {
  initApp();
});
