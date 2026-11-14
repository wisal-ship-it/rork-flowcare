import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import {
  Accessibility, ArrowDown, ArrowUp, ArrowUpDown, Baby, Car, Check, ChevronLeft, ChevronRight, CircleCheck, ClipboardPlus,
  CornerUpLeft, CornerUpRight, DoorOpen, Footprints, FlaskConical, HeartPulse, Info, LocateFixed, MapPin, Mic, Minus, MoveUp,
  Pill, Plus, Route as RouteIcon, ScanLine, ScanQrCode, Search, Stethoscope, Toilet, TriangleAlert, Volume2, VolumeX, Wrench,
  type LucideIcon,
} from "lucide-react";
import { C, ROUTE_TYPES, routeColor, useApp } from "@/lib/store";
import {
  destinations, findFloor, floorLabel, floorsTopDown, isOpen, nodeAr, nodeEn, polylines, routeFloors, routeMinutes,
  startPoints, transitions, unavailableElevators, type MapNode, type MapRoute, type RouteType, type StepIcon,
} from "@/lib/map";
import { MAP_STEP_KEY, guideText, speech, useActiveSpeechKey } from "@/lib/speech";
import { AppHeader, BiText, Card, DemoTag, Pressable, Screen, Sheet, SheetSection, TintButton, hexA } from "@/components/fc/ui";

const STEP_ICON: Record<StepIcon, LucideIcon> = {
  stairs: Footprints, up: ArrowUp, down: ArrowDown, forward: MoveUp, roll: Accessibility,
  right: CornerUpRight, left: CornerUpLeft, pin: MapPin,
};

function nodeIcon(n: MapNode): LucideIcon {
  const s = (n.symbol ?? "").toLowerCase();
  if (n.kind === "elevator") return isOpen(n) ? ArrowUpDown : Wrench;
  if (n.kind === "stairs") return Footprints;
  if (n.kind === "entrance") return DoorOpen;
  if (n.kind === "restroom") return Toilet;
  if (n.kind === "parking") return Car;
  if (n.kind === "kids") return Baby;
  if (s.includes("heart")) return HeartPulse;
  if (s.includes("flask") || s.includes("testtube") || n.id.includes("LAB")) return FlaskConical;
  if (s.includes("pill") || n.id.includes("PHARM")) return Pill;
  if (n.kind === "clinic") return Stethoscope;
  return ClipboardPlus;
}

const LANDMARK_KINDS = new Set(["elevator", "stairs", "restroom", "entrance", "parking"]);

