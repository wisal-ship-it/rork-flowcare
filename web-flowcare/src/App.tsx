import { lazy, Suspense, useEffect, type ComponentType } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { CalendarClock, CircleParking, Headphones, House, MapPin, type LucideIcon } from "lucide-react";
import { AppStoreProvider, C, useApp, type AppTab } from "@/lib/store";
import { speech } from "@/lib/speech";
import { track, trackSessionStart } from "@/lib/analytics";
import { ScreenBackground, ToastView, haptic, hexA } from "@/components/fc/ui";
import HomeScreen from "@/screens/HomeScreen";
import MapScreen from "@/screens/MapScreen";
import ParkingScreen from "@/screens/ParkingScreen";
import VisitScreen from "@/screens/VisitScreen";
import SupportScreen from "@/screens/SupportScreen";
import KidsZoneScreen from "@/screens/KidsZoneScreen";
import KidsGameScreen from "@/screens/KidsGameScreen";
import DoctorScreen from "@/screens/DoctorScreen";
import ScannerOverlay from "@/screens/ScannerOverlay";

const AdminPage = lazy(() => import("@/pages/AdminPage"));

const TABS: { id: AppTab; ar: string; en: string; icon: LucideIcon }[] = [
  { id: "home", ar: "الرئيسية", en: "Home", icon: House },
  { id: "map", ar: "الخريطة", en: "Map", icon: MapPin },
  { id: "parking", ar: "المواقف", en: "Parking", icon: CircleParking },
  { id: "visit", ar: "زيارتي", en: "My Visit", icon: CalendarClock },
  { id: "support", ar: "الدعم", en: "Support", icon: Headphones },
];

const TAB_SCREENS: Record<AppTab, ComponentType> = {
  home: HomeScreen, map: MapScreen, parking: ParkingScreen, visit: VisitScreen, support: SupportScreen,
};

function TabBar() {
  const app = useApp();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t"
      style={{ borderColor: C.hairline, background: "rgba(255,255,255,0.88)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }}
      aria-label={app.t("التبويبات", "Tabs")}
    >
      <div className="mx-auto flex max-w-[480px] px-1" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 4px)" }}>
        {TABS.map((tab) => {
          const sel = app.tab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              data-testid={`tab.${tab.id}`}
              aria-current={sel ? "page" : undefined}
              onClick={() => { haptic(); app.setTab(tab.id); }}
              className="fc-press flex flex-1 flex-col items-center gap-0.5 pb-1 pt-2"
            >
              <span className="flex h-8 w-14 items-center justify-center rounded-full transition-colors" style={{ background: sel ? hexA(C.blue, 0.12) : "transparent" }}>
                <Icon size={23} strokeWidth={sel ? 2.5 : 2} color={sel ? C.blue : "#8A97A6"} />
              </span>
              <span className="text-[11px] font-semibold" style={{ color: sel ? C.blue : "#8A97A6" }}>{app.t(tab.ar, tab.en)}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function FlowCareApp() {
  const app = useApp();
  const top = app.tab === "home" ? app.homePath[app.homePath.length - 1] : undefined;
  const screenName = top ?? app.tab;

  useEffect(() => { trackSessionStart(); }, []);
  useEffect(() => { track("screen_view", { screen: screenName }); }, [screenName]);
  useEffect(() => { speech.stopGuides(); window.scrollTo({ top: 0 }); }, [app.tab, top]);
  useEffect(() => { speech.stop(); }, [app.lang]);
  useEffect(() => { if (app.scanner) track("screen_view", { screen: "scanner" }); }, [app.scanner]);

  let body;
  if (top === "kids") body = <KidsZoneScreen />;
  else if (top === "doctor") body = <DoctorScreen />;
  else if (top) body = <KidsGameScreen game={top} />;
  else {
    const S = TAB_SCREENS[app.tab];
    body = <S />;
  }

  return (
    <div className="min-h-dvh" style={{ color: C.ink }}>
      <ScreenBackground />
      <main key={`${app.tab}-${top ?? ""}`} className={top ? "fc-push" : "fc-fade"}>{body}</main>
      {!top && <TabBar />}
      {app.scanner && <ScannerOverlay mode={app.scanner} />}
      <ToastView />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route
          path="/admin"
          element={
            <Suspense fallback={<div className="min-h-dvh" style={{ background: C.canvas }} />}>
              <AdminPage />
            </Suspense>
          }
        />
        <Route path="*" element={<AppStoreProvider><FlowCareApp /></AppStoreProvider>} />
      </Routes>
    </BrowserRouter>
  );
}
