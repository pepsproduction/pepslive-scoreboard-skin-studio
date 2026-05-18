# PepsLive Scoreboard Skin Studio

## โปรแกรมนี้คืออะไร
เว็บ Dock UI สำหรับเลือกและปรับแต่ง Skin/Template ของ Scoreboard Overlay เท่านั้น  
รองรับการใช้งานแบบ static บน GitHub Pages และใช้งานคู่กับ OBS Browser Dock

## ใช้ทำอะไร
- เลือกกีฬา (Football / Basketball)
- เลือกประเภทบอร์ด (Live / Summary)
- เลือกเทมเพลตและดู Preview
- ปรับธีม/แอนิเมชัน
- Copy URL และ Add Browser Source เข้า OBS
- Import/Export Skin JSON

## ไม่ได้ใช้ทำอะไร
- ไม่มีปุ่มเพิ่ม/ลดคะแนน
- ไม่มีระบบจับเวลา/เริ่ม-หยุดเวลา
- ไม่มีระบบควบคุมทีม/จัดแมตช์/จัดทัวร์นาเมนต์
- ไม่มีปุ่มควบคุมใบเหลือง/ใบแดง/timeout/shot clock

## วิธีเปิดใช้งาน
```powershell
cd pepslive-scoreboard-skin-studio
python -m http.server 8080
```
เปิด `http://localhost:8080/dock.html`

## วิธีใช้กับ OBS Browser Source
1. เลือกเทมเพลต แล้วกด `Use Skin`
2. กด `Copy URL`
3. ใน OBS เพิ่ม Browser Source แล้ววาง URL
4. ขนาดแนะนำ:
- Live: `900x180`
- Summary: `1920x1080`

## วิธีใช้เป็น OBS Custom Browser Dock
1. OBS > View > Docks > Custom Browser Docks
2. ตั้งชื่อ Dock
3. ใส่ URL ของ `dock.html`

## วิธี Add Source
1. กรอก Host/Port/Password ในส่วน OBS Source Manager
2. กด `Connect OBS`
3. กด `Add Source`
4. ถ้าเชื่อม OBS ไม่ได้ จะ fallback เป็น manual mode และให้ copy URL แทน

## วิธี Copy Overlay URL
กด `Copy URL` จาก Header หรือจากการ์ด Template

## วิธี Deploy GitHub Pages
1. Push ขึ้น GitHub
2. Settings > Pages
3. Deploy from branch
4. Branch `main`, folder `/root`

## โครงสร้างไฟล์
```text
pepslive-scoreboard-skin-studio/
├─ index.html
├─ dock.html
├─ README.md
├─ .gitignore
├─ .nojekyll
├─ overlays/
│  ├─ live.html
│  ├─ summary.html
│  ├─ overlay-core.js
│  └─ overlay-base.css
├─ src/
│  ├─ app.js
│  ├─ template-gallery.js
│  ├─ preview-engine.js
│  ├─ theme-editor.js
│  ├─ obs-source-manager.js
│  ├─ skin-storage.js
│  ├─ mock-data.js
│  ├─ utils.js
│  ├─ pepslive-payload-protocol.js
│  ├─ payload-validator.js
│  ├─ external-data-adapters.js
│  ├─ shared-state-bridge.js
│  └─ overlay-module-registry.js
├─ templates/
├─ styles/
└─ data/
```

## Phase 2.1 Shared State Protocol
โปรเจกต์ใช้ protocol กลาง:
- `PEPSLIVE_SCOREBOARD_STATE_V1`

Broadcast channel:
- `pepslive-scoreboard-state-v1`

localStorage fallback:
- `pepslive.scoreboard.sharedState.v1`

custom event:
- `pepslive:scoreboard-state-updated`

## Payload Schema
ฟิลด์หลัก:
- `protocol`
- `version`
- `source`
- `timestamp`
- `sport`
- `skinId`
- `type`
- `theme`
- `animation`
- `matchData`

ฟิลด์ `matchData` พื้นฐาน:
- `eventName`, `eventLogo`
- `homeLogo`, `awayLogo`
- `homeName`, `awayName`
- `homeShortName`, `awayShortName`
- `homeScore`, `awayScore`
- `gameClock`, `periodLabel`, `statusLabel`

football extra:
- `addedTime`, `aggregateScore`, `penaltyScore`, `goalScorerList`, `cardInfo`

basketball extra:
- `shotClock`, `homeFouls`, `awayFouls`, `homeTimeouts`, `awayTimeouts`, `possession`, `bonus`, `quarterBreakdown`, `topScorer`

