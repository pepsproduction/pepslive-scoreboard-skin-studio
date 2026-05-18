import { nowIso, safeJsonParse } from "./utils.js";

const STORAGE_KEYS = {
  favoriteTemplates: "pepslive:favoriteTemplates",
  recentlyUsedTemplates: "pepslive:recentlyUsedTemplates",
  currentSkin: "pepslive:currentSkin",
  customThemes: "pepslive:customThemes",
  obsConfig: "pepslive:obsConfig"
};

function getArray(key) {
  return safeJsonParse(localStorage.getItem(key), []);
}

function setArray(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function getFavorites() {
  return getArray(STORAGE_KEYS.favoriteTemplates);
}

export function isFavorite(templateId) {
  return getFavorites().includes(templateId);
}

export function toggleFavorite(templateId) {
  const favorites = new Set(getFavorites());
  if (favorites.has(templateId)) {
    favorites.delete(templateId);
  } else {
    favorites.add(templateId);
  }
  const updated = Array.from(favorites);
  setArray(STORAGE_KEYS.favoriteTemplates, updated);
  return updated;
}

export function getRecentlyUsed() {
  return getArray(STORAGE_KEYS.recentlyUsedTemplates);
}

export function pushRecentlyUsed(templateId) {
  const list = getRecentlyUsed().filter((item) => item !== templateId);
  list.unshift(templateId);
  const trimmed = list.slice(0, 20);
  setArray(STORAGE_KEYS.recentlyUsedTemplates, trimmed);
  return trimmed;
}

export function getCurrentSkin() {
  return safeJsonParse(localStorage.getItem(STORAGE_KEYS.currentSkin), null);
}

export function setCurrentSkin(skin) {
  const now = nowIso();
  const current = getCurrentSkin();
  const payload = {
    skinId: skin.skinId,
    sport: skin.sport,
    type: skin.type,
    theme: skin.theme || {},
    animation: skin.animation || {},
    displayOptions: skin.displayOptions || {},
    typeSettings: skin.typeSettings || current?.typeSettings || {},
    selectedTemplateByType: skin.selectedTemplateByType || current?.selectedTemplateByType || {},
    eventLogo: skin.eventLogo || "",
    createdAt: current?.createdAt || now,
    updatedAt: now
  };
  localStorage.setItem(STORAGE_KEYS.currentSkin, JSON.stringify(payload));
  return payload;
}

export function duplicateSkin(existingSkin) {
  const now = nowIso();
  const clone = {
    ...existingSkin,
    createdAt: now,
    updatedAt: now
  };
  localStorage.setItem(STORAGE_KEYS.currentSkin, JSON.stringify(clone));
  return clone;
}

export function resetSkin(defaultSkin) {
  const resetPayload = {
    ...defaultSkin,
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
  localStorage.setItem(STORAGE_KEYS.currentSkin, JSON.stringify(resetPayload));
  return resetPayload;
}

export function getCustomThemes() {
  return safeJsonParse(localStorage.getItem(STORAGE_KEYS.customThemes), {});
}

export function getThemeBySkinId(skinId) {
  const themes = getCustomThemes();
  return themes[skinId] || null;
}

export function setThemeBySkinId(skinId, theme) {
  const themes = getCustomThemes();
  themes[skinId] = theme;
  localStorage.setItem(STORAGE_KEYS.customThemes, JSON.stringify(themes));
  return themes;
}

export function getObsConfig() {
  return safeJsonParse(localStorage.getItem(STORAGE_KEYS.obsConfig), {
    host: "localhost",
    port: "4455",
    password: ""
  });
}

export function setObsConfig(config) {
  const merged = {
    host: config.host || "localhost",
    port: config.port || "4455",
    password: config.password || ""
  };
  localStorage.setItem(STORAGE_KEYS.obsConfig, JSON.stringify(merged));
  return merged;
}

export function exportSkinJson(payload) {
  return {
    skinId: payload.skinId,
    sport: payload.sport,
    type: payload.type,
    theme: payload.theme || {},
    animation: payload.animation || {},
    displayOptions: payload.displayOptions || {},
    typeSettings: payload.typeSettings || {},
    selectedTemplateByType: payload.selectedTemplateByType || {},
    eventLogo: payload.eventLogo || "",
    createdAt: payload.createdAt || nowIso(),
    updatedAt: nowIso()
  };
}

// ---------------------------------------------------------------------------
// Phase 4.4 – Named Skin Presets
// ---------------------------------------------------------------------------

const PRESETS_KEY = "pepslive:skinPresets";

/**
 * Generate a simple unique ID for a preset.
 * @returns {string}
 */
function generatePresetId() {
  return `preset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Get the raw presets map from localStorage.
 * @returns {Record<string, object>}
 */
export function getSkinPresets() {
  return safeJsonParse(localStorage.getItem(PRESETS_KEY), {});
}

/**
 * Get all presets as an array sorted by savedAt descending (newest first).
 * @returns {Array<object>}
 */
export function listSkinPresets() {
  const map = getSkinPresets();
  return Object.values(map).sort((a, b) => {
    const ta = a.savedAt || "";
    const tb = b.savedAt || "";
    return ta < tb ? 1 : ta > tb ? -1 : 0;
  });
}

/**
 * Save (or overwrite) a named preset.
 * If `id` is provided, the existing preset is updated.
 * Returns the saved preset object.
 *
 * @param {{
 *   id?: string,
 *   name: string,
 *   skinId: string,
 *   sport: string,
 *   type: string,
 *   theme?: object,
 *   animation?: string,
 *   displayOptions?: object,
 *   eventLogo?: string
 * }} preset
 * @returns {object}
 */
export function saveSkinPreset(preset) {
  const map = getSkinPresets();
  const id = preset.id || generatePresetId();
  const now = nowIso();
  const saved = {
    id,
    name: String(preset.name || "Untitled Preset").slice(0, 64),
    skinId: preset.skinId || "",
    sport: preset.sport || "football",
    type: preset.type || "live",
    theme: preset.theme || {},
    animation: typeof preset.animation === "string" ? preset.animation : (preset.animation?.style || "smooth-broadcast"),
    displayOptions: preset.displayOptions || {},
    eventLogo: preset.eventLogo || "",
    savedAt: now
  };
  map[id] = saved;
  localStorage.setItem(PRESETS_KEY, JSON.stringify(map));
  return saved;
}

/**
 * Get a single preset by id.
 * @param {string} id
 * @returns {object|null}
 */
export function getSkinPresetById(id) {
  if (!id) return null;
  const map = getSkinPresets();
  return map[id] || null;
}

/**
 * Delete a preset by id.
 * @param {string} id
 * @returns {boolean} true if deleted, false if not found
 */
export function deleteSkinPreset(id) {
  const map = getSkinPresets();
  if (!map[id]) return false;
  delete map[id];
  localStorage.setItem(PRESETS_KEY, JSON.stringify(map));
  return true;
}

/**
 * Relay config storage (Phase 4.4).
 */
const RELAY_CONFIG_KEY = "pepslive:relayConfig";

/**
 * Get saved relay config.
 * @returns {{ url: string, intervalSec: number }}
 */
export function getRelayConfig() {
  return safeJsonParse(localStorage.getItem(RELAY_CONFIG_KEY), { url: "", intervalSec: 1 });
}

/**
 * Save relay config.
 * @param {{ url: string, intervalSec: number }} config
 */
export function setRelayConfig(config) {
  const saved = {
    url: String(config.url || "").trim(),
    intervalSec: Math.max(1, Math.min(60, Math.round(Number(config.intervalSec) || 1)))
  };
  localStorage.setItem(RELAY_CONFIG_KEY, JSON.stringify(saved));
  return saved;
}
