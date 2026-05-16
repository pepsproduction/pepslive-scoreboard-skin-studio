import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PepsLiveDockAdapter } from "../src/external-data-adapters.js";
import { validateIncomingPayload } from "../src/payload-validator.js";
import {
  createPepsLivePayloadFromDockState,
  normalizePepsLiveDockState,
  publishPepsLiveDockState,
  sendPepsLiveStateUpdate,
  writePepsLiveStateToLocalStorage
} from "../src/pepslive-dock-bridge.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");

const adapter = new PepsLiveDockAdapter();
const samples = [
  {
    file: "data/sample-pepslive-dock-state-football.json",
    expectSport: "football",
    required: ["eventName", "homeName", "awayName", "homeScore", "awayScore", "gameClock", "periodLabel", "statusLabel"]
  },
  {
    file: "data/sample-pepslive-dock-state-basketball.json",
    expectSport: "basketball",
    required: [
      "eventName",
      "homeName",
      "awayName",
      "homeScore",
      "awayScore",
      "gameClock",
      "periodLabel",
      "statusLabel",
      "shotClock",
      "homeFouls",
      "awayFouls",
      "homeTimeouts",
      "awayTimeouts"
    ]
  }
];

let hasFailure = false;

for (const sample of samples) {
  const filePath = path.resolve(root, sample.file);
  const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const ingested = await adapter.ingest(raw);
  const validation = ingested.accepted ? await validateIncomingPayload(ingested.payload) : null;

  const payload = validation?.normalizedPayload;
  const missingFields = sample.required.filter((field) => payload?.matchData?.[field] === undefined || payload?.matchData?.[field] === null || payload?.matchData?.[field] === "");
  const sourceOk = payload?.source === "pepslive-dock";
  const sportOk = payload?.sport === sample.expectSport;
  const validOk = !!validation?.isValid;
  const bridgeCreate = createPepsLivePayloadFromDockState(raw);
  const bridgeNormalize = normalizePepsLiveDockState(raw);
  const bridgeCreateOk = bridgeCreate?.protocol === "PEPSLIVE_SCOREBOARD_STATE_V1";
  const bridgeNormalizeOk = bridgeNormalize?.protocol === "PEPSLIVE_SCOREBOARD_STATE_V1";

  const pass = ingested.accepted && validOk && sourceOk && sportOk && missingFields.length === 0 && bridgeCreateOk && bridgeNormalizeOk;
  if (!pass) {
    hasFailure = true;
  }

  console.log(
    JSON.stringify(
      {
        file: sample.file,
        detectedFormat: adapter.detectFormat(raw),
        accepted: ingested.accepted,
        valid: validOk,
        source: payload?.source || null,
        sport: payload?.sport || null,
        skinId: payload?.skinId || null,
        bridgeCreateOk,
        bridgeNormalizeOk,
        missingFields,
        pass
      },
      null,
      2
    )
  );
}

const nonBrowserPublishResult = await publishPepsLiveDockState({ sport: "football", teamAName: "A", teamBName: "B", teamAScore: 1, teamBScore: 0 });
const nonBrowserSendResult = await sendPepsLiveStateUpdate({ sport: "football", teamAName: "A", teamBName: "B", teamAScore: 1, teamBScore: 0 });
const nonBrowserLocalStorageResult = await writePepsLiveStateToLocalStorage({ sport: "football", teamAName: "A", teamBName: "B", teamAScore: 1, teamBScore: 0 });
const bridgeNoThrowOk = !!nonBrowserPublishResult && !!nonBrowserSendResult && !!nonBrowserLocalStorageResult;
console.log(JSON.stringify({ bridgeNoThrowOk, nonBrowserPublishResult, nonBrowserSendResult, nonBrowserLocalStorageResult }, null, 2));
if (!bridgeNoThrowOk) {
  hasFailure = true;
}

if (hasFailure) {
  console.log("PHASE3_INTEGRATION_CHECK: FAIL");
  process.exit(1);
}

console.log("PHASE3_INTEGRATION_CHECK: PASS");
