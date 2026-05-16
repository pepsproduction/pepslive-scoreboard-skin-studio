const LIVE_SOURCE = { width: 900, height: 180 };
const SUMMARY_SOURCE = { width: 1920, height: 1080 };

const FOOTBALL_MODES = ["Football 7-a-side", "Football 11-a-side", "Futsal"];
const BASKETBALL_MODES = ["5x5 Full Court", "3x3 Street", "School League"];

export const TEMPLATE_REGISTRY = [
  {
    id: "FB-LIVE-01",
    sport: "football",
    type: "live",
    name: "Minimal Broadcast Bar",
    description: "แถบสกอร์แนวมินิมอลสำหรับภาพถ่ายทอดสด",
    tags: ["Minimal", "Broadcast", "Compact"],
    recommendedSource: LIVE_SOURCE,
    compatibleModes: FOOTBALL_MODES
  },
  {
    id: "FB-LIVE-02",
    sport: "football",
    type: "live",
    name: "Premier Compact",
    description: "สไตล์คอมแพคเหมาะกับมุมล่างของจอ",
    tags: ["Compact", "Premium", "Local"],
    recommendedSource: LIVE_SOURCE,
    compatibleModes: FOOTBALL_MODES
  },
  {
    id: "FB-LIVE-03",
    sport: "football",
    type: "live",
    name: "Capsule Scorebug",
    description: "โครงแบบแคปซูลสำหรับงานสตรีมที่ต้องการความนุ่มนวล",
    tags: ["Broadcast", "Glass", "Compact"],
    recommendedSource: LIVE_SOURCE,
    compatibleModes: FOOTBALL_MODES
  },
  {
    id: "FB-LIVE-04",
    sport: "football",
    type: "live",
    name: "Glass Corner",
    description: "การ์ดใสมุมจอแบบ Glass พร้อมเงา",
    tags: ["Glass", "Premium", "Large"],
    recommendedSource: LIVE_SOURCE,
    compatibleModes: FOOTBALL_MODES
  },
  {
    id: "FB-LIVE-05",
    sport: "football",
    type: "live",
    name: "Neon Edge",
    description: "เส้นขอบนีออนเด่นชัดเหมาะงาน eSports ฟุตบอล",
    tags: ["Neon", "Social", "Broadcast"],
    recommendedSource: LIVE_SOURCE,
    compatibleModes: FOOTBALL_MODES
  },
  {
    id: "FB-LIVE-06",
    sport: "football",
    type: "live",
    name: "Team Color Split",
    description: "แยกสีทีมซ้ายขวาให้เห็นชัดระหว่างเกม",
    tags: ["Broadcast", "Tournament", "Large"],
    recommendedSource: LIVE_SOURCE,
    compatibleModes: FOOTBALL_MODES
  },
  {
    id: "FB-LIVE-07",
    sport: "football",
    type: "live",
    name: "Logo Focus Bar",
    description: "เน้นโลโก้ทีมเป็นหลักในแถบคะแนน",
    tags: ["Premium", "Broadcast", "Large"],
    recommendedSource: LIVE_SOURCE,
    compatibleModes: FOOTBALL_MODES
  },
  {
    id: "FB-LIVE-08",
    sport: "football",
    type: "live",
    name: "Vertical Mini",
    description: "ดีไซน์แนวตั้งขนาดเล็กสำหรับมุมจอ",
    tags: ["Compact", "Minimal", "Social"],
    recommendedSource: LIVE_SOURCE,
    compatibleModes: FOOTBALL_MODES
  },
  {
    id: "FB-LIVE-09",
    sport: "football",
    type: "live",
    name: "Stadium LED",
    description: "กลิ่นอายป้าย LED สนามแข่งพร้อมตัวอักษรเด่น",
    tags: ["Tournament", "Broadcast", "Neon"],
    recommendedSource: LIVE_SOURCE,
    compatibleModes: FOOTBALL_MODES
  },
  {
    id: "FB-LIVE-10",
    sport: "football",
    type: "live",
    name: "Local League Clean",
    description: "ลุคสะอาดตาเหมาะลีกท้องถิ่น",
    tags: ["Local", "Minimal", "Compact"],
    recommendedSource: LIVE_SOURCE,
    compatibleModes: FOOTBALL_MODES
  },
  {
    id: "FB-SUM-01",
    sport: "football",
    type: "summary",
    name: "Full Time Center",
    description: "สรุปผลเต็มเวลาแบบ centered card",
    tags: ["Broadcast", "Large", "Premium"],
    recommendedSource: SUMMARY_SOURCE,
    compatibleModes: FOOTBALL_MODES
  },
  {
    id: "FB-SUM-02",
    sport: "football",
    type: "summary",
    name: "Half Time Split",
    description: "บอร์ดพักครึ่งแบบ split panel",
    tags: ["Minimal", "Broadcast", "Compact"],
    recommendedSource: SUMMARY_SOURCE,
    compatibleModes: FOOTBALL_MODES
  },
  {
    id: "FB-SUM-03",
    sport: "football",
    type: "summary",
    name: "Match Poster Board",
    description: "โปสเตอร์แมตช์แบบเต็มเฟรม",
    tags: ["Premium", "Social", "Large"],
    recommendedSource: SUMMARY_SOURCE,
    compatibleModes: FOOTBALL_MODES
  },
  {
    id: "FB-SUM-04",
    sport: "football",
    type: "summary",
    name: "Goal Scorer Board",
    description: "บอร์ดสรุปผู้ทำประตู",
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
    description: "สรุปผลการแข่งขันทัวร์นาเมนต์พร้อม badge",
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
    description: "โชว์คะแนนใหญ่สำหรับแมตช์เดือด",
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
  {
    id: "BB-LIVE-01",
    sport: "basketball",
    type: "live",
    name: "NBA Compact Bar",
    description: "แถบสกอร์บาสคอมแพคโทนอเมริกัน",
    tags: ["Broadcast", "Compact", "Premium"],
    recommendedSource: LIVE_SOURCE,
    compatibleModes: BASKETBALL_MODES
  },
  {
    id: "BB-LIVE-02",
    sport: "basketball",
    type: "live",
    name: "Bottom Broadcast Strip",
    description: "strip ยาวสำหรับวางด้านล่างภาพแข่ง",
    tags: ["Broadcast", "Large", "Tournament"],
    recommendedSource: LIVE_SOURCE,
    compatibleModes: BASKETBALL_MODES
  },
  {
    id: "BB-LIVE-03",
    sport: "basketball",
    type: "live",
    name: "Quarter Focus",
    description: "เน้น quarter และ game clock ชัดเจน",
    tags: ["Minimal", "Broadcast", "Compact"],
    recommendedSource: LIVE_SOURCE,
    compatibleModes: BASKETBALL_MODES
  },
  {
    id: "BB-LIVE-04",
    sport: "basketball",
    type: "live",
    name: "Shot Clock Slot",
    description: "เพิ่มโซน shot clock ให้เด่น",
    tags: ["Tournament", "Broadcast", "Large"],
    recommendedSource: LIVE_SOURCE,
    compatibleModes: BASKETBALL_MODES
  },
  {
    id: "BB-LIVE-05",
    sport: "basketball",
    type: "live",
    name: "Team Foul Bar",
    description: "โฟกัสฟาวล์ทีมในแถบด้านล่าง",
    tags: ["Local", "Broadcast", "Compact"],
    recommendedSource: LIVE_SOURCE,
    compatibleModes: BASKETBALL_MODES
  },
  {
    id: "BB-LIVE-06",
    sport: "basketball",
    type: "live",
    name: "Timeout Dot Style",
    description: "แสดง timeout แบบจุดสี",
    tags: ["Minimal", "Social", "Compact"],
    recommendedSource: LIVE_SOURCE,
    compatibleModes: BASKETBALL_MODES
  },
  {
    id: "BB-LIVE-07",
    sport: "basketball",
    type: "live",
    name: "Street Neon",
    description: "ลุคนีออนสตรีทสำหรับ 3x3",
    tags: ["Neon", "Social", "Tournament"],
    recommendedSource: LIVE_SOURCE,
    compatibleModes: BASKETBALL_MODES
  },
  {
    id: "BB-LIVE-08",
    sport: "basketball",
    type: "live",
    name: "Glass Court",
    description: "สไตล์ glass panel พร้อมขอบโปร่ง",
    tags: ["Glass", "Premium", "Large"],
    recommendedSource: LIVE_SOURCE,
    compatibleModes: BASKETBALL_MODES
  },
  {
    id: "BB-LIVE-09",
    sport: "basketball",
    type: "live",
    name: "Logo Heavy Scorebug",
    description: "เน้นโลโก้ทีมขนาดใหญ่ด้านข้าง",
    tags: ["Premium", "Broadcast", "Large"],
    recommendedSource: LIVE_SOURCE,
    compatibleModes: BASKETBALL_MODES
  },
  {
    id: "BB-LIVE-10",
    sport: "basketball",
    type: "live",
    name: "Minimal 3x3",
    description: "สกอร์บาส 3x3 แบบเรียบง่าย",
    tags: ["Minimal", "Local", "Compact"],
    recommendedSource: LIVE_SOURCE,
    compatibleModes: BASKETBALL_MODES
  },
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
    description: "การ์ดแยกคะแนนราย quarter",
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
    description: "การ์ดฟินิชโทน street",
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
    description: "กรอบสปอนเซอร์สำหรับสรุปผล",
    tags: ["Premium", "Local", "Social"],
    recommendedSource: SUMMARY_SOURCE,
    compatibleModes: BASKETBALL_MODES
  },
  {
    id: "BB-SUM-09",
    sport: "basketball",
    type: "summary",
    name: "Big Number Result",
    description: "โชว์คะแนนตัวเลขใหญ่พิเศษ",
    tags: ["Large", "Tournament", "Broadcast"],
    recommendedSource: SUMMARY_SOURCE,
    compatibleModes: BASKETBALL_MODES
  },
  {
    id: "BB-SUM-10",
    sport: "basketball",
    type: "summary",
    name: "Social Recap Board",
    description: "รีแคปผลเกมพร้อมบล็อกข้อความโซเชียล",
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
