import { supabase, supabaseConfigured } from "./supabase";

/**
 * Anonymous, aggregate-only usage events. Never send names, appointment details or medical data:
 * only the event type, the screen, the route type and the platform.
 */
export type EventName = "session_start" | "screen_view" | "route_started" | "voice_play";

const SCREENS = new Set([
  "home", "map", "parking", "visit", "support", "kids", "doctor", "scanner",
  "memory", "colorStar", "bubbles", "catchStars", "map-step",
]);
const ROUTES = new Set(["elderly", "pregnant", "urgent"]);

function detectPlatform(): "ios" | "android" | "desktop" | "other" {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  if (/Android/i.test(ua)) return "android";
  if (/Windows|Macintosh|Linux|CrOS/i.test(ua)) return "desktop";
  return "other";
}

/** Test traffic: anything outside the published rork.app site, automation, or links with ?test=1. */
function detectTest(): boolean {
  try {
    const params = new URLSearchParams(location.search);
    if (params.get("test") === "1") localStorage.setItem("fc.testDevice", "1");
    if (params.get("test") === "0") localStorage.removeItem("fc.testDevice");
    if (localStorage.getItem("fc.testDevice") === "1") return true;
  } catch { /* storage blocked */ }
  if (navigator.webdriver) return true;
  return !location.hostname.endsWith(".rork.app");
}

function sessionId(): string {
  try {
    let id = sessionStorage.getItem("fc.session");
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem("fc.session", id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

let ctx: { platform: string; isTest: boolean; session: string } | null = null;
function context() {
  if (!ctx) ctx = { platform: detectPlatform(), isTest: detectTest(), session: sessionId() };
  return ctx;
}

export function track(event: EventName, opts: { screen?: string; routeType?: string } = {}) {
  if (!supabaseConfigured || typeof window === "undefined") return;
  if (location.pathname.startsWith("/admin")) return;
  const c = context();
  const screen = opts.screen && SCREENS.has(opts.screen) ? opts.screen : null;
  const route_type = opts.routeType && ROUTES.has(opts.routeType) ? opts.routeType : null;
  void supabase
    .from("usage_events")
    .insert({ event, screen, route_type, platform: c.platform, is_test: c.isTest, session_id: c.session })
    .then(({ error }) => {
      if (error) console.warn("[analytics]", error.message);
    });
}

let started = false;
export function trackSessionStart() {
  if (started) return;
  started = true;
  try {
    if (sessionStorage.getItem("fc.sessionTracked") === "1") return;
    sessionStorage.setItem("fc.sessionTracked", "1");
  } catch { /* ignore */ }
  track("session_start");
}
