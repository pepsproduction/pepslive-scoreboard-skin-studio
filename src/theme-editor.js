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

const THEME_GROUPS = [
  { title: "Brand Colors", keys: ["primaryColor", "secondaryColor", "accentColor"] },
  { title: "Team Colors", keys: ["homeColor", "awayColor"] },
  { title: "Text & Contrast", keys: ["textColor", "backgroundOpacity"] },
  { title: "Shape & Depth", keys: ["borderRadius", "borderWidth", "glassBlur", "shadowIntensity", "glowIntensity"] },
  { title: "Animation", keys: ["scoreboardScale", "logoSlotSize", "fontFamily", "animationStyle"] }
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

function isHexColor(value) {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value);
}

function normalizeHexColor(value) {
  if (!isHexColor(value)) {
    return null;
  }
  if (value.length === 4) {
    const [hash, r, g, b] = value;
    return `${hash}${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return value.toLowerCase();
}

function getThemePresetName(theme, presets) {
  const target = theme || {};
  const match = (presets || []).find((preset) => {
    const presetTheme = preset.theme || {};
    const presetKeys = Object.keys(presetTheme);
    const targetKeys = Object.keys(target);
    if (presetKeys.length !== targetKeys.length) {
      return false;
    }
    return presetKeys.every((key) => target[key] === presetTheme[key]);
  });
  return match?.name || "Custom";
}

function getControlConfig(key) {
  return CONTROL_CONFIG.find((control) => control.key === key) || null;
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

    const currentPresetName = getThemePresetName(this.theme, this.presets);
    this.root.innerHTML = `
      <section class="editor-shell">
        <div class="editor-topbar">
          <div>
            <div class="editor-label">Current Preset</div>
            <div class="preset-current">${currentPresetName}</div>
          </div>
          <button type="button" class="capsule-btn secondary" id="resetThemeBtn">Reset Theme</button>
        </div>

        <div class="preset-grid" id="themePresetGrid">
          ${
            this.presets.length === 0
              ? `<div class="empty-state compact">No theme presets loaded.</div>`
              : this.presets
                  .map((preset) => {
                    const isActive = preset.name === currentPresetName;
                    const theme = preset.theme || {};
                    const swatchGradient = `linear-gradient(90deg, ${theme.primaryColor || "#ff7a18"}, ${theme.homeColor || "#101827"}, ${theme.awayColor || "#3b82f6"}, ${theme.accentColor || "#fb923c"})`;
                    return `
                      <button
                        type="button"
                        class="preset-card ${isActive ? "is-active" : ""}"
                        data-preset-name="${preset.name}"
                        style="--preset-preview:${swatchGradient}"
                      >
                        <span class="preset-card-head">
                          <strong>${preset.name}</strong>
                          <span>${isActive ? "Active" : "Apply"}</span>
                        </span>
                        <span class="preset-card-swatches"></span>
                        <span class="preset-card-copy">One-click theme preset for fast setup.</span>
                      </button>
                    `;
                  })
                  .join("")
          }
        </div>

        <div class="theme-group-list">
          ${THEME_GROUPS.map((group) => this.renderGroup(group)).join("")}
        </div>
      </section>
    `;

    this.bindEvents();
  }

  renderGroup(group) {
    const controls = group.keys
      .map((key) => this.renderControl(getControlConfig(key)))
      .join("");
    return `
      <section class="theme-group">
        <div class="theme-group-head">
          <h3>${group.title}</h3>
        </div>
        <div class="theme-grid">${controls}</div>
      </section>
    `;
  }

  renderControl(control) {
    if (!control) {
      return "";
    }

    const value = this.theme[control.key];
    if (control.type === "color") {
      const hexValue = normalizeHexColor(String(value || "#ffffff")) || "#ffffff";
      return `
        <label class="control-block control-block-color">
          <span class="editor-label">${control.label}</span>
          <div class="control-row control-row-color">
            <input type="color" data-theme-key="${control.key}" data-theme-role="color" value="${hexValue}" />
            <input type="text" class="hex-input" data-theme-key="${control.key}" data-theme-role="hex" value="${hexValue}" />
          </div>
        </label>
      `;
    }

    if (control.type === "range") {
      return `
        <label class="control-block">
          <span class="editor-label">${control.label}</span>
          <div class="control-row">
            <input
              type="range"
              data-theme-key="${control.key}"
              data-theme-role="range"
              min="${control.min}"
              max="${control.max}"
              step="${control.step}"
              value="${value}"
            />
            <code>${prettyValue(control.type, value)}</code>
          </div>
        </label>
      `;
    }

    if (control.type === "select") {
      return `
        <label class="control-block">
          <span class="editor-label">${control.label}</span>
          <select class="ui-select" data-theme-key="${control.key}" data-theme-role="select">
            ${control.options.map((option) => `<option value="${option}" ${option === value ? "selected" : ""}>${option}</option>`).join("")}
          </select>
        </label>
      `;
    }

    return "";
  }

  bindEvents() {
    const presetCards = this.root.querySelectorAll("[data-preset-name]");
    presetCards.forEach((card) => {
      card.addEventListener("click", () => {
        const selected = this.presets.find((preset) => preset.name === card.dataset.presetName);
        if (!selected) {
          return;
        }
        this.setTheme(selected.theme);
        this.onPresetChange?.(selected);
      });
    });

    const resetBtn = this.root.querySelector("#resetThemeBtn");
    resetBtn?.addEventListener("click", () => {
      this.setTheme(DEFAULT_THEME);
    });

    const themeInputs = this.root.querySelectorAll("[data-theme-key]");
    themeInputs.forEach((input) => {
      const eventName = input.tagName === "SELECT" ? "change" : "input";
      input.addEventListener(eventName, () => {
        this.handleInputChange(input);
      });
    });
  }

  handleInputChange(input) {
    const key = input.dataset.themeKey;
    const control = getControlConfig(key);
    if (!control) {
      return;
    }

    let nextValue = input.value;

    if (control.type === "range") {
      nextValue = clamp(Number(nextValue), control.min, control.max);
      const code = input.parentElement?.querySelector("code");
      if (code) {
        code.textContent = prettyValue("range", nextValue);
      }
      if (key === "borderRadius" || key === "logoSlotSize") {
        nextValue = Math.round(Number(nextValue));
      }
      if (key === "borderWidth" || key === "backgroundOpacity" || key === "shadowIntensity" || key === "glowIntensity" || key === "scoreboardScale") {
        nextValue = Number(nextValue);
      }
    }

    if (control.type === "color") {
      const normalized = normalizeHexColor(nextValue);
      if (!normalized) {
        return;
      }
      nextValue = normalized;
      const colorInput = this.root.querySelector(`input[data-theme-role="color"][data-theme-key="${key}"]`);
      const hexInput = this.root.querySelector(`input[data-theme-role="hex"][data-theme-key="${key}"]`);
      if (colorInput && colorInput.value !== normalized) {
        colorInput.value = normalized;
      }
      if (hexInput && hexInput.value !== normalized) {
        hexInput.value = normalized;
      }
    }

    if (control.type === "select") {
      nextValue = input.value;
    }

    this.theme = { ...this.theme, [key]: nextValue };
    this.onThemeChange?.(this.theme, key);
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
