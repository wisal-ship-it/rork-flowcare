import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { Activity, ChartColumn, Footprints, Lock, LogOut, RefreshCw, Route as RouteIcon, ShieldCheck, Smartphone, Volume2 } from "lucide-react";
import { supabase, supabaseConfigured } from "@/lib/supabase";
import { C, heroGradient, type Lang } from "@/lib/store";
import { hexA } from "@/components/fc/ui";

type Range = "today" | "7d" | "30d";
interface Summary {
  sessions: number; screen_views: number; routes_started: number; voice_plays: number;
  top_screens: { screen: string; count: number }[];
  routes_by_type: Record<string, number>;
  platforms: Record<string, number>;
}

const SCREEN_NAMES: Record<string, [string, string]> = {
  home: ["الرئيسية", "Home"], map: ["الخريطة", "Map"], parking: ["المواقف", "Parking"], visit: ["زيارتي", "My Visit"],
  support: ["الدعم", "Support"], kids: ["ركن الأطفال", "Kids Zone"], doctor: ["لوحة الطبيب", "Doctor panel"],
  scanner: ["الماسح", "Scanner"], memory: ["لعبة الذاكرة", "Memory game"], colorStar: ["لوّن النجمة", "Color the star"],
  bubbles: ["الفقاعات", "Bubbles"], catchStars: ["اصطد النجوم", "Catch the stars"], "map-step": ["خطوة الخريطة", "Map step"],
};
const ROUTE_NAMES: Record<string, [string, string]> = {
  elderly: ["كبار السن", "Older adults"], pregnant: ["الحوامل", "Pregnant"], urgent: ["الأسرع", "Fastest"],
};
const PLATFORM_NAMES: Record<string, [string, string]> = {
  ios: ["iPhone", "iPhone"], android: ["Android", "Android"], desktop: ["كمبيوتر", "Desktop"], other: ["أخرى", "Other"],
};

