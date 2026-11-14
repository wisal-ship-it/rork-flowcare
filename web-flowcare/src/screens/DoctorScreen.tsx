import { useState } from "react";
import { BadgeCheck, Clock, Megaphone, Stethoscope, Users, Volume2, type LucideIcon } from "lucide-react";
import { C, CLINIC_STATUS, heroGradient, useApp, type ClinicStatus } from "@/lib/store";
import { BackHeader, BiText, Card, IconBadge, LanguageToggle, PrimaryButton, Screen, hexA } from "@/components/fc/ui";
import { Segmented } from "./ParkingScreen";

interface QueuePatient { id: string; nameAr: string; nameEn: string; time: string; urgent?: boolean }

const INITIAL: QueuePatient[] = [
  { id: "A-2047", nameAr: "أحمد الشمري", nameEn: "Ahmed Al-Shammari", time: "10:20" },
  { id: "A-2048", nameAr: "ليلى الحربي", nameEn: "Layla Al-Harbi", time: "10:35", urgent: true },
  { id: "A-2049", nameAr: "خالد الدوسري", nameEn: "Khalid Al-Dosari", time: "10:50" },
];

export default function DoctorScreen() {
  const app = useApp();
  const [queue, setQueue] = useState(INITIAL);
  const [seen, setSeen] = useState(14);
  const [current, setCurrent] = useState<QueuePatient | null>(null);
  const a = app.appointment;

  const callNext = () => {
    const next = queue[0];
    if (!next) return;
    setCurrent(next);
    setQueue((q) => q.slice(1));
    setSeen((s) => s + 1);
    app.showToast(`تم استدعاء ${next.nameAr} (${next.id}) إلى غرفة ${a.room}`, `Called ${next.nameEn} (${next.id}) to room ${a.room}`);
  };

  const metric = (Icon: LucideIcon, value: string, ar: string, en: string, color: string) => (
    <Card padding={12} className="flex-1">
      <div className="flex flex-col items-start gap-1.5">
        <Icon size={18} color={color} strokeWidth={2.5} />
        <span key={value} className="fc-fade fc-rounded text-[28px] font-black tabular-nums leading-none" style={{ color: C.ink }}>{value}</span>
        <span className="text-[12px] font-semibold leading-tight" style={{ color: C.ink }}>{app.t(ar, en)}</span>
        <span className="text-[11px] leading-tight" style={{ color: C.sub }}>{app.other(ar, en)}</span>
      </div>
    </Card>
  );

  return (
    <>
      <Screen withTabBar={false}>
        <BackHeader titleAr="لوحة الطبيب" titleEn="Doctor Dashboard" onBack={app.popHome} guide="doctor" trailing={<LanguageToggle />} />

        <div className="flex items-center gap-3.5 rounded-[24px] p-[18px]" style={{ background: heroGradient, boxShadow: `0 8px 16px ${hexA(C.blue, 0.3)}` }}>
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] text-white" style={{ background: "rgba(255,255,255,0.2)" }}><Stethoscope size={26} strokeWidth={2.3} /></span>
          <BiText ar={a.doctorAr} en={a.doctorEn} primary="title3" secondary="subheadline" primaryColor="#fff" secondaryColor="rgba(255,255,255,0.8)" className="flex-1" />
          <div className="flex flex-col items-end">
            <span className="text-[12px] text-white/80">{app.t("غرفة", "Room")}</span>
            <span className="text-[22px] font-black tabular-nums text-white">{a.room}</span>
          </div>
        </div>

        <Card>
          <div className="flex flex-col gap-2.5">
            <BiText ar="حالة العيادة" en="Clinic status" primary="headline" secondary="caption" />
            <Segmented<ClinicStatus>
              options={(Object.keys(CLINIC_STATUS) as ClinicStatus[]).map((s) => ({ id: s, label: app.t(CLINIC_STATUS[s].ar, CLINIC_STATUS[s].en) }))}
              value={app.clinicStatus}
              onChange={app.setClinicStatus}
              testIdPrefix="doctor.status"
            />
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: CLINIC_STATUS[app.clinicStatus].color }} />
              <span className="text-[12px]" style={{ color: C.sub }}>{app.t("تظهر هذه الحالة للمرضى في الصفحة الرئيسية", "Patients see this status on their home screen")}</span>
            </div>
          </div>
        </Card>

        <div className="flex gap-2.5">
          {metric(Users, String(queue.length), "منتظرون", "Waiting", C.blue)}
          {metric(Clock, String(queue.length ? 12 : 0), "متوسط الانتظار (د)", "Avg wait (min)", C.orange)}
          {metric(BadgeCheck, String(seen), "رأيتهم اليوم", "Seen today", C.green)}
        </div>

        {current && (
          <div key={current.id} className="fc-toast">
            <Card padding={12}>
              <div className="flex items-center gap-3">
                <IconBadge icon={Volume2} color={C.green} size={44} />
                <BiText ar={`في العيادة الآن: ${current.nameAr}`} en={`In clinic now: ${current.nameEn}`} primary="subheadline" secondary="caption" primaryClass="font-semibold" className="flex-1" />
                <span dir="ltr" className="text-[12px] font-bold tabular-nums" style={{ color: C.green }}>{current.id}</span>
              </div>
            </Card>
          </div>
        )}

        <Card>
          <BiText ar="طابور المرضى" en="Patient queue" primary="headline" secondary="caption" className="mb-2" />
          {queue.length === 0 && <div className="py-5 text-center text-[15px]" style={{ color: C.sub }}>{app.t("لا يوجد مرضى في الانتظار", "No patients waiting")}</div>}
          {queue.map((p, i) => (
            <div key={p.id} className={`fc-fade flex items-center gap-3 py-2.5 ${i > 0 ? "border-t" : ""}`} style={{ borderColor: C.hairline }}>
              <span dir="ltr" className="rounded-[10px] px-2 py-1.5 text-[12px] font-black tabular-nums" style={{ background: i === 0 ? C.blue : hexA(C.blue, 0.12), color: i === 0 ? "#fff" : C.blue }}>{p.id}</span>
              <BiText ar={p.nameAr} en={p.nameEn} primary="subheadline" secondary="caption" primaryClass="font-semibold" className="flex-1" />
              {p.urgent && <span className="rounded-full px-2 py-1 text-[11px] font-black" style={{ color: C.red, background: hexA(C.red, 0.12) }}>{app.t("مستعجل", "Urgent")}</span>}
              <span dir="ltr" className="text-[12px] tabular-nums" style={{ color: C.sub }}>{p.time}</span>
            </div>
          ))}
        </Card>
        <div className="h-[84px]" />
      </Screen>
      <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-[480px] px-[18px]" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 10px)" }}>
        <PrimaryButton ar="استدعاء المريض التالي" en="Call Next Patient" icon={Megaphone} color={queue.length ? C.blue : C.sub} disabled={!queue.length} onClick={callNext} testId="doctor.callNext" />
      </div>
    </>
  );
}