## BroadcastChannel Usage
รองรับ message type:
- `PEPSLIVE_STATE_UPDATE`
- `PEPSLIVE_SKIN_UPDATE`
- `PEPSLIVE_THEME_UPDATE`
- `PEPSLIVE_ANIMATION_UPDATE`
- `PEPSLIVE_PING`
- `PEPSLIVE_PONG`
- `PEPSLIVE_RESET`

ทุก message มี:
- `type`
- `protocol`
- `timestamp`
- `payload`

## Legacy Dock UI Compatibility
รองรับ payload 3 รูปแบบ:
1. New protocol payload
2. Legacy flat state
3. Legacy nested state (`teams`, `clock`, `event`)

ทุกแบบจะถูก normalize ไปเป็น protocol กลางก่อนเข้า validator

## ตัวอย่าง payload football
ดูไฟล์ [sample-payload-football.json](/D:/pepslive-scoreboard-skin-studio/pepslive-scoreboard-skin-studio/data/sample-payload-football.json)

## ตัวอย่าง payload basketball
ดูไฟล์ [sample-payload-basketball.json](/D:/pepslive-scoreboard-skin-studio/pepslive-scoreboard-skin-studio/data/sample-payload-basketball.json)

## วิธีทดสอบ overlay ด้วย debug=1
- Live: `overlays/live.html?skin=FB-LIVE-01&debug=1`
- Summary: `overlays/summary.html?skin=FB-SUM-01&debug=1`

## วิธีเชื่อมจาก Dock UI เดิมในอนาคต
1. ส่ง payload เข้า `PepsLiveDockAdapter`
2. Adapter จะ normalize legacy/new format เป็น protocol กลาง
3. ผ่าน `payload-validator` เพื่อ validate + fallback
4. publish ผ่าน `SharedStateBridge` ไปยัง overlay

## Roadmap
- ผูก feed จริงจาก Dock UI เดิมแบบ production
- เพิ่ม schema versioning และ migration
- ต่อ Google Sheet/Tournament Manager แบบเต็ม
- แยกโมดูล Lower Third / Goal Frame / Player Card / Sponsor Board / Countdown / Marketplace

## Phase 2.2 Template Render Contract
- ระบบเพิ่มไฟล์ `src/template-render-contract.js` เป็นสัญญากลางของการ render template ทั้ง 40 แบบ
- ทุก template ถูกตรวจ required slots ตาม sport/type ก่อนส่งเข้า Visual QA
- มี critical slots สำหรับความพร้อมใช้งาน overlay:
  - `eventLogo`, `homeLogo`, `awayLogo`, `score`, `gameClock`, `statusLabel`
- Overlay ส่งรายงาน contract กลับไปที่ Dock Panel แบบเรียลไทม์
- ถ้า slot สำคัญหาย ระบบจะขึ้น warning/error โดยไม่ทำให้หน้า crash

## Slot Inspector และ Visual QA
- Slot Inspector:
  - `Off`
  - `Core Slots`
  - `All Slots`
- Visual QA Mode:
  - `Off`
  - `Slot Grid`
  - `Contrast Boost`
  - `Overflow Check`
- ใช้เพื่อเช็กตำแหน่ง slot, ความอ่านง่าย, และปัญหา overflow ก่อนนำขึ้น OBS จริง

## Phase 2.2.1 Visual Smoke Test
Checklist ที่ใช้ตรวจรอบ Visual QA + Overlay Smoke Test:
- [x] เปิด `dock.html`
- [x] เปิด Live overlay football (`overlays/live.html?skin=FB-LIVE-01&debug=1`)
- [x] เปิด Live overlay basketball (`overlays/live.html?skin=BB-LIVE-01&debug=1`)
- [x] เปิด Summary overlay football (`overlays/summary.html?skin=FB-SUM-01&debug=1`)
- [x] เปิด Summary overlay basketball (`overlays/summary.html?skin=BB-SUM-01&debug=1`)
- [x] ตรวจ `debug=1` และโหมดปกติ (ไม่มี debug box)
- [x] ตรวจพื้นหลังโปร่งใส (`html/body` transparent)
- [x] ตรวจ GitHub Pages path (`/pepslive-scoreboard-skin-studio/...`)
- [x] ทดสอบ sample payload 4 ไฟล์ (validate + ingest)
- [x] ทดสอบ OBS Browser Source manual URL (Copy URL / fallback)

## Phase 2.3 OBS Browser Source Integration
- เพิ่ม OBS Connection Panel: host/port/password, connect/disconnect/test, status, current scene, error message
- เพิ่ม Source Actions: Add Live, Add Summary, Add Both, Refresh Selected Source, Force Refresh
- เพิ่ม URL tools: Regenerate URL, Copy Fresh URL, Copy Live/Summary Production URL, Copy Live/Summary Debug URL
- เพิ่ม Source Size Presets:
  - Live: Compact 900x180, Wide 1280x220, Full HD Transparent Canvas 1920x1080
  - Summary: Full HD 1920x1080, Vertical 1080x1920, Square 1080x1080