export default function MapScreen() {
  const app = useApp();
  const activeKey = useActiveSpeechKey();
  const map = app.map;
  const route = app.currentRoute;
  const color = routeColor(app.routeType);

  const [step, setStep] = useState(0);
  const [viewFloor, setViewFloor] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [voiceOn, setVoiceOn] = useState(false);
  const [alertHidden, setAlertHidden] = useState(false);
  const [sheet, setSheet] = useState<null | "search" | "start" | "data">(null);

  const steps = route?.steps ?? [];
  const safeStep = Math.min(step, Math.max(0, steps.length - 1));
  const current = steps[safeStep];
  const floor = viewFloor ?? current?.floor ?? app.start?.floor ?? map.floors[0]?.id;
  const floorsOnRoute = useMemo(() => new Set(route ? routeFloors(route) : []), [route]);
  const brokenElevators = unavailableElevators(map);

  const voiceRef = useRef(voiceOn);
  voiceRef.current = voiceOn;

  const speakStep = (i: number) => {
    const s = steps[i];
    if (!s) return;
    speech.speak([app.t(s.ar, s.en)], app.lang, MAP_STEP_KEY, false);
  };
  const speakFullRoute = (r: MapRoute | null = route) => {
    if (!r || !app.destination) return;
    const dest = app.t(nodeAr(app.destination), nodeEn(app.destination));
    const summary = app.t(
      `إلى ${dest}. حوالي ${Math.round(r.meters)} متر، ${routeMinutes(r)} دقيقة.`,
      `To ${dest}. About ${Math.round(r.meters)} meters, ${routeMinutes(r)} minutes.`,
    );
    speech.speak([guideText("map", app.lang), summary, ...r.steps.map((s) => app.t(s.ar, s.en))], app.lang, MAP_STEP_KEY, false);
  };

  // A new navigation request (or a new route) restarts from step one.
  const routeKey = route ? `${route.nodes.map((n) => n.id).join(">")}|${app.routeType}` : "none";
  const firstRun = useRef(true);
  useEffect(() => {
    setStep(0);
    setViewFloor(null);
    if (firstRun.current) { firstRun.current = false; return; }
    if (voiceRef.current) speakFullRoute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app.navigationRequestID, routeKey]);

  useEffect(() => { speech.stop(MAP_STEP_KEY); setVoiceOn(false); }, [app.lang]);
  useEffect(() => () => speech.stop(MAP_STEP_KEY), []);
  useEffect(() => { if (activeKey !== MAP_STEP_KEY && voiceOn && !speech.supported) setVoiceOn(false); }, [activeKey, voiceOn]);

  const goStep = (i: number) => {
    setStep(i);
    setViewFloor(null);
    if (voiceOn) speakStep(i);
  };
  const next = () => {
    if (safeStep < steps.length - 1) {
      goStep(safeStep + 1);
      if (safeStep + 1 === steps.length - 1) app.showToast("وصلت إلى وجهتك", "You have arrived", { demo: false });
    } else goStep(0);
  };

  const toggleVoice = () => {
    if (voiceOn) {
      setVoiceOn(false);
      speech.stop(MAP_STEP_KEY);
      app.showToast("تم إيقاف الإرشاد الصوتي", "Voice guidance off", { demo: false });
    } else {
      setVoiceOn(true);
      app.showToast("الإرشاد الصوتي يعمل", "Voice guidance on", { demo: false });
      speakFullRoute();
    }
  };

  const chooseRoute = (t: RouteType) => {
    app.setRouteType(t);
    if (t === "elderly") {
      setVoiceOn(true);
      app.showToast("تم تفعيل الإرشاد الصوتي لكبار السن", "Voice guidance on for older adults", { demo: false });
      // A changed route type is announced by the route-change effect; same type speaks right away.
      if (app.routeType === "elderly") speakFullRoute();
    }
  };

  return (
    <Screen>
      <AppHeader />

      {/* Search */}
      <div className="flex items-center gap-2 rounded-[18px] border bg-white px-3.5" style={{ borderColor: C.hairline, minHeight: 52 }}>
        <Pressable onClick={() => setSheet("search")} className="flex flex-1 items-center gap-2.5 py-3" data-testid="map.search">
          <Search size={20} color={C.sub} />
          <span className="text-[16px]" style={{ color: C.sub }}>{app.t("ابحث عن عيادة أو خدمة", "Search for a clinic or service")}</span>
        </Pressable>
        <Pressable
          aria-label={app.t("بحث صوتي", "Voice search")}
          onClick={() => app.showToast("البحث الصوتي قريباً", "Voice search is coming soon")}
          className="flex h-9 w-9 items-center justify-center rounded-full"
          style={{ background: hexA(C.blue, 0.1) }}
        >
          <Mic size={18} color={C.blue} />
        </Pressable>
      </div>

      {brokenElevators.length > 0 && !alertHidden && (
        <div className="flex items-start gap-2.5 rounded-[18px] px-3.5 py-3" style={{ background: "#FFF4DE", color: "#8A4B00" }} data-testid="map.elevatorAlert">
          <TriangleAlert size={20} className="mt-0.5 shrink-0" />
          <div className="flex-1 text-[14px] font-semibold leading-snug">
            {app.t(
              `المصعد ${brokenElevators.map((e) => e.code ?? e.id).join("، ")} تحت الصيانة — المسارات تتجنبه تلقائياً`,
              `Elevator ${brokenElevators.map((e) => e.code ?? e.id).join(", ")} is under maintenance — routes avoid it`,
            )}
          </div>
          <Pressable onClick={() => setAlertHidden(true)} aria-label={app.t("إغلاق", "Dismiss")} className="text-[18px] font-bold leading-none">×</Pressable>
        </div>
      )}

      {/* Destination */}
      {app.destination && (
        <Card padding={14} className="!rounded-[22px]">
          <div data-testid="map.destinationCard" className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px]" style={{ background: hexA(C.blue, 0.12) }}>
              {(() => { const I = nodeIcon(app.destination); return <I size={24} color={C.blue} />; })()}
            </div>
            <div className="min-w-0 flex-1">
              <BiText ar={nodeAr(app.destination)} en={nodeEn(app.destination)} secondary="footnote" />
            </div>
            {route && (
              <div className="shrink-0 text-end">
                <div className="text-[20px] font-black leading-none" style={{ color: C.navy }}>{routeMinutes(route)}<span className="text-[13px] font-bold"> {app.t("د", "min")}</span></div>
                <div className="mt-1 text-[12px] font-semibold" style={{ color: C.sub }}>{Math.round(route.meters)} {app.t("م", "m")}</div>
              </div>
            )}
          </div>
          <div className="mt-3 flex items-center gap-2 border-t pt-3" style={{ borderColor: C.hairline }}>
            <LocateFixed size={16} color={C.green} />
            <div className="min-w-0 flex-1 truncate text-[14px]" style={{ color: C.ink }} data-testid="map.fromLabel">
              <span style={{ color: C.sub }}>{app.t("من: ", "From: ")}</span>
              <span className="font-semibold">{app.start ? app.t(nodeAr(app.start), nodeEn(app.start)) : "—"}</span>
              {app.start && (() => { const f = findFloor(map, app.start.floor); return f ? <span style={{ color: C.sub }}> · {app.t(f.nameAr, f.nameEn)}</span> : null; })()}
            </div>
            <TintButton onClick={() => setSheet("start")} testId="map.changeStart">{app.t("تغيير", "Change")}</TintButton>
            <TintButton onClick={() => app.openScanner("location")} testId="map.scanStart" label={app.t("امسح رمز الموقع", "Scan location code")}>
              <ScanQrCode size={16} />
            </TintButton>
          </div>
        </Card>
      )}

      {/* Map */}
      <MapCanvas
        route={route}
        floor={floor}
        zoom={zoom}
        color={color}
        navKey={`${app.navigationRequestID}-${routeKey}-${floor}`}
        controls={
          <>
            <Pressable
              onClick={() => setSheet("data")}
              data-testid="map.dataBadge"
              className="absolute start-3 top-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-black"
              style={{ background: map.isDemo ? "#FFF1D6" : hexA(C.green, 0.14), color: map.isDemo ? "#B45309" : C.green }}
            >
              <Info size={13} /> {map.isDemo ? app.t("خريطة تجريبية", "Demo map") : app.t("خريطة معتمدة", "Approved map")}
            </Pressable>
            <div className="absolute end-3 top-3 flex flex-col gap-1.5">
              {floorsTopDown(map).map((f) => {
                const sel = f.id === floor;
                return (
                  <Pressable
                    key={f.id}
                    data-testid={`map.floor.${f.id}`}
                    aria-label={app.t(f.nameAr, f.nameEn)}
                    onClick={() => setViewFloor(f.id)}
                    className="relative flex h-10 w-10 items-center justify-center rounded-[12px] text-[15px] font-black shadow-sm"
                    style={{ background: sel ? C.navy : "rgba(255,255,255,0.95)", color: sel ? "#fff" : C.navy }}
                  >
                    {floorLabel(f)}
                    {floorsOnRoute.has(f.id) && <span className="absolute -end-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white" style={{ background: color }} />}
                  </Pressable>
                );
              })}
            </div>
            <div className="absolute bottom-3 start-3 flex flex-col overflow-hidden rounded-[12px] bg-white/95 shadow-sm">
              <Pressable aria-label={app.t("تكبير", "Zoom in")} onClick={() => setZoom((z) => Math.min(2, +(z + 0.25).toFixed(2)))} className="flex h-10 w-10 items-center justify-center">
                <Plus size={18} color={C.navy} />
              </Pressable>
              <div className="h-px" style={{ background: C.hairline }} />
              <Pressable aria-label={app.t("تصغير", "Zoom out")} onClick={() => setZoom((z) => Math.max(1, +(z - 0.25).toFixed(2)))} className="flex h-10 w-10 items-center justify-center">
                <Minus size={18} color={C.navy} />
              </Pressable>
            </div>
            <Pressable
              data-testid="map.voiceButton"
              aria-label={app.t("الإرشاد الصوتي", "Voice guidance")}
              aria-pressed={voiceOn}
              onClick={toggleVoice}
              className="absolute bottom-3 end-3 flex items-center justify-center rounded-full shadow-lg"
              style={{ width: 70, height: 70, background: voiceOn ? C.green : C.blue, boxShadow: `0 10px 24px ${hexA(voiceOn ? C.green : C.blue, 0.35)}` }}
            >
              {voiceOn ? <Volume2 size={30} color="#fff" className={activeKey === MAP_STEP_KEY ? "fc-throb" : undefined} /> : <VolumeX size={30} color="#fff" />}
            </Pressable>
          </>
        }
      />

      {/* Route types */}
      <div className="flex gap-2">
        {ROUTE_TYPES.map((r) => {
          const sel = r.id === app.routeType;
          return (
            <Pressable
              key={r.id}
              data-testid={`map.route.${r.id}`}
              aria-pressed={sel}
              onClick={() => chooseRoute(r.id)}
              className="flex flex-1 flex-col items-center gap-0.5 rounded-[16px] border-2 px-1.5 py-2.5 text-center"
              style={{ background: sel ? hexA(C.green, 0.1) : "#fff", borderColor: sel ? C.green : C.hairline }}
            >
              <span className="h-2 w-8 rounded-full" style={{ background: r.color }} />
              <span className="mt-1 text-[14px] font-bold leading-tight" style={{ color: C.ink }}>{app.t(r.ar, r.en)}</span>
              <span className="text-[11px] leading-tight" style={{ color: C.sub }}>{app.other(r.ar, r.en)}</span>
            </Pressable>
          );
        })}
      </div>

      {/* Step card */}
      <Card padding={16}>
        {current ? (
          <>
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[16px]" style={{ background: color }}>
                {(() => { const I = STEP_ICON[current.symbol]; return <I size={28} color="#fff" />; })()}
              </div>
              <div className="min-w-0 flex-1">
                <div data-testid="map.stepText" className="text-[19px] font-bold leading-snug" style={{ color: C.ink }}>{app.t(current.ar, current.en)}</div>
                <div className="mt-0.5 text-[13px]" style={{ color: C.sub }}>{app.other(current.ar, current.en)}</div>
              </div>
            </div>
            <div className="mt-3.5 flex items-center gap-2">
              <Pressable
                data-testid="map.prevStep"
                disabled={safeStep === 0}
                onClick={() => goStep(safeStep - 1)}
                aria-label={app.t("الخطوة السابقة", "Previous step")}
                className="flex h-12 w-12 items-center justify-center rounded-[16px]"
                style={{ background: hexA(C.blue, 0.1) }}
              >
                {app.lang === "ar" ? <ChevronRight size={22} color={C.blue} /> : <ChevronLeft size={22} color={C.blue} />}
              </Pressable>
              <div className="flex-1 text-center text-[14px] font-bold" style={{ color: C.sub }} data-testid="map.stepCounter">
                {app.t(`الخطوة ${safeStep + 1} من ${steps.length}`, `Step ${safeStep + 1} of ${steps.length}`)}
              </div>
              <Pressable
                data-testid="map.nextStep"
                onClick={next}
                className="flex h-12 min-w-[112px] items-center justify-center gap-1 rounded-[16px] px-4 text-[16px] font-bold text-white"
                style={{ background: C.blue }}
              >
                {safeStep < steps.length - 1 ? app.t("التالي", "Next") : app.t("إعادة", "Restart")}
                {safeStep < steps.length - 1 && (app.lang === "ar" ? <ChevronLeft size={20} /> : <ChevronRight size={20} />)}
              </Pressable>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-3" data-testid="map.noRoute">
            <RouteIcon size={26} color={C.orange} />
            <BiText
              ar="لا يوجد مسار مناسب لهذا النوع — جرّب مساراً آخر"
              en="No suitable route for this type — try another"
              primary="subheadline" secondary="footnote"
            />
          </div>
        )}
      </Card>

      <SearchSheet open={sheet === "search"} onClose={() => setSheet(null)} />
      <StartSheet open={sheet === "start"} onClose={() => setSheet(null)} />
      <MapDataSheet open={sheet === "data"} onClose={() => setSheet(null)} />
    </Screen>
  );
}

