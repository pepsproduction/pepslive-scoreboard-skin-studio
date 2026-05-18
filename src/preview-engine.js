import { BACKGROUND_MODES, DEFAULT_DISPLAY_OPTIONS, SAFE_AREA_MODES, generateOverlayUrl } from "./utils.js";

const BACKGROUND_CLASS_MAP = {
  "Transparent Grid": "bg-transparent-grid",
  "Football Field": "bg-football-field",
  "Basketball Court": "bg-basketball-court",
  "Dark Camera": "bg-dark-camera",
  "Bright Camera": "bg-bright-camera",
  "Crowd Scene": "bg-crowd-scene",
  "Studio Dark": "bg-studio-dark"
};

const SAFE_AREA_CLASS_MAP = {
  Off: "safe-off",
  "16:9 Safe Area": "safe-16-9",
  "9:16 Safe Area": "safe-9-16",
  "YouTube Safe Area": "safe-youtube",
  "Facebook Live Safe Area": "safe-facebook",
  "OBS Corner Guide": "safe-obs-corner"
};

export class PreviewEngine {
  constructor({ stage, frame, safeArea, statusText, onRenderReport }) {
    this.stage = stage;
    this.frame = frame;
    this.safeArea = safeArea;
    this.statusText = statusText;
    this.onRenderReport = onRenderReport;
    this.state = {
      template: null,
      theme: {},
      matchData: null,
      animationStyle: "smooth-broadcast",
      displayOptions: { ...DEFAULT_DISPLAY_OPTIONS },
      backgroundMode: BACKGROUND_MODES[0],
      safeAreaMode: SAFE_AREA_MODES[0],
      slotInspectorMode: "Off",
      visualQaMode: "Off"
    };

    this.frameLoaded = false;
    this.awaitingFrameReveal = false;
    this.previewStateKey = `preview-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.sourceSize = { width: 900, height: 180 };
    this.resizeObserver = typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(() => this.updateViewportScale())
      : null;
    this.resizeObserver?.observe(this.stage);
    this.frame.addEventListener("load", () => {
      this.frameLoaded = true;
      this.postLiveUpdate();
      window.setTimeout(() => this.revealFrame(), 120);
    });

    this.handleWindowMessage = this.handleWindowMessage.bind(this);
    window.addEventListener("message", this.handleWindowMessage);
  }

  dispose() {
    window.removeEventListener("message", this.handleWindowMessage);
    this.resizeObserver?.disconnect();
  }

  handleWindowMessage(event) {
    if (event.source !== this.frame.contentWindow) {
      return;
    }
    const payload = event.data;
    if (!payload || typeof payload !== "object") {
      return;
    }
    if (payload.type !== "pepslive:render-contract-report") {
      return;
    }
    if (this.state.template?.id && payload.report?.templateId && payload.report.templateId !== this.state.template.id) {
      return;
    }
    this.revealFrame();
    this.onRenderReport?.(payload.report || null);
  }

  revealFrame() {
    if (!this.awaitingFrameReveal) {
      return;
    }
    this.awaitingFrameReveal = false;
    this.stage?.classList.remove("is-loading-preview");
    this.frame.style.opacity = "1";
  }

  setTemplate(template) {
    const previousTemplateId = this.state.template?.id || "";
    const previousTemplateType = this.state.template?.type || "";
    this.state.template = template;
    if (!this.frameLoaded || previousTemplateType !== template.type) {
      this.reloadFrame();
    } else {
      this.postMessage({
        type: "pepslive:update-skin",
        skinId: template.id
      });
      if (previousTemplateId !== template.id) {
        this.postLiveUpdate();
      }
    }
    this.updateStatus(`Preview: ${template.id} (${template.type})`);
  }

  setTheme(theme) {
    this.state.theme = { ...theme };
    this.postLiveUpdate();
  }

  setAnimation(animationStyle) {
    this.state.animationStyle = animationStyle;
    this.postMessage({ type: "pepslive:update-animation", animationStyle });
  }

  setDisplayOptions(displayOptions) {
    this.state.displayOptions = { ...DEFAULT_DISPLAY_OPTIONS, ...(displayOptions || {}) };
    this.postMessage({
      type: "pepslive:update-display-options",
      displayOptions: this.state.displayOptions
    });
  }

  setMatchData(matchData) {
    this.state.matchData = matchData ? { ...matchData } : null;
    this.postMessage({
      type: "pepslive:update-data",
      data: this.state.matchData
    });
  }

  setSlotInspectorMode(mode) {
    this.state.slotInspectorMode = mode || "Off";
    this.postMessage({
      type: "pepslive:set-slot-inspector",
      mode: this.state.slotInspectorMode
    });
  }

  setVisualQaMode(mode) {
    this.state.visualQaMode = mode || "Off";
    this.postMessage({
      type: "pepslive:set-visual-qa-mode",
      mode: this.state.visualQaMode
    });
  }

  setBackgroundMode(mode) {
    this.state.backgroundMode = mode;
    this.applyBackgroundClass();
  }

  setSourceSize(width, height) {
    const nextWidth = Math.max(1, Number(width) || 900);
    const nextHeight = Math.max(1, Number(height) || 180);
    this.sourceSize = { width: nextWidth, height: nextHeight };
    this.stage.style.setProperty("--preview-source-width", `${nextWidth}px`);
    this.stage.style.setProperty("--preview-source-height", `${nextHeight}px`);
    this.updateViewportScale();
  }

  updateViewportScale() {
    if (!this.stage || !this.sourceSize.width || !this.sourceSize.height) {
      return;
    }
    const rect = this.stage.getBoundingClientRect();
    const scale = Math.min(rect.width / this.sourceSize.width, rect.height / this.sourceSize.height);
    this.stage.style.setProperty("--preview-scale", String(Math.max(0.01, scale || 1)));
  }

  setSafeAreaMode(mode) {
    this.state.safeAreaMode = mode;
    this.applySafeAreaClass();
  }

  applyBackgroundClass() {
    const classes = Object.values(BACKGROUND_CLASS_MAP);
    this.stage.classList.remove(...classes);
    const nextClass = BACKGROUND_CLASS_MAP[this.state.backgroundMode] || BACKGROUND_CLASS_MAP["Transparent Grid"];
    this.stage.classList.add(nextClass);
  }

  applySafeAreaClass() {
    const classes = Object.values(SAFE_AREA_CLASS_MAP);
    this.safeArea.classList.remove(...classes);
    const nextClass = SAFE_AREA_CLASS_MAP[this.state.safeAreaMode] || SAFE_AREA_CLASS_MAP.Off;
    this.safeArea.classList.add(nextClass);
  }

  getOverlayUrl({ cacheBust = true, absolute = true } = {}) {
    if (!this.state.template) {
      return "";
    }
    this.writePreviewState();
    return generateOverlayUrl({
      skinId: this.state.template.id,
      type: this.state.template.type,
      matchData: this.state.matchData,
      cacheBust,
      absolute,
      stateKey: this.previewStateKey,
      isolated: true
    });
  }

  writePreviewState() {
    if (!this.state.template) {
      return;
    }
    const payload = {
      skinId: this.state.template.id,
      type: this.state.template.type,
      sport: this.state.template.sport,
      animation: this.state.animationStyle,
      theme: this.state.theme,
      displayOptions: this.state.displayOptions,
      matchData: this.state.matchData
    };
    const key = `pepslive.overlayPreviewState.${this.previewStateKey}`;
    try {
      sessionStorage.setItem(key, JSON.stringify(payload));
    } catch (_error) {
      // Same-origin iframe preview can still be hydrated by postMessage.
    }
    try {
      localStorage.setItem(key, JSON.stringify(payload));
    } catch (_error) {
      // localStorage is optional for preview hydration.
    }
  }

  reloadFrame() {
    if (!this.state.template) {
      return;
    }
    this.frameLoaded = false;
    this.awaitingFrameReveal = true;
    this.stage?.classList.add("is-loading-preview");
    this.frame.style.opacity = "0";
    this.frame.src = this.getOverlayUrl({ cacheBust: true, absolute: true });
  }

  postMessage(payload) {
    const target = this.frame.contentWindow;
    if (!target) {
      return;
    }
    target.postMessage(payload, "*");
  }

  postLiveUpdate() {
    if (!this.frameLoaded || !this.state.template) {
      return;
    }
    this.writePreviewState();
    this.postMessage({
      type: "pepslive:update-theme",
      theme: this.state.theme
    });
    this.postMessage({
      type: "pepslive:update-animation",
      animationStyle: this.state.animationStyle
    });
    this.postMessage({
      type: "pepslive:update-skin",
      skinId: this.state.template.id
    });
    this.postMessage({
      type: "pepslive:set-slot-inspector",
      mode: this.state.slotInspectorMode
    });
    this.postMessage({
      type: "pepslive:set-visual-qa-mode",
      mode: this.state.visualQaMode
    });
    this.postMessage({
      type: "pepslive:update-display-options",
      displayOptions: this.state.displayOptions
    });
    if (this.state.matchData) {
      this.postMessage({
        type: "pepslive:update-data",
        data: this.state.matchData
      });
    }
  }

  updateStatus(message) {
    if (this.statusText) {
      this.statusText.textContent = message;
    }
  }
}