- เพิ่ม Recommended OBS Settings + ปุ่ม Copy OBS Custom CSS
- เพิ่ม Source Health Check: URL, skin, preset, connection/manual mode, contract pass, debug flag, GitHub Pages readiness

## Phase 2.4 Production UI Polish
- ปรับ Template Gallery ให้ค้นหาและกรอง template ได้ง่ายขึ้น
- ปรับ Template Card ให้เด่นขึ้นสำหรับงาน broadcast จริง
- ปรับ Preview Panel ให้เห็น current skin, sport/type, source preset และ quick actions ชัดขึ้น
- ปรับ Theme Editor ให้จัดกลุ่มตามการใช้งานและเลือก preset ได้ง่าย
- ปรับ OBS Source Manager ให้เป็น manual-first และอ่านง่ายใน OBS Dock แคบ

## วิธีใช้ Template Search/Filter
1. พิมพ์คำค้นในช่อง `Search templates`
2. ใช้ filter chips เพื่อกรองตาม `Favorites`, `Recently Used`, `Football`, `Basketball`, `Live`, `Summary` และ style tags
3. ดูจำนวน template ที่เหลือใน gallery header
4. ถ้าไม่เจอ template ให้ลองล้าง filter หรือเปลี่ยน keyword

## วิธีเลือก Skin
1. คลิกที่ template card เพื่อ preview
2. กด `Use Skin` เพื่อใช้งาน skin นั้น
3. กด `Favorite` เพื่อปักหมุด template ที่ใช้บ่อย
4. ใช้ `Copy URL` จาก card หรือจาก preview panel เพื่อส่งเข้า OBS

## วิธีใช้ Preview Tools
1. เลือก Background Test Mode เพื่อจำลองฉากหลัง
2. เลือก Safe Area Preview เพื่อเช็กขอบเฟรม
3. เลือก Slot Inspector และ Visual QA Mode เพื่อดู slot / overflow
4. ดู `Current Preview` panel เพื่อเช็ก skin ปัจจุบันและ source preset

## วิธีใช้ Theme Preset
1. กด preset card ใน Theme Editor เพื่อ apply ทันที
2. ใช้ `Reset Theme` เพื่อกลับค่าเริ่มต้น
3. ปรับสี / depth / animation ด้วย control เดิมที่มีอยู่
4. ดู `Current Preset` เพื่อรู้ว่าตอนนี้กำลังใช้ preset ไหนอยู่

## วิธีใช้ OBS Source Manager แบบเร็ว
1. ถ้า OBS พร้อม ให้กรอก host/port/password แล้วกด `Connect OBS`
2. ถ้าเชื่อมไม่ได้ ให้ใช้ Manual Mode และกด `Copy Live Production URL` หรือ `Copy Summary Production URL`
3. ถ้าต้องการติดตั้งหลาย source ให้ใช้ `Add Both Sources`
4. ถ้าต้อง refresh ให้ใช้ `Regenerate URL` แล้ว `Copy Fresh URL` หรือ `Force Refresh Source`

## วิธีใช้แบบ Manual
1. เลือก template และ preset ที่ต้องการ
2. กด `Copy Live Production URL` หรือ `Copy Summary Production URL`
3. ใน OBS เพิ่ม `Browser Source` แล้ววาง URL
4. ตั้ง Width/Height ตาม preset ที่เลือก
5. ตั้งค่า:
   - Shutdown source when not visible: Off
   - Refresh browser when scene becomes active: On
   - Custom CSS: `body { background-color: rgba(0, 0, 0, 0); margin: 0; overflow: hidden; }`

## วิธีใช้แบบ OBS WebSocket
1. กรอก Host/Port/Password ใน OBS Source Manager
2. กด `Connect OBS` แล้ว `Test Connection`
3. เลือก preset สำหรับ Live/Summary
4. กด `Add Live Source`, `Add Summary Source` หรือ `Add Both Sources`
5. ใช้ `Refresh Selected Source` หรือ `Force Refresh Source` เมื่อต้องการรีโหลด

## Production URL vs Debug URL
- Production URL: ใช้งานจริงใน OBS (ไม่มี `debug=1`)
- Debug URL: ใช้ตรวจสถานะ protocol/render (`debug=1`)
- แนะนำให้ใช้ Production URL ตอนถ่ายทอดจริงเสมอ

## วิธีแก้ OBS ไม่ refresh
1. กด `Regenerate URL` แล้ว `Copy Fresh URL`
2. ถ้าเชื่อม OBS ได้ ให้กด `Force Refresh Source`
3. ถ้า Manual mode ให้เปิด Browser Source properties แล้วกด refresh cache ของหน้า

