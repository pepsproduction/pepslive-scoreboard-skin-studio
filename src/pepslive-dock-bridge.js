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
const bridge = new SharedStateBridge({ role: "pepslive-dock" });
let bridgeStarted = false;

function ensureBridgeStarted() {
  if (!bridgeStarted) {
    bridge.start();
    bridgeStarted = true;
  }
}

export function createPepsLivePayloadFromDockState(state) {
  return adapter.normalize(state);
}

export function normalizePepsLiveDockState(state) {
  return createPepsLivePayloadFromDockState(state);
}

export async function sendPepsLiveStateUpdate(state) {
  ensureBridgeStarted();
  const ingested = await adapter.ingest(state);
  if (!ingested.accepted || !ingested.payload) {
    return ingested;
  }
  bridge.emit(PEPSLIVE_MESSAGE_TYPES.STATE_UPDATE, ingested.payload);
  return ingested;
}

export async function publishPepsLiveDockState(state) {
  return sendPepsLiveStateUpdate(state);
}

export async function writePepsLiveStateToLocalStorage(state) {
  const ingested = await adapter.ingest(state);
  if (!ingested.accepted || !ingested.payload) {
    return ingested;
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
