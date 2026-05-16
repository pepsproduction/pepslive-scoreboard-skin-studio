import { ANIMATION_PRESETS, clamp } from "./utils.js";

export const DEFAULT_THEME = {
  primaryColor: "#ff7a18",
  secondaryColor: "#101827",
  homeColor: "#f97316",
  awayColor: "#3b82f6",
  textColor: "#f8fafc",
  accentColor: "#fb923c",
  backgroundOpacity: 0.78,
  borderRadius: 16,
  shadowIntensity: 0.45,
  glowIntensity: 0.3,
  fontFamily: "'Rajdhani', 'Segoe UI', sans-serif",
  logoSlotSize: 42,
  scoreboardScale: 1,
  borderWidth: 1.6,
  glassBlur: 10,
  animationStyle: "smooth-broadcast"
};

const FONT_OPTIONS = [
  "'Rajdhani', 'Segoe UI', sans-serif",
  "'Exo 2', 'Segoe UI', sans-serif",
  "'Kanit', 'Segoe UI', sans-serif",
  "'Saira Condensed', 'Segoe UI', sans-serif",
  "'Orbitron', 'Segoe UI', sans-serif",
  "'Teko', 'Segoe UI', sans-serif",
  "'Barlow Condensed', 'Segoe UI', sans-serif"
];

const CONTROL_CONFIG = [
  { key: "primaryColor", label: "Primary Color", type: "color" },
  { key: "secondaryColor", label: "Secondary Color", type: "color" },
  { key: "homeColor", label: "Home Color", type: "color" },
  { key: "awayColor", label: "Away Color", type: "color" },
  { key: "textColor", label: "Text Color", type: "color" },
  { key: "accentColor", label: "Accent Color", type: "color" },
  { key: "backgroundOpacity", label: "Background Opacity", type: "range", min: 0.2, max: 1, step: 0.01 },
  { key: "borderRadius", label: "Border Radius", type: "range", min: 0, max: 36, step: 1 },
  { key: "shadowIntensity", label: "Shadow Intensity", type: "range", min: 0, max: 1, step: 0.01 },
  { key: "glowIntensity", label: "Glow Intensity", type: "range", min: 0, max: 1, step: 0.01 },
  { key: "fontFamily", label: "Font Family", type: "select", options: FONT_OPTIONS },
  { key: "logoSlotSize", label: "Logo Slot Size", type: "range", min: 24, max: 86, step: 1 },
  { key: "scoreboardScale", label: "Scoreboard Scale", type: "range", min: 0.75, max: 1.3, step: 0.01 },
  { key: "borderWidth", label: "Border Width", type: "range", min: 0, max: 4, step: 0.1 },
  { key: "glassBlur", label: "Glass Blur", type: "range", min: 0, max: 24, step: 1 },
  { key: "animationStyle", label: "Animation Style", type: "select", options: ANIMATION_PRESETS }
];

function prettyValue(type, value) {
  if (type !== "range") {
    return String(value);
  }
  const number = Number(value);
  if (Number.isInteger(number)) {
    return `${number}`;
  }
  return `${number.toFixed(2)}`;
}

export class ThemeEditor {
  constructor({ root, theme, presets, onThemeChange, onPresetChange }) {
    this.root = root;
    this.theme = { ...DEFAULT_THEME, ...(theme || {}) };
    this.presets = presets || [];
    this.onThemeChange = onThemeChange;
    this.onPresetChange = onPresetChange;
  }

  render() {
    if (!this.root) {
      return;
    }

    this.root.innerHTML = `
      <div class="editor-presets">
        <label class="editor-label" for="presetSelect">Theme Preset</label>
        <div class="inline-row">
          <select id="presetSelect" class="ui-select">
            <option value="">Custom</option>
            ${this.presets.map((preset) => `<option value="${preset.name}">${preset.name}</option>`).join("")}
          </select>
          <button type="button" class="capsule-btn secondary" id="resetThemeBtn">Reset</button>
        </div>
      </div>
      <div class="theme-grid" id="themeControlGrid"></div>
    `;

    const grid = this.root.querySelector("#themeControlGrid");
    if (!grid) {
      return;
    }

    CONTROL_CONFIG.forEach((control) => {
      const wrapper = document.createElement("label");
      wrapper.className = "control-block";
      wrapper.innerHTML = `
        <span class="editor-label">${control.label}</span>
        <div class="control-row"></div>
      `;
      const controlRow = wrapper.querySelector(".control-row");
      const value = this.theme[control.key];

      if (control.type === "color") {
        controlRow.innerHTML = `
          <input type="color" data-theme-key="${control.key}" value="${value}" />
          <code>${value}</code>
        `;
      } else if (control.type === "range") {
        controlRow.innerHTML = `
          <input
            type="range"
            data-theme-key="${control.key}"
            min="${control.min}"
            max="${control.max}"
            step="${control.step}"
            value="${value}"
          />
          <code>${prettyValue(control.type, value)}</code>
        `;
      } else if (control.type === "select") {
        controlRow.innerHTML = `
          <select class="ui-select" data-theme-key="${control.key}">
            ${control.options.map((option) => `<option value="${option}" ${option === value ? "selected" : ""}>${option}</option>`).join("")}
          </select>
        `;
      }

      grid.append(wrapper);
    });

    this.bindEvents();
  }

  bindEvents() {
    const themeInputs = this.root.querySelectorAll("[data-theme-key]");
    themeInputs.forEach((input) => {
      const eventName = input.tagName === "SELECT" ? "change" : "input";
      input.addEventListener(eventName, () => {
        const key = input.dataset.themeKey;
        let nextValue = input.value;

        const rangeConfig = CONTROL_CONFIG.find((control) => control.key === key && control.type === "range");
        if (rangeConfig) {
          nextValue = clamp(Number(nextValue), rangeConfig.min, rangeConfig.max);
          const code = input.parentElement?.querySelector("code");
          if (code) {
            code.textContent = prettyValue("range", nextValue);
          }
        }

        if (key === "borderRadius" || key === "logoSlotSize") {
          nextValue = Math.round(Number(nextValue));
        }

        if (key === "borderWidth" || key === "backgroundOpacity" || key === "shadowIntensity" || key === "glowIntensity" || key === "scoreboardScale") {
          nextValue = Number(nextValue);
        }

        this.theme = { ...this.theme, [key]: nextValue };
        if (input.type === "color") {
          const code = input.parentElement?.querySelector("code");
          if (code) {
            code.textContent = String(nextValue);
          }
        }
        this.onThemeChange?.(this.theme, key);
      });
    });

    const presetSelect = this.root.querySelector("#presetSelect");
    presetSelect?.addEventListener("change", () => {
      const selected = this.presets.find((preset) => preset.name === presetSelect.value);
      if (!selected) {
        return;
      }
      this.setTheme(selected.theme);
      this.onPresetChange?.(selected);
    });

    const resetBtn = this.root.querySelector("#resetThemeBtn");
    resetBtn?.addEventListener("click", () => {
      this.setTheme(DEFAULT_THEME);
      presetSelect.value = "";
    });
  }

  setTheme(nextTheme, options = { silent: false }) {
    this.theme = { ...DEFAULT_THEME, ...(nextTheme || {}) };
    this.render();
    if (!options.silent) {
      this.onThemeChange?.(this.theme, "all");
    }
  }

  getTheme() {
    return { ...this.theme };
  }
}
