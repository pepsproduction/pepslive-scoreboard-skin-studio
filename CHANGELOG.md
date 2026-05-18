# CHANGELOG

## Phase 5.7 - No-Flash Live Payload Guard

- Preserved `seq`/`revision` fields through the shared payload protocol so overlays can reason about payload order.
- Overlay live-data updates now ignore stale Dock/relay/shared payloads instead of repainting old score data.
- Invalid incoming payloads now keep the current or last stable Dock data on screen before falling back to mock data.
- Dock/relay payloads now merge into the current match snapshot, reducing flashes back to default team/score values during settings changes.

## Phase 5.6 - Flicker Guard + Summary Preview URL Fix

- Reworked Studio preview iframes to use short `stateKey` URLs plus same-origin storage/postMessage hydration instead of long portable URLs.
- Summary and Live previews now scale the real Browser Source canvas into the preview frame so the whole board is visible without stretching.
- Template Gallery thumbnails now use short overlay URLs and source-size scaling, preventing `URI Too Long` errors in Summary Board cards.
- Portable URLs now strip oversized logo data from nested `matchData` before encoding, avoiding browser URL length failures after Event Logo upload.
- Overlay pages now remember the last stable Dock/relay/shared payload and use it before mock fallback, reducing flashes back to default preview data during reloads.

## Phase 5.5 - Relay Visual Lock + Export Polish

- Locked URL-selected skin/theme/display options while Dock V1 and relay payloads update only match data, reducing flashes back to default preview styling.
- Added automatic text fitting for long team names, event names, clock/status labels, scores, and extra values instead of clipping with ellipsis.
- Embedded Skin Settings Studio now uses a 1/4 preview column and 3/4 scrollable tools/settings column in Dock V1.
- Export PNG now asks for a destination folder when supported by the browser, falling back to save/download behavior when needed.

## Phase 5.4 - Live/Summary Settings Isolation + Flicker Guard

- Embedded Skin Settings Studio now places Source Preview at the top of the popup, with preview and controls scrolling independently.
- Embedded Source Preview stage now targets roughly one quarter of the dock viewport while preserving the selected Browser Source aspect ratio.
- Live Scoreboard and Summary Board styling states are stored separately so adjusting one mode no longer overwrites the other mode.
- Browser Source payloads now carry `displayOptions` as part of the shared protocol, while PepsLive Dock V1 match updates no longer reset display options back to defaults.
- Overlay rendering ignores empty Dock visual settings and keeps the selected skin/theme/slot layout stable during score/time updates.
- Template application now loads match data before re-rendering the preview to reduce visible fallback flicker.

## Phase 5.3 - Embedded Settings Stability + Layout Controls

- Dock V1 payloads now update match data only; they no longer overwrite the selected skin, theme, display options, or Summary Board choice.
- Source Preview export uses a safer PNG download path with explicit canvas/blob download handling.
- Added independent display controls for event text, team names, short names, scores, clock, period, status, extra text, board width/height, score box width, and team box height.
- Embedded Skin Settings Studio now uses a compact sticky preview column plus a scrollable settings column for OBS Dock use.
- Embedded mode hides advanced Browser Source Export, PepsLive Dock Integration, and Data Bridge panels; the simplified Skin Settings File panel remains for moving presets between machines.

## Phase 5.2 - Live Relay Stability + PNG Export

- Relay/portable URLs can now embed the current `matchData` so overlays open with the latest Dock V1 score/team/clock instead of flashing mock preview data first.
- Relay polling default/minimum is now 1 second for faster OBS Browser Source updates.
- Overlay relay payload handling now accepts both full protocol payloads and flat matchData-style relay responses.
- Invalid relay reads no longer force the overlay back to mock data when a valid scoreboard is already visible.
- Added **Export PNG** from the current Source Preview, using the selected Browser Source preset size and transparent background.

## Phase 4.6 - Stable Skin URLs + Dock V1 Handoff

