import { useEffect, useRef, useState } from "react";
import { ArrowRight, Car, CarFront, ChevronLeft, ChevronRight, CircleParking, Accessibility, MapPin, NotebookText, SquarePen, Trash2 } from "lucide-react";
import { C, useApp, type Lang } from "@/lib/store";
import { ActionSheet, AppHeader, BiText, Card, IconBadge, PrimaryButton, Pressable, Screen, Sheet, TintButton, hexA } from "@/components/fc/ui";

type BayState = "free" | "occupied" | "reserved" | "mine";
interface Bay { id: string; state: BayState }

const INITIAL: Bay[] = [
  { id: "A-01", state: "free" }, { id: "A-02", state: "occupied" },
  { id: "A-03", state: "occupied" }, { id: "A-04", state: "free" },
  { id: "A-09", state: "occupied" }, { id: "A-11", state: "free" },
  { id: "A-12", state: "free" }, { id: "A-14", state: "reserved" },
];

export function relativeTime(iso: string, lang: Lang) {
  const diff = (new Date(iso).getTime() - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(lang === "ar" ? "ar" : "en", { numeric: "auto" });
  const abs = Math.abs(diff);
  if (abs < 60) return rtf.format(Math.round(diff), "second");
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  return rtf.format(Math.round(diff / 86400), "day");
}

export default function ParkingScreen() {
  const app = useApp();
  const [lot, setLot] = useState<Bay[]>(INITIAL);
  const [freeCount, setFreeCount] = useState(18);
  const [selected, setSelected] = useState<Bay | null>(null);
  const [showWhere, setShowWhere] = useState(false);
  const [, tick] = useState(0);

  const myBay = app.parkedCar?.bay ?? "A-12";
  const myBayRef = useRef(myBay);
  myBayRef.current = myBay;
  const display = (b: Bay): Bay => (b.id === myBay ? { ...b, state: "mine" } : b);

  // Demo-only: bays change every few seconds to show how live sensor data would look.
  useEffect(() => {
    const id = window.setInterval(() => {
      setLot((cur) => {
        const candidates = cur.map((b, i) => ({ b, i })).filter(({ b }) => (b.state === "free" || b.state === "occupied") && b.id !== myBayRef.current);
        if (!candidates.length) return cur;
        const { i } = candidates[Math.floor(Math.random() * candidates.length)];
        const nowFree = cur[i].state === "occupied";
        setFreeCount((f) => Math.min(Math.max(f + (nowFree ? 1 : -1), 6), 30));
        return cur.map((b, k) => (k === i ? { ...b, state: nowFree ? "free" : "occupied" } : b));
      });
      tick((n) => n + 1);
    }, 5000);
    return () => window.clearInterval(id);
  }, []);

  const park = (bay: string) => {
    app.setParkedCar({ bay, level: app.parkedCar?.level ?? "1", note: app.parkedCar?.note ?? "", savedAt: new Date().toISOString() });
    app.showToast(`تم حفظ موقع سيارتك: ${bay}`, `Car location saved: ${bay}`, { demo: false });
  };

  const stateText = (s: BayState) => ({
    free: app.t("هذا الموقف شاغر", "This bay is free"),
    occupied: app.t("هذا الموقف مشغول", "This bay is occupied"),
    reserved: app.t("محجوز لذوي الاحتياجات الخاصة", "Reserved for accessible parking"),
    mine: app.t("هذا موقفك", "This is your spot"),
  })[s];

  const level = app.parkedCar?.level ?? "1";
  const Chevron = app.lang === "ar" ? ChevronLeft : ChevronRight;

  return (
    <Screen>
      <AppHeader guide="parking" />

      <Card padding={14}>
        <div className="flex items-center justify-between">
          {([[C.green, "شاغر", "Free"], [C.red, "مشغول", "Occupied"], [C.blue, "محجوز", "Reserved"], [C.orange, "موقفك", "Yours"]] as const).map(([c, ar, en]) => (
            <div key={en} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: c }} />
              <span className="text-[12px] font-semibold" style={{ color: C.ink }}>{app.t(ar, en)}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Lot panel */}
      <div className="flex flex-col gap-3.5 rounded-[26px] p-[18px]" style={{ background: C.navy, boxShadow: `0 8px 16px ${hexA(C.navy, 0.25)}` }}>
        <div className="flex items-start justify-between gap-2">
          <BiText ar="المواقف الذكية" en="Smart Parking" primary="title2" secondary="subheadline" primaryColor="#fff" secondaryColor="rgba(255,255,255,0.7)" />
          <div className="flex flex-col items-end gap-1">
            <span key={freeCount} className="fc-fade rounded-full px-2.5 py-1.5 text-[12px] font-bold tabular-nums text-white" style={{ background: "rgba(255,255,255,0.14)" }}>
              {app.t(`شاغر ${freeCount} من 40`, `${freeCount} free of 40`)}
            </span>
            <span className="flex items-center gap-1 text-[11px] font-bold" style={{ color: "rgba(255,255,255,0.75)" }}>
              <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: C.green }} />
              {app.t("مباشر · تجريبي", "Live · Demo")}
            </span>
          </div>
        </div>
        <div dir="ltr" className="flex flex-col gap-3.5">
          <BayRow bays={lot.slice(0, 4).map(display)} onPick={setSelected} />
          <div className="flex items-center">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex flex-1 items-center">
                <div className="h-0.5 flex-1" style={{ background: "rgba(255,255,255,0.25)" }} />
                <ArrowRight size={18} className="mx-2" color="rgba(255,255,255,0.6)" strokeWidth={2.6} />
              </div>
            ))}
            <div className="h-0.5 flex-1" style={{ background: "rgba(255,255,255,0.25)" }} />
          </div>
          <BayRow bays={lot.slice(4).map(display)} onPick={setSelected} />
        </div>
      </div>

      <Card>
        <div className="flex items-center gap-3.5">
          <IconBadge icon={Car} size={58} />
          <div className="flex flex-col gap-1">
            <BiText ar={app.parkedCar ? "موقف سيارتك" : "موقفك المخصص"} en={app.parkedCar ? "Your Car" : "Your Spot"} primary="subheadline" primaryClass="font-semibold" secondary="caption" />
            <span className="text-[22px] font-black" style={{ color: C.navy }} data-testid="parking.mySpot">{app.t(`موقف ${myBay}`, `Spot ${myBay}`)}</span>
            <span className="text-[12px]" style={{ color: C.sub }}>{app.t(`المستوى ${level} · بوابة المواقف A`, `Level ${level} · Parking Gate A`)}</span>
          </div>
        </div>
      </Card>

      <PrimaryButton ar="التوجيه إلى الموقف" en="Navigate to Spot" onClick={() => app.navigateRole("parking")} testId="parking.navigate" />

      <Card>
        <div className="flex flex-col gap-3">
          <Pressable onClick={() => setShowWhere(true)} data-testid="parking.whereParked" className="flex w-full items-center gap-3.5">
            <IconBadge icon={CarFront} color={C.green} size={52} />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <BiText ar="أين أوقفت سيارتي؟" en="Where Did I Park?" />
              {app.parkedCar && (
                <span className="text-[12px] font-semibold" style={{ color: C.green }} data-testid="parking.savedLabel">
                  {app.t(`${app.parkedCar.bay} · محفوظ `, `${app.parkedCar.bay} · Saved `)}{relativeTime(app.parkedCar.savedAt, app.lang)}
                </span>
              )}
            </div>
            <Chevron size={18} color={C.sub} />
          </Pressable>
          <Pressable onClick={() => park(myBay)} data-testid="parking.save" className="w-full rounded-2xl py-3" style={{ background: hexA(C.blue, 0.1) }}>
            <BiText ar="حفظ الموقع" en="Save Location" primary="headline" secondary="caption" primaryColor={C.blue} center />
          </Pressable>
        </div>
      </Card>

      <ActionSheet
        open={selected != null}
        onClose={() => setSelected(null)}
        title={selected ? app.t(`موقف ${selected.id}`, `Bay ${selected.id}`) : ""}
        message={selected ? stateText(selected.state) : undefined}
        actions={[
          ...(selected && (selected.state === "free" || selected.state === "mine")
            ? [{ label: app.t("أوقفت سيارتي هنا", "I parked here"), onClick: () => park(selected.id), testId: "bay.parkHere" }]
            : []),
          { label: app.t("وجّهني إلى المواقف", "Guide me to parking"), onClick: () => app.navigateRole("parking") },
        ]}
      />

      <WhereParkedSheet open={showWhere} onClose={() => setShowWhere(false)} suggestedBay={myBay} />
    </Screen>
  );
}

