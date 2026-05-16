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
