import { setObsConfig } from "./skin-storage.js";

const LIVE_SOURCE_NAME = "PEPS_SKIN_LIVE_SCOREBOARD";
const SUMMARY_SOURCE_NAME = "PEPS_SKIN_SUMMARY_BOARD";

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

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

function parseSafeJson(raw) {
  try {
    return JSON.parse(raw);
  } catch (_error) {
    return null;
  }
}

export class ObsSourceManager {
  constructor({ onStatusChange, onLog }) {
    this.socket = null;
    this.connected = false;
    this.pending = new Map();
    this.requestCounter = 0;
    this.currentConfig = null;
    this.currentSceneName = "";
    this.currentVersion = "";
    this.onStatusChange = onStatusChange;
    this.onLog = onLog;
    this.isAvailable = typeof WebSocket !== "undefined";
    this.lastErrorMessage = "";
    this.lastKnownSourceNames = {
      live: LIVE_SOURCE_NAME,
      summary: SUMMARY_SOURCE_NAME
    };
    this.messageHandlerBound = this.onSocketMessage.bind(this);
    this.closeHandlerBound = this.onSocketClose.bind(this);
    this.errorHandlerBound = this.onSocketError.bind(this);
  }

  log(message, level = "info") {
    this.onLog?.({ message, level, at: new Date().toISOString() });
  }

  statusSnapshot(overrides = {}) {
    return {
      available: this.isAvailable,
      connected: this.connected,
      endpoint: this.currentEndpoint(),
      sceneName: this.currentSceneName || "",
      version: this.currentVersion || "",
      errorMessage: this.lastErrorMessage || "",
      ...overrides
    };
  }

  notifyStatus(overrides = {}) {
    this.onStatusChange?.(this.statusSnapshot(overrides));
  }

  currentEndpoint() {
    if (!this.currentConfig) {
      return "";
    }
    return `ws://${this.currentConfig.host}:${this.currentConfig.port}`;
  }

  clearSocketListeners() {
    if (!this.socket) {
      return;
    }
    this.socket.removeEventListener("message", this.messageHandlerBound);
    this.socket.removeEventListener("close", this.closeHandlerBound);
    this.socket.removeEventListener("error", this.errorHandlerBound);
  }

  safeClose() {
    this.clearSocketListeners();
    try {
      this.socket?.close();
    } catch (_error) {
      // no-op
    }
    this.socket = null;
    this.pending.clear();
  }

  onSocketMessage(event) {
    const payload = parseSafeJson(event.data);
    if (!payload || payload.op !== 7) {
      return;
    }
    const { requestId, requestStatus, responseData } = payload.d || {};
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
  }

  onSocketClose() {
    this.connected = false;
    this.currentSceneName = "";
    this.notifyStatus();
    this.log("OBS disconnected", "warn");
  }

  onSocketError() {
    this.lastErrorMessage = "WebSocket transport error";
    this.notifyStatus();
  }

  bindSocketEvents() {
    if (!this.socket) {
      return;
    }
    this.clearSocketListeners();
    this.socket.addEventListener("message", this.messageHandlerBound);
    this.socket.addEventListener("close", this.closeHandlerBound);
    this.socket.addEventListener("error", this.errorHandlerBound);
  }

  async connect({ host, port, password }) {
    if (!this.isAvailable) {
      this.lastErrorMessage = "Browser does not support WebSocket";
      this.connected = false;
      this.notifyStatus();
      this.log("OBS WebSocket unavailable in this browser", "error");
      return false;
    }

    if (this.connected) {
      return true;
    }

    this.currentConfig = { host, port, password };
    setObsConfig(this.currentConfig);
    const endpoint = this.currentEndpoint();

    try {
      this.socket = new WebSocket(endpoint);
      await this.handleHandshake(password || "");
      this.connected = true;
      this.lastErrorMessage = "";
      await this.refreshConnectionInfo();
      this.notifyStatus({ connected: true });
      this.log(`OBS connected: ${endpoint}`);
      return true;
    } catch (error) {
      this.lastErrorMessage = error.message || "OBS connection failed";
      this.connected = false;
      this.notifyStatus({ connected: false });
      this.log(`OBS connection failed: ${this.lastErrorMessage}`, "error");
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
      const timeout = window.setTimeout(() => reject(new Error("OBS handshake timeout")), 5500);

      const tempMessageListener = (event) => {
        const payload = parseSafeJson(event.data);
        if (!payload || payload.op !== 0) {
          return;
        }
        window.clearTimeout(timeout);
        socket.removeEventListener("message", tempMessageListener);
        resolve(payload.d || {});
      };

      const tempErrorListener = () => {
        window.clearTimeout(timeout);
        socket.removeEventListener("message", tempMessageListener);
        reject(new Error("WebSocket error during handshake"));
      };

      socket.addEventListener("message", tempMessageListener);
      socket.addEventListener("error", tempErrorListener, { once: true });
    });

    const identify = {
      rpcVersion: hello.rpcVersion || 1,
      eventSubscriptions: 0
    };

    if (hello.authentication) {
      identify.authentication = await buildAuthToken(password, hello.authentication.salt, hello.authentication.challenge);
    }

    socket.send(
      JSON.stringify({
        op: 1,
        d: identify
      })
    );

