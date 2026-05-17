/**
 * src/relay-poller.js
 * Phase 4.4 – Relay Poller
 *
 * Polls a user-configured public URL for PepsLive state JSON and delivers
 * validated payloads to the overlay without requiring localStorage or
 * BroadcastChannel (cross-origin / cross-profile safe).
 *
 * The URL must return a JSON object that passes isProtocolPayload() or a
 * legacy-compatible flat matchData object. Invalid responses are silently
 * discarded (no crash).
 */

import { isProtocolPayload } from "./pepslive-payload-protocol.js";
import { nowIso } from "./utils.js";

/** Minimum allowed poll interval in milliseconds. */
export const RELAY_POLL_INTERVAL_MIN_MS = 2_000;

/** Maximum allowed poll interval in milliseconds. */
export const RELAY_POLL_INTERVAL_MAX_MS = 60_000;

/** Default poll interval in milliseconds. */
export const RELAY_POLL_INTERVAL_DEFAULT_MS = 5_000;

/** Maximum consecutive errors before backoff reaches ceiling. */
const MAX_BACKOFF_STEPS = 6;

/** Relay source label used in overlay debug box. */
export const RELAY_SOURCE_LABEL = "relay-poller";

/**
 * Clamp a poll interval to the allowed range.
 * @param {number} ms
 * @returns {number}
 */
export function clampRelayInterval(ms) {
  const value = Math.round(Number(ms));
  if (!Number.isFinite(value)) return RELAY_POLL_INTERVAL_DEFAULT_MS;
  return Math.max(RELAY_POLL_INTERVAL_MIN_MS, Math.min(RELAY_POLL_INTERVAL_MAX_MS, value));
}

/**
 * Validate and sanitize a relay URL string.
 * Returns the URL string if valid, null otherwise.
 * @param {string} raw
 * @returns {string|null}
 */
export function sanitizeRelayUrl(raw) {
  if (!raw || typeof raw !== "string") return null;
  try {
    const parsed = new URL(raw.trim());
    if (!["http:", "https:"].includes(parsed.protocol)) return null;
    return parsed.toString();
  } catch (_error) {
    return null;
  }
}

/**
 * Test whether a value looks like a usable PepsLive state payload.
 * Accepts the full protocol payload or a plain matchData-style object
 * that at minimum contains sport + homeName + awayName.
 * @param {unknown} value
 * @returns {boolean}
 */
export function isRelayPayloadUsable(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  if (isProtocolPayload(value)) return true;
  // Minimal flat matchData check
  const v = /** @type {Record<string,unknown>} */ (value);
  return typeof v.sport === "string" && (typeof v.homeName === "string" || typeof v.teamAName === "string");
}

/**
 * Relay Poller class.
 *
 * Usage:
 *   const poller = new RelayPoller({
 *     url: "https://example.com/state.json",
 *     intervalMs: 5000,
 *     onPayload: (data) => { ... },
 *     onError:   (err) => { ... },
 *     onStatus:  (status) => { ... }
 *   });
 *   poller.start();
 *   // later...
 *   poller.stop();
 */
export class RelayPoller {
  /**
   * @param {{
   *   url?: string,
   *   intervalMs?: number,
   *   onPayload?: (data: object, meta: { url: string, latencyMs: number, etag: string|null }) => void,
   *   onError?:   (error: Error, meta: { url: string, consecutiveErrors: number }) => void,
   *   onStatus?:  (status: { running: boolean, url: string|null, lastPollTime: string, consecutiveErrors: number, backoffMs: number }) => void
   * }} opts
   */
  constructor({ url = "", intervalMs = RELAY_POLL_INTERVAL_DEFAULT_MS, onPayload, onError, onStatus } = {}) {
    this._url = sanitizeRelayUrl(url) || "";
    this._intervalMs = clampRelayInterval(intervalMs);
    this._onPayload = onPayload || null;
    this._onError = onError || null;
    this._onStatus = onStatus || null;

    this._running = false;
    this._timer = null;
    this._lastEtag = "";
    this._consecutiveErrors = 0;
    this._lastPollTime = "";
    this._abortController = null;
  }

