const FALLBACK = {
  football: {
    sport: "football",
    eventName: "PEPS LIVE CUP",
    homeName: "Dragon FC",
    awayName: "Tiger FC",
    homeShortName: "DRA",
    awayShortName: "TIG",
    homeScore: 2,
    awayScore: 1,
    gameClock: "45:00",
    periodLabel: "1H",
    statusLabel: "LIVE",
    addedTime: "+2",
    aggregateScore: "3-2",
    penaltyScore: "4-3",
    goalScorerList: "12' Aran, 39' Krit",
    cardInfo: "DRA 1Y | TIG 2Y 1R",
    homeLogo: "",
    awayLogo: "",
    eventLogo: ""
  },
  basketball: {
    sport: "basketball",
    eventName: "PEPS HOOPS",
    homeName: "Orange Wolves",
    awayName: "Blue Hawks",
    homeShortName: "WOL",
    awayShortName: "HAW",
    homeScore: 78,
    awayScore: 74,
    gameClock: "02:18",
    periodLabel: "Q4",
    statusLabel: "LIVE",
    quarterLabel: "Q4",
    shotClock: "14",
    homeFouls: 4,
    awayFouls: 3,
    homeTimeouts: 2,
    awayTimeouts: 1,
    possession: "home",
    bonus: "away",
    quarterBreakdown: "Q1 20-18 | Q2 41-39 | Q3 61-58 | Q4 78-74",
    topScorer: "WOL #11 24 PTS",
    homeLogo: "",
    awayLogo: "",
    eventLogo: ""
  }
};

let cache = null;

export async function loadMockData() {
  if (cache) {
    return cache;
  }
  try {
    const response = await fetch(new URL("../data/mock-match-data.json", import.meta.url));
    cache = response.ok ? await response.json() : FALLBACK;
  } catch (_error) {
    cache = FALLBACK;
  }
  return cache;
}

export async function getMockDataBySport(sport) {
  const data = await loadMockData();
  return data[sport] || FALLBACK[sport] || FALLBACK.football;
}