// MARK: Canvas

function MapCanvas({ route, floor, zoom, color, navKey, controls }: {
  route: MapRoute | null; floor: string; zoom: number; color: string; navKey: string; controls: React.ReactNode;
}) {
  const app = useApp();
  const map = app.map;
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 360, h: 400 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const f = findFloor(map, floor);
  const W = size.w, H = size.h;
  const px = (x: number) => x * W;
  const py = (y: number) => y * H;

  const lines = route ? polylines(route, floor) : [];
  const trans = route ? transitions(route, floor) : [];
  const start = app.start, dest = app.destination;
  const broken = new Set(map.nodes.filter((n) => n.kind === "elevator" && !isOpen(n)).map((n) => n.id));
  const landmarks = map.nodes.filter((n) => n.floor === floor && LANDMARK_KINDS.has(n.kind) && n.id !== start?.id && n.id !== dest?.id);

  const anchor = start?.floor === floor ? start : dest?.floor === floor ? dest : undefined;
  const origin = anchor ? `${anchor.x * 100}% ${anchor.y * 100}%` : "50% 50%";

  // Where does this floor's run of the route lead next?
  const nextFloorFrom = (n: MapNode) => {
    if (!route) return undefined;
    const idx = route.nodes.findIndex((x) => x.id === n.id);
    if (idx < 0) return undefined;
    let last: string | undefined;
    for (let i = idx + 1; i < route.nodes.length; i++) {
      const fl = route.nodes[i].floor;
      if (fl === floor && last === undefined) continue;
      if (fl === floor) break;
      last = fl;
      if (!route.legs[i]?.vertical) break;
    }
    return last;
  };

  return (
    <div className="relative overflow-hidden rounded-[22px] border" style={{ height: 400, background: "#EEF3F8", borderColor: C.hairline }} dir="ltr" data-testid="map.canvas">
      <div ref={ref} className="absolute inset-0 transition-transform duration-300 ease-out" style={{ transform: `scale(${zoom})`, transformOrigin: origin }}>
        <svg width={W} height={H} className="absolute inset-0" aria-hidden>
          <defs>
            <pattern id="fc-grid" width={22} height={22} patternUnits="userSpaceOnUse">
              <path d="M22 0H0V22" fill="none" stroke="#DDE6F0" strokeWidth={1} opacity={0.6} />
            </pattern>
          </defs>
          <rect width={W} height={H} fill="url(#fc-grid)" />
          {f && (
            <text x={W / 2} y={H / 2} textAnchor="middle" dominantBaseline="central" fontSize={Math.min(W, H) * 0.55} fontWeight={900} fill={C.navy} opacity={0.06}>
              {floorLabel(f)}
            </text>
          )}
          {f?.rooms?.map((r, i) => (
            <rect key={i} x={px(r.x)} y={py(r.y)} width={r.w * W} height={r.h * H} rx={8} fill="#DFE7F1" stroke="#C9D5E3" strokeWidth={1} />
          ))}
          {dest && dest.floor === floor && (
            <rect x={px(dest.x) - 35} y={py(dest.y) - 25} width={70} height={50} rx={12} fill={hexA(C.blue, 0.15)} />
          )}
          <g key={navKey}>
            {lines.map((pts, i) => {
              const p = pts.map((q) => `${px(q.x)},${py(q.y)}`).join(" ");
              return (
                <g key={i}>
                  <polyline points={p} fill="none" stroke={hexA(color, 0.25)} strokeWidth={18} strokeLinecap="round" strokeLinejoin="round" />
                  <polyline points={p} fill="none" stroke={color} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray="1 1" className="fc-draw" />
                  {pts.slice(1).map((b, k) => {
                    const a = pts[k];
                    const dx = px(b.x) - px(a.x), dy = py(b.y) - py(a.y);
                    if (Math.hypot(dx, dy) < 40) return null;
                    const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
                    const mx = (px(a.x) + px(b.x)) / 2, my = (py(a.y) + py(b.y)) / 2;
                    return <path key={k} d="M-3.5,-4 L3,0 L-3.5,4" fill="none" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" transform={`translate(${mx},${my}) rotate(${ang})`} />;
                  })}
                </g>
              );
            })}
          </g>
        </svg>

        {/* Landmarks */}
        {landmarks.map((n) => {
          const I = nodeIcon(n);
          const isBroken = broken.has(n.id);
          const tint = n.kind === "elevator" ? (isBroken ? C.orange : C.green) : C.sub;
          return (
            <div key={n.id} className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center" style={{ left: px(n.x), top: py(n.y) }} title={app.t(nodeAr(n), nodeEn(n))}>
              <div className="flex h-7 w-7 items-center justify-center rounded-full border bg-white shadow-sm" style={{ borderColor: hexA(tint, 0.4) }}>
                <I size={15} color={tint} strokeWidth={2.4} />
              </div>
              {(n.kind === "elevator" || n.kind === "entrance") && n.code && (
                <span className="mt-0.5 rounded px-1 text-[9px] font-black leading-tight" style={{ background: "rgba(255,255,255,0.85)", color: isBroken ? C.orange : C.navy }}>{n.code}</span>
              )}
            </div>
          );
        })}

        {/* Floor change badges */}
        {trans.map((n) => {
          const to = nextFloorFrom(n);
          const tf = to ? findFloor(map, to) : undefined;
          return (
            <div key={`t-${n.id}`} className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center" style={{ left: px(n.x), top: py(n.y) }}>
              <div className="flex h-9 w-9 items-center justify-center rounded-full border-[3px] border-white shadow" style={{ background: color }}>
                {(() => { const I = n.kind === "stairs" ? Footprints : ArrowUpDown; return <I size={17} color="#fff" strokeWidth={2.6} />; })()}
              </div>
              {tf && <span className="mt-0.5 whitespace-nowrap rounded-full px-1.5 py-0.5 text-[10px] font-black text-white" style={{ background: C.navy }}>→ {floorLabel(tf)}</span>}
            </div>
          );
        })}

        {/* Destination pin */}
        {dest && dest.floor === floor && (
          <div className="absolute flex -translate-x-1/2 flex-col items-center" style={{ left: px(dest.x), top: py(dest.y) - 40 }}>
            <div className="flex h-10 w-10 items-center justify-center rounded-full rounded-bl-none border-[3px] border-white shadow-md" style={{ background: C.blue, transform: "rotate(-45deg)" }}>
              <MapPin size={18} color="#fff" style={{ transform: "rotate(45deg)" }} />
            </div>
            {dest.code && <span className="mt-1 rounded-full bg-white px-1.5 py-0.5 text-[10px] font-black shadow-sm" style={{ color: C.blue }}>{dest.code}</span>}
          </div>
        )}

        {/* You are here */}
        {start && start.floor === floor && (
          <div className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center" style={{ left: px(start.x), top: py(start.y) }} data-testid="map.youAreHere">
            <div className="relative flex h-6 w-6 items-center justify-center">
              <span className="fc-pulse absolute -inset-3 rounded-full" style={{ background: hexA(C.green, 0.35) }} />
              <span className="relative h-4 w-4 rounded-full border-[3px] border-white shadow" style={{ background: C.green }} />
            </div>
            <span className="mt-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-black text-white" style={{ background: C.green }}>
              {app.t("أنت هنا", "You are here")}
            </span>
          </div>
        )}
      </div>
      {controls}
    </div>
  );
}