## Troubleshooting
- URL เปิดไม่ขึ้น:
  - ตรวจ path ว่าเป็น `.../overlays/live.html` หรือ `.../overlays/summary.html`
  - ตรวจว่าไม่ใช่ path แบบ `/src/...`
- Overlay ไม่โปร่งใส:
  - ตั้ง Custom CSS ตามค่าที่ระบบให้
  - ตรวจว่า overlay page ใช้พื้นหลัง `transparent`
- OBS ไม่อัปเดตหลังเปลี่ยน skin:
  - ลอง `Regenerate URL` + `Force Refresh Source`
  - ตรวจ `Source Health Check` ว่า URL ตรงกับ expected หรือไม่
- Debug box โผล่ตอนใช้งานจริง:
  - ใช้ Production URL (ไม่มี `debug=1`)
- Source size ผิด:
  - เปลี่ยน preset ให้ตรง use case แล้ว add/refresh source ใหม่

## วิธีใช้งานบน GitHub Pages
- รองรับ URL รูปแบบ:
  - `https://USERNAME.github.io/pepslive-scoreboard-skin-studio/dock.html`
  - `https://USERNAME.github.io/pepslive-scoreboard-skin-studio/overlays/live.html?skin=FB-LIVE-01`
  - `https://USERNAME.github.io/pepslive-scoreboard-skin-studio/overlays/summary.html?skin=FB-SUM-01`
- ระบบ generate URL ใช้ base path อัตโนมัติให้ไม่พังบน GitHub Pages

## Production Readiness Checklist
- [x] `dock.html`, `index.html`, `test-protocol.html` เปิดได้
- [x] Live/Summary overlay เปิดได้ทั้ง football และ basketball
- [x] Overlay ยังเป็นพื้นหลังโปร่งใส (`background: transparent`)
- [x] Template gallery ครบ 40 แบบ และ filter/search ทำงาน
- [x] Theme editor และ preset ใช้งานได้แบบ real-time
- [x] Payload protocol validation + legacy adapter ทำงาน
- [x] OBS Manual Mode พร้อม copy URL/CSS และ preset source size
- [x] GitHub Pages path จำลองใช้งานได้

## GitHub Pages Final Setup
1. Push โค้ดขึ้น branch `main`
2. ไปที่ `Settings > Pages`
3. ตั้งค่า Source เป็น `Deploy from a branch`
4. เลือก Branch `main` และ Folder `/root`
5. รอ deploy แล้วทดสอบ URL:
- `https://pepsproduction.github.io/pepslive-scoreboard-skin-studio/`
- `https://pepsproduction.github.io/pepslive-scoreboard-skin-studio/dock.html`
- `https://pepsproduction.github.io/pepslive-scoreboard-skin-studio/overlays/live.html?skin=FB-LIVE-01`
- `https://pepsproduction.github.io/pepslive-scoreboard-skin-studio/overlays/summary.html?skin=FB-SUM-01`

## Quick Start for pepslive-tools
1. ให้ Dock UI เดิมส่ง state เข้าผ่าน `PEPSLIVE_SCOREBOARD_STATE_V1` หรือ legacy payload
2. ใช้ `PepsLiveDockAdapter` + `payload-validator` เพื่อ normalize/validate
3. Publish shared state ผ่าน channel `pepslive-scoreboard-state-v1`
4. เปิด overlay URL ใน OBS Browser Source

ลิงก์ทดสอบด่วน:
- Dock: [dock.html](./dock.html)
- Live overlay: [overlays/live.html?skin=FB-LIVE-01](./overlays/live.html?skin=FB-LIVE-01)
- Summary overlay: [overlays/summary.html?skin=FB-SUM-01](./overlays/summary.html?skin=FB-SUM-01)
- Protocol test: [test-protocol.html](./test-protocol.html)

## Recommended OBS Browser Source Settings
- Live Source:
  - Width: `900` (หรือ preset ที่เลือก)
  - Height: `180` (หรือ preset ที่เลือก)
- Summary Source:
  - Width: `1920` (หรือ preset ที่เลือก)
  - Height: `1080` (หรือ preset ที่เลือก)
- Custom CSS:
```css
body { background-color: rgba(0, 0, 0, 0); margin: 0; overflow: hidden; }
```
- Shutdown source when not visible: `Off`
- Refresh browser when scene becomes active: `On`

## Final Troubleshooting
- URL เปิดไม่ได้:
  - ตรวจ path ว่าเป็น `.../overlays/live.html` หรือ `.../overlays/summary.html`
  - ตรวจว่าขึ้นด้วยโปรเจกต์ path บน GitHub Pages ถูกต้อง
