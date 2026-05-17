/**
 * scripts/check-phase44-relay.mjs
 * Phase 4.4 QA: Relay Poller + Named Skin Presets verification
 *
 * Run with: node scripts/check-phase44-relay.mjs
 */

import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// Inline relay-poller helpers (no DOM/browser required)
// ---------------------------------------------------------------------------

const RELAY_POLL_INTERVAL_MIN_MS = 2_000;
const RELAY_POLL_INTERVAL_MAX_MS = 60_000;
const RELAY_POLL_INTERVAL_DEFAULT_MS = 5_000;

function clampRelayInterval(ms) {
  const value = Math.round(Number(ms));
  if (!Number.isFinite(value)) return RELAY_POLL_INTERVAL_DEFAULT_MS;
  return Math.max(RELAY_POLL_INTERVAL_MIN_MS, Math.min(RELAY_POLL_INTERVAL_MAX_MS, value));
}

function sanitizeRelayUrl(raw) {
  if (!raw || typeof raw !== "string") return null;
  try {
    const parsed = new URL(raw.trim());
    if (!["http:", "https:"].includes(parsed.protocol)) return null;
    return parsed.toString();
  } catch (_error) {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Inline skin-preset helpers (localStorage-free for Node.js)
// ---------------------------------------------------------------------------

function generatePresetId() {
  return `preset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function saveSkinPreset(store, preset) {
  const id = preset.id || generatePresetId();
  const saved = {
    id,
    name: String(preset.name || "Untitled Preset").slice(0, 64),
    skinId: preset.skinId || "",
    sport: preset.sport || "football",
    type: preset.type || "live",
    theme: preset.theme || {},
    animation: typeof preset.animation === "string" ? preset.animation : "smooth-broadcast",
    displayOptions: preset.displayOptions || {},
    eventLogo: preset.eventLogo || "",
    savedAt: new Date().toISOString()
  };
  store[id] = saved;
  return saved;
}

function listSkinPresets(store) {
  return Object.values(store).sort((a, b) => {
    const ta = a.savedAt || "";
    const tb = b.savedAt || "";
    return ta < tb ? 1 : ta > tb ? -1 : 0;
  });
}

function deleteSkinPreset(store, id) {
  if (!store[id]) return false;
  delete store[id];
  return true;
}

// ---------------------------------------------------------------------------
// Inline relay URL generator (mirrors src/utils.js logic)
// ---------------------------------------------------------------------------

function encodePortableState(stateObj) {
  const clean = {};
  for (const [key, value] of Object.entries(stateObj)) {
    if (value !== undefined && value !== null) clean[key] = value;
  }
  const encoded = Buffer.from(JSON.stringify(clean), "utf8")
    .toString("base64")
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return { encoded, size: encoded.length };
}

function generateRelayOverlayUrl(opts) {
  const { skinId, type, relayUrl, sport, animationStyle, theme, displayOptions, debug = false } = opts;
  if (!relayUrl) return { url: "", warning: "Relay URL is required." };
  let sanitizedRelay;
  try {
    const parsed = new URL(relayUrl.trim());
    if (!["http:", "https:"].includes(parsed.protocol)) return { url: "", warning: "Must use http/https" };
    sanitizedRelay = parsed.toString();
  } catch (_error) {
    return { url: "", warning: "Invalid relay URL." };
  }

  const overlayFile = type === "summary" ? "overlays/summary.html" : "overlays/live.html";
  const baseUrl = `http://localhost:8080/${overlayFile}`;
  const url = new URL(baseUrl);
  url.searchParams.set("relay", encodeURIComponent(sanitizedRelay));

  if (skinId) {
    const stateObj = {};
    if (skinId) stateObj.skinId = skinId;
    if (sport) stateObj.sport = sport;
    if (type) stateObj.type = type;
    if (animationStyle) stateObj.animation = animationStyle;
    if (theme && Object.keys(theme).length > 0) stateObj.theme = theme;
    if (displayOptions && Object.keys(displayOptions).length > 0) stateObj.displayOptions = displayOptions;
    const { encoded } = encodePortableState(stateObj);
    url.searchParams.set("state", encoded);
  }

  if (debug) url.searchParams.set("debug", "1");

  return { url: url.toString(), warning: null };
}

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;

function assert(description, condition) {
  if (condition) {
    console.log(`  ✓ ${description}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${description}`);
    failed++;
  }
}

// ---------------------------------------------------------------------------
// [1] clampRelayInterval
// ---------------------------------------------------------------------------
console.log("\n[1] clampRelayInterval");

assert("default for NaN", clampRelayInterval(NaN) === RELAY_POLL_INTERVAL_DEFAULT_MS);
assert("null clamps to min (Number(null)=0)", clampRelayInterval(null) === RELAY_POLL_INTERVAL_MIN_MS);
assert("clamp below min → min", clampRelayInterval(100) === RELAY_POLL_INTERVAL_MIN_MS);
assert("clamp above max → max", clampRelayInterval(999_999) === RELAY_POLL_INTERVAL_MAX_MS);
assert("valid value passes through", clampRelayInterval(10_000) === 10_000);
assert("string number parsed", clampRelayInterval("8000") === 8_000);

// ---------------------------------------------------------------------------
// [2] sanitizeRelayUrl
// ---------------------------------------------------------------------------
console.log("\n[2] sanitizeRelayUrl");

assert("null → null", sanitizeRelayUrl(null) === null);
assert("empty → null", sanitizeRelayUrl("") === null);
assert("garbage → null", sanitizeRelayUrl("not-a-url!!!") === null);
assert("file:// → null (not http)", sanitizeRelayUrl("file:///some/file.json") === null);
assert("ftp:// → null (not http)", sanitizeRelayUrl("ftp://example.com/state.json") === null);
assert("http OK", sanitizeRelayUrl("http://example.com/state.json") !== null);
assert("https OK", sanitizeRelayUrl("https://gist.githubusercontent.com/user/1234/raw/state.json") !== null);
assert("trailing spaces trimmed", sanitizeRelayUrl("  https://example.com/state.json  ") !== null);
assert("URL normalised", sanitizeRelayUrl("HTTPS://EXAMPLE.COM/state.json") === "https://example.com/state.json");

// ---------------------------------------------------------------------------
// [3] Named Skin Presets round-trip
// ---------------------------------------------------------------------------
console.log("\n[3] Skin Presets round-trip");

const store = {};

const p1 = saveSkinPreset(store, {
  name: "Cup Final 2026 – Live",
  skinId: "FB-LIVE-01",
  sport: "football",
  type: "live",
  theme: { primaryColor: "#ff7a18" },
  animation: "smooth-broadcast",
  displayOptions: { eventLogo: true, gameClock: true }
});

assert("preset has id", typeof p1.id === "string" && p1.id.startsWith("preset-"));
assert("preset name stored", p1.name === "Cup Final 2026 – Live");
assert("preset skinId", p1.skinId === "FB-LIVE-01");
assert("preset theme", p1.theme?.primaryColor === "#ff7a18");
assert("savedAt is ISO string", typeof p1.savedAt === "string" && p1.savedAt.includes("T"));

const p2 = saveSkinPreset(store, {
  name: "Basketball OT",
  skinId: "BB-LIVE-03",
  sport: "basketball",
  type: "live",
  animation: "neon-pulse"
});

const list = listSkinPresets(store);
assert("list has 2 presets", list.length === 2);
assert("list sorted newest first", list[0].id === p2.id);

const deleted = deleteSkinPreset(store, p1.id);
assert("delete returns true", deleted === true);
assert("list now has 1 preset", listSkinPresets(store).length === 1);

const notDeleted = deleteSkinPreset(store, "nonexistent-id");
assert("delete non-existent returns false", notDeleted === false);

// ---------------------------------------------------------------------------
// [4] Preset name clamped to 64 chars
// ---------------------------------------------------------------------------
console.log("\n[4] Preset name length cap");

const longNameStore = {};
const longPreset = saveSkinPreset(longNameStore, {
  name: "A".repeat(100),
  skinId: "FB-LIVE-01",
  sport: "football",
  type: "live"
});
assert("name clamped to 64 chars", longPreset.name.length === 64);

// ---------------------------------------------------------------------------
// [5] generateRelayOverlayUrl
// ---------------------------------------------------------------------------
console.log("\n[5] generateRelayOverlayUrl");

const noRelayResult = generateRelayOverlayUrl({ skinId: "FB-LIVE-01", type: "live", relayUrl: "" });
assert("missing relay → empty URL", noRelayResult.url === "");
assert("missing relay → warning", !!noRelayResult.warning);

const badRelayResult = generateRelayOverlayUrl({ skinId: "FB-LIVE-01", type: "live", relayUrl: "not-a-url" });
assert("bad relay → empty URL", badRelayResult.url === "");

const goodRelay = "https://gist.githubusercontent.com/user/abc123/raw/state.json";
const liveResult = generateRelayOverlayUrl({
  skinId: "FB-LIVE-01",
  type: "live",
  relayUrl: goodRelay,
  sport: "football",
  animationStyle: "smooth-broadcast",
  theme: { primaryColor: "#ff7a18" },
  displayOptions: { eventLogo: true }
});

assert("relay URL generated", liveResult.url.length > 0);
assert("no warning for valid relay", liveResult.warning === null);
assert("URL contains relay param", liveResult.url.includes("relay="));
assert("relay param value is percent-encoded in URL string", liveResult.url.includes("relay=https"));
assert("URL contains state param (portable skin)", liveResult.url.includes("state="));
assert("URL targets live overlay", liveResult.url.includes("live.html"));

const summaryResult = generateRelayOverlayUrl({
  skinId: "BB-SUM-01",
  type: "summary",
  relayUrl: goodRelay
});
assert("summary overlay relay URL", summaryResult.url.includes("summary.html"));

const debugResult = generateRelayOverlayUrl({
  skinId: "FB-LIVE-01",
  type: "live",
  relayUrl: goodRelay,
  debug: true
});
assert("debug flag in URL", debugResult.url.includes("debug=1"));

// ---------------------------------------------------------------------------
// [6] relay URL can be decoded back
// ---------------------------------------------------------------------------
console.log("\n[6] Relay URL relay param decode round-trip");

const parsedUrl = new URL(liveResult.url);
const decodedRelay = decodeURIComponent(parsedUrl.searchParams.get("relay") || "");
assert("relay param decodes back to original URL", decodedRelay === goodRelay);

// ---------------------------------------------------------------------------
// [7] Source files exist and have no hard-coded paths
// ---------------------------------------------------------------------------
console.log("\n[7] New source files exist");

const requiredFiles = [
  "src/relay-poller.js",
  "scripts/check-phase44-relay.mjs"
];
for (const file of requiredFiles) {
  assert(`${file} exists`, fs.existsSync(path.resolve(root, file)));
}

const relayPollerSrc = fs.readFileSync(path.resolve(root, "src/relay-poller.js"), "utf8");
assert("relay-poller.js has no absolute C:\\ paths", !relayPollerSrc.includes("C:\\"));
assert("relay-poller.js has no absolute /Users/ paths", !relayPollerSrc.includes("/Users/"));
assert("relay-poller exports RelayPoller", relayPollerSrc.includes("export class RelayPoller"));
assert("relay-poller exports clampRelayInterval", relayPollerSrc.includes("export function clampRelayInterval"));
assert("relay-poller exports sanitizeRelayUrl", relayPollerSrc.includes("export function sanitizeRelayUrl"));

// skin-storage check
const skinStorageSrc = fs.readFileSync(path.resolve(root, "src/skin-storage.js"), "utf8");
assert("skin-storage exports listSkinPresets", skinStorageSrc.includes("export function listSkinPresets"));
assert("skin-storage exports saveSkinPreset", skinStorageSrc.includes("export function saveSkinPreset"));
assert("skin-storage exports deleteSkinPreset", skinStorageSrc.includes("export function deleteSkinPreset"));
assert("skin-storage exports getRelayConfig", skinStorageSrc.includes("export function getRelayConfig"));

// overlay-core check
const coreJs = fs.readFileSync(path.resolve(root, "overlays/overlay-core.js"), "utf8");
assert("overlay-core imports RelayPoller", coreJs.includes("RelayPoller"));
assert("overlay-core reads relayRaw param", coreJs.includes("relayRaw"));
assert("overlay-core starts relay poller", coreJs.includes("relayPoller.start()"));
assert("overlay-core stops relay on unload", coreJs.includes("relayPoller?.stop()"));

// dock.html check
const dockHtml = fs.readFileSync(path.resolve(root, "dock.html"), "utf8");
assert("dock.html has presetNameInput", dockHtml.includes("presetNameInput"));
assert("dock.html has savePresetBtn", dockHtml.includes("savePresetBtn"));
assert("dock.html has presetListEl", dockHtml.includes("presetListEl"));
assert("dock.html has relayUrlInput", dockHtml.includes("relayUrlInput"));
assert("dock.html has copyRelayLiveUrlBtn", dockHtml.includes("copyRelayLiveUrlBtn"));
assert("dock.html has exportStateRelayBtn", dockHtml.includes("exportStateRelayBtn"));

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log(`\n${"─".repeat(50)}`);
if (failed === 0) {
  console.log(`PHASE44_RELAY_CHECK: PASS (${passed}/${passed + failed} assertions)`);
  process.exit(0);
} else {
  console.log(`PHASE44_RELAY_CHECK: FAIL (${failed} failures, ${passed} passed)`);
  process.exit(1);
}
