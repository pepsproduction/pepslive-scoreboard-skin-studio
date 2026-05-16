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
