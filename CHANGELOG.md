# CHANGELOG

## Phase 3.9 - Web Studio Selection Stability + Slot Controls

### Stability
- Fixed preview flicker by avoiding iframe reloads when switching skins within the same overlay type
- Prevented old shared/localStorage payloads from overriding an explicit `?skin=` query during overlay startup
- Stopped preview postMessage updates from publishing back into shared state, avoiding feedback loops

### Web Studio UX
- Shifted the main page copy toward a regular web studio/manual Browser Source workflow
- Hid direct OBS WebSocket/Add Source controls from the main flow while keeping manual URL copy available
- Added Scoreboard Parts toggles for Event Logo, Event Name, Team Logos, Short Names, Clock, Period, Status, and Extra Stats

### Template polish
- Added stronger image-inspired visual treatments for selected football/basketball live and summary templates
- Kept team names and scores as always-on core slots while optional parts auto-collapse cleanly

## Phase 3.8 - Template Visual Differentiation + Overlay Flicker Polish

### Overlay stability
- Reduced preview iframe reloads when incoming payloads keep the same skin/type
- Updated overlay rendering to patch existing slots instead of rebuilding the full scoreboard DOM on every state update
- Kept animation classes stable during normal score/time updates to reduce visible flicker in OBS Browser Source

### Template visuals
- Added per-template gallery thumbnail signatures so cards better represent each skin family
- Expanded football and basketball live/summary CSS signatures for clearer differences across all 40 templates
- Added mobile overlay safeguards for narrow preview and dock testing viewports

### QA
- Verified JavaScript syntax, Phase 3 integration script, and HTTP smoke routes for dock/live/summary overlays

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

## Phase 3.0 - PepsLive Dock UI Integration

### Dock bridge helper
- Added `src/pepslive-dock-bridge.js` for publish/normalize/write state helper functions
- Exported helper API:
  - `publishPepsLiveDockState(state)`
  - `normalizePepsLiveDockState(state)`
  - `createPepsLivePayloadFromDockState(state)`
  - `sendPepsLiveStateUpdate(state)`
  - `writePepsLiveStateToLocalStorage(state)`

### PepsLive Dock adapter mapping
- Expanded `PepsLiveDockAdapter` with explicit public methods:
  - `detectFormat`, `fromLegacyFlat`, `fromLegacyNested`, `fromPepsLiveDockState`, `normalize`, `ingest`
- Added mapping coverage for legacy flat, legacy nested, and PepsLive Dock style fields

### Sample dock state payload
- Added:
  - `data/sample-pepslive-dock-state-football.json`
  - `data/sample-pepslive-dock-state-basketball.json`

### Integration test harness
- Updated `test-protocol.html` with PepsLive Dock compatibility section:
  - load dock-style samples
  - normalize dock state
  - publish to bridge
  - inspect normalized payload and validation

### Documentation
- Added Phase 3.0 integration docs in README with field mapping table and usage examples
