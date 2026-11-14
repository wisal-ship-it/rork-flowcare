import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  dataset, destinations, findNode, nodeIDFor, route as computeRoute,
  type MapDataset, type MapNode, type MapRoute, type PlaceRole, type RouteType,
} from "./map";
import { track } from "./analytics";

export type Lang = "ar" | "en";
export type AppTab = "home" | "map" | "parking" | "visit" | "support";
export type HomeRoute = "kids" | "doctor" | "memory" | "colorStar" | "bubbles" | "catchStars";
export type ClinicStatus = "available" | "busy" | "away";
export type ScannerMode = "appointment" | "location";

export const C = {
  canvas: "#F4F8FC", surface: "#FFFFFF", blue: "#1E6FD9", blueLight: "#4FA3F7", navy: "#173865",
  ink: "#0F2A43", sub: "#5B6B7C", green: "#22A06B", greenSoft: "#3DAE7C", orange: "#F59E0B",
  red: "#E5484D", purple: "#8B5CF6", hairline: "#E3EBF4",
  kidYellow: "#FFD166", kidCoral: "#FF8A73", kidMint: "#6FD6B5", kidSky: "#7CC4FF", kidCream: "#FFF8EC",
} as const;
export const heroGradient = "linear-gradient(135deg, #1E6FD9 0%, #2F86EA 50%, #58AEF8 100%)";

export const CLINIC_STATUS: Record<ClinicStatus, { ar: string; en: string; color: string }> = {
  available: { ar: "متاحة", en: "Available", color: C.green },
  busy: { ar: "مشغولة", en: "Busy", color: C.orange },
  away: { ar: "غير متواجد", en: "Away", color: C.sub },
};

export const ROUTE_TYPES: { id: RouteType; ar: string; en: string; color: string }[] = [
  { id: "elderly", ar: "كبار السن", en: "Elderly", color: C.orange },
  { id: "pregnant", ar: "حوامل", en: "Pregnant", color: C.purple },
  { id: "urgent", ar: "مستعجل", en: "Urgent", color: C.green },
];
export const routeColor = (t: RouteType) => ROUTE_TYPES.find((r) => r.id === t)!.color;

export interface Appointment {
  ticket: string; patientAr: string; patientEn: string; doctorAr: string; doctorEn: string;
  clinicAr: string; clinicEn: string; clinicNodeID: string; room: string;
  /** ISO date string */
  date: string;
  medicationAr?: string; medicationEn?: string; ahead: number; minutes: number;
}

export function todayAt1020(): string {
  const d = new Date();
  d.setHours(10, 20, 0, 0);
  return d.toISOString();
}

export const sampleAppointment = (): Appointment => ({
  ticket: "A-2047",
  patientAr: "أحمد الشمري", patientEn: "Ahmed Al-Shammari",
  doctorAr: "د. سارة أحمد", doctorEn: "Dr. Sara Ahmed",
  clinicAr: "عيادة القلب", clinicEn: "Cardiology",
  clinicNodeID: "CLN-CARD-204", room: "204", date: todayAt1020(), ahead: 3, minutes: 15,
});

export function formatAppointmentTime(iso: string, lang: Lang): string {
  const date = new Date(iso);
  const loc = lang === "ar" ? "ar" : "en-US";
  const time = date.toLocaleTimeString(loc, { hour: "numeric", minute: "2-digit" });
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (same(date, today)) return lang === "ar" ? `اليوم ${time}` : `Today ${time}`;
  if (same(date, tomorrow)) return lang === "ar" ? `غداً ${time}` : `Tomorrow ${time}`;
  const day = date.toLocaleDateString(loc, { weekday: "long", day: "numeric", month: "short" });
  return `${day} · ${time}`;
}

export interface ParkedCar { bay: string; level: string; note: string; savedAt: string }
export interface Toast { id: number; ar: string; en: string; icon?: string; isDemo: boolean }
export interface HelpRequest { kindAr: string; kindEn: string; created: string }

function load<T>(key: string): T | undefined {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? undefined : (JSON.parse(raw) as T);
  } catch {
    return undefined;
  }
}
function save(key: string, value: unknown) {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch { /* storage blocked */ }
}

const K = {
  lang: "fc.lang", appointment: "fc.appointment", imported: "fc.appointmentImported",
  start: "fc.startID", parked: "fc.parkedCar", visitStep: "fc.visitStep",
};

interface Store {
  lang: Lang; setLang: (l: Lang) => void;
  t: (ar: string, en: string) => string;
  other: (ar: string, en: string) => string;
  tab: AppTab; setTab: (t: AppTab) => void;
  homePath: HomeRoute[]; pushHome: (r: HomeRoute) => void; popHome: () => void;
  scanner: ScannerMode | null; openScanner: (m: ScannerMode) => void; closeScanner: () => void;

  appointment: Appointment; setAppointment: (a: Appointment) => void;
  appointmentImported: boolean; setAppointmentImported: (b: boolean) => void;
  clinicStatus: ClinicStatus; setClinicStatus: (s: ClinicStatus) => void;

  map: MapDataset;
  startID: string; destinationID: string; routeType: RouteType;
  setRouteType: (t: RouteType) => void;
  start?: MapNode; destination?: MapNode; currentRoute: MapRoute | null;
  navigationRequestID: number;
  navigate: (id: string, route?: RouteType) => void;
  navigateRole: (role: PlaceRole, route?: RouteType) => void;
  setStart: (id: string) => void;

