import {
  PEPSLIVE_BROADCAST_CHANNEL,
  PEPSLIVE_CUSTOM_EVENT_UPDATED,
  PEPSLIVE_LOCALSTORAGE_FALLBACK_KEY,
  PEPSLIVE_MESSAGE_TYPES,
  PEPSLIVE_SCOREBOARD_PROTOCOL,
  PEPSLIVE_SCOREBOARD_PROTOCOL_VERSION,
  createProtocolMessage,
  createProtocolPayload,
  isProtocolMessage,
  isProtocolPayload
} from "./pepslive-payload-protocol.js";
import { nowIso, safeJsonParse } from "./utils.js";

const DEFAULT_STATE = {
  protocol: PEPSLIVE_SCOREBOARD_PROTOCOL,
  version: PEPSLIVE_SCOREBOARD_PROTOCOL_VERSION,
  updatedAt: "",
  lastSyncTime: "",
  currentPayload: null,
  lastMessageType: "",
  sourceId: ""
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createFallbackState() {
  return { ...DEFAULT_STATE };
}

export function getSharedOverlayState() {
  const parsed = safeJsonParse(localStorage.getItem(PEPSLIVE_LOCALSTORAGE_FALLBACK_KEY), null);
  if (!parsed || typeof parsed !== "object") {
    return createFallbackState();
  }
  if (isProtocolPayload(parsed)) {
    return {
      ...createFallbackState(),
      updatedAt: parsed.timestamp || nowIso(),
      lastSyncTime: parsed.timestamp || nowIso(),
      currentPayload: parsed,
      lastMessageType: PEPSLIVE_MESSAGE_TYPES.STATE_UPDATE,
      sourceId: parsed.source || "storage-payload"
    };
  }
  return {
    ...createFallbackState(),
    ...parsed
  };
}

function normalizeStoredState(value) {
  if (!value || typeof value !== "object") {
    return null;
  }
  if (isProtocolPayload(value)) {
    return {
      ...createFallbackState(),
      updatedAt: value.timestamp || nowIso(),
      lastSyncTime: value.timestamp || nowIso(),
      currentPayload: value,
      lastMessageType: PEPSLIVE_MESSAGE_TYPES.STATE_UPDATE,
      sourceId: value.source || "storage-payload"
    };
  }
  return {
    ...createFallbackState(),
    ...value
  };
}

function writeSharedState(state) {
  localStorage.setItem(PEPSLIVE_LOCALSTORAGE_FALLBACK_KEY, JSON.stringify(state));
  return state;
}

function dispatchUpdatedEvent(state, message, transport) {
  const detail = {
    state: clone(state),
    message: clone(message),
    transport
  };
  window.dispatchEvent(new CustomEvent(PEPSLIVE_CUSTOM_EVENT_UPDATED, { detail }));
}

function mergePayload(basePayload, patch = {}) {
  return createProtocolPayload({
    ...basePayload,
    ...patch,
    theme: {
      ...(basePayload?.theme || {}),
      ...(patch?.theme || {})
    },
    animation: {
      ...(basePayload?.animation || {}),
      ...(patch?.animation || {})
    },
    displayOptions: {
      ...(basePayload?.displayOptions || {}),
      ...(patch?.displayOptions || {})
    },
    matchData: {
      ...(basePayload?.matchData || {}),
      ...(patch?.matchData || {})
    }
  });
}

export class SharedStateBridge {
  constructor({ role = "dock", onRemoteEvent, onStateChange } = {}) {
    this.role = role;
    this.onRemoteEvent = onRemoteEvent;
    this.onStateChange = onStateChange;
    this.sourceId = `${role}-${Math.random().toString(36).slice(2, 10)}`;
    this.channel = null;
    this.state = getSharedOverlayState();
    this.handleStorage = this.handleStorage.bind(this);
  }

  start() {
    if ("BroadcastChannel" in window) {
      this.channel = new BroadcastChannel(PEPSLIVE_BROADCAST_CHANNEL);
      this.channel.addEventListener("message", (event) => {
        this.consumeMessage(event.data, "broadcast");
      });
    }
    window.addEventListener("storage", this.handleStorage);
  }

  stop() {
    window.removeEventListener("storage", this.handleStorage);
    this.channel?.close();
    this.channel = null;
  }

  handleStorage(event) {
    if (event.key !== PEPSLIVE_LOCALSTORAGE_FALLBACK_KEY || !event.newValue) {
      return;
    }
    const nextState = normalizeStoredState(safeJsonParse(event.newValue, null));
    if (!nextState) {
      return;
    }
    this.state = nextState;
    const syntheticMessage = createProtocolMessage(PEPSLIVE_MESSAGE_TYPES.STATE_UPDATE, this.state.currentPayload || {}, {
      sourceId: this.state.sourceId || "storage",
      timestamp: this.state.lastSyncTime || nowIso()
    });
    dispatchUpdatedEvent(this.state, syntheticMessage, "storage");
    this.onStateChange?.(clone(this.state), "storage");
  }

  consumeMessage(message, transport = "unknown") {
    if (!isProtocolMessage(message)) {
      return;
    }
    if (transport !== "local" && message.sourceId === this.sourceId) {
      return;
    }
    if (message.protocol !== PEPSLIVE_SCOREBOARD_PROTOCOL) {
      return;
    }

    const basePayload = this.state.currentPayload || createProtocolPayload();
    let nextPayload = basePayload;

    if (message.type === PEPSLIVE_MESSAGE_TYPES.RESET) {
      nextPayload = createProtocolPayload({ source: message.payload?.source || "reset" });
    } else if (message.type === PEPSLIVE_MESSAGE_TYPES.SKIN_UPDATE) {
      nextPayload = mergePayload(basePayload, {
        skinId: message.payload?.skinId,
        sport: message.payload?.sport,
        type: message.payload?.type
      });
    } else if (message.type === PEPSLIVE_MESSAGE_TYPES.THEME_UPDATE) {
      nextPayload = mergePayload(basePayload, {
        theme: message.payload?.theme || {}
      });
    } else if (message.type === PEPSLIVE_MESSAGE_TYPES.ANIMATION_UPDATE) {
      nextPayload = mergePayload(basePayload, {
        animation: message.payload?.animation || {}
      });
    } else if (message.type === PEPSLIVE_MESSAGE_TYPES.STATE_UPDATE) {
      nextPayload = mergePayload(basePayload, message.payload || {});
    } else if (message.type === PEPSLIVE_MESSAGE_TYPES.PING) {
      this.sendPong();
      nextPayload = basePayload;
    } else if (message.type === PEPSLIVE_MESSAGE_TYPES.PONG) {
      nextPayload = basePayload;
    }

    this.state = writeSharedState({
      ...this.state,
      protocol: PEPSLIVE_SCOREBOARD_PROTOCOL,
      version: PEPSLIVE_SCOREBOARD_PROTOCOL_VERSION,
      updatedAt: nowIso(),
      lastSyncTime: message.timestamp || nowIso(),
      currentPayload: nextPayload,
      lastMessageType: message.type,
      sourceId: message.sourceId || ""
    });

    dispatchUpdatedEvent(this.state, message, transport);
    this.onRemoteEvent?.(clone(message), transport);
    this.onStateChange?.(clone(this.state), transport);
  }

  emit(type, payload) {
    const message = createProtocolMessage(type, payload, {
      sourceId: this.sourceId
    });

    this.consumeMessage(message, "local");

    if (this.channel) {
      this.channel.postMessage(message);
    }

    return message;
  }

  publishState(payload) {
    return this.emit(PEPSLIVE_MESSAGE_TYPES.STATE_UPDATE, payload);
  }

  publishSkin(payload) {
    return this.emit(PEPSLIVE_MESSAGE_TYPES.SKIN_UPDATE, payload);
  }

  publishTheme(theme) {
    return this.emit(PEPSLIVE_MESSAGE_TYPES.THEME_UPDATE, { theme });
  }

  publishAnimation(animation) {
    return this.emit(PEPSLIVE_MESSAGE_TYPES.ANIMATION_UPDATE, { animation });
  }

  sendPing(payload = {}) {
    return this.emit(PEPSLIVE_MESSAGE_TYPES.PING, payload);
  }

  sendPong(payload = {}) {
    return this.emit(PEPSLIVE_MESSAGE_TYPES.PONG, payload);
  }

  reset(payload = {}) {
    return this.emit(PEPSLIVE_MESSAGE_TYPES.RESET, payload);
  }

  getState() {
    return clone(this.state);
  }
}