function BayRow({ bays, onPick }: { bays: Bay[]; onPick: (b: Bay) => void }) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {bays.map((bay) => {
        const bg = bay.state === "occupied" ? C.red : bay.state === "reserved" ? C.blue : bay.state === "mine" ? C.orange : hexA(C.green, 0.85);
        const Icon = bay.state === "reserved" ? Accessibility : bay.state === "free" ? CircleParking : Car;
        return (
          <Pressable
            key={bay.id}
            onClick={() => onPick(bay)}
            data-testid={`bay.${bay.id}`}
            aria-label={bay.id}
            className="flex h-[74px] flex-col items-center justify-center gap-1 rounded-[14px] transition-[background-color,transform] duration-400"
            style={{
              background: bg, color: bay.state === "free" ? "rgba(255,255,255,0.75)" : "#fff",
              boxShadow: bay.state === "mine" ? "inset 0 0 0 3px #fff" : undefined,
              transform: bay.state === "mine" ? "scale(1.04)" : undefined,
            }}
          >
            <Icon size={19} strokeWidth={2.4} />
            <span className="text-[13px] font-black">{bay.id}</span>
          </Pressable>
        );
      })}
    </div>
  );
}

function WhereParkedSheet({ open, onClose, suggestedBay }: { open: boolean; onClose: () => void; suggestedBay: string }) {
  const app = useApp();
  const [bay, setBay] = useState("");
  const [level, setLevel] = useState("1");
  const [note, setNote] = useState("");
  const [editing, setEditing] = useState(false);
  const car = app.parkedCar;

  const load = () => {
    setBay(app.parkedCar?.bay ?? suggestedBay);
    setLevel(app.parkedCar?.level ?? "1");
    setNote(app.parkedCar?.note ?? "");
  };
  useEffect(() => {
    if (open) { load(); setEditing(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const inputCls = "w-full rounded-xl px-3 py-3 text-[17px] outline-none focus:ring-2";
  return (
    <Sheet open={open} onClose={onClose} titleAr="أين أوقفت سيارتي؟" titleEn="Where Did I Park?" tall>
      <div className="flex flex-col items-center gap-[18px] rounded-[22px] bg-white p-6">
        <CarFront key={car?.savedAt ?? "none"} size={64} className="fc-bounce" color={C.green} />
        {car && !editing ? (
          <div className="flex w-full flex-col items-center gap-3.5">
            <BiText testId="whereParked.summary" ar={`سيارتك في الموقف ${car.bay}، المستوى ${car.level}`} en={`Your car is at ${car.bay}, Level ${car.level}`} primary="title3" secondary="subheadline" center />
            {car.note && (
              <div className="flex w-full items-center gap-2 rounded-[14px] p-3 text-[15px]" style={{ background: C.canvas, color: C.ink }}>
                <NotebookText size={16} color={C.blue} /> {car.note}
              </div>
            )}
            <span className="text-[17px] font-semibold tabular-nums" style={{ color: C.sub }}>
              {new Date(car.savedAt).toLocaleString(app.lang === "ar" ? "ar" : "en-US", { dateStyle: "medium", timeStyle: "short" })}
            </span>
            <PrimaryButton ar="خذني إلى سيارتي" en="Take me to my car" color={C.green} testId="whereParked.go" onClick={() => { onClose(); app.navigateRole("parking"); }} />
            <div className="flex w-full gap-2">
              <TintButton className="flex-1" onClick={() => { load(); setEditing(true); }}><SquarePen size={15} />{app.t("تعديل", "Edit")}</TintButton>
              <TintButton className="flex-1" color={C.red} testId="whereParked.clear" onClick={() => {
                app.setParkedCar(null);
                setBay(suggestedBay); setLevel("1"); setNote("");
                app.showToast("تم مسح موقع السيارة", "Car location cleared", { demo: false });
              }}><Trash2 size={15} />{app.t("مسح", "Clear")}</TintButton>
            </div>
          </div>
        ) : (
          <div className="flex w-full flex-col gap-3.5">
            <BiText ar={car ? "تعديل موقع السيارة" : "لم تحفظ موقع سيارتك بعد"} en={car ? "Edit car location" : "You haven't saved your car location yet"} primary="title3" secondary="subheadline" center className="w-full" />
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-semibold" style={{ color: C.sub }}>{app.t("رقم الموقف", "Bay number")}</span>
              <input dir="ltr" data-testid="whereParked.bay" value={bay} onChange={(e) => setBay(e.target.value.toUpperCase())} placeholder="A-12" autoCapitalize="characters" autoCorrect="off" className={inputCls} style={{ background: C.canvas, color: C.ink }} />
            </label>
            <div className="flex flex-col gap-1.5">
              <span className="text-[12px] font-semibold" style={{ color: C.sub }}>{app.t("المستوى", "Level")}</span>
              <Segmented options={["B1", "1", "2"].map((l) => ({ id: l, label: l }))} value={level} onChange={setLevel} />
            </div>
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-semibold" style={{ color: C.sub }}>{app.t("ملاحظة (اختياري)", "Note (optional)")}</span>
              <input data-testid="whereParked.note" value={note} onChange={(e) => setNote(e.target.value)} placeholder={app.t("مثال: بجانب العمود الأزرق", "e.g. next to the blue pillar")} className={inputCls} style={{ background: C.canvas, color: C.ink }} />
            </label>
            <PrimaryButton ar="احفظ الموقع" en="Save location" icon={MapPin} testId="whereParked.save" onClick={() => {
              const trimmed = bay.trim().toUpperCase();
              const value = trimmed || suggestedBay;
              app.setParkedCar({ bay: value, level, note: note.trim(), savedAt: new Date().toISOString() });
              setEditing(false);
              app.showToast(`تم حفظ موقع سيارتك: ${value}`, `Car location saved: ${value}`, { demo: false });
            }} />
          </div>
        )}
      </div>
    </Sheet>
  );
}

export function Segmented<T extends string>({ options, value, onChange, testIdPrefix }: { options: { id: T; label: string }[]; value: T; onChange: (v: T) => void; testIdPrefix?: string }) {
  return (
    <div className="flex rounded-[10px] p-0.5" style={{ background: "rgba(118,118,128,0.12)" }}>
      {options.map((o) => {
        const on = o.id === value;
        return (
          <Pressable
            key={o.id}
            onClick={() => onChange(o.id)}
            data-testid={testIdPrefix ? `${testIdPrefix}.${o.id}` : undefined}
            aria-pressed={on}
            className="flex-1 rounded-[8px] py-1.5 text-center text-[13px] font-semibold transition-all"
            style={{ background: on ? "#fff" : "transparent", color: C.ink, boxShadow: on ? "0 2px 6px rgba(0,0,0,0.12)" : undefined }}
          >
            {o.label}
          </Pressable>
        );
      })}
    </div>
  );
}