- Changed production copy URLs to portable state URLs with cache busters for OBS-ready setup.
- Preserved URL-selected skins when PepsLive Dock V1 publishes live match payloads without a skinId.
- Added Studio-to-Dock URL handoff via `PEPSLIVE_STUDIO_SYNC` plus localStorage fallback.
- Added team-name alignment modes: Left/Left, Right/Right, Outer L/R, Inner R/L.
- Fixed BB-LIVE-11 scoped CSS typo so basketball gallery styles no longer leak/miss.
## Phase 4.4 - Relay Poller + Named Skin Presets

### Overview
Closes the final sync gap for OBS Browser Sources running in isolated storage profiles. A **Relay Poller** allows overlays to periodically fetch live score state from any public HTTP JSON endpoint โ€” no BroadcastChannel or localStorage required. **Named Skin Presets** let users save and load complete configurations (skin + theme + display options) during events.

### New Features

#### Relay Poller (`src/relay-poller.js`)
- `RelayPoller` class: polls a user-configured URL for PepsLive state JSON every N ms
- ETag-based conditional GET (`If-None-Match`) avoids re-parsing identical responses
- Exponential backoff (up to 30 s) on HTTP errors; resets on success
- `sanitizeRelayUrl` โ€” validates http/https only, trims whitespace, returns null on failure
- `clampRelayInterval` โ€” enforces 1 000 ms โ€“ 60 000 ms range
- `onStatus` callback exposes running/error state to the debug overlay box
- Never throws; all errors go to `onError` callback

#### Relay Overlay URL (`src/utils.js`)
- `generateRelayOverlayUrl` โ€” produces URLs with `?relay=<encoded-url>` plus `?state=` for immediate skin load before the first poll

#### Named Skin Presets (`src/skin-storage.js`)
- `saveSkinPreset(preset)` โ€” saves name + skinId + sport + type + theme + animation + displayOptions + eventLogo; name capped at 64 chars
- `listSkinPresets()` โ€” returns array sorted newest-first
- `getSkinPresetById(id)` โ€” single preset lookup
- `deleteSkinPreset(id)` โ€” remove preset; returns boolean
- `getRelayConfig` / `setRelayConfig` โ€” persist relay URL and poll interval across sessions

#### Dock UI (`dock.html` + `styles/dock.css`)
- **Skin Presets** panel above Browser Source Export
  - Text input for preset name + Save Preset button
  - Rendered preset list with Load / Delete per entry
  - Styled `.preset-list`, `.preset-item`, `.preset-actions`, `.text-input`
- **Relay Config** section inside Browser Source Export (below Portable State URLs)
  - Relay JSON URL input + Poll Interval input (1-60 sec)
  - Copy Relay Live URL / Copy Relay Summary URL buttons
  - Export State as Relay JSON (downloads the current payload as a ready-to-host file)
  - Test Relay URL (fetches URL, validates format, shows result inline)

#### `src/app.js`
- `buildRelayUrlByType` โ€” builds live/summary relay URLs from current studio state
- `exportStateAsRelayJson` โ€” downloads current state as `relay-state-*.json`
- `testRelayUrl` โ€” fetches URL, validates payload format, shows inline status
- `renderPresetsPanel` / `bindPresetsPanel` โ€” full preset UI lifecycle
- `bindRelayPanel` โ€” relay config panel bindings and persistence

#### Overlay (`overlays/overlay-core.js`)
- Reads `?relay=` query param (percent-encoded URL)
- Starts `RelayPoller` after init if relay URL is present and not isolated mode
- Relay updates go through the same `applyProtocolPayload` path as other sources
- Relay stopped on `beforeunload` to prevent dangling timers
- Debug overlay box shows relay status: `Relay: polling | errors: 0`

### QA
- `scripts/check-phase44-relay.mjs` โ€” **59/59 assertions pass**
  - `clampRelayInterval`: NaN, null, out-of-range, valid, string
  - `sanitizeRelayUrl`: null/empty, garbage, file/ftp (rejected), http/https (accepted), normalisation
  - Skin Presets: save / list / sort / delete round-trip; name cap; non-existent delete
  - `generateRelayOverlayUrl`: missing/bad relay, valid relay + state combo, live/summary, debug flag, decode round-trip
  - Source file completeness and export names
