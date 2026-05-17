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
    createdAt: payload.createdAt || nowIso(),
    updatedAt: nowIso()
  };
}