// MARK: Sheets

function SearchSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const app = useApp();
  const [q, setQ] = useState("");
  useEffect(() => { if (!open) setQ(""); }, [open]);
  const list = destinations(app.map).filter((n) => {
    const s = q.trim().toLowerCase();
    return !s || nodeAr(n).includes(s) || nodeEn(n).toLowerCase().includes(s) || (n.code ?? "").toLowerCase().includes(s);
  });
  return (
    <Sheet open={open} onClose={onClose} titleAr="إلى أين؟" titleEn="Where to?" tall testId="sheet.search">
      <div className="mb-3 flex items-center gap-2 rounded-[12px] bg-white px-3" style={{ minHeight: 44 }}>
        <Search size={18} color={C.sub} />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={app.t("عيادة، خدمة أو رمز", "Clinic, service or code")}
          className="flex-1 bg-transparent py-2.5 text-[17px] outline-none"
          style={{ color: C.ink }}
          data-testid="search.input"
        />
      </div>
      <SheetSection>
        {list.map((n) => {
          const I = nodeIcon(n);
          const f = findFloor(app.map, n.floor);
          return (
            <Pressable
              key={n.id}
              data-testid={`dest.${n.id}`}
              onClick={() => { onClose(); app.navigate(n.id); }}
              className="flex w-full items-center gap-3 px-4 py-3"
              style={{ borderColor: C.hairline }}
            >
              <I size={20} color={C.blue} />
              <div className="min-w-0 flex-1"><BiText ar={nodeAr(n)} en={nodeEn(n)} primary="body" secondary="footnote" /></div>
              <span className="text-[13px] font-semibold" style={{ color: C.sub }}>{f ? floorLabel(f) : ""}{n.code ? ` · ${n.code}` : ""}</span>
            </Pressable>
          );
        })}
        {!list.length && <div className="px-4 py-6 text-center text-[15px]" style={{ color: C.sub }}>{app.t("لا توجد نتائج", "No results")}</div>}
      </SheetSection>
    </Sheet>
  );
}

function StartSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const app = useApp();
  const points = startPoints(app.map);
  return (
    <Sheet open={open} onClose={onClose} titleAr="نقطة البداية" titleEn="Starting point" tall testId="sheet.start">
      <SheetSection>
        <Pressable
          data-testid="start.scan"
          onClick={() => { onClose(); app.openScanner("location"); }}
          className="flex w-full items-center gap-3 px-4 py-3.5"
        >
          <ScanLine size={20} color={C.blue} />
          <span className="flex-1 text-[17px] font-semibold" style={{ color: C.blue }}>{app.t("امسح رمز QR القريب منك", "Scan the nearest QR code")}</span>
        </Pressable>
      </SheetSection>
      {floorsTopDown(app.map).map((f) => {
        const rows = points.filter((p) => p.floor === f.id);
        if (!rows.length) return null;
        return (
          <SheetSection key={f.id} title={app.t(f.nameAr, f.nameEn)}>
            {rows.map((n) => {
              const I = nodeIcon(n);
              const sel = n.id === app.startID;
              return (
                <Pressable
                  key={n.id}
                  data-testid={`start.${n.id}`}
                  onClick={() => {
                    app.setStart(n.id);
                    onClose();
                    app.showToast(`نقطة البداية: ${nodeAr(n)}`, `Starting from: ${nodeEn(n)}`, { demo: false });
                  }}
                  className="flex w-full items-center gap-3 px-4 py-3"
                >
                  <I size={20} color={C.sub} />
                  <div className="min-w-0 flex-1"><BiText ar={nodeAr(n)} en={nodeEn(n)} primary="body" secondary="footnote" /></div>
                  {sel && <Check size={20} color={C.blue} strokeWidth={3} />}
                </Pressable>
              );
            })}
          </SheetSection>
        );
      })}
    </Sheet>
  );
}

function MapDataSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const app = useApp();
  const map = app.map;
  const qrNodes = map.nodes.filter((n) => n.qr);
  const [codes, setCodes] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!open) return;
    let alive = true;
    Promise.all(qrNodes.map(async (n) => [n.id, await QRCode.toDataURL(n.qr!, { margin: 1, width: 180, color: { dark: "#173865" } })] as const))
      .then((pairs) => alive && setCodes(Object.fromEntries(pairs)))
      .catch(() => undefined);
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const row = (labelAr: string, labelEn: string, value: React.ReactNode) => (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="flex-1 text-[16px]" style={{ color: C.ink }}>{app.t(labelAr, labelEn)}</span>
      <span className="text-[15px] font-semibold" style={{ color: C.sub }}>{value}</span>
    </div>
  );

  return (
    <Sheet open={open} onClose={onClose} titleAr="بيانات الخريطة" titleEn="Map data" tall testId="sheet.mapData">
      <SheetSection
        footer={app.t(
          "هذه خريطة تجريبية لأغراض العرض فقط، وليست خريطة المستشفى المعتمدة.",
          "This is a demo map for presentation only — not the approved hospital map.",
        )}
      >
        <div className="flex items-center gap-2 px-4 py-3">
          <div className="min-w-0 flex-1"><BiText ar={map.nameAr} en={map.nameEn} primary="body" secondary="footnote" /></div>
          {map.isDemo && <DemoTag />}
        </div>
        {row("الإصدار", "Version", map.version ?? "—")}
        {row("المصدر", "Source", app.t("مضمّن في التطبيق", "Built in"))}
        {row("الأدوار", "Floors", map.floors.length)}
        {row("الوجهات", "Destinations", destinations(map).length)}
        {row("النقاط", "Points", map.nodes.length)}
        {row("الممرات", "Paths", map.edges.length)}
      </SheetSection>
      <SheetSection
        title={app.t("رموز QR للمواقع", "Location QR codes")}
        footer={app.t("اطبع هذه الرموز وضعها عند كل نقطة ليمسحها الزوار.", "Print these and place them at each point for visitors to scan.")}
      >
        <div className="grid grid-cols-2 gap-3 p-3">
          {qrNodes.map((n) => (
            <div key={n.id} className="flex flex-col items-center gap-1 rounded-[12px] border p-2 text-center" style={{ borderColor: C.hairline }}>
              {codes[n.id] ? <img src={codes[n.id]} alt={n.qr} className="h-[120px] w-[120px]" /> : <div className="h-[120px] w-[120px] rounded bg-slate-100" />}
              <span className="text-[13px] font-bold leading-tight" style={{ color: C.ink }}>{app.t(nodeAr(n), nodeEn(n))}</span>
              <span className="text-[11px]" style={{ color: C.sub }}>{n.qr}</span>
            </div>
          ))}
        </div>
      </SheetSection>
      <div className="flex items-center justify-center gap-1.5 pb-2 text-[12px]" style={{ color: C.sub }}>
        <CircleCheck size={14} color={C.green} /> {app.t("المسارات تتجنب المصاعد المعطلة تلقائياً", "Routes avoid elevators under maintenance")}
      </div>
    </Sheet>
  );
}
