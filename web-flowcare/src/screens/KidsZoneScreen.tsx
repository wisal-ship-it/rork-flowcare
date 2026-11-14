import { Grid2x2, Hourglass, Palette, Sparkles, Star, type LucideIcon } from "lucide-react";
import { C, useApp, type HomeRoute } from "@/lib/store";
import { BackHeader, BiText, LanguageToggle, Pressable, hexA } from "@/components/fc/ui";

export type KidGame = Extract<HomeRoute, "memory" | "colorStar" | "bubbles" | "catchStars">;

export const KID_GAMES: Record<KidGame, { ar: string; en: string; icon: LucideIcon; color: string }> = {
  memory: { ar: "لعبة الذاكرة", en: "Memory Match", icon: Grid2x2, color: C.kidSky },
  colorStar: { ar: "لوّن النجمة", en: "Color the Star", icon: Palette, color: C.kidCoral },
  bubbles: { ar: "فقاعات الصابون", en: "Soap Bubbles", icon: Sparkles, color: C.kidMint },
  catchStars: { ar: "اصطد النجوم", en: "Catch the Stars", icon: Star, color: C.kidYellow },
};

export function KidsBackground({ tint }: { tint?: string }) {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-[5] overflow-hidden" style={{ background: C.kidCream }}>
      {tint ? (
        <div className="absolute inset-0" style={{ background: hexA(tint, 0.22) }} />
      ) : (
        <>
          <div className="absolute rounded-full" style={{ width: 300, height: 300, right: -120, top: -120, background: hexA(C.kidYellow, 0.35), filter: "blur(60px)" }} />
          <div className="absolute rounded-full" style={{ width: 280, height: 280, left: -150, bottom: -40, background: hexA(C.kidMint, 0.25), filter: "blur(70px)" }} />
        </>
      )}
    </div>
  );
}

export default function KidsZoneScreen() {
  const app = useApp();
  const a = app.appointment;
  return (
    <div className="mx-auto flex w-full max-w-[480px] flex-col gap-[18px] px-[18px]" style={{ paddingTop: "calc(env(safe-area-inset-top) + 10px)", paddingBottom: "calc(env(safe-area-inset-bottom) + 30px)" }}>
      <KidsBackground />
      <BackHeader titleAr="ركن الأطفال" titleEn="Kids Zone" onBack={app.popHome} guide="kids" trailing={<LanguageToggle />} />

      <div className="flex flex-col items-center gap-2.5 pt-2">
        <div className="flex h-[150px] w-[150px] items-center justify-center rounded-full" style={{ background: hexA(C.kidYellow, 0.45) }}>
          <span className="fc-sway text-[92px] leading-none" role="img" aria-label="teddy bear">🧸</span>
        </div>
        <BiText ar="أهلاً يا بطل!" en="Hello, Champ!" primary="title2" secondary="headline" center primaryClass="fc-rounded text-[34px] font-black" />
        <span className="text-[15px]" style={{ color: C.sub }}>{app.t("العب واستمتع حتى يحين دورك", "Play and have fun until it's your turn")}</span>
      </div>

      <div className="flex items-center gap-3 rounded-[24px] p-3.5" style={{ background: `linear-gradient(90deg, ${C.kidCoral}, #FFA98F)`, boxShadow: `0 6px 14px ${hexA(C.kidCoral, 0.35)}` }}>
        <span className="fc-throb flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-full text-white" style={{ background: "rgba(255,255,255,0.25)" }}><Hourglass size={22} strokeWidth={2.6} /></span>
        <BiText ar={`دورك بعد ${a.minutes} دقيقة`} en={`Your turn in ${a.minutes} min`} primary="headline" secondary="footnote" primaryColor="#fff" secondaryColor="rgba(255,255,255,0.85)" className="flex-1" />
        <span dir="ltr" className="rounded-full bg-white px-2.5 py-1.5 text-[15px] font-black tabular-nums" style={{ color: C.kidCoral }}>{a.ticket}</span>
      </div>

      <div className="grid grid-cols-2 gap-3.5">
        {(Object.keys(KID_GAMES) as KidGame[]).map((g) => {
          const game = KID_GAMES[g];
          const Icon = game.icon;
          return (
            <Pressable key={g} data-testid={`kids.${g}`} onClick={() => app.pushHome(g)} className="flex flex-col items-center gap-2.5 rounded-[28px] py-5" style={{ background: game.color, boxShadow: `0 6px 12px ${hexA(game.color, 0.45)}` }}>
              <span className="flex h-[72px] w-[72px] items-center justify-center rounded-full text-white" style={{ background: "rgba(255,255,255,0.3)" }}><Icon size={34} strokeWidth={2.6} fill={g === "catchStars" ? "#fff" : "none"} /></span>
              <BiText ar={game.ar} en={game.en} primary="headline" secondary="caption" center primaryColor={C.ink} secondaryColor={hexA(C.ink, 0.65)} primaryClass="fc-rounded font-bold" />
            </Pressable>
          );
        })}
      </div>
    </div>
  );
}
