import { useCallback, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { Calendar, CameraOff, CircleCheck, DoorOpen, Download, Pill, RotateCw, ScanBarcode, Stethoscope, Ticket, User, Video, X, type LucideIcon } from "lucide-react";
import { C, formatAppointmentTime, sampleAppointment, todayAt1020, useApp, type Appointment, type ScannerMode } from "@/lib/store";
import { findNode, nodeAr, nodeEn, nodeForScannedCode, nodeIDFor } from "@/lib/map";
import { BiText, DemoTag, GuideButton, LanguageToggle, PrimaryButton, Pressable, haptic } from "@/components/fc/ui";
import AppointmentEditSheet from "./AppointmentEditSheet";

type Access = "checking" | "live" | "denied" | "unavailable";

interface DetectorLike { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> }

export default function ScannerOverlay({ mode }: { mode: ScannerMode }) {
  const app = useApp();
  const [access, setAccess] = useState<Access>("checking");
  const [scanned, setScanned] = useState<Appointment | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [unknown, setUnknown] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastRejected = useRef<string | null>(null);
  const busy = useRef(false);
  busy.current = scanned != null || unknown != null;

  const close = app.closeScanner;

  const parse = useCallback((code: string): Appointment => {
    const a = sampleAppointment();
    a.date = todayAt1020();
    const clinic = findNode(app.map, nodeIDFor(app.map, "cardiology"));
    if (clinic) {
      a.clinicNodeID = clinic.id;
      a.clinicAr = nodeAr(clinic);
      a.clinicEn = nodeEn(clinic);
      a.room = clinic.code ?? a.room;
    }
    if (code.toUpperCase().includes("PH") || code.length > 12) {
      a.medicationAr = "ميتفورمين 500 مغ - صيدلية الدور الأرضي";
      a.medicationEn = "Metformin 500 mg - Ground floor pharmacy";
    }
    const digits = code.replace(/\D/g, "").slice(-4);
    if (digits.length === 4) a.ticket = `A-${digits}`;
    return a;
  }, [app.map]);

  const handle = useCallback((code: string, demo: boolean) => {
    if (busy.current) return;
    if (mode === "location") {
      const node = nodeForScannedCode(app.map, code);
      if (node) {
        app.setStart(node.id);
        app.showToast(`تم تحديد موقعك: ${nodeAr(node)}`, `Location set: ${nodeEn(node)}`, { demo });
        haptic(30);
        close();
      } else if (code !== lastRejected.current) {
        lastRejected.current = code;
        haptic(60);
        setUnknown(code);
      }
      return;
    }
    haptic(30);
    setIsDemo(demo);
    setScanned(parse(code));
  }, [mode, app, close, parse]);

  // Camera
  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let cancelled = false;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia || navigator.webdriver) { setAccess("unavailable"); return; }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      } catch (e) {
        const name = (e as DOMException)?.name;
        setAccess(name === "NotAllowedError" || name === "SecurityError" ? "denied" : "unavailable");
        return;
      }
      if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
      setAccess("live");
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play().catch(() => undefined);

      const W = window as unknown as { BarcodeDetector?: new (o?: { formats: string[] }) => DetectorLike };
      let detector: DetectorLike | null = null;
      if (W.BarcodeDetector) {
        try { detector = new W.BarcodeDetector({ formats: ["qr_code", "ean_13", "ean_8", "code_128", "code_39", "pdf417", "data_matrix", "aztec", "upc_e"] }); } catch { detector = null; }
      }
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      let last = 0;
      const loop = async (t: number) => {
        if (cancelled) return;
        if (t - last > 220 && !busy.current && video.readyState >= 2) {
          last = t;
          try {
            if (detector) {
              const codes = await detector.detect(video);
              if (codes[0]?.rawValue) handle(codes[0].rawValue, false);
            } else if (ctx) {
              const w = Math.min(640, video.videoWidth), h = Math.round((video.videoHeight / video.videoWidth) * w);
              canvas.width = w; canvas.height = h;
              ctx.drawImage(video, 0, 0, w, h);
              const res = jsQR(ctx.getImageData(0, 0, w, h).data, w, h);
              if (res?.data) handle(res.data, false);
            }
          } catch { /* frame not ready */ }
        }
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    })();
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [handle]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !editing && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close, editing]);

  const demoScan = () => {
    if (mode === "location") {
      const c = app.map.nodes.find((n) => n.qr != null && n.id !== app.startID && n.kind === "elevator")
        ?? app.map.nodes.find((n) => n.qr != null && n.id !== app.startID);
      handle(c?.qr ?? app.map.defaultStart, true);
    } else {
      handle("PH-2047", true);
    }
  };

  const field = (Icon: LucideIcon, ar: string, en: string, value: string) => (
    <div className="flex items-center gap-2.5 py-2.5">
      <span className="flex w-[22px] justify-center"><Icon size={17} color={C.blue} /></span>
      <span className="text-[12px]" style={{ color: C.sub }}>{app.t(ar, en)} / {app.other(ar, en)}</span>
      <span className="flex-1 text-end text-[15px] font-semibold" style={{ color: C.ink }}>{value}</span>
    </div>
  );

  return (
    <div className="fc-fade fixed inset-0 z-40 overflow-hidden" style={{ background: "#0B1626" }} role="dialog" aria-modal="true" data-testid="scanner">
      <video ref={videoRef} playsInline muted className={access === "live" ? "absolute inset-0 h-full w-full object-cover" : "hidden"} />

      {access === "checking" && <div className="absolute inset-0 flex items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-[3px] border-white/30 border-t-white" /></div>}
      {(access === "denied" || access === "unavailable") && (
        <div className="absolute inset-x-0 top-[34%] flex flex-col items-center gap-3.5 px-8 text-center">
          {access === "denied" ? <Video size={44} color="rgba(255,255,255,0.8)" /> : <CameraOff size={44} color="rgba(255,255,255,0.8)" />}
          <BiText
            ar={access === "denied" ? "الوصول إلى الكاميرا مرفوض" : "لا توجد كاميرا متاحة"}
            en={access === "denied" ? "Camera access denied" : "No camera available"}
            primary="title3" secondary="subheadline" primaryColor="#fff" secondaryColor="rgba(255,255,255,0.7)" center
          />
          <span className="text-[13px] text-white/70">
            {access === "denied"
              ? app.t("اسمح للمتصفح باستخدام الكاميرا من إعدادات الموقع (رمز القفل بجانب العنوان)، ثم أعد المحاولة.", "Allow camera access for this site in your browser settings (the lock icon by the address), then try again.")
              : app.t("يمكنك تجربة مسح تجريبي بالأسفل.", "You can try a demo scan below.")}
          </span>
          {access === "denied" && (
            <Pressable onClick={() => window.location.reload()} className="rounded-full px-4 py-2 text-[15px] font-semibold text-white" style={{ background: C.blue }}>{app.t("إعادة المحاولة", "Try again")}</Pressable>
          )}
        </div>
      )}

      {(access === "live" || access === "unavailable") && (
        <div className="pointer-events-none absolute left-1/2 top-[40%] -translate-x-1/2 -translate-y-1/2" style={{ width: "min(78vw, 340px)", aspectRatio: "1 / 0.62" }}>
          {["left-0 top-0 border-l-[5px] border-t-[5px] rounded-tl-xl", "right-0 top-0 border-r-[5px] border-t-[5px] rounded-tr-xl", "right-0 bottom-0 border-r-[5px] border-b-[5px] rounded-br-xl", "left-0 bottom-0 border-l-[5px] border-b-[5px] rounded-bl-xl"].map((c) => (
            <span key={c} className={`absolute h-8 w-8 border-white ${c}`} />
          ))}
          {!scanned && <span className="fc-laser absolute inset-x-[10px] h-[3px] rounded" style={{ background: `linear-gradient(90deg, transparent, ${C.blueLight}, transparent)`, boxShadow: `0 0 8px ${C.blueLight}` }} />}
        </div>
      )}

      <div className="relative mx-auto flex h-full max-w-[480px] flex-col">
        <div className="flex flex-col gap-3.5 px-[18px]" style={{ paddingTop: "calc(env(safe-area-inset-top) + 10px)" }}>
          <div className="flex items-center gap-2.5">
            <Pressable onClick={close} aria-label={app.t("إغلاق", "Close")} data-testid="scanner.close" className="flex h-11 w-11 items-center justify-center rounded-full text-white" style={{ background: "rgba(255,255,255,0.15)" }}>
              <X size={20} strokeWidth={3} />
            </Pressable>
            <div className="flex-1" />
            <GuideButton guide="scanner" />
            <LanguageToggle />
          </div>
          <BiText
            ar={mode === "location" ? "امسح رمز الموقع القريب منك" : "مسح باركود الصيدلية والموعد"}
            en={mode === "location" ? "Scan the location code near you" : "Scan Pharmacy/Appointment Barcode"}
            primary="title3" secondary="subheadline" primaryColor="#fff" secondaryColor="rgba(255,255,255,0.7)" center
          />
        </div>
        <div className="flex-1" />

        {scanned ? (
          <div className="fc-sheet mx-2.5 flex flex-col gap-3 rounded-[28px] bg-white p-[18px]" style={{ marginBottom: "calc(env(safe-area-inset-bottom) + 8px)" }}>
            <div className="mx-auto h-[5px] w-10 rounded-full" style={{ background: C.hairline }} />
            <div className="flex items-center gap-2.5">
              <CircleCheck size={26} color={C.green} fill={`${C.green}22`} />
              <BiText ar="تم استخراج بيانات الموعد" en="Appointment details extracted" primary="headline" secondary="caption" className="flex-1" />
              {isDemo && <DemoTag />}
            </div>
            <div className="divide-y rounded-2xl px-3" style={{ background: C.canvas, borderColor: C.hairline }}>
              {field(User, "اسم المريض", "Patient", app.t(scanned.patientAr, scanned.patientEn))}
              {field(Stethoscope, "الطبيب", "Doctor", app.t(scanned.doctorAr, scanned.doctorEn))}
              {field(DoorOpen, "الغرفة", "Room", app.t(`${scanned.clinicAr} - ${scanned.room}`, `${scanned.clinicEn} - ${scanned.room}`))}
              {field(Calendar, "الموعد", "Time", formatAppointmentTime(scanned.date, app.lang))}
              {field(Ticket, "رقم الموعد", "Appointment ID", scanned.ticket)}
              {scanned.medicationAr && scanned.medicationEn && field(Pill, "الدواء", "Medication", app.t(scanned.medicationAr, scanned.medicationEn))}
            </div>
            <PrimaryButton
              ar="تأكيد واستيراد البيانات" en="Confirm & Import Details" icon={Download} testId="scanner.confirm"
              onClick={() => {
                app.setAppointment(scanned);
                app.setAppointmentImported(true);
                app.showToast(`تم استيراد بيانات الموعد ${scanned.ticket}`, `Appointment ${scanned.ticket} imported`, { demo: isDemo });
                close();
              }}
            />
            <div className="flex">
              <Pressable data-testid="scanner.edit" onClick={() => setEditing(true)} className="flex-1 py-1.5 text-center text-[15px] font-semibold" style={{ color: C.blue }}>{app.t("تعديل البيانات", "Edit details")}</Pressable>
              <Pressable onClick={() => setScanned(null)} className="flex-1 py-1.5 text-center text-[15px] font-semibold" style={{ color: C.blue }}>{app.t("مسح مرة أخرى", "Scan again")}</Pressable>
            </div>
          </div>
        ) : unknown ? (
          <div className="fc-sheet mx-2.5 flex flex-col items-center gap-3 rounded-[28px] bg-white p-[18px]" style={{ marginBottom: "calc(env(safe-area-inset-bottom) + 8px)" }}>
            <span className="text-[34px] font-black" style={{ color: C.orange }}>?</span>
            <BiText ar="هذا الرمز غير موجود في خريطة المستشفى" en="This code isn't on the hospital map" primary="headline" secondary="caption" center />
            <span dir="ltr" className="line-clamp-2 font-mono text-[12px]" style={{ color: C.sub }}>{unknown}</span>
            <PrimaryButton ar="امسح رمزاً آخر" en="Scan another code" icon={RotateCw} onClick={() => setUnknown(null)} />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 30px)" }}>
            <span className="text-[15px] font-semibold text-white/85">
              {mode === "location" ? app.t("تجد الرمز عند المداخل والمصاعد", "Codes are at entrances and elevators") : app.t("وجّه الكاميرا نحو الباركود", "Point the camera at the barcode")}
            </span>
            <Pressable onClick={demoScan} data-testid="scanner.demoScan" className="flex items-center gap-2 rounded-full px-[18px] py-2.5 text-[15px] font-bold text-white" style={{ background: "rgba(255,255,255,0.15)" }}>
              <ScanBarcode size={18} />{app.t("مسح تجريبي", "Demo scan")}<DemoTag />
            </Pressable>
          </div>
        )}
      </div>

      {scanned && (
        <AppointmentEditSheet open={editing} appointment={scanned} onClose={() => setEditing(false)} onSave={(u) => setScanned(u)} />
      )}
    </div>
  );
}
