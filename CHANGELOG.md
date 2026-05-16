# CHANGELOG

## Phase 2.5 - Final QA + GitHub Pages Deployment Check

### Core Features
- Final regression pass across dock, overlay, protocol bridge, validator, and template modules
- Verified template gallery behavior with 40 templates and search/filter states
- Confirmed theme editor, preview tools, and render contract checks remain functional

### OBS Integration
- Validated manual workflow readiness for production/debug URL copy and custom CSS copy
- Confirmed source size presets for live and summary remain intact
- Confirmed safe fallback behavior when OBS WebSocket is unavailable (manual mode path)

### Protocol Support
- Verified shared protocol constants and message types remain aligned for:
  - `PEPSLIVE_SCOREBOARD_STATE_V1`
  - `pepslive-scoreboard-state-v1`
  - `pepslive.scoreboard.sharedState.v1`
  - `pepslive:scoreboard-state-updated`
- Validated protocol payload samples and legacy adapter normalization paths

### Template Count
- Total templates: `40`
- Football: `20` (`10 live + 10 summary`)
- Basketball: `20` (`10 live + 10 summary`)

### Overlay Readiness
- Verified live and summary overlay routes load correctly
- Verified overlay base remains transparent and OBS-safe
- Verified GitHub Pages-style paths for overlay endpoints

### Known Limitations
- โปรเจกต์นี้ยังไม่ใช่ระบบควบคุมคะแนน (ไม่มีปุ่มเพิ่ม/ลดคะแนน)
- โปรเจกต์นี้ยังไม่มีระบบจัดการทีม/ทัวร์นาเมนต์
- ข้อมูลจริงต้องมาจาก PepsLive Dock UI เดิม หรือ shared payload protocol
- การใช้งาน OBS WebSocket ต้องตั้งค่าฝั่ง OBS ให้ถูกต้องก่อน (host/port/password/permissions)
