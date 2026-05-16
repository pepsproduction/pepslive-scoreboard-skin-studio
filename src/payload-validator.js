import { getMockDataBySport } from "./mock-data.js";
import { PEPSLIVE_SCOREBOARD_PROTOCOL, PEPSLIVE_SCOREBOARD_PROTOCOL_VERSION, SUPPORTED_SPORTS, SUPPORTED_TYPES, createProtocolPayload, isProtocolPayload } from "./pepslive-payload-protocol.js";
import { getTemplateById, TEMPLATE_REGISTRY } from "../templates/template-registry.js";

const COMMON_FIELDS = [
  "eventName",
  "eventLogo",
  "homeLogo",
  "awayLogo",
  "homeName",
  "awayName",
  "homeShortName",
  "awayShortName",
  "homeScore",
  "awayScore",
  "gameClock",
  "periodLabel",
  "statusLabel"
];

const FOOTBALL_EXTRA_FIELDS = ["addedTime", "aggregateScore", "penaltyScore", "goalScorerList", "cardInfo"];
const BASKETBALL_EXTRA_FIELDS = [
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

function normalizeTimestamp(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value).toISOString();
  }
  if (typeof value === "string") {
    const timestamp = Date.parse(value);
    if (!Number.isNaN(timestamp)) {
      return new Date(timestamp).toISOString();
    }
  }
  return new Date().toISOString();
}

function normalizeScoreValue(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") {
      return 0;
    }
    const converted = Number(trimmed);
    if (Number.isFinite(converted)) {
      return converted;
    }
  }
  return 0;
}

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function inferSport(raw) {
  if (!isPlainObject(raw)) {
    return null;
  }
  if (typeof raw.sport === "string" && raw.sport.trim() !== "") {
    return SUPPORTED_SPORTS.includes(raw.sport) ? raw.sport : "__invalid__";
  }
  if (typeof raw?.skinId === "string" && raw.skinId.startsWith("FB-")) {
    return "football";
  }
  if (typeof raw?.skinId === "string" && raw.skinId.startsWith("BB-")) {
    return "basketball";
  }
  return null;
}

function inferType(raw) {
  if (!isPlainObject(raw)) {
    return null;
  }
  if (typeof raw.type === "string" && raw.type.trim() !== "") {
    if (SUPPORTED_TYPES.includes(raw.type)) {
      return raw.type;
    }
    return "__invalid__";
  }
  if (typeof raw?.skinId === "string" && raw.skinId.includes("-SUM-")) {
    return "summary";
  }
  if (typeof raw?.skinId === "string" && raw.skinId.includes("-LIVE-")) {
    return "live";
  }
  return null;
}

function getFallbackTemplate(sport, type) {
  return TEMPLATE_REGISTRY.find((item) => item.sport === sport && item.type === type) || TEMPLATE_REGISTRY.find((item) => item.sport === sport) || TEMPLATE_REGISTRY[0];
}

function selectAllowedFields(sport) {
  if (sport === "football") {
    return [...COMMON_FIELDS, ...FOOTBALL_EXTRA_FIELDS];
  }
  return [...COMMON_FIELDS, ...BASKETBALL_EXTRA_FIELDS];
}

function mergeMatchDataWithFallback(fallback, incoming, sport) {
  const allowedFields = selectAllowedFields(sport);
  const merged = {};
  allowedFields.forEach((field) => {
    merged[field] = incoming?.[field] ?? fallback?.[field] ?? "";
  });

  merged.homeScore = normalizeScoreValue(merged.homeScore);
  merged.awayScore = normalizeScoreValue(merged.awayScore);

  if (sport === "basketball") {
    merged.homeFouls = normalizeScoreValue(merged.homeFouls);
    merged.awayFouls = normalizeScoreValue(merged.awayFouls);
    merged.homeTimeouts = normalizeScoreValue(merged.homeTimeouts);
    merged.awayTimeouts = normalizeScoreValue(merged.awayTimeouts);
  }

  return merged;
}

export function getPayloadValidationErrors(payload) {
  const errors = [];
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    errors.push("Payload must be an object");
    return errors;
  }

  if (!isProtocolPayload(payload)) {
    errors.push("Payload protocol is incompatible");
  }

  const sport = inferSport(payload);
  if (!sport) {
    errors.push("Unsupported sport");
  } else if (sport === "__invalid__") {
    errors.push("Sport must be football or basketball");
  } else if (!SUPPORTED_SPORTS.includes(sport)) {
    errors.push("Sport must be football or basketball");
  }

  return errors;
}

