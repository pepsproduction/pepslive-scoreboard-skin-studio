import { TEMPLATE_REGISTRY, getTemplateById } from "../templates/template-registry.js";

export const TEMPLATE_CONTRACT_VERSION = "2.2.0";

export const COMMON_REQUIRED_SLOTS = [
  "eventLogo",
  "eventName",
  "homeLogo",
  "awayLogo",
  "homeName",
  "awayName",
  "homeShortName",
  "awayShortName",
  "homeScore",
  "awayScore",
  "score",
  "gameClock",
  "periodLabel",
  "statusLabel"
];

export const FOOTBALL_REQUIRED_SLOTS = ["addedTime", "aggregateScore", "penaltyScore", "goalScorerList", "cardInfo"];

export const BASKETBALL_REQUIRED_SLOTS = [
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

const CRITICAL_SLOTS = ["eventLogo", "homeLogo", "awayLogo", "score", "gameClock", "statusLabel"];

function getSportSlots(sport) {
  if (sport === "football") {
    return FOOTBALL_REQUIRED_SLOTS;
  }
  if (sport === "basketball") {
    return BASKETBALL_REQUIRED_SLOTS;
  }
  return [];
}

function dedupe(items) {
  return Array.from(new Set(items));
}

function sortSlots(items) {
  return [...items].sort((a, b) => a.localeCompare(b));
}

export const TEMPLATE_RENDER_CONTRACTS = TEMPLATE_REGISTRY.map((template) => {
  const requiredSlots = dedupe([...COMMON_REQUIRED_SLOTS, ...getSportSlots(template.sport)]);
  const optionalSlots = sortSlots(getSportSlots(template.sport));
  const criticalSlots = CRITICAL_SLOTS.filter((slot) => requiredSlots.includes(slot));

  return {
    id: template.id,
    sport: template.sport,
    type: template.type,
    contractVersion: TEMPLATE_CONTRACT_VERSION,
    requiredSlots: sortSlots(requiredSlots),
    criticalSlots: sortSlots(criticalSlots),
    optionalSlots,
    notes: "All skins must render required slots through shared overlay markup and template-scoped CSS."
  };
});

export const TEMPLATE_RENDER_CONTRACT_MAP = new Map(TEMPLATE_RENDER_CONTRACTS.map((item) => [item.id, item]));

export function getRenderContractByTemplateId(templateId) {
  return TEMPLATE_RENDER_CONTRACT_MAP.get(templateId) || TEMPLATE_RENDER_CONTRACTS[0];
}

export function getRequiredSlotsForTemplate(templateId) {
  return getRenderContractByTemplateId(templateId).requiredSlots;
}

export function evaluateRenderedSlots(templateId, renderedSlotList) {
  const contract = getRenderContractByTemplateId(templateId);
  const renderedSet = new Set(Array.isArray(renderedSlotList) ? renderedSlotList.filter(Boolean) : []);
  const missingRequired = contract.requiredSlots.filter((slot) => !renderedSet.has(slot));
  const missingCritical = contract.criticalSlots.filter((slot) => !renderedSet.has(slot));

  const warnings = [];
  if (missingCritical.length > 0) {
    warnings.push(`Critical slots missing: ${missingCritical.join(", ")}`);
  }
  if (missingRequired.length > 0) {
    warnings.push(`Required slots missing: ${missingRequired.join(", ")}`);
  }

  return {
    templateId: contract.id,
    sport: contract.sport,
    type: contract.type,
    contractVersion: contract.contractVersion,
    renderedSlots: sortSlots(Array.from(renderedSet)),
    requiredSlots: contract.requiredSlots,
    missingRequired,
    missingCritical,
    warnings,
    isPass: missingRequired.length === 0
  };
}

export function auditTemplateContracts() {
  const errors = [];
  const warnings = [];

  TEMPLATE_REGISTRY.forEach((template) => {
    const contract = TEMPLATE_RENDER_CONTRACT_MAP.get(template.id);
    if (!contract) {
      errors.push(`${template.id}: missing render contract`);
      return;
    }

    if (contract.sport !== template.sport || contract.type !== template.type) {
      errors.push(`${template.id}: contract sport/type mismatch`);
    }

    if (!Array.isArray(contract.requiredSlots) || contract.requiredSlots.length === 0) {
      errors.push(`${template.id}: requiredSlots is empty`);
    }

    const missingCore = COMMON_REQUIRED_SLOTS.filter((slot) => !contract.requiredSlots.includes(slot));
    if (missingCore.length > 0) {
      errors.push(`${template.id}: missing common slots ${missingCore.join(", ")}`);
    }

    const sportSlots = getSportSlots(template.sport);
    const missingSportSlots = sportSlots.filter((slot) => !contract.requiredSlots.includes(slot));
    if (missingSportSlots.length > 0) {
      warnings.push(`${template.id}: missing sport slots ${missingSportSlots.join(", ")}`);
    }
  });

  return {
    templateCount: TEMPLATE_REGISTRY.length,
    contractCount: TEMPLATE_RENDER_CONTRACTS.length,
    errors,
    warnings,
    pass: errors.length === 0
  };
}

export function getTemplateFromContract(templateId) {
  return getTemplateById(templateId);
}
