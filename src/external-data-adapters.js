import { nowIso } from "./utils.js";

export function normalizeExternalMatchPayload(payload) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  // Accept future payload sources from PepsLive Dock UI / sheets / tournament systems.
  const normalized = {
    sport: payload.sport || null,
    eventName: payload.eventName || payload.event?.name || "",
    statusLabel: payload.statusLabel || payload.status || "",
    gameClock: payload.gameClock || payload.clock || "",
    periodLabel: payload.periodLabel || payload.period || "",
    homeName: payload.homeName || payload.home?.name || "",
    awayName: payload.awayName || payload.away?.name || "",
    homeShortName: payload.homeShortName || payload.home?.shortName || "",
    awayShortName: payload.awayShortName || payload.away?.shortName || "",
    homeScore: payload.homeScore ?? payload.home?.score ?? "",
    awayScore: payload.awayScore ?? payload.away?.score ?? "",
    homeLogo: payload.homeLogo || payload.home?.logo || "",
    awayLogo: payload.awayLogo || payload.away?.logo || "",
    eventLogo: payload.eventLogo || payload.event?.logo || "",
    updatedAt: payload.updatedAt || nowIso()
  };

  const optionalFields = [
    "addedTime",
    "aggregateScore",
    "penaltyScore",
    "goalScorerList",
    "cardInfo",
    "quarterLabel",
    "shotClock",
    "homeFouls",
    "awayFouls",
    "homeTimeouts",
    "awayTimeouts",
    "possession",
    "bonus",
    "quarterBreakdown",
    "topScorer"
  ];

  optionalFields.forEach((key) => {
    if (payload[key] !== undefined) {
      normalized[key] = payload[key];
    }
  });

  return normalized;
}

export function buildPepsLiveDockHook() {
  return {
    source: "pepslive-dock",
    status: "ready",
    // TODO Phase 2.1:
    // - bind event source from legacy Dock UI
    // - validate payload schema and signature
    // - support differential updates per sport slot
    ingest(payload) {
      return normalizeExternalMatchPayload(payload);
    }
  };
}

export function buildGoogleSheetAdapter() {
  return {
    source: "google-sheet",
    status: "stub",
    // TODO Phase 2.2:
    // - load published CSV/JSON endpoint
    // - map rows to overlay match payload
    // - refresh with interval polling + ETag
    ingest(payload) {
      return normalizeExternalMatchPayload(payload);
    }
  };
}

export function buildTournamentManagerAdapter() {
  return {
    source: "tournament-manager",
    status: "stub",
    // TODO Phase 2.2:
    // - map tournament API payloads to current match
    // - resolve bracket -> live match context
    ingest(payload) {
      return normalizeExternalMatchPayload(payload);
    }
  };
}
