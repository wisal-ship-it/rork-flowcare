import { useEffect, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Info, Volume2, AudioLines, X, type LucideIcon } from "lucide-react";
import { C, useApp } from "@/lib/store";
import { guideText, speech, useActiveSpeechKey, type ScreenGuide } from "@/lib/speech";
import { cn } from "@/lib/utils";

export function haptic(ms = 8) {
  try { navigator.vibrate?.(ms); } catch { /* unsupported */ }
}

/** Every tappable surface: scale 0.97 + slight fade while pressed. */
export function Pressable({ className, children, onClick, ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...rest}
      onClick={(e) => { haptic(); onClick?.(e); }}
      className={cn("fc-press select-none text-start disabled:opacity-40", className)}
    >
      {children}
    </button>
  );
}

type Size = "headline" | "subheadline" | "footnote" | "caption" | "caption2" | "title2" | "title3" | "body";
const sizeClass: Record<Size, string> = {
  title2: "text-[22px] font-bold leading-tight",
  title3: "text-[20px] font-bold leading-tight",
  headline: "text-[17px] font-semibold leading-snug",
  body: "text-[17px] leading-snug",
  subheadline: "text-[15px] leading-snug",
  footnote: "text-[13px] leading-snug",
  caption: "text-[12px] leading-snug",
  caption2: "text-[11px] leading-snug",
};

/** Primary line in the active language, secondary line in the other language. */
export function BiText({
  ar, en, primary = "headline", secondary = "subheadline", primaryColor = C.ink, secondaryColor = C.sub,
  center = false, className, primaryClass, testId,
}: {
  ar: string; en: string; primary?: Size; secondary?: Size; primaryColor?: string; secondaryColor?: string;
  center?: boolean; className?: string; primaryClass?: string; testId?: string;
}) {
  const app = useApp();
  return (
    <div className={cn("flex min-w-0 flex-col gap-0.5", center ? "items-center text-center" : "items-start text-start", className)} data-testid={testId}>
      <span className={cn(sizeClass[primary], primaryClass)} style={{ color: primaryColor }} lang={app.lang}>
        {app.t(ar, en)}
      </span>
      <span className={sizeClass[secondary]} style={{ color: secondaryColor }} lang={app.lang === "ar" ? "en" : "ar"} dir="auto">
        {app.other(ar, en)}
      </span>
    </div>
  );
}

export function Card({ children, className, style, padding = 16 }: { children: ReactNode; className?: string; style?: CSSProperties; padding?: number }) {
  return (
    <div
      className={cn("w-full rounded-[22px] border bg-white", className)}
      style={{ borderColor: C.hairline, boxShadow: "0 4px 12px rgba(23,56,101,0.05)", padding, ...style }}
    >
      {children}
    </div>
  );
}

export function IconBadge({ icon: Icon, color = C.blue, size = 48 }: { icon: LucideIcon; color?: string; size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size, borderRadius: size * 0.3, background: hexA(color, 0.13), color }}
    >
      <Icon size={size * 0.44} strokeWidth={2.4} />
    </span>
  );
}

export function hexA(hex: string, alpha: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

/** Soft atmospheric background shared by every screen (never takes touches). */
export function ScreenBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" style={{ background: C.canvas }}>
      <div className="absolute rounded-full" style={{ width: 360, height: 360, right: -110, top: -140, background: hexA(C.blueLight, 0.16), filter: "blur(70px)" }} />
      <div className="absolute rounded-full" style={{ width: 300, height: 300, left: -150, bottom: -60, background: hexA(C.green, 0.08), filter: "blur(80px)" }} />
    </div>
  );
}

export function LanguageToggle() {
  const app = useApp();
  return (
    <div dir="ltr" className="flex shrink-0 gap-0.5 rounded-full border bg-white p-[3px]" style={{ borderColor: C.hairline }}>
      {(["ar", "en"] as const).map((l) => {
        const on = app.lang === l;
        return (
          <Pressable
            key={l}
            aria-label={l === "ar" ? "العربية" : "English"}
            aria-pressed={on}
            data-testid={`lang.${l}`}
            onClick={() => app.setLang(l)}
            className="flex h-8 w-[46px] items-center justify-center rounded-full text-[15px] font-bold transition-colors duration-300"
            style={{ background: on ? C.blue : "transparent", color: on ? "#fff" : C.sub }}
          >
            {l.toUpperCase()}
          </Pressable>
        );
      })}
    </div>
  );
}

/** Small speaker button that reads the current screen's guide. */
export function GuideButton({ guide }: { guide: ScreenGuide }) {
  const app = useApp();
  const active = useActiveSpeechKey();
  const playing = active === guide;
  useEffect(() => () => speech.stop(guide), [guide]);
  return (
    <Pressable
      onClick={() => speech.toggle([guideText(guide, app.lang)], app.lang, guide)}
      aria-label={playing ? app.t("إيقاف الإرشاد الصوتي", "Stop voice guide") : app.t("استمع لشرح الصفحة", "Hear screen guide")}
      data-testid={`guide.${guide}`}
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-colors"
      style={{ background: playing ? C.blue : C.surface, borderColor: playing ? C.blue : C.hairline, color: playing ? "#fff" : C.blue }}
    >
      {playing ? <AudioLines size={19} strokeWidth={2.5} className="fc-wave" /> : <Volume2 size={19} strokeWidth={2.5} />}
    </Pressable>
  );
}