export function isCompatiblePayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return false;
  }
  if (payload.protocol !== PEPSLIVE_SCOREBOARD_PROTOCOL) {
    return false;
  }
  return payload.version === undefined || payload.version === PEPSLIVE_SCOREBOARD_PROTOCOL_VERSION;
}

export async function normalizeIncomingPayload(payload) {
  const warnings = [];
  const errors = [];

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {
      accepted: false,
      warnings,
      errors: ["Payload must be an object"],
      payload: null
    };
  }

  if (!isProtocolPayload(payload)) {
    return {
      accepted: false,
      warnings,
      errors: ["Payload protocol mismatch"],
      payload: null
    };
  }

  if (payload.version !== undefined && payload.version !== PEPSLIVE_SCOREBOARD_PROTOCOL_VERSION) {
    return {
      accepted: false,
      warnings,
      errors: [`Protocol version ${payload.version} is incompatible with expected ${PEPSLIVE_SCOREBOARD_PROTOCOL_VERSION}`],
      payload: null
    };
  }

  const sport = inferSport(payload);
  if (!sport || sport === "__invalid__" || !SUPPORTED_SPORTS.includes(sport)) {
    return {
      accepted: false,
      warnings,
      errors: ["Sport is not supported"],
      payload: null
    };
  }

  let type = inferType(payload);
  if (type === "__invalid__") {
    warnings.push("Type is invalid, fallback to inferred/default type");
    type = null;
  }
  if (!type || !SUPPORTED_TYPES.includes(type)) {
    type = "live";
    warnings.push("Type is missing or invalid, fallback to live");
  }

  const fallbackTemplate = getFallbackTemplate(sport, type);
  let skinId = payload.skinId || fallbackTemplate.id;
  const skinExists = TEMPLATE_REGISTRY.some((item) => item.id === skinId);
  if (!skinExists) {
    warnings.push(`Skin ${skinId} was not found, fallback to ${fallbackTemplate.id}`);
    skinId = fallbackTemplate.id;
  } else {
    const skin = getTemplateById(skinId);
    if (skin.sport !== sport || skin.type !== type) {
      warnings.push(`Skin ${skinId} is not compatible with ${sport}/${type}, fallback to ${fallbackTemplate.id}`);
      skinId = fallbackTemplate.id;
    }
  }

  if (!isPlainObject(payload.matchData)) {
    warnings.push("matchData is missing or invalid, fallback to mock data");
  }

  if (!isPlainObject(payload.theme)) {
    warnings.push("theme is missing or invalid, fallback to default theme");
  }

  if (!isPlainObject(payload.animation)) {
    warnings.push("animation is missing or invalid, fallback to default animation");
  }

  if (payload.timestamp === undefined) {
    warnings.push("timestamp is missing, fallback to current time");
  }

  const fallbackMock = await getMockDataBySport(sport);
  const mergedMatchData = mergeMatchDataWithFallback(fallbackMock, isPlainObject(payload.matchData) ? payload.matchData : {}, sport);
  const normalized = createProtocolPayload({
    protocol: PEPSLIVE_SCOREBOARD_PROTOCOL,
    version: PEPSLIVE_SCOREBOARD_PROTOCOL_VERSION,
    source: payload.source || "external",
    timestamp: normalizeTimestamp(payload.timestamp),
    sport,
    skinId,
    type,
    theme: isPlainObject(payload.theme) ? payload.theme : {},
    animation: isPlainObject(payload.animation) ? payload.animation : {},
    matchData: {
      ...mergedMatchData,
      sport
    }
  });

  if (payload.matchData?.homeScore !== undefined && typeof payload.matchData.homeScore === "string") {
    const converted = Number(payload.matchData.homeScore.trim());
    warnings.push(Number.isFinite(converted) ? "homeScore string converted to number" : "homeScore is non-numeric string, fallback to numeric default");
  }
  if (payload.matchData?.awayScore !== undefined && typeof payload.matchData.awayScore === "string") {
    const converted = Number(payload.matchData.awayScore.trim());
    warnings.push(Number.isFinite(converted) ? "awayScore string converted to number" : "awayScore is non-numeric string, fallback to numeric default");
  }

  return {
    accepted: true,
    warnings,
    errors,
    payload: normalized
  };
}

export async function validateIncomingPayload(payload) {
  const structuralErrors = getPayloadValidationErrors(payload);
  const normalized = await normalizeIncomingPayload(payload);
  return {
    isCompatible: isCompatiblePayload(payload),
    isValid: structuralErrors.length === 0 && normalized.accepted,
    errors: [...structuralErrors, ...normalized.errors],
    warnings: normalized.warnings,
    normalizedPayload: normalized.payload
  };
}
