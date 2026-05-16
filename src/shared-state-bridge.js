import { nowIso, safeJsonParse } from "./utils.js";

export const SHARED_STATE_KEY = "pepslive:sharedOverlayState";
export const SHARED_CHANNEL_NAME = "pepslive-overlay-sync-v1";

const DEFAULT_STATE = {
  version: 1,
  updatedAt: "",
  currentSkin: null,
  matchData: null,
  modules: {},
  lastEvent: null
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function getSharedOverlayState() {
  const parsed = safeJsonParse(localStorage.getItem(SHARED_STATE_KEY), null);
  if (!parsed || typeof parsed !== "object") {
    return { ...DEFAULT_STATE };
  }
  return {
    ...DEFAULT_STATE,
    ...parsed
  };
}

function setSharedOverlayState(nextState) {
  localStorage.setItem(SHARED_STATE_KEY, JSON.stringify(nextState));
  return nextState;
}

function applyEnvelopeToState(state, envelope) {
  const next = {
    ...state,
    updatedAt: envelope.at || nowIso(),
    lastEvent: {
      type: envelope.type,
      at: envelope.at || nowIso(),
      sourceId: envelope.sourceId
    }
  };

  if (envelope.type === "skin:update") {
    next.currentSkin = {
      ...(state.currentSkin || {}),
      ...(envelope.payload || {})
    };
  }

  if (envelope.type === "match:update") {
    next.matchData = {
      ...(state.matchData || {}),
      ...(envelope.payload || {})
    };
  }

  if (envelope.type === "module:update") {
    const moduleId = envelope.payload?.moduleId;
    if (moduleId) {
      next.modules = {
        ...(state.modules || {}),
        [moduleId]: {
          ...(state.modules?.[moduleId] || {}),
          ...envelope.payload
        }
      };
    }
  }

  return next;
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
      this.channel = new BroadcastChannel(SHARED_CHANNEL_NAME);
      this.channel.addEventListener("message", (event) => {
        const envelope = event.data;
        this.consumeEnvelope(envelope, "broadcast");
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
    if (event.key !== SHARED_STATE_KEY || !event.newValue) {
      return;
    }
    const nextState = safeJsonParse(event.newValue, null);
    if (!nextState || typeof nextState !== "object") {
      return;
    }
    this.state = {
      ...DEFAULT_STATE,
      ...nextState
    };
    this.onStateChange?.(clone(this.state), "storage");
  }

  consumeEnvelope(envelope, transport = "unknown") {
    if (!envelope || typeof envelope !== "object") {
      return;
    }
    if (envelope.sourceId === this.sourceId) {
      return;
    }
    const nextState = applyEnvelopeToState(this.state, envelope);
    this.state = setSharedOverlayState(nextState);
    this.onRemoteEvent?.(clone(envelope), transport);
    this.onStateChange?.(clone(this.state), transport);
  }

  emit(type, payload) {
    const envelope = {
      type,
      payload: payload || {},
      at: nowIso(),
      sourceId: this.sourceId
    };

    const nextState = applyEnvelopeToState(this.state, envelope);
    this.state = setSharedOverlayState(nextState);
    this.onStateChange?.(clone(this.state), "local");

    if (this.channel) {
      this.channel.postMessage(envelope);
    }

    return envelope;
  }

  publishSkin(payload) {
    return this.emit("skin:update", payload);
  }

  publishMatchData(payload) {
    return this.emit("match:update", payload);
  }

  publishModule(payload) {
    return this.emit("module:update", payload);
  }

  getState() {
    return clone(this.state);
  }
}