- `scripts/check-portable-url.mjs` โ€” 36/36 PASS (no regressions)
- `scripts/check-phase3-integration.mjs` โ€” PASS (no regressions)
- `node --check` โ€” clean for all 6 modified files

### Relay Quick-Start Guide
1. **Export** current state from dock โ’ Settings โ’ Relay Config โ’ "Export State as Relay JSON"
2. **Host** the JSON file at any public HTTPS URL (GitHub Gist raw, Dropbox, etc.)
3. **Paste** the URL into "Relay JSON URL" field and set poll interval
4. **Copy** Relay Live URL / Relay Summary URL โ’ paste into OBS Browser Source
5. For live score updates, **update the JSON file** via any HTTP PUT/PATCH tool or scripted uploader
6. Overlays poll the URL and pick up changes within the configured interval

### Limitations (unchanged)
- Relay poller **only works when `?relay=` is in the Browser Source URL** โ€” same-origin BroadcastChannel/localStorage still used when relay param is absent
- Updating the relay JSON file itself still requires a manual upload step or an external uploader script
- A future Phase (hosted relay server) would automate this push step

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
  1. **`?state=` portable param** (Phase 4.3) โ€” highest priority; locks out localStorage override on first load
  2. Legacy `?skin` / `?theme` / `?slots` individual params
  3. Shared state (localStorage / BroadcastChannel)
  4. Mock data fallback
- `decodePortableState` is imported from `src/utils.js`
- Source label "Portable URL State" added for debug overlay box
- Live score updates still arrive via BroadcastChannel/postMessage if the dock is same-origin

### QA
- `scripts/check-portable-url.mjs` โ€” 36/36 assertions pass:
  - Round-trip encode/decode for skin/theme/displayOptions
  - Base64url safety (no `+`, `/`, trailing `=`)
  - Invalid state fallback (null, garbage, corrupt, array) โ€” never throws
  - EventLogo size budget (small included, oversized dropped)
  - Overlay file existence + no absolute path leaks
  - State completeness including `teamLogoPosition` and boolean `extraRow`
- `scripts/check-phase3-integration.mjs` โ€” still PASS (no regressions)
- `node --check` โ€” clean for all 4 modified files

### Limitations (unchanged)
- Skin Studio is a skin selector only โ€” no score/timer controls
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
- เนเธเธฃเน€เธเธเธ•เนเธเธตเนเธขเธฑเธเนเธกเนเนเธเนเธฃเธฐเธเธเธเธงเธเธเธธเธกเธเธฐเนเธเธ (เนเธกเนเธกเธตเธเธธเนเธกเน€เธเธดเนเธก/เธฅเธ”เธเธฐเนเธเธ)
- เนเธเธฃเน€เธเธเธ•เนเธเธตเนเธขเธฑเธเนเธกเนเธกเธตเธฃเธฐเธเธเธเธฑเธ”เธเธฒเธฃเธ—เธตเธก/เธ—เธฑเธงเธฃเนเธเธฒเน€เธกเธเธ•เน
- เธเนเธญเธกเธนเธฅเธเธฃเธดเธเธ•เนเธญเธเธกเธฒเธเธฒเธ PepsLive Dock UI เน€เธ”เธดเธก เธซเธฃเธทเธญ shared payload protocol
- เธเธฒเธฃเนเธเนเธเธฒเธ OBS WebSocket เธ•เนเธญเธเธ•เธฑเนเธเธเนเธฒเธเธฑเนเธ OBS เนเธซเนเธ–เธนเธเธ•เนเธญเธเธเนเธญเธ (host/port/password/permissions)

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

## Phase 5.0 - Embedded Dock V1 Handoff

- Added `?embed=1` support for Skin Studio when opened inside PepsLive Dock V1.
- Added parent-window `postMessage` handoff for generated Live/Summary overlay URLs.
- Kept BroadcastChannel/localStorage URL handoff as fallbacks.
- Added compact embedded layout styles for the Dock V1 Skin popup.
- No scoring, timer, or match-control logic was added to Skin Studio.