  /** Start polling. Safe to call multiple times (idempotent). */
  start() {
    if (this._running) return;
    this._running = true;
    this._scheduleNext(0);
    this._emitStatus();
  }

  /** Stop polling. Safe to call multiple times. */
  stop() {
    this._running = false;
    if (this._timer !== null) {
      clearTimeout(this._timer);
      this._timer = null;
    }
    this._abortController?.abort();
    this._abortController = null;
    this._emitStatus();
  }

  /**
   * Change the relay URL. If currently running, triggers an immediate poll.
   * @param {string} url
   */
  setUrl(url) {
    const sanitized = sanitizeRelayUrl(url) || "";
    if (sanitized === this._url) return;
    this._url = sanitized;
    this._lastEtag = "";
    this._consecutiveErrors = 0;
    if (this._running) {
      this._scheduleNext(0);
    }
  }

  /**
   * Change the poll interval in milliseconds.
   * @param {number} ms
   */
  setInterval(ms) {
    this._intervalMs = clampRelayInterval(ms);
  }

  /** Force an immediate poll outside the normal schedule. */
  forceRefresh() {
    if (!this._running) return;
    if (this._timer !== null) {
      clearTimeout(this._timer);
      this._timer = null;
    }
    this._poll();
  }

  /** Current relay URL (null if not set / invalid). */
  get url() {
    return this._url || null;
  }

  /** Whether the poller is currently running. */
  get running() {
    return this._running;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  _scheduleNext(delayMs) {
    if (!this._running) return;
    if (this._timer !== null) {
      clearTimeout(this._timer);
    }
    this._timer = setTimeout(() => {
      this._timer = null;
      this._poll();
    }, delayMs);
  }

  async _poll() {
    if (!this._running) return;
    if (!this._url) {
      this._scheduleNext(this._intervalMs);
      return;
    }

    const t0 = Date.now();
    this._abortController = new AbortController();
    const { signal } = this._abortController;

    try {
      const headers = { Accept: "application/json" };
      if (this._lastEtag) {
        headers["If-None-Match"] = this._lastEtag;
      }

      const response = await fetch(this._url, { method: "GET", headers, signal, cache: "no-store" });

      if (response.status === 304) {
        // Not modified — no new payload
        this._consecutiveErrors = 0;
        this._lastPollTime = nowIso();
        this._scheduleNext(this._intervalMs);
        this._emitStatus();
        return;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }

      const etag = response.headers.get("ETag") || "";
      const data = await response.json();
      const latencyMs = Date.now() - t0;

      if (isRelayPayloadUsable(data)) {
        this._lastEtag = etag;
        this._consecutiveErrors = 0;
        this._lastPollTime = nowIso();
        this._onPayload?.(data, { url: this._url, latencyMs, etag: etag || null });
      }
      // Silently discard unusable payloads

      this._scheduleNext(this._intervalMs);
      this._emitStatus();
    } catch (error) {
      if (error?.name === "AbortError") {
        return;
      }
      this._consecutiveErrors = Math.min(this._consecutiveErrors + 1, MAX_BACKOFF_STEPS);
      this._lastPollTime = nowIso();
      const backoffMs = this._computeBackoff();
      this._onError?.(error instanceof Error ? error : new Error(String(error)), {
        url: this._url,
        consecutiveErrors: this._consecutiveErrors
      });
      this._scheduleNext(backoffMs);
      this._emitStatus();
    } finally {
      this._abortController = null;
    }
  }

  _computeBackoff() {
    // Exponential backoff: intervalMs * 2^(errors-1), max 30s
    const base = this._intervalMs;
    const step = Math.pow(2, Math.max(0, this._consecutiveErrors - 1));
    return Math.min(base * step, 30_000);
  }

  _emitStatus() {
    this._onStatus?.({
      running: this._running,
      url: this._url || null,
      lastPollTime: this._lastPollTime,
      consecutiveErrors: this._consecutiveErrors,
      backoffMs: this._consecutiveErrors > 0 ? this._computeBackoff() : 0
    });
  }
}
