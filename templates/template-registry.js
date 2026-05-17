const LIVE_SOURCE = { width: 900, height: 180 };
const SUMMARY_SOURCE = { width: 1920, height: 1080 };

const FOOTBALL_MODES = ["Football 7-a-side", "Football 11-a-side", "Futsal"];
const BASKETBALL_MODES = ["5x5 Full Court", "3x3 Street", "School League"];

export const TEMPLATE_REGISTRY = [
  // ---------------------------------------------------------------------------
  // FOOTBALL — LIVE
  // ---------------------------------------------------------------------------
  {
    id: "FB-LIVE-01",
    sport: "football",
    type: "live",
    name: "Premier Broadcast",
    description: "แถบถ่ายทอดสดระดับ Premier พื้นขาวกลาง ขอบทองชิมเมอร์",
    tags: ["Broadcast", "Premium", "Animated", "Compact"],
    recommendedSource: LIVE_SOURCE,
    compatibleModes: FOOTBALL_MODES
  },
  {
    id: "FB-LIVE-02",
    sport: "football",
    type: "live",
    name: "Capsule Pro",
    description: "สกอร์บั๊กทรงแคปซูลพรีเมียม ขอบเรืองแสงแบบ loop",
    tags: ["Capsule", "Animated", "Compact", "Broadcast"],
    recommendedSource: LIVE_SOURCE,
    compatibleModes: FOOTBALL_MODES
  },
  {
    id: "FB-LIVE-03",
    sport: "football",
    type: "live",
    name: "Arrow Cut Live",
    description: "แถบแนว arrow clip-path เฉียงคมคาย มีแสงชิมเมอร์ทีม",
    tags: ["Animated", "Tournament", "Broadcast", "Neon"],
    recommendedSource: LIVE_SOURCE,
    compatibleModes: FOOTBALL_MODES
  },
  {
    id: "FB-LIVE-04",
    sport: "football",
    type: "live",
    name: "Corner Glass HUD",
    description: "การ์ด Glass มุมจอแบบ HUD หายใจขึ้นลงเหมือน AR overlay",
    tags: ["Glass", "Animated", "Premium", "Compact"],
    recommendedSource: LIVE_SOURCE,
    compatibleModes: FOOTBALL_MODES
  },
  {
    id: "FB-LIVE-05",
    sport: "football",
    type: "live",
    name: "Rivalry Neon",
    description: "ไฟนีออน Blue vs Orange ตลอดเวลา เหมาะงาน Derby Match",
    tags: ["Neon", "Animated", "Broadcast", "Tournament"],
    recommendedSource: LIVE_SOURCE,
    compatibleModes: FOOTBALL_MODES
  },
  {
    id: "FB-LIVE-06",
    sport: "football",
    type: "live",
    name: "Club Divide",
    description: "แบ่งสีทีมซ้าย-ขวา สีเข้มจางแบบ wave loop",
    tags: ["Animated", "Broadcast", "Tournament", "Large"],
    recommendedSource: LIVE_SOURCE,
    compatibleModes: FOOTBALL_MODES
  },
  {
    id: "FB-LIVE-07",
    sport: "football",
    type: "live",
    name: "Stadium Focus",
    description: "แถบมืดระดับสนามใหญ่ โลโก้ทีมเรืองแสง glow pulse",
    tags: ["Animated", "Premium", "Broadcast", "Large"],
    recommendedSource: LIVE_SOURCE,
    compatibleModes: FOOTBALL_MODES
  },
  {
    id: "FB-LIVE-08",
    sport: "football",
    type: "live",
    name: "Corner Compact",
    description: "การ์ดเล็กมุมจอ สกอร์แนวตั้ง หายใจเบาตลอดเวลา",
    tags: ["Animated", "Compact", "Social", "Minimal"],
    recommendedSource: LIVE_SOURCE,
    compatibleModes: FOOTBALL_MODES
  },
  {
    id: "FB-LIVE-09",
    sport: "football",
    type: "live",
    name: "Matrix LED",
    description: "พื้นผิว LED stripe มีไฟ scan ผ่านตลอดเวลา",
    tags: ["Animated", "Neon", "Broadcast", "Tournament"],
    recommendedSource: LIVE_SOURCE,
    compatibleModes: FOOTBALL_MODES
  },
  {
    id: "FB-LIVE-10",
    sport: "football",
    type: "live",
    name: "Clean League",
    description: "ลุคสะอาด เรียบ เหมาะลีกท้องถิ่น มีแสงเรืองเบาๆ",
    tags: ["Animated", "Minimal", "Local", "Compact"],
    recommendedSource: LIVE_SOURCE,
    compatibleModes: FOOTBALL_MODES
  },

  // ---------------------------------------------------------------------------
  // FOOTBALL — SUMMARY
  // ---------------------------------------------------------------------------
  {
    id: "FB-SUM-01",
    sport: "football",
    type: "summary",
    name: "Full Time Center",
    description: "สรุปผลเต็มเวลาแบบ centered card ระดับ broadcast",
    tags: ["Broadcast", "Large", "Premium"],
    recommendedSource: SUMMARY_SOURCE,
    compatibleModes: FOOTBALL_MODES
  },
  {
    id: "FB-SUM-02",
    sport: "football",
    type: "summary",
    name: "Half Time Split",
    description: "บอร์ดพักครึ่งแบบ split panel สี home/away",
    tags: ["Minimal", "Broadcast", "Compact"],
    recommendedSource: SUMMARY_SOURCE,
    compatibleModes: FOOTBALL_MODES
  },
  {
    id: "FB-SUM-03",
    sport: "football",
    type: "summary",
    name: "Match Poster Board",
    description: "โปสเตอร์แมตช์แบบเต็มเฟรม เหมาะงาน Social",
    tags: ["Premium", "Social", "Large"],
    recommendedSource: SUMMARY_SOURCE,
    compatibleModes: FOOTBALL_MODES
  },
  {
    id: "FB-SUM-04",
    sport: "football",
    type: "summary",
    name: "Goal Scorer Board",
    description: "บอร์ดสรุปผู้ทำประตู ขอบซ้ายสีทีม",
    tags: ["Tournament", "Broadcast", "Local"],
    recommendedSource: SUMMARY_SOURCE,
    compatibleModes: FOOTBALL_MODES
  },
  {
    id: "FB-SUM-05",
    sport: "football",
    type: "summary",
    name: "Dark Premium Result",
    description: "การ์ดผลการแข่งขันโทนเข้มระดับพรีเมียม",
    tags: ["Premium", "Glass", "Broadcast"],
    recommendedSource: SUMMARY_SOURCE,
    compatibleModes: FOOTBALL_MODES
  },
  {
    id: "FB-SUM-06",
    sport: "football",
    type: "summary",
    name: "Tournament Result Card",
    description: "สรุปผลทัวร์นาเมนต์พร้อม sponsor badge",
    tags: ["Tournament", "Large", "Broadcast"],
    recommendedSource: SUMMARY_SOURCE,
    compatibleModes: FOOTBALL_MODES
  },
  {
    id: "FB-SUM-07",
    sport: "football",
    type: "summary",
    name: "Sponsor Frame",
    description: "กรอบสปอนเซอร์สำหรับการ์ดสรุปผล",
    tags: ["Premium", "Social", "Local"],
    recommendedSource: SUMMARY_SOURCE,
    compatibleModes: FOOTBALL_MODES
  },
  {
    id: "FB-SUM-08",
    sport: "football",
    type: "summary",
    name: "Big Score Clash",
    description: "โชว์คะแนนตัวใหญ่พิเศษสำหรับแมตช์เดือด",
    tags: ["Large", "Broadcast", "Tournament"],
    recommendedSource: SUMMARY_SOURCE,
    compatibleModes: FOOTBALL_MODES
  },
  {
    id: "FB-SUM-09",
    sport: "football",
    type: "summary",
    name: "Social Result Card",
    description: "การ์ดผลการแข่งขันสำหรับโพสต์โซเชียล",
    tags: ["Social", "Minimal", "Compact"],
    recommendedSource: SUMMARY_SOURCE,
    compatibleModes: FOOTBALL_MODES
  },
  {
    id: "FB-SUM-10",
    sport: "football",
    type: "summary",
    name: "Final Whistle Board",
    description: "สรุปผลหลังเสียงนกหวีดสุดท้าย",
    tags: ["Broadcast", "Premium", "Local"],
    recommendedSource: SUMMARY_SOURCE,
    compatibleModes: FOOTBALL_MODES
  },

  // ---------------------------------------------------------------------------
  // BASKETBALL — LIVE
  // ---------------------------------------------------------------------------
  {
    id: "BB-LIVE-01",
    sport: "basketball",
    type: "live",
    name: "Arena Bar",
    description: "แถบสกอร์สไตล์อาร์นา NBA badge flash แบบ loop",
    tags: ["Animated", "Broadcast", "Compact", "Premium"],
    recommendedSource: LIVE_SOURCE,
    compatibleModes: BASKETBALL_MODES
  },
  {
    id: "BB-LIVE-02",
    sport: "basketball",
    type: "live",
    name: "Court Strip",
    description: "strip แนวกว้างพร้อม highlight sweep ตลอดเวลา",
    tags: ["Animated", "Broadcast", "Large", "Tournament"],
    recommendedSource: LIVE_SOURCE,
    compatibleModes: BASKETBALL_MODES
  },
  {
    id: "BB-LIVE-03",
    sport: "basketball",
    type: "live",
    name: "Quarter Burst",
    description: "Quarter badge pop bounce loop เน้น game clock",
    tags: ["Animated", "Minimal", "Broadcast", "Compact"],
    recommendedSource: LIVE_SOURCE,
    compatibleModes: BASKETBALL_MODES
  },
  {
    id: "BB-LIVE-04",
    sport: "basketball",
    type: "live",
    name: "Shot Clock Pro",
    description: "เน้น shot clock ด้วย blink animation แบบ loop",
    tags: ["Animated", "Tournament", "Broadcast", "Large"],
    recommendedSource: LIVE_SOURCE,
    compatibleModes: BASKETBALL_MODES
  },
  {
    id: "BB-LIVE-05",
    sport: "basketball",
    type: "live",
    name: "Foul Tracker",
    description: "โฟกัสฟาวล์ทีม มี scan sweep เบาๆ ตลอดเวลา",
    tags: ["Animated", "Local", "Broadcast", "Compact"],
    recommendedSource: LIVE_SOURCE,
    compatibleModes: BASKETBALL_MODES
  },
  {
    id: "BB-LIVE-06",
    sport: "basketball",
    type: "live",
    name: "Timeout Dots",
    description: "แสดง timeout แบบจุดสีพร้อม dot wave animation",
    tags: ["Animated", "Minimal", "Social", "Compact"],
    recommendedSource: LIVE_SOURCE,
    compatibleModes: BASKETBALL_MODES
  },
  {
    id: "BB-LIVE-07",
    sport: "basketball",
    type: "live",
    name: "Street Ball Neon",
    description: "ลุคนีออนสตรีท 3x3 มีไฟ flicker จริงๆ ตลอดเวลา",
    tags: ["Animated", "Neon", "Social", "Tournament"],
    recommendedSource: LIVE_SOURCE,
    compatibleModes: BASKETBALL_MODES
  },
  {
    id: "BB-LIVE-08",
    sport: "basketball",
    type: "live",
    name: "Crystal Court",
    description: "Glass panel โปร่งใส shimmer แบบ crystal loop",
    tags: ["Animated", "Glass", "Premium", "Large"],
    recommendedSource: LIVE_SOURCE,
    compatibleModes: BASKETBALL_MODES
  },
  {
    id: "BB-LIVE-09",
    sport: "basketball",
    type: "live",
    name: "Team Identity",
    description: "โลโก้ทีมขนาดใหญ่ glow scale loop แบบมืออาชีพ",
    tags: ["Animated", "Premium", "Broadcast", "Large"],
    recommendedSource: LIVE_SOURCE,
    compatibleModes: BASKETBALL_MODES
  },
  {
    id: "BB-LIVE-10",
    sport: "basketball",
    type: "live",
    name: "3x3 Clean",
    description: "สกอร์บาส 3x3 เรียบง่าย quiet breathe animation",
    tags: ["Animated", "Minimal", "Local", "Compact"],
    recommendedSource: LIVE_SOURCE,
    compatibleModes: BASKETBALL_MODES
  },

  // ---------------------------------------------------------------------------
  // BASKETBALL — SUMMARY
  // ---------------------------------------------------------------------------
  {
    id: "BB-SUM-01",
    sport: "basketball",
    type: "summary",
    name: "Final Score Center",
    description: "สรุปผลเต็มเกมแบบกึ่งกลางจอ",
    tags: ["Broadcast", "Premium", "Large"],
    recommendedSource: SUMMARY_SOURCE,
    compatibleModes: BASKETBALL_MODES
  },
  {
    id: "BB-SUM-02",
    sport: "basketball",
    type: "summary",
    name: "Quarter Breakdown",
    description: "การ์ดแยกคะแนนราย quarter ครบทุก period",
    tags: ["Tournament", "Local", "Broadcast"],
    recommendedSource: SUMMARY_SOURCE,
    compatibleModes: BASKETBALL_MODES
  },
  {
    id: "BB-SUM-03",
    sport: "basketball",
    type: "summary",
    name: "Halftime Board",
    description: "บอร์ดสรุปช่วงพักครึ่ง",
    tags: ["Minimal", "Broadcast", "Compact"],
    recommendedSource: SUMMARY_SOURCE,
    compatibleModes: BASKETBALL_MODES
  },
  {
    id: "BB-SUM-04",
    sport: "basketball",
    type: "summary",
    name: "MVP Highlight Board",
    description: "สรุปผลพร้อมไฮไลต์ผู้เล่นเด่น",
    tags: ["Premium", "Social", "Large"],
    recommendedSource: SUMMARY_SOURCE,
    compatibleModes: BASKETBALL_MODES
  },
  {
    id: "BB-SUM-05",
    sport: "basketball",
    type: "summary",
    name: "Team Stats Result",
    description: "แสดงผลพร้อมสถิติทีมรวม",
    tags: ["Tournament", "Broadcast", "Local"],
    recommendedSource: SUMMARY_SOURCE,
    compatibleModes: BASKETBALL_MODES
  },
  {
    id: "BB-SUM-06",
    sport: "basketball",
    type: "summary",
    name: "Street Final Card",
    description: "การ์ดฟินิชโทน street สำหรับ 3x3",
    tags: ["Neon", "Social", "Large"],
    recommendedSource: SUMMARY_SOURCE,
    compatibleModes: BASKETBALL_MODES
  },
  {
    id: "BB-SUM-07",
    sport: "basketball",
    type: "summary",
    name: "Clean Broadcast Final",
    description: "บอร์ดผลสุดท้ายแบบ clean broadcast",
    tags: ["Minimal", "Broadcast", "Premium"],
    recommendedSource: SUMMARY_SOURCE,
    compatibleModes: BASKETBALL_MODES
  },
  {
    id: "BB-SUM-08",
    sport: "basketball",
    type: "summary",
    name: "Sponsor Result Frame",
    description: "กรอบสปอนเซอร์สำหรับสรุปผลการแข่งขัน",
    tags: ["Premium", "Local", "Social"],
    recommendedSource: SUMMARY_SOURCE,
    compatibleModes: BASKETBALL_MODES
  },
  {
    id: "BB-SUM-09",
    sport: "basketball",
    type: "summary",
    name: "Big Number Result",
    description: "โชว์คะแนนตัวเลขใหญ่พิเศษ สำหรับ tournament",
    tags: ["Large", "Tournament", "Broadcast"],
    recommendedSource: SUMMARY_SOURCE,
    compatibleModes: BASKETBALL_MODES
  },
  {
    id: "BB-SUM-10",
    sport: "basketball",
    type: "summary",
    name: "Social Recap Board",
    description: "รีแคปผลเกมสำหรับโซเชียล พร้อมข้อมูลสรุป",
    tags: ["Social", "Compact", "Minimal"],
    recommendedSource: SUMMARY_SOURCE,
    compatibleModes: BASKETBALL_MODES
  }
];

export const TEMPLATE_MAP = new Map(TEMPLATE_REGISTRY.map((template) => [template.id, template]));

export function getTemplateById(templateId) {
  return TEMPLATE_MAP.get(templateId) || TEMPLATE_REGISTRY[0];
}

export function listTemplateTags() {
  const tags = new Set();
  TEMPLATE_REGISTRY.forEach((item) => item.tags.forEach((tag) => tags.add(tag)));
  return Array.from(tags).sort((a, b) => a.localeCompare(b));
}

export function listSports() {
  return ["football", "basketball"];
}

export function listTypes() {
  return ["live", "summary"];
}
