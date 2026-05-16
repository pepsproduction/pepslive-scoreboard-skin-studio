import { BACKGROUND_MODES, SAFE_AREA_MODES, generateOverlayUrl } from "./utils.js";

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
      backgroundMode: BACKGROUND_MODES[0],
      safeAreaMode: SAFE_AREA_MODES[0],
      slotInspectorMode: "Off",
      visualQaMode: "Off"
    };

    this.frameLoaded = false;
    this.frame.addEventListener("load", () => {
      this.frameLoaded = true;
      this.postLiveUpdate();
    });

    this.handleWindowMessage = this.handleWindowMessage.bind(this);
    window.addEventListener("message", this.handleWindowMessage);
  }

  dispose() {
    window.removeEventListener("message", this.handleWindowMessage);
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
    this.onRenderReport?.(payload.report || null);
  }

  setTemplate(template) {
    this.state.template = template;
    this.reloadFrame();
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
    return generateOverlayUrl({
      skinId: this.state.template.id,
      type: this.state.template.type,
      animationStyle: this.state.animationStyle,
      theme: this.state.theme,
      cacheBust,
      absolute
    });
  }

  reloadFrame() {
    if (!this.state.template) {
      return;
    }
    this.frameLoaded = false;
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
