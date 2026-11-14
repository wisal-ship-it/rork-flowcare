import { useCallback, useEffect, useRef, useState } from "react";
import { Hand, Sparkles, Star, Timer } from "lucide-react";
import { C, useApp } from "@/lib/store";
import { BackHeader, BiText, Pressable, haptic } from "@/components/fc/ui";
import { KID_GAMES, KidsBackground, type KidGame } from "./KidsZoneScreen";

export default function KidsGameScreen({ game }: { game: KidGame }) {
  const app = useApp();
  const g = KID_GAMES[game];
  const fullBleed = game === "bubbles" || game === "catchStars";
  return (
    <div className="mx-auto flex h-[100dvh] w-full max-w-[480px] flex-col" style={{ paddingTop: "calc(env(safe-area-inset-top) + 10px)" }}>
      <KidsBackground tint={g.color} />
      <div className="px-[18px]">
        <BackHeader titleAr={g.ar} titleEn={g.en} onBack={app.popHome} guide={game} backAr="ركن الأطفال" backEn="Kids Zone" />
      </div>
      <div className={`relative min-h-0 flex-1 ${fullBleed ? "" : "overflow-y-auto"}`}>
        {game === "memory" && <MemoryGame />}
        {game === "colorStar" && <ColorStarGame />}
        {game === "bubbles" && <BubblesGame />}
        {game === "catchStars" && <CatchStarsGame />}
      </div>
    </div>
  );
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const kidButton = "fc-press rounded-full px-4 py-2 text-[15px] font-bold";

// MARK: Memory
interface MemoryCard { id: number; face: string; up: boolean; matched: boolean }
const deal = (): MemoryCard[] => shuffle(["🐻", "🦁", "🐰", "🐢", "🦄", "🐳"].flatMap((f) => [f, f])).map((face, id) => ({ id, face, up: false, matched: false }));

function MemoryGame() {
  const app = useApp();
  const [cards, setCards] = useState(deal);
  const [moves, setMoves] = useState(0);
  const busy = useRef(false);

  const flip = (i: number) => {
    const c = cards[i];
    if (busy.current || c.up || c.matched) return;
    haptic();
    const next = cards.map((x, j) => (j === i ? { ...x, up: true } : x));
    const open = next.map((x, j) => (x.up && !x.matched ? j : -1)).filter((j) => j >= 0);
    if (open.length < 2) { setCards(next); return; }
    setMoves((m) => m + 1);
    if (next[open[0]].face === next[open[1]].face) {
      setCards(next.map((x, j) => (open.includes(j) ? { ...x, matched: true, up: false } : x)));
      haptic(30);
    } else {
      setCards(next);
      busy.current = true;
      window.setTimeout(() => {
        setCards((cur) => cur.map((x, j) => (open.includes(j) ? { ...x, up: false } : x)));
        busy.current = false;
      }, 800);
    }
  };
  const done = cards.every((c) => c.matched);

  return (
    <div className="flex flex-col gap-[18px] p-5">
      <div className="flex items-center justify-between text-[17px] font-semibold" style={{ color: C.ink }}>
        <span className="flex items-center gap-1.5"><Hand size={18} />{moves}</span>
        <button type="button" className={kidButton} style={{ background: C.kidCoral, color: "#fff" }} onClick={() => { setCards(deal()); setMoves(0); }}>{app.t("من جديد", "Restart")}</button>
      </div>
      <div className="grid grid-cols-3 gap-3" style={{ perspective: 800 }}>
        {cards.map((c, i) => {
          const shown = c.up || c.matched;
          return (
            <button key={c.id} type="button" data-testid="memory.card" onClick={() => flip(i)} aria-label={shown ? c.face : "?"}
              className="relative h-24 rounded-[20px] transition-[transform,opacity] duration-300"
              style={{ transformStyle: "preserve-3d", transform: `rotateY(${shown ? 0 : 180}deg)`, opacity: c.matched ? 0.55 : 1 }}>
              <span className="absolute inset-0 flex items-center justify-center rounded-[20px] bg-white text-[44px]" style={{ backfaceVisibility: "hidden" }}>{c.face}</span>
              <span className="absolute inset-0 flex items-center justify-center rounded-[20px] text-[30px] font-black text-white" style={{ background: C.kidSky, backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>?</span>
            </button>
          );
        })}
      </div>
      {done && <div className="fc-toast"><BiText ar="رائع! وجدت كل الأزواج 🎉" en="Great! You found all pairs 🎉" primary="title3" center primaryClass="font-black" /></div>}
    </div>
  );
}

// MARK: Color the star
const PALETTE = [C.kidYellow, C.kidCoral, C.kidMint, C.kidSky, C.purple, C.red];
function segmentPath(index: number) {
  const c = 140, r = 140, inner = r * 0.45;
  const pt = (k: number, rad: number) => {
    const a = -Math.PI / 2 + (k * Math.PI) / 5;
    return `${c + rad * Math.cos(a)},${c + rad * Math.sin(a)}`;
  };
  const k = index * 2;
  return `M${c},${c} L${pt(k - 1, inner)} L${pt(k, r)} L${pt(k + 1, inner)} Z`;
}

function ColorStarGame() {
  const app = useApp();
  const [fills, setFills] = useState<(string | null)[]>([null, null, null, null, null]);
  const [selected, setSelected] = useState<string>(C.kidYellow);
  const complete = fills.every(Boolean);
  return (
    <div className="flex flex-col items-center gap-6 p-5">
      <span className="text-[17px] font-semibold" style={{ color: C.ink }}>{app.t("اختر لوناً ثم المس أجزاء النجمة", "Pick a color, then tap the star")}</span>
      <svg viewBox="-4 -4 288 288" width={280} height={280} className="transition-transform duration-500" style={{ transform: `scale(${complete ? 1.06 : 1})`, transitionTimingFunction: "cubic-bezier(.3,1.8,.5,1)" }}>
        {fills.map((f, i) => (
          <path key={i} d={segmentPath(i)} fill={f ?? "#fff"} stroke={`${C.ink}B3`} strokeWidth={3} strokeLinejoin="round" className="cursor-pointer transition-[fill] duration-200"
            onClick={() => { haptic(); setFills((cur) => cur.map((x, j) => (j === i ? selected : x))); }} />
        ))}
      </svg>
      <div className="flex gap-3">
        {PALETTE.map((p) => (
          <button key={p} type="button" aria-label={p} onClick={() => setSelected(p)} className="h-11 w-11 rounded-full transition-transform duration-300"
            style={{ background: p, border: selected === p ? "4px solid #fff" : "none", boxShadow: selected === p ? `0 0 12px ${p}` : "none", transform: `scale(${selected === p ? 1.15 : 1})` }} />
        ))}
      </div>
      <button type="button" className={kidButton} style={{ background: `${C.kidCoral}26`, color: C.kidCoral }} onClick={() => setFills([null, null, null, null, null])}>{app.t("امسح الألوان", "Clear")}</button>
    </div>
  );
}

// MARK: Shared animation clock
function useFrame(active = true) {
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => {
    if (!active) return;
    let id = 0;
    const loop = (t: number) => { setNow(t); id = requestAnimationFrame(loop); };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [active]);
  return now;
}
function useSize() {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 360, h: 600 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pill = "absolute left-1/2 top-3 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full bg-white px-[18px] py-2 font-black tabular-nums";

// MARK: Bubbles
interface Bubble { id: number; x: number; size: number; born: number; speed: number; color: string }
function BubblesGame() {
  const [ref, size] = useSize();
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [popped, setPopped] = useState(0);
  const now = useFrame();
  useEffect(() => {
    const colors = [C.kidSky, C.kidMint, C.kidCoral, C.purple];
    const id = window.setInterval(() => {
      const s = rand(50, 95);
      const t = performance.now();
      setBubbles((b) => [...b.filter((x) => t - x.born < 14000), { id: t, x: rand(s / 2, Math.max(s / 2 + 1, size.w - s / 2)), size: s, born: t, speed: rand(70, 140), color: colors[Math.floor(Math.random() * colors.length)] }]);
    }, 700);
    return () => window.clearInterval(id);
  }, [size.w]);
  return (
    <div ref={ref} className="absolute inset-0 overflow-hidden touch-manipulation">
      <div className={`${pill} text-[22px]`} style={{ color: C.ink }}><Sparkles size={22} />{popped}</div>
      {bubbles.map((b) => {
        const t = (now - b.born) / 1000;
        const y = size.h + b.size - t * b.speed;
        const x = b.x + Math.sin(t * 2) * 12;
        return (
          <button key={b.id} type="button" aria-label="bubble" data-testid="bubble"
            onPointerDown={() => { haptic(); setBubbles((cur) => cur.filter((c) => c.id !== b.id)); setPopped((p) => p + 1); }}
            className="absolute rounded-full"
            style={{ width: b.size, height: b.size, left: x - b.size / 2, top: y - b.size / 2, background: `radial-gradient(circle at 25% 25%, rgba(255,255,255,0.9), ${b.color}59 ${b.size}px)`, border: `2px solid ${b.color}B3` }} />
        );
      })}
    </div>
  );
}

// MARK: Catch the stars
interface FallingStar { id: number; x: number; born: number; speed: number }
function CatchStarsGame() {
  const app = useApp();
  const [ref, size] = useSize();
  const [stars, setStars] = useState<FallingStar[]>([]);
  const [score, setScore] = useState(0);
  const [remaining, setRemaining] = useState(30);
  const [round, setRound] = useState(0);
  const playing = remaining > 0;
  const now = useFrame(playing);

  useEffect(() => {
    let tick = 0;
    const id = window.setInterval(() => {
      const t = performance.now();
      setStars((s) => [...s.filter((x) => ((t - x.born) / 1000) * 220 < size.h + 120), { id: t, x: rand(40, Math.max(41, size.w - 40)), born: t, speed: rand(120, 220) }]);
      tick += 1;
      if (tick % 2 === 0) {
        setRemaining((r) => {
          if (r <= 1) { window.clearInterval(id); setStars([]); return 0; }
          return r - 1;
        });
      }
    }, 500);
    return () => window.clearInterval(id);
  }, [round, size.w, size.h]);

  const restart = useCallback(() => { setScore(0); setRemaining(30); setStars([]); setRound((r) => r + 1); }, []);

  return (
    <div ref={ref} className="absolute inset-0 overflow-hidden touch-manipulation">
      <div className="absolute inset-x-5 top-3 z-10 flex items-center justify-between rounded-full bg-white px-[18px] py-2.5 text-[20px] font-black tabular-nums" style={{ color: C.ink }}>
        <span className="flex items-center gap-1.5"><Star size={20} fill={C.ink} />{score}</span>
        <span className="flex items-center gap-1.5" dir="ltr"><Timer size={20} />{remaining}s</span>
      </div>
      {stars.map((s) => {
        const t = (now - s.born) / 1000;
        return (
          <button key={s.id} type="button" aria-label="star" data-testid="star"
            onPointerDown={() => { if (!playing) return; haptic(20); setStars((cur) => cur.filter((c) => c.id !== s.id)); setScore((x) => x + 1); }}
            className="absolute flex h-[70px] w-[70px] items-center justify-center"
            style={{ left: s.x - 35, top: -40 + t * s.speed - 35, transform: `rotate(${t * 90}deg)` }}>
            <Star size={46} fill={C.kidYellow} color={C.kidYellow} style={{ filter: `drop-shadow(0 0 6px ${C.orange}99)` }} />
          </button>
        );
      })}
      {!playing && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="fc-toast flex flex-col items-center gap-3.5 rounded-[28px] bg-white p-7">
            <span className="fc-rounded text-[54px] font-black" style={{ color: C.ink }}>⭐️ {score}</span>
            <BiText ar="أحسنت يا بطل!" en="Well done, champ!" primary="title2" center primaryClass="font-black" />
            <Pressable onClick={restart} className="rounded-full px-6 py-3 text-[17px] font-bold text-white" style={{ background: C.kidCoral }}>{app.t("العب مجدداً", "Play again")}</Pressable>
          </div>
        </div>
      )}
    </div>
  );
}
