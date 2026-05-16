import { setObsConfig } from "./skin-storage.js";

const LIVE_SOURCE_NAME = "PEPS_SKIN_LIVE_SCOREBOARD";
const SUMMARY_SOURCE_NAME = "PEPS_SKIN_SUMMARY_BOARD";

async function sha256Base64(text) {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const bytes = Array.from(new Uint8Array(digest));
  return btoa(String.fromCharCode(...bytes));
}

async function buildAuthToken(password, salt, challenge) {
  const secret = await sha256Base64(`${password}${salt}`);
  return sha256Base64(`${secret}${challenge}`);
}

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export class ObsSourceManager {
  constructor({ onStatusChange, onLog }) {
    this.socket = null;
    this.connected = false;
    this.onStatusChange = onStatusChange;
    this.onLog = onLog;
    this.pending = new Map();
    this.requestCounter = 0;
    this.currentConfig = null;
  }

  log(message, level = "info") {
    this.onLog?.({ message, level, at: new Date().toISOString() });
  }

  async connect({ host, port, password }) {
    if (this.connected) {
      return true;
    }

    this.currentConfig = { host, port, password };
    setObsConfig(this.currentConfig);
    const endpoint = `ws://${host}:${port}`;

    try {
      this.socket = new WebSocket(endpoint);
      await this.handleHandshake(password);
      this.connected = true;
      this.onStatusChange?.({ connected: true, endpoint });
      this.log(`OBS connected: ${endpoint}`);
      return true;
    } catch (error) {
      this.connected = false;
      this.onStatusChange?.({ connected: false, endpoint });
      this.log(`OBS connection failed: ${error.message}`, "error");
      this.safeClose();
      return false;
    }
  }

  async handleHandshake(password) {
    const socket = this.socket;
    if (!socket) {
      throw new Error("No socket instance");
    }

    const hello = await new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error("OBS handshake timeout")), 5000);

      socket.addEventListener("message", async (event) => {
        const payload = JSON.parse(event.data);
        if (payload.op === 0) {
          window.clearTimeout(timeout);
          resolve(payload.d);
        }
      });

      socket.addEventListener("error", () => {
        window.clearTimeout(timeout);
        reject(new Error("WebSocket error"));
      });
    });

    const identify = {
      rpcVersion: hello.rpcVersion || 1,
      eventSubscriptions: 0
    };

    if (hello.authentication) {
      identify.authentication = await buildAuthToken(password || "", hello.authentication.salt, hello.authentication.challenge);
    }

    socket.send(
      JSON.stringify({
        op: 1,
        d: identify
      })
    );

    await new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error("OBS identify timeout")), 5000);

      socket.addEventListener("message", (event) => {
        const payload = JSON.parse(event.data);
        if (payload.op === 2) {
          window.clearTimeout(timeout);
          this.bindSocketEvents();
          resolve(payload.d);
        }
        if (payload.op === 5) {
          window.clearTimeout(timeout);
          reject(new Error(`OBS identify failed (${payload.d?.code || "unknown"})`));
        }
      });
    });
  }

  bindSocketEvents() {
    if (!this.socket) {
      return;
    }

    this.socket.addEventListener("message", (event) => {
      const payload = JSON.parse(event.data);
      if (payload.op !== 7) {
        return;
      }
      const { requestId, requestStatus, responseData } = payload.d;
      const pending = this.pending.get(requestId);
      if (!pending) {
        return;
      }
      this.pending.delete(requestId);
      if (requestStatus?.result) {
        pending.resolve(responseData || {});
      } else {
        pending.reject(new Error(requestStatus?.comment || `Request failed (${requestStatus?.code || "unknown"})`));
      }
    });

    this.socket.addEventListener("close", () => {
      this.connected = false;
      this.onStatusChange?.({ connected: false, endpoint: this.currentEndpoint() });
      this.log("OBS disconnected", "warn");
    });
  }

  currentEndpoint() {
    if (!this.currentConfig) {
      return "";
    }
    return `ws://${this.currentConfig.host}:${this.currentConfig.port}`;
  }

  safeClose() {
    try {
      this.socket?.close();
    } catch (_error) {
      // no-op
    }
    this.socket = null;
    this.pending.clear();
  }

  async disconnect() {
    this.safeClose();
    this.connected = false;
    this.onStatusChange?.({ connected: false, endpoint: this.currentEndpoint() });
  }

  async request(requestType, requestData = {}) {
    if (!this.connected || !this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error("OBS not connected");
    }

    const requestId = `req_${Date.now()}_${++this.requestCounter}`;
    const payload = {
      op: 6,
      d: {
        requestId,
        requestType,
        requestData
      }
    };

    const resultPromise = new Promise((resolve, reject) => {
      this.pending.set(requestId, { resolve, reject });
    });

    this.socket.send(JSON.stringify(payload));
    return resultPromise;
  }

  async testConnection() {
    if (!this.connected) {
      throw new Error("OBS disconnected");
    }
    const version = await this.request("GetVersion");
    return version;
  }

  async getCurrentSceneName() {
    const scene = await this.request("GetCurrentProgramScene");
    return scene.currentProgramSceneName;
  }

  sourceNameByType(type) {
    return type === "summary" ? SUMMARY_SOURCE_NAME : LIVE_SOURCE_NAME;
  }

  async addBrowserSource({ type, url, width, height }) {
    if (!this.connected) {
      throw new Error("OBS disconnected");
    }

    const sceneName = await this.getCurrentSceneName();
    const inputName = this.sourceNameByType(type);
    const inputSettings = {
      url,
      width,
      height,
      shutdown: false,
      restart_when_active: true
    };

    try {
      await this.request("CreateInput", {
        sceneName,
        inputName,
        inputKind: "browser_source",
        inputSettings,
        sceneItemEnabled: true
      });
      this.log(`Create Browser Source success (${inputName})`);
      return { mode: "created", inputName };
    } catch (_createError) {
      // TODO Phase 2: verify scene item membership and auto-attach if source exists outside current scene.
      await this.request("SetInputSettings", {
        inputName,
        inputSettings,
        overlay: false
      });
      this.log(`Update Browser Source success (${inputName})`, "warn");
      return { mode: "updated", inputName };
    }
  }

  async refreshBrowserSource(type) {
    if (!this.connected) {
      throw new Error("OBS disconnected");
    }
    const inputName = this.sourceNameByType(type);
    try {
      await this.request("PressInputPropertiesButton", {
        inputName,
        propertyName: "refreshnocache"
      });
      return { refreshed: true, inputName };
    } catch (_error) {
      await this.request("SetInputSettings", {
        inputName,
        inputSettings: {
          reroute_audio: false
        },
        overlay: true
      });
      await wait(90);
      return { refreshed: true, inputName, fallback: true };
    }
  }

  async healthCheck({ type, expectedUrl }) {
    if (!this.connected) {
      return {
        connected: false,
        sourceExists: false,
        urlMatch: false,
        detail: "OBS disconnected"
      };
    }

    const inputName = this.sourceNameByType(type);
    try {
      const input = await this.request("GetInputSettings", { inputName });
      const actualUrl = input.inputSettings?.url || "";
      return {
        connected: true,
        sourceExists: true,
        urlMatch: expectedUrl ? actualUrl.includes(expectedUrl.split("?")[0]) : true,
        actualUrl,
        expectedUrl
      };
    } catch (_error) {
      return {
        connected: true,
        sourceExists: false,
        urlMatch: false,
        detail: `${inputName} not found in OBS`
      };
    }
  }
}