export default function AdminPage() {
  const [lang, setLang] = useState<Lang>(() => (localStorage.getItem("fc.lang")?.includes("en") ? "en" : "ar"));
  const t = (ar: string, en: string) => (lang === "ar" ? ar : en);
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    document.title = "FlowCare Admin";
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    localStorage.setItem("fc.lang", JSON.stringify(lang));
  }, [lang]);

  useEffect(() => {
    let robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (!robots) {
      robots = document.createElement("meta");
      robots.name = "robots";
      document.head.appendChild(robots);
    }
    robots.content = "noindex, nofollow";
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  return (
    <div className="min-h-dvh" style={{ background: C.canvas, color: C.ink }}>
      <header className="relative overflow-hidden" style={{ background: heroGradient }}>
        <div className="mx-auto flex max-w-[960px] items-center gap-3 px-5 pb-5" style={{ paddingTop: "calc(env(safe-area-inset-top) + 18px)" }}>
          <div className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-white/20"><ChartColumn size={24} color="#fff" /></div>
          <div className="flex-1 text-white">
            <div className="text-[22px] font-black leading-tight">{t("الإحصائيات", "Analytics")}</div>
            <div className="text-[13px] opacity-85">{t("FlowCare · للمشرفين فقط", "FlowCare · Admins only")}</div>
          </div>
          <button
            type="button"
            onClick={() => setLang(lang === "ar" ? "en" : "ar")}
            className="fc-press rounded-full bg-white/20 px-3.5 py-2 text-[14px] font-bold text-white"
            data-testid="admin.lang"
          >
            {lang === "ar" ? "EN" : "ع"}
          </button>
          {session && (
            <button
              type="button"
              onClick={() => supabase.auth.signOut()}
              className="fc-press flex items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-[14px] font-bold"
              style={{ color: C.navy }}
              data-testid="admin.signOut"
            >
              <LogOut size={16} /> {t("خروج", "Sign out")}
            </button>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-[960px] px-5 py-6">
        {!supabaseConfigured ? (
          <Notice>{t("الخادم غير مهيأ.", "The server is not configured.")}</Notice>
        ) : !ready ? null : session ? (
          <Dashboard t={t} lang={lang} />
        ) : (
          <SignIn t={t} />
        )}
      </main>
    </div>
  );
}

function Notice({ children }: { children: ReactNode }) {
  return <div className="rounded-[18px] border bg-white p-4 text-[15px]" style={{ borderColor: C.hairline, color: C.sub }}>{children}</div>;
}

function SignIn({ t }: { t: (ar: string, en: string) => string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (err) {
      console.warn("[admin] sign-in failed", err.message);
      setError(t("البريد الإلكتروني أو كلمة المرور غير صحيحة.", "Incorrect email or password."));
    }
  };

  return (
    <form onSubmit={submit} className="mx-auto mt-4 max-w-[400px] rounded-[22px] border bg-white p-6" style={{ borderColor: C.hairline, boxShadow: "0 8px 24px rgba(23,56,101,0.06)" }} data-testid="admin.signIn">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-[14px]" style={{ background: hexA(C.blue, 0.12) }}>
        <Lock size={24} color={C.blue} />
      </div>
      <h1 className="text-[22px] font-black" style={{ color: C.ink }}>{t("دخول المشرف", "Admin sign-in")}</h1>
      <p className="mt-1 text-[14px]" style={{ color: C.sub }}>{t("هذه الصفحة للمشرفين المعتمدين فقط.", "This page is for approved admins only.")}</p>
      <label className="mt-5 block text-[13px] font-bold" style={{ color: C.sub }}>
        {t("البريد الإلكتروني", "Email")}
        <input
          type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr"
          className="mt-1.5 block w-full rounded-[14px] border px-3.5 py-3 text-[16px] font-normal outline-none focus:border-[#1E6FD9]"
          style={{ borderColor: C.hairline, color: C.ink, background: C.canvas }} data-testid="admin.email"
        />
      </label>
      <label className="mt-3 block text-[13px] font-bold" style={{ color: C.sub }}>
        {t("كلمة المرور", "Password")}
        <input
          type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr"
          className="mt-1.5 block w-full rounded-[14px] border px-3.5 py-3 text-[16px] font-normal outline-none focus:border-[#1E6FD9]"
          style={{ borderColor: C.hairline, color: C.ink, background: C.canvas }} data-testid="admin.password"
        />
      </label>
      {error && <div className="mt-3 rounded-[12px] px-3 py-2 text-[14px] font-semibold" style={{ background: hexA(C.red, 0.1), color: C.red }} role="alert">{error}</div>}
      <button
        type="submit" disabled={busy}
        className="fc-press mt-5 w-full rounded-[20px] py-3.5 text-[17px] font-bold text-white disabled:opacity-60"
        style={{ background: C.blue }} data-testid="admin.submit"
      >
        {busy ? t("جارٍ الدخول…", "Signing in…") : t("دخول", "Sign in")}
      </button>
    </form>
  );
}

function Dashboard({ t, lang }: { t: (ar: string, en: string) => string; lang: Lang }) {
  const [range, setRange] = useState<Range>("7d");
  const [test, setTest] = useState(false);
  const [data, setData] = useState<Summary | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "denied" | "error">("loading");

  const load = useCallback(async () => {
    setState("loading");
    const { data: res, error } = await supabase.rpc("analytics_summary", { range, include_test: test });
    if (error) {
      console.warn("[admin] analytics_summary", error.code, error.message);
      setState(error.code === "42501" ? "denied" : "error");
      return;
    }
    setData(res as unknown as Summary);
    setState("ok");
  }, [range, test]);
  useEffect(() => { void load(); }, [load]);

  const nf = new Intl.NumberFormat(lang === "ar" ? "ar-SA-u-nu-latn" : "en-US");
  const name = (map: Record<string, [string, string]>, k: string) => (map[k] ? t(map[k][0], map[k][1]) : k);

  if (state === "denied") {
    return (
      <div data-testid="admin.denied">
        <Notice>
          <div className="flex items-center gap-2 font-bold" style={{ color: C.red }}><Lock size={18} /> {t("هذا الحساب ليس لديه صلاحية المشرف.", "This account doesn't have admin access.")}</div>
        </Notice>
      </div>
    );
  }

  const ranges: { id: Range; ar: string; en: string }[] = [
    { id: "today", ar: "اليوم", en: "Today" },
    { id: "7d", ar: "آخر 7 أيام", en: "Last 7 days" },
    { id: "30d", ar: "آخر 30 يوماً", en: "Last 30 days" },
  ];
  const max = Math.max(1, ...(data?.top_screens ?? []).map((s) => s.count));

  return (
    <div data-testid="admin.dashboard">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-full bg-white p-1" style={{ border: `1px solid ${C.hairline}` }} role="tablist">
          {ranges.map((r) => (
            <button
              key={r.id} type="button" role="tab" aria-selected={range === r.id} onClick={() => setRange(r.id)}
              data-testid={`admin.range.${r.id}`}
              className="fc-press rounded-full px-3.5 py-2 text-[14px] font-bold"
              style={{ background: range === r.id ? C.navy : "transparent", color: range === r.id ? "#fff" : C.sub }}
            >
              {t(r.ar, r.en)}
            </button>
          ))}
        </div>
        <div className="flex rounded-full bg-white p-1" style={{ border: `1px solid ${C.hairline}` }} role="tablist">
          {[false, true].map((v) => (
            <button
              key={String(v)} type="button" role="tab" aria-selected={test === v} onClick={() => setTest(v)}
              data-testid={`admin.data.${v ? "test" : "real"}`}
              className="fc-press flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[14px] font-bold"
              style={{ background: test === v ? (v ? C.orange : C.green) : "transparent", color: test === v ? "#fff" : C.sub }}
            >
              {v ? t("نشاط الاختبار", "Test activity") : t("الاستخدام الحقيقي", "Real usage")}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <button type="button" onClick={() => void load()} className="fc-press flex h-10 w-10 items-center justify-center rounded-full bg-white" style={{ border: `1px solid ${C.hairline}` }} aria-label={t("تحديث", "Refresh")}>
          <RefreshCw size={18} color={C.blue} className={state === "loading" ? "animate-spin" : undefined} />
        </button>
      </div>

      {test && (
        <div className="mt-3 rounded-[14px] px-3.5 py-2.5 text-[13px] font-semibold" style={{ background: "#FFF4DE", color: "#8A4B00" }}>
          {t("تعرض أرقام الاختبار فقط: المعاينات، والاختبارات الآلية، والروابط التي تنتهي بـ ?test=1.", "Showing test numbers only: previews, automated tests and links opened with ?test=1.")}
        </div>
      )}
      {state === "error" && <div className="mt-3"><Notice>{t("تعذّر تحميل الأرقام. حاول مرة أخرى.", "Couldn't load the numbers. Try again.")}</Notice></div>}

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat icon={Activity} color={C.blue} label={t("جلسات التطبيق", "App sessions")} value={data ? nf.format(data.sessions) : "—"} testId="admin.stat.sessions" />
        <Stat icon={Footprints} color={C.navy} label={t("مشاهدات الشاشات", "Screen views")} value={data ? nf.format(data.screen_views) : "—"} testId="admin.stat.views" />
        <Stat icon={RouteIcon} color={C.green} label={t("مسارات مبدوءة", "Routes started")} value={data ? nf.format(data.routes_started) : "—"} testId="admin.stat.routes" />
        <Stat icon={Volume2} color={C.purple} label={t("تشغيل الإرشاد الصوتي", "Voice guidance plays")} value={data ? nf.format(data.voice_plays) : "—"} testId="admin.stat.voice" />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[1.4fr_1fr]">
        <Panel title={t("الشاشات الأكثر زيارة", "Most visited screens")}>
          {data && data.top_screens.length ? (
            <ol className="space-y-2.5" data-testid="admin.topScreens">
              {data.top_screens.map((s) => (
                <li key={s.screen}>
                  <div className="flex items-baseline justify-between text-[14px]">
                    <span className="font-semibold" style={{ color: C.ink }}>{name(SCREEN_NAMES, s.screen)}</span>
                    <span className="font-bold tabular-nums" style={{ color: C.sub }}>{nf.format(s.count)}</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full" style={{ background: hexA(C.blue, 0.1) }}>
                    <div className="h-2 rounded-full" style={{ width: `${(s.count / max) * 100}%`, background: C.blue }} />
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <Empty t={t} />
          )}
        </Panel>
        <div className="grid gap-3">
          <Panel title={t("المسارات حسب النوع", "Routes by type")}>
            <Breakdown entries={data?.routes_by_type} names={ROUTE_NAMES} nf={nf} name={name} t={t} />
          </Panel>
          <Panel title={t("الأجهزة", "Devices")} icon={Smartphone}>
            <Breakdown entries={data?.platforms} names={PLATFORM_NAMES} nf={nf} name={name} t={t} />
          </Panel>
        </div>
      </div>

      <p className="mt-5 flex items-start gap-2 text-[13px]" style={{ color: C.sub }}>
        <ShieldCheck size={16} className="mt-0.5 shrink-0" color={C.green} />
        {t(
          "أعداد مجمّعة فقط — لا تُجمع أسماء أو مواعيد أو بيانات طبية.",
          "Aggregate counts only — no names, appointments or medical data are collected.",
        )}
      </p>
    </div>
  );
}

function Stat({ icon: Icon, color, label, value, testId }: { icon: typeof Activity; color: string; label: string; value: string; testId: string }) {
  return (
    <div className="rounded-[22px] border bg-white p-4" style={{ borderColor: C.hairline }} data-testid={testId}>
      <div className="flex h-10 w-10 items-center justify-center rounded-[12px]" style={{ background: hexA(color, 0.12) }}><Icon size={20} color={color} /></div>
      <div className="mt-3 text-[30px] font-black leading-none tabular-nums" style={{ color: C.ink }}>{value}</div>
      <div className="mt-1.5 text-[13px] font-semibold" style={{ color: C.sub }}>{label}</div>
    </div>
  );
}

function Panel({ title, children, icon: Icon }: { title: string; children: ReactNode; icon?: typeof Activity }) {
  return (
    <section className="rounded-[22px] border bg-white p-4" style={{ borderColor: C.hairline }}>
      <h2 className="mb-3 flex items-center gap-1.5 text-[15px] font-black" style={{ color: C.navy }}>{Icon && <Icon size={16} />}{title}</h2>
      {children}
    </section>
  );
}

function Empty({ t }: { t: (ar: string, en: string) => string }) {
  return <div className="py-4 text-center text-[14px]" style={{ color: C.sub }}>{t("لا توجد بيانات في هذه الفترة بعد.", "No data for this period yet.")}</div>;
}

function Breakdown({ entries, names, nf, name, t }: {
  entries?: Record<string, number>; names: Record<string, [string, string]>; nf: Intl.NumberFormat;
  name: (m: Record<string, [string, string]>, k: string) => string; t: (ar: string, en: string) => string;
}) {
  const list = Object.entries(entries ?? {}).sort((a, b) => b[1] - a[1]);
  if (!list.length) return <Empty t={t} />;
  return (
    <ul className="space-y-1.5">
      {list.map(([k, v]) => (
        <li key={k} className="flex justify-between text-[14px]">
          <span style={{ color: C.ink }}>{name(names, k)}</span>
          <span className="font-bold tabular-nums" style={{ color: C.sub }}>{nf.format(v)}</span>
        </li>
      ))}
    </ul>
  );
}
