import { nowIso } from "./utils.js";

export const PEPSLIVE_SCOREBOARD_PROTOCOL = "PEPSLIVE_SCOREBOARD_STATE_V1";
export const PEPSLIVE_SCOREBOARD_PROTOCOL_VERSION = 1;

export const PEPSLIVE_BROADCAST_CHANNEL = "pepslive-scoreboard-state-v1";
export const PEPSLIVE_LOCALSTORAGE_FALLBACK_KEY = "pepslive.scoreboard.sharedState.v1";
export const PEPSLIVE_CUSTOM_EVENT_UPDATED = "pepslive:scoreboard-state-updated";

export const PEPSLIVE_MESSAGE_TYPES = {
  STATE_UPDATE: "PEPSLIVE_STATE_UPDATE",
  SKIN_UPDATE: "PEPSLIVE_SKIN_UPDATE",
  THEME_UPDATE: "PEPSLIVE_THEME_UPDATE",
  ANIMATION_UPDATE: "PEPSLIVE_ANIMATION_UPDATE",
  PING: "PEPSLIVE_PING",
  PONG: "PEPSLIVE_PONG",
  RESET: "PEPSLIVE_RESET"
};

export const SUPPORTED_SPORTS = ["football", "basketball"];
export const SUPPORTED_TYPES = ["live", "summary"];

export function createProtocolPayload(partial = {}) {
  const payload = {
    protocol: PEPSLIVE_SCOREBOARD_PROTOCOL,
    version: PEPSLIVE_SCOREBOARD_PROTOCOL_VERSION,
    source: partial.source || "PepsLiveScoreboardSkinStudio",
    timestamp: partial.timestamp || nowIso(),
    sport: partial.sport || "football",
    skinId: partial.skinId || "",
    type: partial.type || "live",
    theme: partial.theme || {},
    animation: partial.animation || {},
    matchData: partial.matchData || {},
    displayOptions: partial.displayOptions || {}
  };
  if (partial.seq !== undefined) {
    payload.seq = partial.seq;
  }
  if (partial.revision !== undefined) {
    payload.revision = partial.revision;
  }
  return payload;
}

export function createProtocolMessage(type, payload, meta = {}) {
  return {
    type,
    protocol: PEPSLIVE_SCOREBOARD_PROTOCOL,
    timestamp: meta.timestamp || nowIso(),
    payload: payload || {},
    sourceId: meta.sourceId || "unknown",
    version: PEPSLIVE_SCOREBOARD_PROTOCOL_VERSION
  };
}

export function isProtocolMessage(value) {
  return !!value && typeof value === "object" && value.protocol === PEPSLIVE_SCOREBOARD_PROTOCOL && typeof value.type === "string";
}

export function isProtocolPayload(value) {
  return !!value && typeof value === "object" && value.protocol === PEPSLIVE_SCOREBOARD_PROTOCOL;
}
