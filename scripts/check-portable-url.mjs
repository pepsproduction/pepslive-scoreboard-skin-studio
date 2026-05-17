/**
 * scripts/check-portable-url.mjs
 * Phase 4.3 QA: Portable State URL encode/decode verification
 *
 * Run with: node scripts/check-portable-url.mjs
 * (No browser context needed — pure Node.js logic checks only.)
 */

import { createRequire } from "module";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// Inline the encode/decode logic from src/utils.js so we can run without DOM
// ---------------------------------------------------------------------------

const PORTABLE_STATE_SIZE_LIMIT = 4096;

function encodePortableState(stateObj, { includeEventLogo = false } = {}) {
  const dropped = [];
  const clean = {};
  for (const [key, value] of Object.entries(stateObj)) {
    if (value === undefined || value === null) continue;
    clean[key] = value;
  }

  const withoutLogo = { ...clean };
  delete withoutLogo.eventLogo;

  const jsonWithoutLogo = JSON.stringify(withoutLogo);
  let jsonToEncode = jsonWithoutLogo;

  if (includeEventLogo && clean.eventLogo) {
    const jsonWithLogo = JSON.stringify(clean);
    if (jsonWithLogo.length <= PORTABLE_STATE_SIZE_LIMIT) {
      jsonToEncode = jsonWithLogo;
    } else {
      dropped.push("eventLogo");
    }
  }

  // Node.js doesn't have btoa/atob natively in older versions — use Buffer
  const encoded = Buffer.from(jsonToEncode, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  return {
    encoded,
    size: encoded.length,
    oversized: encoded.length > PORTABLE_STATE_SIZE_LIMIT,
    dropped
  };
}

function decodePortableState(raw) {
  if (!raw || typeof raw !== "string") return null;
  try {
    const base64 = raw.replace(/-/g, "+").replace(/_/g, "/");
    const json = Buffer.from(base64, "base64").toString("utf8");
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed;
  } catch (_error) {
    return null;
  }
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
// Test 1: Encode/decode round-trip – basic skin + theme
// ---------------------------------------------------------------------------
console.log("\n[1] Encode/decode round-trip");

const sample = {
  skinId: "FB-LIVE-01",
  sport: "football",
  type: "live",
  animation: "smooth-broadcast",
  theme: { primaryColor: "#ff7a18", secondaryColor: "#101827" },
  displayOptions: { eventLogo: true, eventName: true, gameClock: true },
  matchData: { homeName: "Dragon FC", awayName: "Tiger FC", homeScore: 2, awayScore: 1, gameClock: "45:00" }
};

const { encoded, size, oversized, dropped } = encodePortableState(sample);
assert("encoded is non-empty string", typeof encoded === "string" && encoded.length > 0);
assert("encoded contains no + or /", !encoded.includes("+") && !encoded.includes("/"));
assert("encoded has no trailing =", !encoded.endsWith("="));
assert(`size reported (${size} chars)`, size > 0);
assert("not oversized for typical state", !oversized);
assert("no fields dropped", dropped.length === 0);

const decoded = decodePortableState(encoded);
assert("decoded is object", decoded !== null && typeof decoded === "object");
assert("skinId preserved", decoded.skinId === sample.skinId);
assert("sport preserved", decoded.sport === sample.sport);
assert("type preserved", decoded.type === sample.type);
assert("animation preserved", decoded.animation === sample.animation);
assert("theme.primaryColor preserved", decoded.theme?.primaryColor === sample.theme.primaryColor);
assert("displayOptions.eventLogo preserved", decoded.displayOptions?.eventLogo === true);
assert("matchData.homeScore preserved", decoded.matchData?.homeScore === 2);
assert("matchData.gameClock preserved", decoded.matchData?.gameClock === "45:00");

// ---------------------------------------------------------------------------
// Test 2: Decode invalid/corrupt state – must return null, not throw
// ---------------------------------------------------------------------------
console.log("\n[2] Invalid state fallback (must not throw)");

assert("null input → null", decodePortableState(null) === null);
assert("empty string → null", decodePortableState("") === null);
assert("garbage string → null", decodePortableState("!!!not-base64!!!") === null);
assert("valid base64 but bad JSON → null", decodePortableState(Buffer.from("{bad json").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")) === null);
assert("array JSON → null (not an object)", decodePortableState(Buffer.from("[1,2,3]", "utf8").toString("base64")) === null);

// ---------------------------------------------------------------------------
// Test 3: EventLogo dropped when state would be oversized
// ---------------------------------------------------------------------------
console.log("\n[3] EventLogo size budget");

// Simulate a small data-URL — real ones are typically 50k+
const fakeLogoSmall = "data:image/png;base64," + "A".repeat(200);
const fakeLogoBig = "data:image/png;base64," + "A".repeat(PORTABLE_STATE_SIZE_LIMIT * 2);

const withSmallLogo = encodePortableState({ skinId: "FB-LIVE-01", eventLogo: fakeLogoSmall }, { includeEventLogo: true });
const withBigLogo = encodePortableState({ skinId: "FB-LIVE-01", eventLogo: fakeLogoBig }, { includeEventLogo: true });

assert("small logo (within limit) — not dropped", withSmallLogo.dropped.length === 0);
assert("big logo (over limit) — dropped", withBigLogo.dropped.includes("eventLogo"));

const decodedWithSmallLogo = decodePortableState(withSmallLogo.encoded);
assert("small logo: eventLogo present in decoded state", !!decodedWithSmallLogo?.eventLogo);

const decodedWithBigLogo = decodePortableState(withBigLogo.encoded);
assert("big logo: eventLogo absent from decoded state", !decodedWithBigLogo?.eventLogo);

// ---------------------------------------------------------------------------
// Test 4: Overlay files exist (GitHub Pages path check)
// ---------------------------------------------------------------------------
console.log("\n[4] Overlay files exist and have no absolute-path imports");

const overlayFiles = ["overlays/live.html", "overlays/summary.html", "overlays/overlay-core.js"];
for (const file of overlayFiles) {
  const filePath = path.resolve(root, file);
  assert(`${file} exists`, fs.existsSync(filePath));
}

// Check overlay-core.js doesn't contain hard absolute Windows/macOS paths
const coreJs = fs.readFileSync(path.resolve(root, "overlays/overlay-core.js"), "utf8");
assert("overlay-core.js has no absolute C:\\ paths", !coreJs.includes("C:\\"));
assert("overlay-core.js has no absolute /Users/ paths", !coreJs.includes("/Users/"));

// ---------------------------------------------------------------------------
// Test 5: Portable state contains expected skin/theme/displayOptions fields
// ---------------------------------------------------------------------------
console.log("\n[5] Portable state completeness check");

const fullState = {
  skinId: "BB-LIVE-01",
  sport: "basketball",
  type: "live",
  animation: "neon-pulse",
  theme: {
    primaryColor: "#3b82f6",
    secondaryColor: "#0f172a",
    homeColor: "#f97316",
    awayColor: "#3b82f6"
  },
  displayOptions: {
    eventLogo: false,
    eventName: true,
    teamLogos: true,
    gameClock: true,
    periodLabel: true,
    statusLabel: true,
    extraRow: false,
    textMode: "full",
    teamLogoPosition: "outer"
  },
  matchData: { homeName: "Orange Wolves", awayName: "Blue Hawks", homeScore: 78, awayScore: 74 }
};

const { encoded: fullEncoded } = encodePortableState(fullState);
const fullDecoded = decodePortableState(fullEncoded);

assert("skinId in state", fullDecoded.skinId === "BB-LIVE-01");
assert("theme in state", typeof fullDecoded.theme === "object");
assert("displayOptions in state", typeof fullDecoded.displayOptions === "object");
assert("displayOptions.teamLogoPosition preserved", fullDecoded.displayOptions?.teamLogoPosition === "outer");
assert("displayOptions.extraRow preserved (false)", fullDecoded.displayOptions?.extraRow === false);
assert("matchData in state", typeof fullDecoded.matchData === "object");
assert("matchData.awayScore preserved", fullDecoded.matchData?.awayScore === 74);

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log(`\n${"─".repeat(50)}`);
if (failed === 0) {
  console.log(`PORTABLE_URL_CHECK: PASS (${passed}/${passed + failed} assertions)`);
  process.exit(0);
} else {
  console.log(`PORTABLE_URL_CHECK: FAIL (${failed} failures, ${passed} passed)`);
  process.exit(1);
}
