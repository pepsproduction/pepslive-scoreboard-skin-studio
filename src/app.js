import { getTemplateById, TEMPLATE_REGISTRY } from "../templates/template-registry.js";
import { buildGoogleSheetAdapter, buildPepsLiveDockHook, buildTournamentManagerAdapter, normalizeExternalMatchPayload } from "./external-data-adapters.js";
import { getMockDataBySport } from "./mock-data.js";
import { ObsSourceManager } from "./obs-source-manager.js";
import { OVERLAY_MODULE_REGISTRY } from "./overlay-module-registry.js";
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
import { TemplateGallery } from "./template-gallery.js";
import { DEFAULT_THEME, ThemeEditor } from "./theme-editor.js";
import { ANIMATION_PRESETS, BACKGROUND_MODES, SAFE_AREA_MODES, STYLE_TAGS, downloadJson, setButtonGroupActive } from "./utils.js";

const adapters = [buildPepsLiveDockHook(), buildGoogleSheetAdapter(), buildTournamentManagerAdapter()];

const state = {
  selectedTemplate: null,
  currentTheme: { ...DEFAULT_THEME },
  animationStyle: DEFAULT_THEME.animationStyle,
  favorites: getFavorites(),
  recentlyUsed: getRecentlyUsed(),
  presets: [],
  currentSkin: getCurrentSkin(),
  activeMatchData: null,
  bridge: null
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

function publishCurrentSkinToBridge() {
  if (!state.bridge || !state.selectedTemplate) {
    return;
  }
  state.bridge.publishSkin({
    skinId: state.selectedTemplate.id,
    sport: state.selectedTemplate.sport,
    type: state.selectedTemplate.type,
    theme: state.currentTheme,
    animation: {
      style: state.animationStyle
    }
  });
}

async function copyCurrentOverlayUrl(template = state.selectedTemplate) {
  if (!template || !previewEngine) {
    return;
  }
  const url = previewEngine.getOverlayUrl({ cacheBust: true, absolute: true });
  try {
    await navigator.clipboard.writeText(url);
    notify("คัดลอก Browser Source URL แล้ว");
  } catch (_error) {
    ui.skinJsonArea.value = url;
    notify("ไม่สามารถคัดลอกอัตโนมัติได้ ระบบวาง URL ในช่องข้อความแทนแล้ว", "warn");
  }
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

async function resolveMatchDataForTemplate(template, options = { forceMock: false }) {
  const sharedState = getSharedOverlayState();
  const sharedMatch = sharedState.matchData;
  if (!options.forceMock && sharedMatch && sharedMatch.sport === template.sport) {
    return sharedMatch;
  }
  return getMockDataBySport(template.sport);
}

async function syncMatchDataForTemplate(template, options = { broadcast: true, forceMock: false }) {
  const matchData = await resolveMatchDataForTemplate(template, options);
  state.activeMatchData = matchData;
  previewEngine.setMatchData(matchData);

  if (options.broadcast && state.bridge) {
    state.bridge.publishMatchData(matchData);
  }
}

async function applyTemplate(template, options = { markRecent: false, broadcast: true, forceMock: false }) {
  state.selectedTemplate = template;
  state.currentTheme = getThemeBySkinId(template.id) || state.currentTheme || DEFAULT_THEME;
  state.animationStyle = state.currentTheme.animationStyle || state.animationStyle;
  previewEngine.setTemplate(template);
  previewEngine.setTheme(state.currentTheme);
  previewEngine.setAnimation(state.animationStyle);
  themeEditor.setTheme(state.currentTheme, { silent: true });
  ui.animationPreset.value = state.animationStyle;
  updateCurrentSkinLabel();
  saveSkinState();
  await syncMatchDataForTemplate(template, { broadcast: options.broadcast, forceMock: options.forceMock });

  if (options.markRecent) {
    state.recentlyUsed = pushRecentlyUsed(template.id);
    gallery.setCollections({ favorites: state.favorites, recentlyUsed: state.recentlyUsed });
  }

  if (options.broadcast) {
    publishCurrentSkinToBridge();
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
    notify("OBS ไม่ได้เชื่อมต่อ ระบบอยู่ใน Manual Mode และคัดลอก URL ให้แล้ว", "warn");
    return;
  }

  try {
    const result = await obsManager.addBrowserSource({
      type: template.type,
      url,
      width: source.width,
      height: source.height
    });
    notify(`Add Source สำเร็จ (${result.inputName})`);
  } catch (error) {
    try {
      await navigator.clipboard.writeText(url);
    } catch (_error) {
      ui.skinJsonArea.value = url;
    }
    notify(`Add Source ไม่สำเร็จ: ${error.message} (fallback: copy URL)`, "error");
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
    setThemeBySkinId(state.selectedTemplate.id, state.currentTheme);
    saveSkinState();
    publishCurrentSkinToBridge();
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
    notify("Export Current Skin JSON เรียบร้อย");
  });

  ui.importJsonBtn.addEventListener("click", async () => {
    const raw = ui.skinJsonArea.value.trim();
    if (!raw) {
      notify("วาง Skin JSON ก่อน import", "warn");
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      const template = getTemplateById(parsed.skinId);
      state.currentTheme = { ...DEFAULT_THEME, ...(parsed.theme || {}) };
      state.animationStyle = parsed.animation?.style || state.currentTheme.animationStyle || "smooth-broadcast";
      setThemeBySkinId(template.id, state.currentTheme);
      await applyTemplate(template, { markRecent: true, broadcast: true, forceMock: false });
      notify(`Import Skin สำเร็จ: ${template.id}`);
    } catch (error) {
      notify(`Import JSON ไม่สำเร็จ: ${error.message}`, "error");
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
    notify("Reset Skin เรียบร้อย");
  });

  ui.duplicateSkinBtn.addEventListener("click", () => {
    if (!state.currentSkin) {
      return;
    }
    const cloned = duplicateSkin(state.currentSkin);
    state.currentSkin = cloned;
    ui.skinJsonArea.value = JSON.stringify(cloned, null, 2);
    notify("Duplicate Skin แล้ว (เก็บเป็น currentSkin ใหม่)");
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
    notify(connected ? "เชื่อม OBS สำเร็จ" : "เชื่อม OBS ไม่สำเร็จ (Manual Mode)");
  });

  ui.obsTestBtn.addEventListener("click", async () => {
    try {
      const version = await obsManager.testConnection();
      notify(`OBS OK | ${version.obsVersion || "version unknown"}`);
    } catch (error) {
      notify(`OBS Test ไม่สำเร็จ: ${error.message}`, "error");
    }
  });

  ui.obsRefreshBtn.addEventListener("click", async () => {
    try {
      const type = state.selectedTemplate?.type || "live";
      await obsManager.refreshBrowserSource(type);
      notify("Refresh Browser Source สำเร็จ");
    } catch (error) {
      notify(`Refresh ไม่สำเร็จ: ${error.message}`, "error");
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

function renderPhase2Roadmap() {
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

async function ingestExternalPayload(rawPayload, sourceLabel = "manual", options = { broadcast: true }) {
  const normalized = normalizeExternalMatchPayload(rawPayload);
  if (!normalized) {
    notify("Payload ไม่ถูกต้องหรือไม่พบข้อมูลที่นำเข้าได้", "warn");
    return;
  }

  if (normalized.sport && state.selectedTemplate && normalized.sport !== state.selectedTemplate.sport) {
    const fallbackTemplate =
      TEMPLATE_REGISTRY.find((item) => item.sport === normalized.sport && item.type === state.selectedTemplate.type) ||
      TEMPLATE_REGISTRY.find((item) => item.sport === normalized.sport) ||
      state.selectedTemplate;
    await applyTemplate(fallbackTemplate, { markRecent: false, broadcast: true, forceMock: false });
  }

  state.activeMatchData = normalized;
  previewEngine.setMatchData(normalized);
  if (options.broadcast) {
    state.bridge?.publishMatchData(normalized);
  }
  notify(`รับข้อมูลภายนอกแล้ว (${sourceLabel})`);
}

function bindPhase2Panel() {
  ui.ingestPayloadBtn.addEventListener("click", async () => {
    const raw = ui.externalPayloadArea.value.trim();
    if (!raw) {
      notify("วาง JSON payload ก่อน ingest", "warn");
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      await ingestExternalPayload(parsed, "manual-json");
    } catch (error) {
      notify(`JSON parse ไม่สำเร็จ: ${error.message}`, "error");
    }
  });

  ui.clearPayloadBtn.addEventListener("click", async () => {
    ui.externalPayloadArea.value = "";
    if (state.selectedTemplate) {
      await syncMatchDataForTemplate(state.selectedTemplate, { broadcast: true, forceMock: true });
    }
    notify("ล้าง payload แล้วและรีเซ็ตกลับ mock data");
  });
}

function initSharedBridge() {
  state.bridge = new SharedStateBridge({
    role: "dock",
    onRemoteEvent: async (envelope, transport) => {
      if (envelope.type === "skin:update" && envelope.payload?.skinId) {
        const remoteTemplate = getTemplateById(envelope.payload.skinId);
        state.currentTheme = { ...DEFAULT_THEME, ...(envelope.payload.theme || state.currentTheme) };
        state.animationStyle = envelope.payload.animation?.style || state.animationStyle;
        await applyTemplate(remoteTemplate, { markRecent: false, broadcast: false, forceMock: false });
      }

      if (envelope.type === "match:update" && envelope.payload) {
      await ingestExternalPayload(envelope.payload, `bridge:${transport}`, { broadcast: false });
      }

      updateBridgeStatus(`Sync active via ${transport}`, "ok");
    },
    onStateChange: (sharedState, mode) => {
      updateBridgeStatus(`State ${mode} @ ${sharedState.updatedAt || "-"}`, "ok");
    }
  });

  state.bridge.start();
  updateBridgeStatus("BroadcastChannel + localStorage sync ready", "ok");
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
  ui.ingestPayloadBtn = document.getElementById("ingestPayloadBtn");
  ui.clearPayloadBtn = document.getElementById("clearPayloadBtn");
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
      notify(`กำลังใช้สกิน ${template.id}`);
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
    statusText: ui.previewStatus
  });
  previewEngine.setBackgroundMode(BACKGROUND_MODES[0]);
  previewEngine.setSafeAreaMode(SAFE_AREA_MODES[0]);
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
        publishCurrentSkinToBridge();
      }
    },
    onPresetChange: (preset) => {
      notify(`ใช้ preset: ${preset.name}`);
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
  initGallery();
  initThemeEditor();
  renderPhase2Roadmap();

  bindSidebarFilters();
  bindTopActions();
  bindPreviewTools();
  bindSkinJsonActions();
  bindObsPanel();
  bindPhase2Panel();

  setButtonGroupActive(ui.sportFilter, "all");
  setButtonGroupActive(ui.typeFilter, "all");
  setButtonGroupActive(ui.listFilter, "All");

  const sharedState = getSharedOverlayState();
  const initialTemplate = state.currentSkin?.skinId
    ? getTemplateById(state.currentSkin.skinId)
    : sharedState.currentSkin?.skinId
      ? getTemplateById(sharedState.currentSkin.skinId)
      : TEMPLATE_REGISTRY[0];

  const initialTheme = getThemeBySkinId(initialTemplate.id) || sharedState.currentSkin?.theme || state.currentSkin?.theme || DEFAULT_THEME;
  state.currentTheme = { ...DEFAULT_THEME, ...initialTheme };
  state.animationStyle = sharedState.currentSkin?.animation?.style || state.currentTheme.animationStyle || DEFAULT_THEME.animationStyle;
  await applyTemplate(initialTemplate, { markRecent: false, broadcast: true, forceMock: false });
  notify("พร้อมใช้งาน: เลือก template แล้วกด Use Skin");
}

window.addEventListener("beforeunload", () => {
  state.bridge?.stop();
});

document.addEventListener("DOMContentLoaded", () => {
  initApp();
});
