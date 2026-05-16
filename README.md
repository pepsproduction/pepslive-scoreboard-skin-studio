# PepsLive Scoreboard Skin Studio

## โปรแกรมนี้คืออะไร
PepsLive Scoreboard Skin Studio คือเว็บ Dock UI สำหรับเลือกและปรับแต่ง **รูปแบบ/สกิน/เทมเพลต** ของ Scoreboard Overlay เท่านั้น  
ออกแบบให้ใช้งานร่วมกับ OBS Browser Dock และ deploy แบบ static บน GitHub Pages ได้ทันที

## ใช้ทำอะไร
- เลือกกีฬา (Football / Basketball)
- เลือกประเภทบอร์ด (Live Scoreboard / Summary Board)
- เลือกเทมเพลตจาก Gallery (40 แบบ)
- Preview เทมเพลตแบบทันที
- ปรับ Theme/Style/Animation แบบ real-time
- Copy Browser Source URL
- Add Browser Source เข้า OBS (ผ่าน obs-websocket) พร้อม fallback manual mode
- Export / Import Skin JSON
- Favorite / Recently Used
- Safe Area Preview
- Background Test Mode
- Source Health Check

## ไม่ได้ใช้ทำอะไร
โปรเจกต์นี้ **ไม่ใช่** ระบบควบคุมแมตช์ และไม่มีฟีเจอร์ต่อไปนี้:
- เพิ่ม/ลดคะแนน
- เริ่ม/หยุดเวลา
- เลือก/แก้ทีม
- อัปโหลดโลโก้จริง
- คุมใบเหลือง/ใบแดง
- Timeout/Shot Clock control
- Match/Tournament management

## วิธีเปิดใช้งาน
1. ดาวน์โหลดหรือ clone โปรเจกต์
2. เปิดไฟล์ [dock.html](/D:/pepslive-scoreboard-skin-studio/pepslive-scoreboard-skin-studio/dock.html) โดยตรง หรือผ่าน local server
3. หรือเปิด [index.html](/D:/pepslive-scoreboard-skin-studio/pepslive-scoreboard-skin-studio/index.html) เพื่อ redirect เข้าหน้า Dock

ตัวอย่างเปิดผ่าน local server:
```powershell
cd pepslive-scoreboard-skin-studio
python -m http.server 8080
```
แล้วเข้า `http://localhost:8080`

## วิธีใช้กับ OBS Browser Source
1. เลือก Template ที่ต้องการ
2. กด `Use Skin`
3. กด `Copy URL` เพื่อคัดลอกลิงก์ overlay
4. ไปที่ OBS > Add Source > Browser
5. วาง URL แล้วตั้ง Width / Height ตามประเภท
  - Live: 900 x 180
  - Summary: 1920 x 1080

## วิธีใช้เป็น OBS Custom Browser Dock
1. เข้า OBS > `View` > `Docks` > `Custom Browser Docks...`
2. ตั้งชื่อเช่น `PepsLive Skin Studio`
3. ใส่ URL ของ `dock.html` บน GitHub Pages หรือ local URL
4. กด `Apply`

## วิธี Add Source
1. กรอก OBS Host/Port/Password ในส่วน `OBS Source Manager`
2. กด `Connect OBS`
3. กด `Add Source` (บน header หรือการ์ด template)
4. ถ้าเชื่อมต่อ OBS ไม่ได้ ระบบจะเข้า **Manual Mode** และให้ Copy URL แทน

## วิธีใช้ Phase 2 Data Bridge
1. เปิด `dock.html` มากกว่า 1 หน้าหรือเปิดพร้อมกับ overlay ใน origin เดียวกัน
2. ระบบจะ sync ผ่าน `BroadcastChannel` อัตโนมัติ
3. ถ้า Browser ไม่รองรับ ระบบ fallback ไปที่ `localStorage shared state`
4. สามารถวาง payload JSON ใน `Phase 2 Data Bridge` เพื่อทดสอบ feed จากภายนอกได้

คีย์ shared state ที่ใช้:
- `pepslive:sharedOverlayState`
- channel: `pepslive-overlay-sync-v1`

## วิธี Copy Overlay URL
- ใช้ปุ่ม `Copy URL` ได้ทั้ง:
  - บน Header (template ที่กำลังเลือก)
  - บน Template Card แต่ละใบ
- URL รองรับ cache buster `&v=timestamp`

## วิธี Deploy GitHub Pages
1. push code ขึ้น GitHub repository
2. ไปที่ `Settings` > `Pages`
3. Source: `Deploy from a branch`
4. Branch: `main`
5. Folder: `/root`
6. Save

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
│  └─ utils.js
├─ templates/
│  ├─ template-registry.js
│  ├─ football-live.css
│  ├─ football-summary.css
│  ├─ basketball-live.css
│  └─ basketball-summary.css
├─ styles/
│  ├─ dock.css
│  ├─ preview.css
│  └─ responsive.css
└─ data/
   ├─ templates.json
   ├─ theme-presets.json
   └─ mock-match-data.json
```

## Roadmap
### Phase 2 (planned)
- เชื่อมข้อมูลจาก PepsLive Dock UI เดิม (โครง hook พร้อมใช้งาน)
- รองรับ BroadcastChannel (เสร็จแล้ว)
- รองรับ localStorage shared state (เสร็จแล้ว)
- รองรับ Google Sheet / Tournament Manager integration (stub adapter)
- รองรับ Lower Third (planned module)
- รองรับ Goal Frame (planned module)
- รองรับ Player Card (planned module)
- รองรับ Sponsor Board (planned module)
- รองรับ Countdown Overlay (planned module)
- รองรับ Skin Marketplace (planned module)