export function Wordmark({ size = 30 }: { size?: number }) {
  return (
    <span
      dir="ltr"
      className="fc-rounded font-black tracking-tight"
      style={{ fontSize: size, lineHeight: 1.1, background: `linear-gradient(90deg, ${C.navy}, ${C.blue})`, WebkitBackgroundClip: "text", color: "transparent" }}
    >
      FlowCare
    </span>
  );
}

export function AppHeader({ guide, trailing }: { guide?: ScreenGuide; trailing?: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <Wordmark />
      <div className="flex-1" />
      {guide && <GuideButton guide={guide} />}
      {trailing}
      <LanguageToggle />
    </div>
  );
}

/** Header for pushed screens (Kids Zone, Doctor Dashboard, games). */
export function BackHeader({ titleAr, titleEn, onBack, guide, tint = C.blue, backAr = "الرئيسية", backEn = "Home", trailing }: { titleAr: string; titleEn: string; onBack: () => void; guide?: ScreenGuide; tint?: string; backAr?: string; backEn?: string; trailing?: ReactNode }) {
  const app = useApp();
  const Chevron = app.lang === "ar" ? ChevronRight : ChevronLeft;
  return (
    <div className="flex items-center gap-2">
      <Pressable onClick={onBack} aria-label={app.t("رجوع", "Back")} data-testid="nav.back" className="-ms-1 flex h-10 items-center gap-0.5 pe-2 text-[17px] font-medium" style={{ color: tint }}>
        <Chevron size={26} strokeWidth={2.4} />
        {app.t(backAr, backEn)}
      </Pressable>
      <div className="min-w-0 flex-1 truncate text-center text-[17px] font-semibold" style={{ color: C.ink }}>{app.t(titleAr, titleEn)}</div>
      {guide ? <GuideButton guide={guide} /> : <div className="w-10" />}
      {trailing}
    </div>
  );
}

export function DemoTag() {
  const app = useApp();
  return (
    <span className="inline-flex shrink-0 rounded-full px-[7px] py-[3px] text-[11px] font-black leading-none" style={{ color: C.orange, background: hexA(C.orange, 0.14) }}>
      {app.t("تجريبي", "DEMO")}
    </span>
  );
}

export function ToastView() {
  const app = useApp();
  const toast = app.toast;
  if (!toast) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] mx-auto max-w-[480px] px-4" style={{ paddingTop: "calc(env(safe-area-inset-top) + 6px)" }}>
      <div
        key={toast.id}
        role="status"
        onClick={app.dismissToast}
        className="fc-toast pointer-events-auto flex items-center gap-3 rounded-[18px] border p-3.5"
        style={{ borderColor: C.hairline, background: "rgba(255,255,255,0.86)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", boxShadow: "0 8px 18px rgba(0,0,0,0.12)" }}
      >
        <Info size={22} style={{ color: toast.isDemo ? C.orange : C.green }} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[15px] font-semibold" style={{ color: C.ink }}>{app.t(toast.ar, toast.en)}</span>
            {toast.isDemo && <DemoTag />}
          </div>
          <div className="text-[12px]" style={{ color: C.sub }}>{app.other(toast.ar, toast.en)}</div>
        </div>
      </div>
    </div>
  );
}

export function PrimaryButton({ ar, en, color = C.blue, icon, onClick, testId, disabled }: { ar: string; en: string; color?: string; icon?: LucideIcon; onClick: () => void; testId?: string; disabled?: boolean }) {
  const app = useApp();
  const Icon = icon ?? (app.lang === "ar" ? ChevronLeft : ChevronRight);
  return (
    <Pressable
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      className="flex w-full items-center rounded-[20px] px-5 py-3.5"
      style={{ background: color, boxShadow: `0 6px 12px ${hexA(color, 0.3)}` }}
    >
      <span className="w-5" />
      <BiText ar={ar} en={en} primary="headline" secondary="footnote" primaryColor="#fff" secondaryColor="rgba(255,255,255,0.8)" center className="flex-1" />
      <Icon size={20} color="#fff" strokeWidth={2.6} />
    </Pressable>
  );
}