- Overlay ไม่โปร่งใส:
  - ตรวจ Custom CSS ใน OBS
  - ตรวจว่าใช้ overlay page ของโปรเจกต์นี้โดยตรง
- Overlay ไม่อัปเดตหลังเปลี่ยน skin:
  - ใช้ `Regenerate URL` แล้ว `Copy Fresh URL`
  - ถ้าใช้ WebSocket ให้กด `Force Refresh Source`
- Debug box โผล่ในงานจริง:
  - ใช้ Production URL ที่ไม่มี `debug=1`

## Phase 3.0 PepsLive Dock UI Integration
แนวคิดการเชื่อม:
- Skin Studio รับข้อมูลสถานะการแข่งขันจาก Dock UI เดิมผ่าน shared payload protocol เท่านั้น
- Skin Studio ยังทำหน้าที่เลือก/preview skin และจัดการ theme/overlay URL
- Dock UI เดิมยังเป็นแหล่งควบคุมคะแนน, เวลา, ทีม, และสถานะแมตช์

สิ่งที่ Skin Studio ทำ:
- normalize payload จากหลาย format
- validate payload ก่อน render
- publish/consume state ผ่าน BroadcastChannel และ localStorage fallback

สิ่งที่ Dock UI เดิมทำ:
- อัปเดต score/time/team/status จาก workflow จริง
- ส่ง state มาที่ Skin Studio ผ่าน `pepslive-dock-bridge.js` หรือ protocol เดิม

### Field Mapping (Dock -> Protocol matchData)
| Dock UI Field (examples) | Protocol Field |
|---|---|
| `eventTitle`, `tournamentName`, `leagueName`, `event.name` | `eventName` |
| `event.logo` | `eventLogo` |
| `teamAName`, `homeTeam.name`, `teams.home.name` | `homeName` |
| `teamBName`, `awayTeam.name`, `teams.away.name` | `awayName` |
| `teamAScore`, `scoreA`, `homeTeam.score`, `teams.home.score` | `homeScore` |
| `teamBScore`, `scoreB`, `awayTeam.score`, `teams.away.score` | `awayScore` |
| `teamALogo`, `homeTeam.logo`, `teams.home.logo` | `homeLogo` |
| `teamBLogo`, `awayTeam.logo`, `teams.away.logo` | `awayLogo` |
| `teamAColor`, `homeTeam.color`, `teams.home.color` | `theme.homeColor` |
| `teamBColor`, `awayTeam.color`, `teams.away.color` | `theme.awayColor` |
| `matchTime`, `timer`, `clockText`, `clock.time` | `gameClock` |
| `period`, `half`, `quarter`, `clock.period` | `periodLabel` |
| `matchStatus`, `status`, `clock.status` | `statusLabel` |
| `teamAFouls`, `homeTeam.fouls`, `teams.home.fouls` | `homeFouls` |
| `teamBFouls`, `awayTeam.fouls`, `teams.away.fouls` | `awayFouls` |
| `teamATimeouts`, `homeTeam.timeouts`, `teams.home.timeouts` | `homeTimeouts` |
| `teamBTimeouts`, `awayTeam.timeouts`, `teams.away.timeouts` | `awayTimeouts` |

### Example: Flat payload
```json
{
  "sport": "football",
  "homeName": "Dragon FC",
  "awayName": "Tiger FC",
  "homeScore": 2,
  "awayScore": 1,
  "gameClock": "45:00",
  "periodLabel": "1H",
  "statusLabel": "LIVE"
}
```

### Example: Nested payload
```json
{
  "event": { "name": "PEPS LIVE CUP", "logo": "" },
  "teams": {
    "home": { "name": "Dragon FC", "shortName": "DRA", "score": 2, "logo": "" },
    "away": { "name": "Tiger FC", "shortName": "TIG", "score": 1, "logo": "" }
  },
  "clock": { "time": "45:00", "period": "1H", "status": "LIVE" }
}
```

### Example: PepsLive Dock style payload
```json
{
  "sport": "football",
  "eventTitle": "PEPS LIVE CUP",
  "teamAName": "Dragon FC",
  "teamBName": "Tiger FC",
  "teamAScore": 2,
  "teamBScore": 1,
  "matchTime": "45:00",
  "half": "1H",
  "matchStatus": "LIVE"
}
```

### Using `pepslive-dock-bridge.js`
```js
import { publishPepsLiveDockState } from "./src/pepslive-dock-bridge.js";

publishPepsLiveDockState({
  teamAName: "Dragon FC",
  teamBName: "Tiger FC",
  teamAScore: 2,
  teamBScore: 1,
  matchTime: "45:00",
  half: "1H",
  matchStatus: "LIVE"
});
```

