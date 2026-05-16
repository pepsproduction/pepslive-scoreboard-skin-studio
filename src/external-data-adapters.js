import { PEPSLIVE_SCOREBOARD_PROTOCOL, createProtocolPayload } from "./pepslive-payload-protocol.js";
import { normalizeIncomingPayload } from "./payload-validator.js";

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function pickFirst(source, keys, fallback = undefined) {
  for (const key of keys) {
    const value = source?.[key];
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }
  return fallback;
}

function mapLegacyFlatToProtocol(payload) {
  const safe = isPlainObject(payload) ? payload : {};
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
  const safe = isPlainObject(payload) ? payload : {};
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

function mapPepsLiveDockStateToProtocol(payload) {
  const safe = isPlainObject(payload) ? payload : {};
  const homeTeam = safe.homeTeam || safe.teamA || {};
  const awayTeam = safe.awayTeam || safe.teamB || {};

  return createProtocolPayload({
    source: safe.source || "pepslive-dock",
    timestamp: safe.timestamp,
    sport: pickFirst(safe, ["sport", "gameSport", "matchSport"]),
    skinId: safe.skinId,
    type: safe.type,
    theme: safe.theme || {},
    animation: safe.animation || {},
    matchData: {
      eventName: pickFirst(safe, ["eventTitle", "tournamentName", "leagueName", "eventName"]),
      eventLogo: pickFirst(safe, ["eventLogo", "leagueLogo", "tournamentLogo"]),
      homeLogo: pickFirst(safe, ["teamALogo", "homeLogo", "logoA"]) || homeTeam.logo,
      awayLogo: pickFirst(safe, ["teamBLogo", "awayLogo", "logoB"]) || awayTeam.logo,
      homeName: pickFirst(safe, ["teamAName", "homeName", "teamNameA", "homeTeamName"]) || homeTeam.name,
      awayName: pickFirst(safe, ["teamBName", "awayName", "teamNameB", "awayTeamName"]) || awayTeam.name,
      homeShortName: pickFirst(safe, ["teamAShortName", "homeShortName", "teamAShort"]) || homeTeam.shortName,
      awayShortName: pickFirst(safe, ["teamBShortName", "awayShortName", "teamBShort"]) || awayTeam.shortName,
      homeScore: pickFirst(safe, ["teamAScore", "homeScore", "scoreA", "homeTeamScore"]) ?? homeTeam.score,
      awayScore: pickFirst(safe, ["teamBScore", "awayScore", "scoreB", "awayTeamScore"]) ?? awayTeam.score,
      gameClock: pickFirst(safe, ["matchTime", "timer", "clockText", "gameClock", "clock"]),
      periodLabel: pickFirst(safe, ["period", "half", "quarter", "periodLabel"]),
      statusLabel: pickFirst(safe, ["matchStatus", "status", "statusLabel"]),
      addedTime: pickFirst(safe, ["addedTime"]),
      aggregateScore: pickFirst(safe, ["aggregateScore"]),
      penaltyScore: pickFirst(safe, ["penaltyScore"]),
      goalScorerList: pickFirst(safe, ["goalScorerList", "scorers"]),
      cardInfo: pickFirst(safe, ["cardInfo", "cards"]),
      shotClock: pickFirst(safe, ["shotClock"]),
      homeFouls: pickFirst(safe, ["teamAFouls", "homeFouls"]),
      awayFouls: pickFirst(safe, ["teamBFouls", "awayFouls"]),
      homeTimeouts: pickFirst(safe, ["teamATimeouts", "homeTimeouts"]),
      awayTimeouts: pickFirst(safe, ["teamBTimeouts", "awayTimeouts"]),
      possession: pickFirst(safe, ["possession"]),
      bonus: pickFirst(safe, ["bonus"]),
      quarterBreakdown: pickFirst(safe, ["quarterBreakdown"]),
      topScorer: pickFirst(safe, ["topScorer"])
    }
  });
}

export class PepsLiveDockAdapter {
  static detectFormat(input) {
    return new PepsLiveDockAdapter().detectFormat(input);
  }

  static fromLegacyFlat(input) {
    return new PepsLiveDockAdapter().fromLegacyFlat(input);
  }

  static fromLegacyNested(input) {
    return new PepsLiveDockAdapter().fromLegacyNested(input);
  }

  static fromPepsLiveDockState(input) {
    return new PepsLiveDockAdapter().fromPepsLiveDockState(input);
  }

  static normalize(input) {
    return new PepsLiveDockAdapter().normalize(input);
  }

  static async ingest(input) {
    return new PepsLiveDockAdapter().ingest(input);
  }

  constructor() {
    this.source = "pepslive-dock";
    this.status = "ready";
  }

  detectFormat(input) {
    if (input?.protocol === PEPSLIVE_SCOREBOARD_PROTOCOL) {
      return "new-protocol";
    }
    if (isPlainObject(input) && (input.teams || input.clock || input.event)) {
      return "legacy-nested";
    }
    if (
      isPlainObject(input) &&
      (input.teamAName || input.teamBName || input.teamAScore !== undefined || input.teamBScore !== undefined || input.eventTitle || input.matchTime || input.timer)
    ) {
      return "pepslive-dock-state";
    }
    if (isPlainObject(input)) {
      return "legacy-flat";
    }
    return "unknown";
  }

  fromLegacyFlat(input) {
    return mapLegacyFlatToProtocol(input);
  }

  fromLegacyNested(input) {
    return mapLegacyNestedToProtocol(input);
  }

  fromPepsLiveDockState(input) {
    return mapPepsLiveDockStateToProtocol(input);
  }

  normalize(input) {
    const format = this.detectFormat(input);
    if (format === "new-protocol") {
      return input;
    }
    if (format === "legacy-nested") {
      return this.fromLegacyNested(input);
    }
    if (format === "pepslive-dock-state") {
      return this.fromPepsLiveDockState(input);
    }
    if (format === "legacy-flat") {
      return this.fromLegacyFlat(input);
    }
    return this.fromLegacyFlat({});
  }

  async ingest(input) {
    const shape = this.detectFormat(input);
    const candidate = this.normalize(input);
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
