import { PEPSLIVE_SCOREBOARD_PROTOCOL, createProtocolPayload } from "./pepslive-payload-protocol.js";
import { normalizeIncomingPayload } from "./payload-validator.js";

function mapLegacyFlatToProtocol(payload) {
  const safe = payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {};
  return createProtocolPayload({
    source: safe.source || "legacy-flat",
    timestamp: safe.timestamp,
    sport: safe.sport,
    skinId: safe.skinId,
    type: safe.type,
    theme: safe.theme || {},
    animation: safe.animation || {},
    matchData: {
      eventName: safe.eventName,
      eventLogo: safe.eventLogo,
      homeLogo: safe.homeLogo,
      awayLogo: safe.awayLogo,
      homeName: safe.homeName,
      awayName: safe.awayName,
      homeShortName: safe.homeShortName,
      awayShortName: safe.awayShortName,
      homeScore: safe.homeScore,
      awayScore: safe.awayScore,
      gameClock: safe.gameClock,
      periodLabel: safe.periodLabel,
      statusLabel: safe.statusLabel,
      addedTime: safe.addedTime,
      aggregateScore: safe.aggregateScore,
      penaltyScore: safe.penaltyScore,
      goalScorerList: safe.goalScorerList,
      cardInfo: safe.cardInfo,
      shotClock: safe.shotClock,
      homeFouls: safe.homeFouls,
      awayFouls: safe.awayFouls,
      homeTimeouts: safe.homeTimeouts,
      awayTimeouts: safe.awayTimeouts,
      possession: safe.possession,
      bonus: safe.bonus,
      quarterBreakdown: safe.quarterBreakdown,
      topScorer: safe.topScorer
    }
  });
}

function mapLegacyNestedToProtocol(payload) {
  const safe = payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {};
  const event = safe.event || {};
  const teams = safe.teams || {};
  const home = teams.home || safe.home || {};
  const away = teams.away || safe.away || {};
  const clock = safe.clock || {};
  const stats = safe.stats || {};

  return createProtocolPayload({
    source: safe.source || "legacy-nested",
    timestamp: safe.timestamp,
    sport: safe.sport || safe.match?.sport,
    skinId: safe.skinId,
    type: safe.type,
    theme: safe.theme || {},
    animation: safe.animation || {},
    matchData: {
      eventName: event.name || safe.eventName,
      eventLogo: event.logo || safe.eventLogo,
      homeLogo: home.logo || safe.homeLogo,
      awayLogo: away.logo || safe.awayLogo,
      homeName: home.name || safe.homeName,
      awayName: away.name || safe.awayName,
      homeShortName: home.shortName || safe.homeShortName,
      awayShortName: away.shortName || safe.awayShortName,
      homeScore: home.score ?? safe.homeScore,
      awayScore: away.score ?? safe.awayScore,
      gameClock: clock.time || clock.display || clock.value || safe.gameClock,
      periodLabel: clock.period || safe.periodLabel,
      statusLabel: safe.statusLabel || clock.status || safe.status,
      addedTime: clock.addedTime || safe.addedTime,
      aggregateScore: stats.aggregateScore || safe.aggregateScore,
      penaltyScore: stats.penaltyScore || safe.penaltyScore,
      goalScorerList: stats.goalScorerList || safe.goalScorerList,
      cardInfo: stats.cardInfo || safe.cardInfo,
      shotClock: clock.shotClock || stats.shotClock || safe.shotClock,
      homeFouls: stats.homeFouls ?? safe.homeFouls,
      awayFouls: stats.awayFouls ?? safe.awayFouls,
      homeTimeouts: stats.homeTimeouts ?? safe.homeTimeouts,
      awayTimeouts: stats.awayTimeouts ?? safe.awayTimeouts,
      possession: stats.possession || safe.possession,
      bonus: stats.bonus || safe.bonus,
      quarterBreakdown: stats.quarterBreakdown || safe.quarterBreakdown,
      topScorer: stats.topScorer || safe.topScorer
    }
  });
}

function mapUnknownPayloadToProtocol(payload) {
  if (payload?.teams || payload?.clock || payload?.event) {
    return mapLegacyNestedToProtocol(payload);
  }
  return mapLegacyFlatToProtocol(payload);
}

function detectPayloadShape(payload) {
  if (payload?.protocol === PEPSLIVE_SCOREBOARD_PROTOCOL) {
    return "new-protocol";
  }
  if (payload?.teams || payload?.clock || payload?.event) {
    return "legacy-nested";
  }
  return "legacy-flat";
}

export class PepsLiveDockAdapter {
  constructor() {
    this.source = "pepslive-dock";
    this.status = "ready";
  }

  async ingest(rawPayload) {
    const shape = detectPayloadShape(rawPayload);
    let candidate = null;

    if (shape === "new-protocol") {
      candidate = rawPayload;
    } else if (shape === "legacy-nested") {
      candidate = mapLegacyNestedToProtocol(rawPayload);
    } else if (shape === "legacy-flat") {
      candidate = mapLegacyFlatToProtocol(rawPayload);
    } else {
      candidate = mapUnknownPayloadToProtocol(rawPayload);
    }

    const normalized = await normalizeIncomingPayload(candidate);
    return {
      ...normalized,
      shape,
      candidate
    };
  }
}

export class GoogleSheetAdapter {
  constructor() {
    this.source = "google-sheet";
    this.status = "stub";
  }

  async ingest(rawPayload) {
    const candidate = mapLegacyFlatToProtocol({
      ...rawPayload,
      source: "google-sheet"
    });
    const normalized = await normalizeIncomingPayload(candidate);
    return {
      ...normalized,
      shape: "sheet-row",
      candidate
    };
  }
}

export class TournamentManagerAdapter {
  constructor() {
    this.source = "tournament-manager";
    this.status = "stub";
  }

  async ingest(rawPayload) {
    const candidate = mapLegacyNestedToProtocol({
      ...rawPayload,
      source: "tournament-manager"
    });
    const normalized = await normalizeIncomingPayload(candidate);
    return {
      ...normalized,
      shape: "tournament-state",
      candidate
    };
  }
}

export function createDefaultAdapters() {
  return [new PepsLiveDockAdapter(), new GoogleSheetAdapter(), new TournamentManagerAdapter()];
}
