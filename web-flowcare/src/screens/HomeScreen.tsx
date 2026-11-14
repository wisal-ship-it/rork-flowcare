import { Baby, CalendarDays, Camera, Check, ChevronLeft, ChevronRight, CircleParking, CircleUser, Headphones, Navigation, Stethoscope, Users, type LucideIcon } from "lucide-react";
import { C, CLINIC_STATUS, formatAppointmentTime, heroGradient, useApp } from "@/lib/store";
import { AppHeader, BiText, Card, IconBadge, Pressable, Screen, hexA } from "@/components/fc/ui";

export default function HomeScreen() {
  const app = useApp();
  const a = app.appointment;
  const Fwd = app.lang === "ar" ? ChevronLeft : ChevronRight;
  const status = CLINIC_STATUS[app.clinicStatus];

  const infoRow = (Icon: LucideIcon, ar: string, en: string) => (
    <div className="flex items-center gap-3">
      <span className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-[14px] text-white" style={{ background: "rgba(255,255,255,0.18)" }}><Icon size={22} strokeWidth={2.2} /></span>
      <BiText ar={ar} en={en} primary="headline" secondary="footnote" primaryColor="#fff" secondaryColor="rgba(255,255,255,0.8)" />
    </div>
  );

  const tile = (Icon: LucideIcon, color: string, ar: string, en: string, onClick: () => void, testId?: string) => (
    <Pressable onClick={onClick} data-testid={testId} className="w-full">
      <Card padding={14}>
        <div className="flex flex-col items-start gap-2.5">
          <IconBadge icon={Icon} color={color} size={50} />
          <BiText ar={ar} en={en} primary="headline" secondary="footnote" className="w-full" primaryClass="truncate w-full" />
        </div>
      </Card>
    </Pressable>
  );

  const timeAr = formatAppointmentTime(a.date, "ar");
  const timeEn = formatAppointmentTime(a.date, "en");

  return (
    <Screen>
      <div className="pb-1">
        <AppHeader
          guide="home"
          trailing={
            <Pressable onClick={() => app.pushHome("doctor")} aria-label={app.t("لوحة الطبيب", "Doctor Dashboard")} data-testid="home.doctor"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border bg-white" style={{ borderColor: C.hairline, color: C.blue }}>
              <Stethoscope size={19} strokeWidth={2.4} />
            </Pressable>
          }
        />
      </div>

      <div className="relative overflow-hidden rounded-[26px] p-5" style={{ background: heroGradient, boxShadow: `0 10px 18px ${hexA(C.blue, 0.28)}` }}>
        <div aria-hidden className="pointer-events-none absolute rounded-full" style={{ width: 260, height: 260, insetInlineEnd: -120, top: -130, background: "rgba(255,255,255,0.10)" }} />
        <div aria-hidden className="pointer-events-none absolute rounded-full" style={{ width: 200, height: 200, insetInlineStart: -120, bottom: -100, background: "rgba(255,255,255,0.07)" }} />
        <div className="relative flex flex-col gap-3.5">
          <div className="flex items-start">
            <BiText ar="موعدك القادم" en="Next appointment" primary="title2" secondary="subheadline" primaryColor="#fff" secondaryColor="rgba(255,255,255,0.8)" className="flex-1" />
            <span dir="ltr" className="rounded-full px-2.5 py-1.5 text-[13px] font-bold tabular-nums text-white" style={{ background: "rgba(255,255,255,0.18)" }}>{a.ticket}</span>
          </div>
          {infoRow(CalendarDays, timeAr, timeEn)}
          {infoRow(CircleUser, `${a.doctorAr} - ${a.room}`, `${a.doctorEn} - ${a.room}`)}
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1.5 text-[13px] font-bold" style={{ color: C.ink }}>
              <span className="h-2 w-2 rounded-full" style={{ background: status.color }} />{app.t(status.ar, status.en)}
            </span>
            <span className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[13px] font-semibold text-white" style={{ background: "rgba(255,255,255,0.18)" }}>
              <Users size={14} />{app.t(`${a.ahead} قبلك · ${a.minutes} د`, `${a.ahead} ahead · ${a.minutes} min`)}
            </span>
          </div>
          <Pressable onClick={() => app.navigate(a.clinicNodeID)} data-testid="home.goToClinic" className="flex w-full items-center rounded-full bg-white px-5 py-3">
            <span className="w-5" />
            <BiText ar="بدء الذهاب للعيادة" en="Go to Clinic" primary="headline" secondary="footnote" primaryColor={C.blue} center className="flex-1" />
            <Fwd size={20} color={C.blue} strokeWidth={2.6} />
          </Pressable>
        </div>
      </div>

      <Pressable onClick={() => app.openScanner("appointment")} data-testid="home.scan" className="w-full">
        <Card>
          <div className="flex items-center gap-3.5">
            <IconBadge icon={Camera} />
            <BiText ar="امسح باركود الموعد" en="Scan appointment barcode" className="flex-1" />
            <Fwd size={18} color={C.sub} />
          </div>
        </Card>
      </Pressable>

      <div className="grid grid-cols-2 gap-3">
        {tile(CircleParking, C.green, "المواقف الذكية", "Smart Parking", () => app.setTab("parking"), "home.parking")}
        {tile(Navigation, C.purple, "الملاحة الداخلية", "Indoor Navigation", () => app.setTab("map"), "home.map")}
        {tile(Baby, C.orange, "ركن الأطفال", "Kids Zone", () => app.pushHome("kids"), "home.kids")}
        {tile(Headphones, C.blueLight, "طلب مساعدة", "Request Assistance", () => app.setTab("support"), "home.support")}
      </div>

      <Pressable onClick={() => app.setTab("visit")} className="flex w-full items-center gap-3.5 rounded-[22px] p-4" style={{ background: `linear-gradient(90deg, ${C.green}, ${C.greenSoft})` }}>
        <span className="flex h-12 w-12 items-center justify-center rounded-full text-white" style={{ background: "rgba(255,255,255,0.22)" }}><Check size={22} strokeWidth={3} /></span>
        <BiText ar="أنت على المسار الصحيح" en="You are on track" primary="headline" secondary="footnote" primaryColor="#fff" secondaryColor="rgba(255,255,255,0.85)" />
      </Pressable>
    </Screen>
  );
}
