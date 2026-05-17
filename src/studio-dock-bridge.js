export const STUDIO_SYNC_CHANNEL = "PEPSLIVE_STUDIO_SYNC";
export const STUDIO_SYNC_PROTOCOL = "PEPSLIVE_STUDIO_SYNC_V1";
export const STUDIO_SYNC_STORAGE_KEY = "pepslive.scoreboardSkinStudio.lastUrls";
export const STUDIO_SYNC_EVENT_NAME = "pepslive:scoreboard-skin-studio-urls-updated";
export const DOCK_STATE_CHANNEL = "pepslive-scoreboard-state-v1";

let studioChannel = null;
let lastPayload = null;
let listeners = [];

function safeWarn(message, error) {
  try {
    console.warn(`[StudioDockBridge] ${message}`, error || "");
  } catch (_error) {}
}

function getStudioChannel() {
  if (studioChannel) {
    return studioChannel;
  }
  try {
    studioChannel = new BroadcastChannel(STUDIO_SYNC_CHANNEL);
    return studioChannel;
  } catch (error) {
    safeWarn("BroadcastChannel unavailable; localStorage handoff will still be used", error);
    return null;
  }
}

function writeLastPayload(payload) {
  try {
    localStorage.setItem(STUDIO_SYNC_STORAGE_KEY, JSON.stringify(payload));
    return true;
  } catch (error) {
    safeWarn("Unable to persist Studio URLs to localStorage", error);
    return false;
  }
}

function dispatchLastPayload(payload) {
  try {
    window.dispatchEvent(new CustomEvent(STUDIO_SYNC_EVENT_NAME, { detail: payload }));
    return true;
  } catch (error) {
    safeWarn("Unable to dispatch Studio URL event", error);
    return false;
  }
}

export function broadcastSkinUrls(payload) {
  const message = {
    type: "studio:skin-url-ready",
    protocol: STUDIO_SYNC_PROTOCOL,
    timestamp: new Date().toISOString(),
    customCss: "body { background-color: rgba(0,0,0,0); margin: 0; overflow: hidden; }",
    ...payload
  };

  lastPayload = message;
  const stored = writeLastPayload(message);
  const dispatched = dispatchLastPayload(message);
  let broadcasted = false;

  const channel = getStudioChannel();
  if (channel) {
    try {
      channel.postMessage(message);
      broadcasted = true;
    } catch (error) {
      safeWarn("Unable to broadcast Studio URLs", error);
    }
  }

  return broadcasted || stored || dispatched;
}

export function listenForDockUpdates(onMessage) {
  let dockChannel = null;
  try {
    dockChannel = new BroadcastChannel(DOCK_STATE_CHANNEL);
  } catch (error) {
    safeWarn("Dock state channel unavailable", error);
    return () => {};
  }

  function handler(event) {
    const message = event.data;
    if (message && typeof message === "object") {
      onMessage(message);
    }
  }

  dockChannel.addEventListener("message", handler);
  listeners.push({ channel: dockChannel, handler });

  return () => {
    dockChannel.removeEventListener("message", handler);
    dockChannel.close();
  };
}

export function getLastBroadcast() {
  if (lastPayload) {
    return lastPayload;
  }
  try {
    return JSON.parse(localStorage.getItem(STUDIO_SYNC_STORAGE_KEY) || "null");
  } catch (_error) {
    return null;
  }
}

export function closeStudioDockBridge() {
  listeners.forEach(({ channel, handler }) => {
    try {
      channel.removeEventListener("message", handler);
      channel.close();
    } catch (_error) {}
  });
  listeners = [];
  if (studioChannel) {
    try {
      studioChannel.close();
    } catch (_error) {}
    studioChannel = null;
  }
}
