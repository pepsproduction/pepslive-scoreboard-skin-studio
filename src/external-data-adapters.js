import { createProtocolPayload } from "./pepslive-payload-protocol.js";
import { normalizeIncomingPayload } from "./payload-validator.js";

function mapLegacyFlatToProtocol(payload) {
  return createProtocolPayload({
    source: payload.source || "legacy-flat",
    timestamp: payload.timestamp,
    sport: payload.sport,
    skinId: payload.skinId,
    type: payload.type,
    theme: payload.theme || {},
    animation: payload.animation || {},
    matchData: {
      eventName: payload.eventName,
      eventLogo: payload.eventLogo,
      homeLogo: payload.homeLogo,
      awayLogo: payload.awayLogo,
      homeName: payload.homeName,
      awayName: payload.awayName,
      homeShortName: payload.homeShortName,
      awayShortName: payload.awayShortName,
      homeScore: payload.homeScore,
      awayScore: payload.awayScore,
      gameClock: payload.gameClock,
      periodLabel: payload.periodLabel,
      statusLabel: payload.statusLabel,
      addedTime: payload.addedTime,
      aggregateScore: payload.aggregateScore,
      penaltyScore: payload.penaltyScore,
      goalScorerList: payload.goalScorerList,
      cardInfo: payload.cardInfo,
      shotClock: payload.shotClock,
      homeFouls: payload.homeFouls,
      awayFouls: payload.awayFouls,
      homeTimeouts: payload.homeTimeouts,
      awayTimeouts: payload.awayTimeouts,
      possession: payload.possession,
      bonus: payload.bonus,
      quarterBreakdown: payload.quarterBreakdown,
      topScorer: payload.topScorer
    }
  });
}

function mapLegacyNestedToProtocol(payload) {
  const event = payload.event || {};
  const teams = payload.teams || {};
  const home = teams.home || payload.home || {};
  const away = teams.away || payload.away || {};
  const clock = payload.clock || {};
  const stats = payload.stats || {};

  return createProtocolPayload({
    source: payload.source || "legacy-nested",
    timestamp: payload.timestamp,
    sport: payload.sport || payload.match?.sport,
    skinId: payload.skinId,
    type: payload.type,
    theme: payload.theme || {},
    animation: payload.animation || {},
    matchData: {
      eventName: event.name || payload.eventName,
      eventLogo: event.logo || payload.eventLogo,
      homeLogo: home.logo || payload.homeLogo,
      awayLogo: away.logo || payload.awayLogo,
      homeName: home.name || payload.homeName,
      awayName: away.name || payload.awayName,
      homeShortName: home.shortName || payload.homeShortName,
      awayShortName: away.shortName || payload.awayShortName,
      homeScore: home.score ?? payload.homeScore,
      awayScore: away.score ?? payload.awayScore,
      gameClock: clock.display || clock.value || payload.gameClock,
      periodLabel: clock.period || payload.periodLabel,
      statusLabel: payload.statusLabel || clock.status || payload.status,
      addedTime: clock.addedTime || payload.addedTime,
      aggregateScore: stats.aggregateScore || payload.aggregateScore,
      penaltyScore: stats.penaltyScore || payload.penaltyScore,
      goalScorerList: stats.goalScorerList || payload.goalScorerList,
      cardInfo: stats.cardInfo || payload.cardInfo,
      shotClock: clock.shotClock || stats.shotClock || payload.shotClock,
      homeFouls: stats.homeFouls ?? payload.homeFouls,
      awayFouls: stats.awayFouls ?? payload.awayFouls,
      homeTimeouts: stats.homeTimeouts ?? payload.homeTimeouts,
      awayTimeouts: stats.awayTimeouts ?? payload.awayTimeouts,
      possession: stats.possession || payload.possession,
      bonus: stats.bonus || payload.bonus,
      quarterBreakdown: stats.quarterBreakdown || payload.quarterBreakdown,
      topScorer: stats.topScorer || payload.topScorer
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
  if (payload?.protocol === "PEPSLIVE_SCOREBOARD_STATE_V1") {
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