/** Bottom sheet (iOS-style) with grabber, title and close button. */
export function Sheet({ open, onClose, titleAr, titleEn, children, tall = false, testId }: { open: boolean; onClose: () => void; titleAr: string; titleEn: string; children: ReactNode; tall?: boolean; testId?: string }) {
  const app = useApp();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" data-testid={testId} role="dialog" aria-modal="true" aria-label={app.t(titleAr, titleEn)}>
      <div className="fc-fade absolute inset-0 bg-black/35" onClick={onClose} />
      <div
        className="fc-sheet relative flex w-full max-w-[480px] flex-col rounded-t-[28px]"
        style={{ background: "#F2F5F9", maxHeight: tall ? "92dvh" : "78dvh", minHeight: tall ? "70dvh" : undefined }}
      >
        <div className="mx-auto mt-2 h-[5px] w-9 rounded-full bg-black/15" />
        <div className="flex items-center gap-2 px-4 pb-2 pt-2">
          <Pressable onClick={onClose} className="text-[17px] font-medium" style={{ color: C.blue }} data-testid="sheet.close">
            {app.t("إغلاق", "Close")}
          </Pressable>
          <div className="flex-1 text-center text-[17px] font-semibold" style={{ color: C.ink }}>{app.t(titleAr, titleEn)}</div>
          <span className="invisible text-[17px]">{app.t("إغلاق", "Close")}</span>
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom)+20px)]">{children}</div>
      </div>
    </div>
  );
}

/** iOS-style confirmation dialog (action sheet) anchored to the bottom. */
export function ActionSheet({ open, title, message, actions, onClose, testId }: {
  open: boolean; title: string; message?: string; onClose: () => void; testId?: string;
  actions: { label: string; onClick: () => void; destructive?: boolean; testId?: string }[];
}) {
  const app = useApp();
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center px-2" role="dialog" aria-modal="true" aria-label={title} data-testid={testId}>
      <div className="fc-fade absolute inset-0 bg-black/35" onClick={onClose} />
      <div className="fc-sheet relative w-full max-w-[464px]" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 8px)" }}>
        <div className="overflow-hidden rounded-[14px]" style={{ background: "rgba(250,250,252,0.96)", backdropFilter: "blur(20px)" }}>
          <div className="px-4 py-3 text-center">
            <div className="text-[13px] font-semibold" style={{ color: C.sub }}>{title}</div>
            {message && <div className="mt-0.5 text-[13px]" style={{ color: C.sub }}>{message}</div>}
          </div>
          {actions.map((a) => (
            <button
              key={a.label}
              type="button"
              data-testid={a.testId}
              onClick={() => { haptic(); onClose(); a.onClick(); }}
              className="block w-full border-t py-3.5 text-center text-[19px] active:bg-black/5"
              style={{ borderColor: "rgba(0,0,0,0.08)", color: a.destructive ? C.red : C.blue }}
            >
              {a.label}
            </button>
          ))}
        </div>
        <button type="button" onClick={onClose} className="mt-2 block w-full rounded-[14px] bg-white py-3.5 text-center text-[19px] font-semibold active:bg-black/5" style={{ color: C.blue }}>
          {app.t("إلغاء", "Cancel")}
        </button>
      </div>
    </div>
  );
}

/** Bordered (tinted) button, like SwiftUI .bordered / .borderedProminent. */
export function TintButton({ children, onClick, color = C.blue, prominent = false, className, disabled, testId, label }: {
  children: ReactNode; onClick: () => void; color?: string; prominent?: boolean; className?: string; disabled?: boolean; testId?: string; label?: string;
}) {
  return (
    <Pressable
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      aria-label={label}
      className={cn("inline-flex min-h-[36px] items-center justify-center gap-1.5 rounded-full px-3.5 text-[13px] font-bold", className)}
      style={{ background: prominent ? color : hexA(color, 0.12), color: prominent ? "#fff" : color }}
    >
      {children}
    </Pressable>
  );
}

export function SheetSection({ title, footer, children }: { title?: string; footer?: string; children: ReactNode }) {
  return (
    <div className="mb-5">
      {title && <div className="mb-1.5 px-4 text-[13px] uppercase tracking-wide" style={{ color: C.sub }}>{title}</div>}
      <div className="divide-y overflow-hidden rounded-[14px] bg-white" style={{ borderColor: C.hairline }}>{children}</div>
      {footer && <div className="mt-1.5 px-4 text-[13px]" style={{ color: C.sub }}>{footer}</div>}
    </div>
  );
}

export function CloseX({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <Pressable onClick={onClick} aria-label={label} className="flex h-8 w-8 items-center justify-center rounded-full">
      <X size={16} strokeWidth={3} color={C.sub} />
    </Pressable>
  );
}

/** Scrollable screen body with the shared padding and space for the tab bar. */
export function Screen({ children, withTabBar = true }: { children: ReactNode; withTabBar?: boolean }) {
  return (
    <div
      className="mx-auto flex w-full max-w-[480px] flex-col gap-3.5 px-[18px]"
      style={{ paddingTop: "calc(env(safe-area-inset-top) + 10px)", paddingBottom: withTabBar ? "calc(env(safe-area-inset-bottom) + 96px)" : "calc(env(safe-area-inset-bottom) + 24px)" }}
    >
      {children}
    </div>
  );
}
