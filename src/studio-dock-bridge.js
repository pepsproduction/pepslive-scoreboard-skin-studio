/**
 * studio-dock-bridge.js  —  Phase 5.0
 *
 * Bidirectional BroadcastChannel bridge between:
 *   PepsLive Scoreboard Skin Studio  (this file)
 *   PepsLive Dock V1                 (pepslive-dock)
 *
 * Channels:
 *   "PEPSLIVE_SCOREBOARD"   Dock → Studio  (match data, already Phase 4.x)
 *   "PEPSLIVE_STUDIO_SYNC"  Studio → Dock  (skin overlay URLs)   ← NEW
 *
 * Protocol message sent by Studio:
 * {
 *   type:       "studio:skin-url-ready",
 *   protocol:   "PEPSLIVE_STUDIO_SYNC_V1",
 *   timestamp:  "<ISO string>",
 *   liveUrl:    "<full overlay URL for OBS Browser Source (live)>",
 *   summaryUrl: "<full overlay URL for OBS Browser Source (summary)>",
 *   skinId:     "FB-LIVE-01",
 *   sport:      "football",
 *   skinName:   "Premier Broadcast",
 *   obsWidth:   900,
 *   obsHeight:  180,
 *   customCss:  "body { background-color: rgba(0,0,0,0); margin: 0; overflow: hidden; }"
 * }
 */

export const STUDIO_SYNC_CHANNEL = "PEPSLIVE_STUDIO_SYNC";
export const STUDIO_SYNC_PROTOCOL = "PEPSLIVE_STUDIO_SYNC_V1";

let _channel = null;
let _lastPayload = null;
let _listeners = [];

function getChannel() {
  if (!_channel) {
    try {
      _channel = new BroadcastChannel(STUDIO_SYNC_CHANNEL);
    } catch (_e) {
      return null;
    }
  }
  return _channel;
}

/**
 * Broadcast current skin overlay URLs to any listening Dock V1 instances.
 * Safe to call whenever skin or theme changes.
 *
 * @param {object} payload
 * @param {string} payload.liveUrl
 * @param {string} payload.summaryUrl
 * @param {string} payload.skinId
 * @param {string} payload.sport
 * @param {string} payload.skinName
 * @param {number} payload.obsWidth
 * @param {number} payload.obsHeight
 */
export function broadcastSkinUrls(payload) {
  const ch = getChannel();
  if (!ch) return false;

  const message = {
    type: "studio:skin-url-ready",
    protocol: STUDIO_SYNC_PROTOCOL,
    timestamp: new Date().toISOString(),
    customCss: "body { background-color: rgba(0,0,0,0); margin: 0; overflow: hidden; }",
    ...payload
  };

  _lastPayload = message;

  try {
    ch.postMessage(message);
    return true;
  } catch (_e) {
    return false;
  }
}

/**
 * Listen for Dock → Studio state (match data).
 * Wraps the existing PEPSLIVE_SCOREBOARD channel so
 * the studio doesn't need to open it separately.
 *
 * @param {function} onMessage
 * @returns {function} unsubscribe
 */
export function listenForDockUpdates(onMessage) {
  let dockChannel = null;
  try {
    dockChannel = new BroadcastChannel("PEPSLIVE_SCOREBOARD");
  } catch (_e) {
    return () => {};
  }

  function handler(event) {
    if (event.data && typeof event.data === "object") {
      onMessage(event.data);
    }
  }

  dockChannel.addEventListener("message", handler);
  _listeners.push({ channel: dockChannel, handler });

  return () => {
    dockChannel.removeEventListener("message", handler);
    dockChannel.close();
  };
}

/** Return the last payload broadcast (for diagnostics). */
export function getLastBroadcast() {
  return _lastPayload;
}

/** Close all channels — call on page unload. */
export function closeStudioDockBridge() {
  _listeners.forEach(({ channel, handler }) => {
    try {
      channel.removeEventListener("message", handler);
      channel.close();
    } catch (_e) {}
  });
  _listeners = [];
  if (_channel) {
    try { _channel.close(); } catch (_e) {}
    _channel = null;
  }
}