    await new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error("OBS identify timeout")), 5500);
      const listener = (event) => {
        const payload = parseSafeJson(event.data);
        if (!payload) {
          return;
        }
        if (payload.op === 2) {
          window.clearTimeout(timeout);
          socket.removeEventListener("message", listener);
          resolve(payload.d || {});
        }
        if (payload.op === 5) {
          window.clearTimeout(timeout);
          socket.removeEventListener("message", listener);
          reject(new Error(`OBS identify failed (${payload.d?.code || "unknown"})`));
        }
      };
      socket.addEventListener("message", listener);
    });

    this.bindSocketEvents();
  }

  async disconnect() {
    this.safeClose();
    this.connected = false;
    this.currentSceneName = "";
    this.lastErrorMessage = "";
    this.notifyStatus({ connected: false });
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
    this.currentVersion = version.obsVersion || "";
    return version;
  }

  async getCurrentSceneName() {
    const scene = await this.request("GetCurrentProgramScene");
    this.currentSceneName = scene.currentProgramSceneName || "";
    return this.currentSceneName;
  }

  sourceNameByType(type) {
    return type === "summary" ? SUMMARY_SOURCE_NAME : LIVE_SOURCE_NAME;
  }

  async resolveExistingSourceName(type) {
    const baseName = this.sourceNameByType(type);
    const names = await this.getInputNames();
    const remembered = this.lastKnownSourceNames[type];
    if (remembered && names.includes(remembered)) {
      return remembered;
    }
    if (names.includes(baseName)) {
      this.lastKnownSourceNames[type] = baseName;
      return baseName;
    }

    const candidateByPrefix = names
      .filter((name) => name === baseName || name.startsWith(`${baseName}_`))
      .map((name) => {
        if (name === baseName) {
          return { name, rank: 1 };
        }
        const suffix = Number.parseInt(name.slice(baseName.length + 1), 10);
        return { name, rank: Number.isFinite(suffix) ? suffix : 1 };
      })
      .sort((a, b) => b.rank - a.rank);

    if (candidateByPrefix.length > 0) {
      this.lastKnownSourceNames[type] = candidateByPrefix[0].name;
      return candidateByPrefix[0].name;
    }

    return "";
  }

  async getInputNames() {
    const inputList = await this.request("GetInputList");
    return Array.isArray(inputList.inputs) ? inputList.inputs.map((input) => input.inputName) : [];
  }

  async getUniqueSourceName(baseName) {
    const names = await this.getInputNames();
    if (!names.includes(baseName)) {
      return baseName;
    }
    let index = 2;
    while (names.includes(`${baseName}_${index}`)) {
      index += 1;
    }
    return `${baseName}_${index}`;
  }

  async refreshConnectionInfo() {
    if (!this.connected) {
      return this.statusSnapshot({ connected: false });
    }
    try {
      const version = await this.testConnection();
      this.currentVersion = version.obsVersion || "";
    } catch (_error) {
      this.currentVersion = "";
    }
    try {
      await this.getCurrentSceneName();
    } catch (_error) {
      this.currentSceneName = "";
    }
    this.notifyStatus();
    return this.statusSnapshot();
  }

  async addBrowserSource({ type, url, width, height }) {
    if (!this.connected) {
      throw new Error("OBS disconnected");
    }

    const sceneName = this.currentSceneName || (await this.getCurrentSceneName());
    const baseName = this.sourceNameByType(type);
    const inputName = await this.getUniqueSourceName(baseName);
    const inputSettings = {
      url,
      width,
      height,
      shutdown: false,
      restart_when_active: true
    };

    await this.request("CreateInput", {
      sceneName,
      inputName,
      inputKind: "browser_source",
      inputSettings,
      sceneItemEnabled: true
    });

    this.lastKnownSourceNames[type] = inputName;
    this.log(`Create Browser Source success (${inputName})`);
    return { mode: "created", inputName, sceneName };
  }

  async addBothSources({ live, summary }) {
    const created = [];
    if (live) {
      created.push(await this.addBrowserSource({ type: "live", ...live }));
    }
    if (summary) {
      created.push(await this.addBrowserSource({ type: "summary", ...summary }));
    }
    return created;
  }

  async refreshSourceByName(inputName) {
    if (!this.connected) {
      throw new Error("OBS disconnected");
    }
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
      await wait(100);
      return { refreshed: true, inputName, fallback: true };
    }
  }

  async refreshBrowserSource(type) {
    const inputName = await this.resolveExistingSourceName(type);
    if (!inputName) {
      throw new Error(`${this.sourceNameByType(type)} not found`);
    }
    return this.refreshSourceByName(inputName);
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

    const inputName = await this.resolveExistingSourceName(type);
    if (!inputName) {
      return {
        connected: true,
        sourceExists: false,
        urlMatch: false,
        detail: `${this.sourceNameByType(type)} not found in OBS`,
        inputName: this.sourceNameByType(type)
      };
    }
    try {
      const input = await this.request("GetInputSettings", { inputName });
      const actualUrl = input.inputSettings?.url || "";
      return {
        connected: true,
        sourceExists: true,
        urlMatch: expectedUrl ? actualUrl.includes(expectedUrl.split("?")[0]) : true,
        actualUrl,
        expectedUrl,
        inputName
      };
    } catch (_error) {
      return {
        connected: true,
        sourceExists: false,
        urlMatch: false,
        detail: `${inputName} not found in OBS`,
        inputName
      };
    }
  }
}