### Test with `test-protocol.html`
1. เปิด `test-protocol.html`
2. โหลด sample แบบ `PepsLive Football/Basketball State`
3. กด `Normalize Dock State`
4. กด `Publish Dock State To Bridge`
5. เปิด overlay ด้วย `debug=1` เพื่อตรวจ source/validation

### Overlay debug mode
- Live: `overlays/live.html?skin=FB-LIVE-01&debug=1`
- Summary: `overlays/summary.html?skin=FB-SUM-01&debug=1`
- Debug box จะแสดง source และสถานะ validation ล่าสุด

คำเตือน:
- โปรเจกต์นี้ไม่ควบคุมคะแนนหรือเวลาเอง
- หากต้องการเปลี่ยนคะแนน/เวลา ให้เปลี่ยนจาก Dock UI เดิม แล้วส่ง payload มา

## Phase 4.2 - Preview Stability and Gallery Accuracy

- Studio preview and Template Gallery thumbnails use isolated iframe mode so BroadcastChannel/localStorage updates do not force every thumbnail back to the same skin.
- Gallery cards keep a consistent preview box height while the embedded Browser Source keeps its real source ratio.
- Scoreboard Parts now includes Team Logo Position: `Left / Left`, `Right / Right`, `Outer: Left / Right`, and `Inner: Right / Left`.
- `Blank Plates` hides team/event logos and text while keeping the scoreboard plate structure for OBS text layers.
- Event logo uploads are resized locally before storage/publish to reduce lag while adjusting the theme in real time.

### PepsLive Dock V1 Sync Note

PepsLive Dock V1 already publishes match state through `PEPSLIVE_SCOREBOARD_STATE_V1`, `pepslive-scoreboard-state-v1`, and `pepslive.scoreboard.sharedState.v1`.

You do not need to keep this Skin Studio `dock.html` page open after copying the overlay URL. For live score/team/time updates, keep PepsLive Dock V1 open and make sure Dock V1 and the Skin Studio overlay run on the same origin/browser profile.

Most reliable current setup:

1. Choose a skin in Skin Studio and copy the overlay URL.
2. Add that URL to OBS Browser Source.
3. Keep PepsLive Dock V1 open while controlling the match.
4. Open Dock V1 and overlay from the same origin when using BroadcastChannel/localStorage sync.

Known browser limitation: OBS Browser Source may use a separate storage profile or a different origin. If so, BroadcastChannel/localStorage will not sync. A future fully portable bridge should use a hosted/shared JSON state URL or backend relay so PepsLive Dock V1 can be the single source of truth without relying on same-origin storage.

## Phase 4.3 Portable State URL + Dock Sync Reliability

### ปัญหาที่แก้
OBS Browser Source อาจโหลดในสภาพแวดล้อมที่แยก storage profile ออกจาก Skin Studio dock.html ทำให้ BroadcastChannel/localStorage ไม่ทำงาน ทำให้ skin/theme/display options ที่ตั้งไว้ไม่ถูกส่งไปที่ overlay

### วิธีการแก้: Portable State URL
Phase 4.3 เพิ่มระบบ Portable URL ที่ฝัง skin, theme, และ display options ลงใน `?state=` parameter โดยตรง

```text
overlays/live.html?state=<base64url-encoded-json>
```

**ข้อมูลที่ฝังใน URL ได้:**
- `skinId` — รหัส skin ที่เลือก
- `sport` — กีฬา (football / basketball)
- `type` — ประเภท (live / summary)
- `animation` — animation preset
- `theme` — ค่าสีและ visual settings
- `displayOptions` — การซ่อน/แสดง element ต่างๆ (eventLogo, gameClock, ฯลฯ)
- `eventLogo` — data-URL ของ event logo (ถ้าขนาดไม่เกิน 4096 chars หลัง encode)

### วิธีใช้ใน dock.html
1. เลือก skin และปรับแต่ง theme/display options ตามต้องการ
2. เปิด **Settings → Browser Source Export**
3. ใต้หัวข้อ **Portable State URLs** จะมี URL ที่พร้อมใช้งาน
4. กด **Copy Portable Live URL** หรือ **Copy Portable Summary URL**
5. วาง URL ที่ได้ลงใน OBS Browser Source ได้เลย — ไม่ต้องพึ่ง localStorage

### ลำดับการโหลดของ Overlay (Phase 4.3)
1. **`?state=` param (Portable)** — ถ้ามี ใช้ก่อนอื่นทั้งหมด และห้าม localStorage ทับค่า skin/theme ตอนเริ่มโหลด
2. **`?skin` / `?theme` / `?slots` แบบเดิม** — fallback ถ้าไม่มี `?state=`
3. **Shared state (localStorage / BroadcastChannel)** — สำหรับ same-origin sync
4. **Mock data fallback** — ถ้าไม่มีข้อมูลจากแหล่งไหนเลย

