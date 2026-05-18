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
  {
    id: "FB-LIVE-11",
    sport: "football",
    type: "live",
    name: "Cyber Edge",
    description: "สไตล์ Cyberpunk ล้ำยุค ขอบเฉียงพร้อมแสงนีออนวิ่งรอบทิศทาง",
    tags: ["Cyberpunk", "Neon", "Animated", "Esports", "Premium"],
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
    name: "Pitch Dark Elite",
    description: "พื้นดำ pitch-สนามหญ้า ขอบสีทีม gradient ขนาดตัวเลขคะแนนยักษ์",
    tags: ["Dark", "Premium", "Broadcast"],
    recommendedSource: SUMMARY_SOURCE,
    compatibleModes: FOOTBALL_MODES
  },
  {
    id: "FB-SUM-02",
    sport: "football",
    type: "summary",
    name: "Diagonal Clash",
    description: "แบ่งพื้นที่เฉียง 45° สีทีม Home/Away ชัดเจน คะแนนกลาง",
    tags: ["Bold", "Tournament", "Social"],
    recommendedSource: SUMMARY_SOURCE,
    compatibleModes: FOOTBALL_MODES
  },
  {
    id: "FB-SUM-03",
    sport: "football",
    type: "summary",
    name: "Stadium Arch",
    description: "shape โค้งด้านบน เหมือน arch ประตูสนามกีฬา ชื่อทีมแบบ stadium",
    tags: ["Architecture", "Local", "Premium"],
    recommendedSource: SUMMARY_SOURCE,
    compatibleModes: FOOTBALL_MODES
  },
  {
    id: "FB-SUM-04",
    sport: "football",
    type: "summary",
    name: "Grass Texture Strip",
    description: "texture หญ้าสนามบนพื้น ตัดกับ dark card คะแนน กลิ่นอายสนามจริง",
    tags: ["Realistic", "Broadcast", "Local"],
    recommendedSource: SUMMARY_SOURCE,
    compatibleModes: FOOTBALL_MODES
  },
  {
    id: "FB-SUM-05",
    sport: "football",
    type: "summary",
    name: "Trophy Glow",
    description: "ไฟ golden glow รอบ score block เหมือนถ้วยรางวัล เหมาะ Final",
    tags: ["Gold", "Trophy", "Tournament"],
    recommendedSource: SUMMARY_SOURCE,
    compatibleModes: FOOTBALL_MODES
  },
  {
    id: "FB-SUM-06",
    sport: "football",
    type: "summary",
    name: "Neon Stadium Night",
    description: "พื้นมืด มี neon light สี cyan/magenta รอบขอบ ลุค night match",
    tags: ["Neon", "Night", "Broadcast"],
    recommendedSource: SUMMARY_SOURCE,
    compatibleModes: FOOTBALL_MODES
  },
  {
    id: "FB-SUM-07",
    sport: "football",
    type: "summary",
    name: "Club Colors Vertical",
    description: "layout แนวตั้ง สีทีมแบ่งซ้าย-ขวา เต็มพื้นที่ เหมาะ Social Story",
    tags: ["Vertical", "Social", "Bold"],
    recommendedSource: SUMMARY_SOURCE,
    compatibleModes: FOOTBALL_MODES
  },
  {
    id: "FB-SUM-08",
    sport: "football",
    type: "summary",
    name: "Broadcast Lower Third",
    description: "ลุค Lower-Third สตูดิโอทีวี แถบสีล่างจอ ชื่อทีมใหญ่ด้านข้าง",
    tags: ["TV", "Broadcast", "Clean"],
    recommendedSource: SUMMARY_SOURCE,
    compatibleModes: FOOTBALL_MODES
  },
  {
    id: "FB-SUM-09",
    sport: "football",
    type: "summary",
    name: "Glassmorphism Card",
    description: "Card แก้วแบบ frosted glass พื้นหลัง blur สีทีม premium modern",
    tags: ["Glass", "Modern", "Premium"],
    recommendedSource: SUMMARY_SOURCE,
    compatibleModes: FOOTBALL_MODES
  },
  {
    id: "FB-SUM-10",
    sport: "football",
    type: "summary",
    name: "Retro Classic",
    description: "ลุค retro สไตล์ลีกเก่า border หนา เส้นสองชั้น โทนคลาสสิก",
    tags: ["Retro", "Classic", "Local"],
    recommendedSource: SUMMARY_SOURCE,
    compatibleModes: FOOTBALL_MODES
  },
  {
    id: "FB-SUM-11",
    sport: "football",
    type: "summary",
    name: "Cinematic Widescreen",
    description: "widescreen 21:9 letterbox style ชื่อทีมขนาดใหญ่มาก minimal",
    tags: ["Cinematic", "Premium", "Social"],
    recommendedSource: SUMMARY_SOURCE,
    compatibleModes: FOOTBALL_MODES
  },
  {
    id: "FB-SUM-12",
    sport: "football",
    type: "summary",
    name: "Derby Fire Duel",
    description: "gradient ไฟสีแดง-ส้ม เหมาะ Derby/Rivalry match ไฟลุกทั้งสอง",
    tags: ["Fire", "Derby", "Tournament"],
    recommendedSource: SUMMARY_SOURCE,
    compatibleModes: FOOTBALL_MODES
  },
  {
    id: "FB-SUM-13",
    sport: "football",
    type: "summary",
    name: "Clean Minimal White",
    description: "พื้นขาว/off-white สะอาด ตัวอักษรดำ เหมาะสถาบัน/โรงเรียน",
    tags: ["Minimal", "Clean", "Local"],
    recommendedSource: SUMMARY_SOURCE,
    compatibleModes: FOOTBALL_MODES
  },
  {
    id: "FB-SUM-14",
    sport: "football",
    type: "summary",
    name: "Holographic Foil",
    description: "เอฟเฟกต์ holographic foil shimmer รอบการ์ด ลุค premium award",
    tags: ["Holographic", "Premium", "Award"],
    recommendedSource: SUMMARY_SOURCE,
    compatibleModes: FOOTBALL_MODES
  },
  {
    id: "FB-SUM-15",
    sport: "football",
    type: "summary",
    name: "Street League Spray",
    description: "ลุค urban street art spray paint grunge เหมาะฟุตบอลชุมชน",
    tags: ["Urban", "Street", "Social"],
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
  {
    id: "BB-LIVE-11",
    sport: "basketball",
    type: "live",
    name: "Hoops Hologram",
    description: "โฮโลแกรมสแกนไลน์ พร้อมแสงเรืองรอบจอสุดล้ำ",
    tags: ["Hologram", "Animated", "Premium", "Esports", "Neon"],
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
