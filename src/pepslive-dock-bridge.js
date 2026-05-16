import { PepsLiveDockAdapter } from "./external-data-adapters.js";
import {
  PEPSLIVE_LOCALSTORAGE_FALLBACK_KEY,
  PEPSLIVE_MESSAGE_TYPES,
  PEPSLIVE_SCOREBOARD_PROTOCOL,
  PEPSLIVE_SCOREBOARD_PROTOCOL_VERSION
} from "./pepslive-payload-protocol.js";
import { SharedStateBridge } from "./shared-state-bridge.js";
import { nowIso } from "./utils.js";

const adapter = new PepsLiveDockAdapter();
let bridge = null;
let bridgeStarted = false;

function canUseBrowserBridge() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function toRejectedResult(error, fallbackShape = "unknown") {
  return {
    accepted: false,
    warnings: [],
    errors: [error?.message || String(error) || "Unknown bridge error"],
    payload: null,
    shape: fallbackShape,
    candidate: null
  };
}

function getBridge() {
  if (!bridge && canUseBrowserBridge()) {
    bridge = new SharedStateBridge({ role: "pepslive-dock" });
  }
  return bridge;
}

function ensureBridgeStarted() {
  if (!canUseBrowserBridge()) {
    return false;
  }
  const current = getBridge();
  if (!current) {
    return false;
  }
  if (!bridgeStarted) {
    current.start();
    bridgeStarted = true;
  }
  return true;
}

export function createPepsLivePayloadFromDockState(state) {
  try {
    return adapter.normalize(state);
  } catch (_error) {
    return adapter.normalize({});
  }
}

export function normalizePepsLiveDockState(state) {
  return createPepsLivePayloadFromDockState(state);
}

export async function sendPepsLiveStateUpdate(state) {
  try {
    const ingested = await adapter.ingest(state);
    if (!ingested.accepted || !ingested.payload) {
      return ingested;
    }

    const ready = ensureBridgeStarted();
    if (!ready) {
      return {
        ...ingested,
        warnings: [...(ingested.warnings || []), "BroadcastChannel unavailable, state update was normalized but not published"]
      };
    }

    getBridge().emit(PEPSLIVE_MESSAGE_TYPES.STATE_UPDATE, ingested.payload);
    return ingested;
  } catch (error) {
    return toRejectedResult(error, adapter.detectFormat(state));
  }
}

export async function publishPepsLiveDockState(state) {
  return sendPepsLiveStateUpdate(state);
}

export async function writePepsLiveStateToLocalStorage(state) {
  try {
    const ingested = await adapter.ingest(state);
    if (!ingested.accepted || !ingested.payload) {
      return ingested;
    }

    if (typeof localStorage === "undefined") {
      return {
        ...ingested,
        warnings: [...(ingested.warnings || []), "localStorage unavailable, state was normalized but not persisted"]
      };
    }

    const snapshot = {
      protocol: PEPSLIVE_SCOREBOARD_PROTOCOL,
      version: PEPSLIVE_SCOREBOARD_PROTOCOL_VERSION,
      updatedAt: nowIso(),
      lastSyncTime: ingested.payload.timestamp || nowIso(),
      currentPayload: ingested.payload,
      lastMessageType: PEPSLIVE_MESSAGE_TYPES.STATE_UPDATE,
      sourceId: "pepslive-dock-bridge"
    };

    localStorage.setItem(PEPSLIVE_LOCALSTORAGE_FALLBACK_KEY, JSON.stringify(snapshot));
    return ingested;
  } catch (error) {
    return toRejectedResult(error, adapter.detectFormat(state));
  }
}

/*
Example usage from PepsLive Dock UI:

import { publishPepsLiveDockState } from "./src/pepslive-dock-bridge.js";

publishPepsLiveDockState({
  teamAName: "Dragon FC",
  teamBName: "Tiger FC",
  teamAScore: 2,
  teamBScore: 1,
  matchTime: "45:00",
  half: "1H",
  matchStatus: "LIVE"
});
*/