### ข้อจำกัดของ Portable URL
| สิ่งที่ Portable URL รองรับ | สิ่งที่ยังต้องพึ่ง same-origin |
|---|---|
| Skin ID | Live score (homeScore/awayScore) |
| Theme (สี/ขนาด/animation) | Game clock (gameClock) |
| Display options (toggle slots) | Period / status (periodLabel, statusLabel) |
| Event logo (ถ้าขนาดเล็กพอ) | Added time, fouls, timeouts, ฯลฯ |

**Live score update ยังต้องมาจาก PepsLive Dock V1** ผ่าน BroadcastChannel/localStorage (same-origin) หรือ Phase ถัดไปที่จะเป็น hosted JSON relay / backend bridge

### เมื่อ URL ยาวเกินไป
ถ้า state ใหญ่กว่า 4 096 chars หลัง encode:
- ระบบแสดง warning notification ใน dock.html
- ถ้า `eventLogo` ทำให้เกิน limit ระบบจะตัด eventLogo ออกก่อนและแสดง warning
- แนะนำให้ใช้ same-origin localStorage sync แทน หรือรอ Phase ถัดไป (hosted relay)

### ขั้นตอนถัดไปสำหรับ cross-origin sync 100%
ถ้าต้องการ sync live score ข้าม origin/profile อย่างแน่นอน:
- Phase ถัดไป: **Hosted JSON Relay / Backend Bridge**
  - Dock V1 push state ไปที่ server endpoint
  - Overlay ดึง state จาก endpoint เป็นระยะ (polling) หรือ SSE
  - ไม่พึ่ง localStorage หรือ BroadcastChannel อีกต่อไป

### QA check
```bash
node scripts/check-portable-url.mjs   # 36/36 assertions pass
node scripts/check-phase3-integration.mjs   # PASS (no regressions)
node --check src/utils.js src/app.js overlays/overlay-core.js src/shared-state-bridge.js
```

## Phase 4.4 Relay Poller + Named Skin Presets

### ปัญหาที่แก้
Phase 4.3 แก้ปัญหา skin/theme เดินทางไปกับ URL แล้ว แต่ **live score ยังต้องพึ่ง same-origin** เพราะ BroadcastChannel/localStorage ไม่ข้ามระหว่าง storage profile ได้ Phase 4.4 แก้ด้วยการเพิ่ม Relay Poller ที่ polling URL สาธารณะ

### Relay Poller

#### ทำงานอย่างไร
1. **Export** state ปัจจุบันจาก dock.html → Settings → Relay Config → "Export State as Relay JSON"
2. **Host** ไฟล์ JSON ที่ได้บน URL สาธารณะ HTTPS ใดก็ได้ เช่น:
   - GitHub Gist (raw URL)
   - Dropbox public link
   - GitHub Pages (`data/relay-state.json`)
   - PHP/Python one-liner ที่ return JSON
3. **วาง URL** ลงใน "Relay JSON URL" และตั้ง poll interval
4. **Copy Relay Live URL / Relay Summary URL** → วางใน OBS Browser Source
5. สำหรับ live score update: อัปเดตไฟล์ JSON ด้วย script หรือ HTTP PUT จากระบบควบคุมคะแนน
6. Overlay จะ poll ทุก N วินาทีและ update อัตโนมัติ

#### URL ที่ได้
```text
overlays/live.html?relay=https%3A%2F%2F...&state=<base64url>
```
- `?relay=` = URL ของ relay JSON endpoint
- `?state=` = skin/theme แบบ portable (โหลดทันทีก่อน poll แรก)

#### Relay JSON format
JSON ที่ relay endpoint ต้อง return เป็น PepsLive protocol payload หรือ flat matchData:

```json
{
  "protocol": "PEPSLIVE_SCOREBOARD_STATE_V1",
  "version": 1,
  "source": "relay",
  "sport": "football",
  "skinId": "FB-LIVE-01",
  "matchData": {
    "homeName": "Dragon FC",
    "awayName": "Tiger FC",
    "homeScore": 2,
    "awayScore": 1,
    "gameClock": "72:00",
    "periodLabel": "2H",
    "statusLabel": "LIVE"
  }
}
```

### Named Skin Presets

บันทึกชื่อ config (skin + theme + display options + animation) สำหรับใช้งานซ้ำได้เร็ว:

1. เลือก skin และปรับ theme ตามต้องการ
2. เปิด Settings → Skin Presets
3. พิมพ์ชื่อ preset เช่น "Cup Final 2026 – Live"
4. กด **Save Preset**
5. กด **Load** เพื่อสลับไป preset นั้นได้ทุกเมื่อ

Presets เก็บใน localStorage ของ Skin Studio dock (**ไม่ส่งไปที่ overlay** และไม่เกี่ยวกับ relay)