  parkedCar: ParkedCar | null; setParkedCar: (p: ParkedCar | null) => void;
  visitStep: number; setVisitStep: (n: number) => void;
  helpRequest: HelpRequest | null; setHelpRequest: (h: HelpRequest | null) => void;

  toast: Toast | null; showToast: (ar: string, en: string, opts?: { icon?: string; demo?: boolean }) => void; dismissToast: () => void;
}

const Ctx = createContext<Store | null>(null);

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const map = dataset;
  const [lang, setLangState] = useState<Lang>(() => load<Lang>(K.lang) ?? "ar");
  const [tab, setTabState] = useState<AppTab>("home");
  const [homePath, setHomePath] = useState<HomeRoute[]>([]);
  const [scanner, setScanner] = useState<ScannerMode | null>(null);

  const [appointment, setAppointmentState] = useState<Appointment>(() => {
    const a = load<Appointment>(K.appointment) ?? sampleAppointment();
    if (!findNode(map, a.clinicNodeID)) a.clinicNodeID = nodeIDFor(map, "cardiology") ?? a.clinicNodeID;
    return a;
  });
  const [appointmentImported, setImported] = useState<boolean>(() => load<boolean>(K.imported) ?? false);
  const [clinicStatus, setClinicStatus] = useState<ClinicStatus>("available");

  const [startID, setStartID] = useState<string>(() => {
    const s = load<string>(K.start);
    return s && findNode(map, s) ? s : map.defaultStart;
  });
  const [destinationID, setDestinationID] = useState<string>(
    () => nodeIDFor(map, "cardiology") ?? destinations(map)[0]?.id ?? map.defaultStart,
  );
  const [routeType, setRouteType] = useState<RouteType>("urgent");
  const [navigationRequestID, setNavReq] = useState(0);

  const [parkedCar, setParkedState] = useState<ParkedCar | null>(() => load<ParkedCar>(K.parked) ?? null);
  const [visitStep, setVisitState] = useState<number>(() => load<number>(K.visitStep) ?? 1);
  const [helpRequest, setHelpRequest] = useState<HelpRequest | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  const t = useCallback((ar: string, en: string) => (lang === "ar" ? ar : en), [lang]);
  const other = useCallback((ar: string, en: string) => (lang === "ar" ? en : ar), [lang]);

  const setLang = useCallback((l: Lang) => { setLangState(l); save(K.lang, l); }, []);
  const setTab = useCallback((x: AppTab) => setTabState(x), []);
  const setAppointment = useCallback((a: Appointment) => { setAppointmentState(a); save(K.appointment, a); }, []);
  const setAppointmentImported = useCallback((b: boolean) => { setImported(b); save(K.imported, b); }, []);
  const setParkedCar = useCallback((p: ParkedCar | null) => { setParkedState(p); save(K.parked, p); }, []);
  const setVisitStep = useCallback((n: number) => { setVisitState(n); save(K.visitStep, n); }, []);

  const showToast = useCallback((ar: string, en: string, opts?: { icon?: string; demo?: boolean }) => {
    const next: Toast = { id: Date.now() + Math.random(), ar, en, icon: opts?.icon, isDemo: opts?.demo ?? true };
    setToast(next);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast((cur) => (cur?.id === next.id ? null : cur)), 2800);
  }, []);
  const dismissToast = useCallback(() => setToast(null), []);

  const currentRoute = useMemo(() => computeRoute(map, startID, destinationID, routeType), [map, startID, destinationID, routeType]);

  const navigate = useCallback((id: string, r?: RouteType) => {
    if (!findNode(map, id)) {
      showToast("هذه الوجهة غير موجودة في بيانات الخريطة", "This place isn't in the map data", { icon: "alert" });
      return;
    }
    setDestinationID(id);
    if (r) setRouteType(r);
    setNavReq((n) => n + 1);
    setTabState("map");
    track("route_started", { screen: "map", routeType: r ?? routeType });
  }, [map, showToast, routeType]);

  const navigateRole = useCallback((role: PlaceRole, r?: RouteType) => {
    const id = nodeIDFor(map, role);
    if (!id) {
      showToast("هذه الوجهة غير مضافة في بيانات الخريطة", "This place isn't mapped yet", { icon: "alert" });
      return;
    }
    navigate(id, r);
  }, [map, navigate, showToast]);

  const setStart = useCallback((id: string) => {
    if (!findNode(map, id)) return;
    setStartID(id);
    save(K.start, id);
    setNavReq((n) => n + 1);
  }, [map]);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);

  const value: Store = {
    lang, setLang, t, other, tab, setTab,
    homePath, pushHome: (r) => setHomePath((p) => [...p, r]), popHome: () => setHomePath((p) => p.slice(0, -1)),
    scanner, openScanner: setScanner, closeScanner: () => setScanner(null),
    appointment, setAppointment, appointmentImported, setAppointmentImported, clinicStatus, setClinicStatus,
    map, startID, destinationID, routeType, setRouteType,
    start: findNode(map, startID), destination: findNode(map, destinationID), currentRoute, navigationRequestID,
    navigate, navigateRole, setStart,
    parkedCar, setParkedCar, visitStep, setVisitStep, helpRequest, setHelpRequest,
    toast, showToast, dismissToast,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp outside provider");
  return v;
}
