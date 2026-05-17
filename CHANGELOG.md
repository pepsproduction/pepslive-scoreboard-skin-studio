# CHANGELOG

## Phase 4.3 - Portable State URL + Reliable Dock Sync Bridge

### Overview
Adds a first-class **Portable State URL** strategy so that OBS Browser Sources can load the correct skin/theme/display options without depending on localStorage or BroadcastChannel. This resolves the sync gap where OBS Browser Sources using an isolated storage profile could not reliably receive state from the Skin Studio dock.

### New Features
- **`encodePortableState` / `decodePortableState`** in `src/utils.js`
  - Base64url encode/decode of a plain-object state (skinId, sport, type, animation, theme, displayOptions, eventLogo)
  - Size limit: 4 096 chars; warns if exceeded
  - `eventLogo` data-URL is included only if the total remains within the limit, otherwise dropped with a warning
  - Decode returns `null` (never throws) on any invalid/corrupt input
- **`generatePortableOverlayUrl`** in `src/utils.js`
  - Produces overlay URLs with `?state=<base64url>` parameter
  - Warning message returned (not thrown) when state is oversized
- **`buildPortableUrlByType`** in `src/app.js`
  - Builds portable live/summary URLs from current studio state (skin + theme + displayOptions + eventLogo)
  - Updates both portable URL textareas whenever skin/theme/display changes via `refreshObsUrlsPanel`
- **Portable State URLs** section in Browser Source Export panel (`dock.html`)
  - "Copy Portable Live URL" button
  - "Copy Portable Summary URL" button
  - Descriptive note explaining use-case and limitations

### Overlay Changes (`overlays/overlay-core.js`)
- Priority loading order is now:
  1. **`?state=` portable param** (Phase 4.3) — highest priority; locks out localStorage override on first load
  2. Legacy `?skin` / `?theme` / `?slots` individual params
  3. Shared state (localStorage / BroadcastChannel)
  4. Mock data fallback
- `decodePortableState` is imported from `src/utils.js`
- Source label "Portable URL State" added for debug overlay box
- Live score updates still arrive via BroadcastChannel/postMessage if the dock is same-origin

### QA
- `scripts/check-portable-url.mjs` — 32/32 assertions pass:
  - Round-trip encode/decode for skin/theme/displayOptions
  - Base64url safety (no `+`, `/`, trailing `=`)
  - Invalid state fallback (null, garbage, corrupt, array) — never throws
  - EventLogo size budget (small included, oversized dropped)
  - Overlay file existence + no absolute path leaks
  - State completeness including `teamLogoPosition` and boolean `extraRow`
- `scripts/check-phase3-integration.mjs` — still PASS (no regressions)
- `node --check` — clean for all 4 modified files

### Limitations (unchanged)
- Skin Studio is a skin selector only — no score/timer controls
- Portable URL carries **static** skin/theme/displayOptions only
- Live score updates still require same-origin or a future hosted JSON relay/backend bridge

## Phase 4.2 - Preview Stability + Gallery Accuracy

### Fixes
- Isolated studio preview and gallery thumbnail iframes from shared BroadcastChannel/localStorage updates so cards no longer collapse back to the same selected skin.
- Reduced event-logo lag by resizing uploaded logos locally before saving/publishing and debouncing high-frequency theme publishes.
- Kept background opacity/theme edits bound to the currently selected skin.

### Scoreboard Parts
- Added team logo position options: Left / Left, Right / Right, Outer, and Inner.
- Blank Plates now hides team/event logos as well as text while preserving scoreboard plate structure.
- Gallery preview boxes now use a consistent height while preserving each Browser Source's real aspect ratio inside the card.

## Phase 4.1 - Theme Stability + Event Logo Palette

### Fixes
- Fixed theme/background opacity updates so they publish the full currently selected skin state instead of a theme-only patch that could fall back to an older skin
- Kept preview, shared state, and copied URL generation aligned with the selected skin during theme edits

### Event Logo
- Added local event logo upload for the current skin preview
- Added automatic palette extraction from the event logo and one-click palette application to the theme
- Event logo is stored in the current skin JSON/local state and can be cleared without affecting team data

## Phase 4.0 - Settings Modal + Source-Ratio Preview

### Studio UX
- Moved skin tuning controls into a dedicated settings modal with a locked preview column and scrollable controls
- Updated source preview sizing so live and summary previews follow the selected Browser Source preset ratio
- Added Browser Source text mode: full text or blank plates for users who want to add their own text/font layers in OBS

### Gallery
- Switched template cards to real overlay iframe thumbnails so gallery previews match actual skin output more closely
- Tightened card action labels and button layout to avoid text overflow on narrow cards

### Overlay
- Added blank text rendering mode while preserving scoreboard structure and transparent background behavior

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