### Relay Poller Technical Details
- ETag support: ไม่ re-parse ถ้า server return 304 Not Modified
- Exponential backoff: 2× interval per error, cap ที่ 30 วินาที
- `sanitizeRelayUrl`: reject ftp/file/non-http protocols
- `clampRelayInterval`: 1 000 ms – 60 000 ms (1–60 วินาที)
- Poller หยุดอัตโนมัติเมื่อ OBS Browser Source ถูกซ่อน (beforeunload)
- Debug box แสดงสถานะ: `Relay: polling | errors: 0`

### QA check
```bash
node scripts/check-phase44-relay.mjs   # 59/59 assertions pass
node scripts/check-portable-url.mjs    # 36/36 PASS
node scripts/check-phase3-integration.mjs   # PASS
node --check src/relay-poller.js src/skin-storage.js src/utils.js overlays/overlay-core.js src/app.js
```

### Sync Strategy Summary (Phase 4.4 complete)

| Method | Cross-origin | Live scores | Effort |
|---|---|---|---|
| Same-origin BroadcastChannel | ❌ | ✅ auto | Zero |
| Portable URL `?state=` | ✅ | ❌ static only | Copy URL once |
| **Relay Poller `?relay=`** | ✅ | ✅ with uploader | Host JSON + update |
| Future hosted relay server | ✅ | ✅ fully auto | Phase ถัดไป |



## Phase 4.6 - Stable Skin URLs + Dock V1 Handoff

- ปุ่ม Copy URL หลักใช้ Portable Production URL พร้อม `v=timestamp` เพื่อวางใน OBS Browser Source ได้ตรงขึ้น
- Skin ที่เลือกจาก URL จะไม่ถูก payload จาก PepsLive Dock V1 เปลี่ยนกลับเป็น template แรกเอง
- Background Opacity, Display Options, Event Logo และ Auto Theme ถูกส่งไปกับ URL/preview context ของทุก template
- Skin Studio ส่ง Live/Summary Browser Source URL ล่าสุดให้ PepsLive Dock V1 ผ่าน `PEPSLIVE_STUDIO_SYNC`
- PepsLive Dock V1 สามารถใช้ URL ล่าสุดจาก Skin Studio เพื่อ Copy URL หรือสร้าง Browser Source ได้ง่ายขึ้น

## Phase 5.0 Embedded Mode for PepsLive Dock V1

Skin Studio supports an embedded popup mode for PepsLive Dock V1:

```text
dock.html?embed=1&from=dock-v1
```

In embedded mode:

- the header is hidden for a tighter popup layout
- OBS/Data Bridge panels are hidden to keep the popup focused on skin selection and styling
- current Live/Summary Browser Source URLs are sent to the parent Dock by `postMessage`
- BroadcastChannel and localStorage handoff still work as fallbacks
- score/team/time data still comes from PepsLive Dock V1 or the shared payload protocol

## Phase 5.2 Live Source Stability and PNG Export

- Relay URLs now embed the latest match snapshot in `?state=` so OBS opens with the current Dock V1 score/team/clock immediately.
- Relay polling defaults to 1 second for lower score-update delay.
- Bad/stale relay reads no longer reset the visible scoreboard back to mock preview data.
- Use **Export PNG** in the Source Preview toolbar to download the current scoreboard design as a transparent PNG at the selected Browser Source preset size.

## Phase 5.3 Embedded Settings Stability

- PepsLive Dock V1 match payloads now update only score/team/clock data. They do not reset the selected skin, Summary Board choice, theme, event logo, or display options.
- Skin Settings Studio in embedded mode uses a small locked Source Preview and a larger scrollable settings column, so it is easier to tune inside an OBS Dock popup.
- Added independent controls for text sizes and frame sizing: event text, team name, short name, score, clock, period, status, extra text, board width/height, score box width, and team box height.
- In embedded mode, advanced panels that are no longer needed during Dock V1 use are hidden: Browser Source Export, PepsLive Dock Integration, and Data Bridge.
- Use **Skin Settings File** to export a skin setup on the full web page and import it inside Dock V1 on another machine.

## Phase 5.4 Live/Summary Settings Isolation

- Embedded Skin Settings Studio keeps Source Preview at the top of the popup, sizes the preview stage to about one quarter of the dock viewport, and lets the settings panel scroll separately.
- Live Scoreboard settings and Summary Board settings are saved independently.
- PepsLive Dock V1 updates score/team/clock data only; it does not reset skin, theme, display options, or slot layout.
- Browser Source overlays keep the selected visual state while live match data changes, reducing fallback flicker to the default preview.
- If OBS uses an isolated Browser Source profile, use the copied Portable URL or Relay URL so the selected skin state is included directly in the URL.
