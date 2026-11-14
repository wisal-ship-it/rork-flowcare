import { useState } from "react";
import { CalendarClock, Check, Clock, FlaskConical, HeartPulse, IdCard, Navigation, ScanBarcode, SquarePen, Stethoscope, Trash2, User, type LucideIcon } from "lucide-react";
import { C, formatAppointmentTime, sampleAppointment, useApp } from "@/lib/store";
import type { PlaceRole } from "@/lib/map";
import { ActionSheet, AppHeader, BiText, Card, DemoTag, IconBadge, PrimaryButton, Pressable, Screen, TintButton, hexA } from "@/components/fc/ui";
import AppointmentEditSheet from "./AppointmentEditSheet";

interface VisitStep { id: number; ar: string; en: string; icon: LucideIcon; role: PlaceRole | null }

const STEPS: VisitStep[] = [
  { id: 0, ar: "الاستقبال والتسجيل", en: "Reception & Registration", icon: IdCard, role: "reception" },
  { id: 1, ar: "عيادة الفرز والأولويات", en: "Triage & Priorities", icon: Stethoscope, role: "triage" },
  { id: 2, ar: "مختبر التحاليل", en: "Laboratory", icon: FlaskConical, role: "lab" },
  { id: 3, ar: "الطبيب المعالج", en: "Treating Doctor", icon: HeartPulse, role: null },
];

export default function VisitScreen() {
  const app = useApp();
  const [editing, setEditing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const a = app.appointment;
  const go = (s: VisitStep) => (s.role ? app.navigateRole(s.role) : app.navigate(app.appointment.clinicNodeID));

  const row = (Icon: LucideIcon, text: string) => (
    <div className="flex items-center gap-2">
      <span className="flex w-[18px] justify-center"><Icon size={13} color={C.blue} strokeWidth={2.6} /></span>
      <span className="text-[15px]" style={{ color: C.ink }}>{text}</span>
    </div>
  );

  const progress = Math.min(app.visitStep, STEPS.length) / STEPS.length;
  const circ = 2 * Math.PI * 28;

  return (
    <Screen>
      <AppHeader guide="visit" />

      <Card>
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <IconBadge icon={CalendarClock} size={46} />
            <BiText ar="موعدي" en="My appointment" primary="headline" secondary="caption" className="flex-1" />
            {app.appointmentImported && (
              <span dir="ltr" data-testid="visit.ticket" className="rounded-full px-2.5 py-[5px] text-[13px] font-bold tabular-nums" style={{ color: C.blue, background: hexA(C.blue, 0.1) }}>{a.ticket}</span>
            )}
            <DemoTag />
          </div>
          {app.appointmentImported ? (
            <>
              <div className="flex flex-col gap-1.5" data-testid="visit.appointmentDetails">
                {row(User, app.t(a.patientAr, a.patientEn))}
                {row(Stethoscope, app.t(`${a.doctorAr} · ${a.clinicAr} ${a.room}`, `${a.doctorEn} · ${a.clinicEn} ${a.room}`))}
                {row(Clock, formatAppointmentTime(a.date, app.lang))}
              </div>
              <div className="flex items-center gap-2">
                <TintButton testId="visit.edit" onClick={() => setEditing(true)}><SquarePen size={14} />{app.t("تعديل", "Edit")}</TintButton>
                <TintButton onClick={() => app.openScanner("appointment")}><ScanBarcode size={14} />{app.t("مسح جديد", "Scan again")}</TintButton>
                <div className="flex-1" />
                <TintButton color={C.red} label={app.t("حذف الموعد", "Remove appointment")} onClick={() => setConfirmClear(true)}><Trash2 size={15} /></TintButton>
              </div>
            </>
          ) : (
            <>
              <p className="text-[13px]" style={{ color: C.sub }}>{app.t("امسح باركود ورقة الموعد لإضافة موعدك إلى خطة الزيارة.", "Scan your appointment slip to add it to your visit plan.")}</p>
              <TintButton prominent testId="visit.scan" className="w-full py-2.5 text-[15px]" onClick={() => app.openScanner("appointment")}>
                <ScanBarcode size={17} />{app.t("امسح باركود الموعد", "Scan appointment barcode")}
              </TintButton>
            </>
          )}
        </div>
      </Card>

      <Card>
        <div className="flex items-center gap-4">
          <div className="relative h-16 w-16 shrink-0">
            <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90">
              <circle cx="32" cy="32" r="28" fill="none" stroke={hexA(C.blue, 0.15)} strokeWidth="8" />
              <circle cx="32" cy="32" r="28" fill="none" stroke={C.blue} strokeWidth="8" strokeLinecap="round"
                strokeDasharray={circ} strokeDashoffset={circ * (1 - progress)} style={{ transition: "stroke-dashoffset .6s cubic-bezier(.3,1.3,.5,1)" }}
                transform={document.documentElement.dir === "rtl" ? "scale(1,-1) translate(0,-64)" : undefined} />
            </svg>
            <span dir="ltr" className="absolute inset-0 flex items-center justify-center text-[17px] font-semibold tabular-nums" style={{ color: C.ink }}>
              {Math.min(app.visitStep, STEPS.length)}/{STEPS.length}
            </span>
          </div>
          <BiText ar="خطوات زيارتي اليوم" en="My visit steps today" primary="title3" secondary="subheadline" />
        </div>
      </Card>

      <Card>
        <div className="flex flex-col">
          {STEPS.map((step) => {
            const isLast = step.id === STEPS.length - 1;
            const done = step.id < app.visitStep;
            const active = step.id === app.visitStep;
            const next = step.id === app.visitStep + 1;
            const color = done ? C.green : active ? C.blue : hexA(C.sub, 0.5);
            const [pAr, pEn, pColor] = done ? ["مكتملة", "Completed", C.green] : active ? ["قيد الإجراء", "In progress", C.blue] : next ? ["الخطوة القادمة", "Next step", C.orange] : ["لاحقاً", "Later", C.sub];
            const Icon = done ? Check : step.icon;
            return (
              <div key={step.id} className="flex items-stretch gap-3.5">
                <div className="flex flex-col items-center">
                  <div className="relative flex h-[50px] w-[50px] items-center justify-center">
                    {active && <span className="absolute h-[50px] w-[50px] rounded-full" style={{ boxShadow: `inset 0 0 0 6px ${hexA(C.blue, 0.3)}` }} />}
                    <span className="flex h-10 w-10 items-center justify-center rounded-full transition-colors duration-500" style={{ background: done || active ? (done ? C.green : C.blue) : hexA(C.sub, 0.075) }}>
                      <Icon size={17} strokeWidth={2.8} color={done || active ? "#fff" : C.sub} />
                    </span>
                  </div>
                  {!isLast && <div className="min-h-[34px] w-[3px] flex-1 transition-colors duration-500" style={{ background: done ? C.green : C.hairline }} />}
                </div>
                <div className={`flex min-w-0 flex-1 flex-col items-start gap-1.5 pt-1.5 ${isLast ? "" : "pb-3.5"}`}>
                  <BiText ar={`${step.id + 1}. ${step.ar}`} en={`${step.id + 1}. ${step.en}`} primary="headline" secondary="footnote" />
                  <span className="rounded-full px-2.5 py-1 text-[12px] font-bold" style={{ color: pColor, background: hexA(pColor, 0.12) }}>{app.t(pAr, pEn)}</span>
                  {(next || active) && (
                    <TintButton onClick={() => go(step)}><Navigation size={13} />{app.t(`وجّهني إلى ${step.ar}`, `Guide me to ${step.en}`)}</TintButton>
                  )}
                </div>
                <span className="hidden" style={{ color }} />
              </div>
            );
          })}
        </div>
      </Card>

      <div className="flex flex-col gap-2.5">
        {app.visitStep < STEPS.length ? (
          <>
            {app.visitStep + 1 < STEPS.length && (() => {
              const next = STEPS[app.visitStep + 1];
              return <PrimaryButton ar={`وجّهني إلى ${next.ar}`} en={`Guide me to ${next.en}`} icon={Navigation} onClick={() => go(next)} />;
            })()}
            <Pressable
              onClick={() => {
                const n = app.visitStep + 1;
                app.setVisitStep(n);
                if (n < STEPS.length) {
                  const s = STEPS[n];
                  app.showToast(`الخطوة التالية: ${s.ar}`, `Next step: ${s.en}`);
                } else {
                  app.showToast("اكتملت زيارتك اليوم، سلامتك!", "Your visit is complete. Get well soon!");
                }
              }}
              data-testid="visit.finishStep"
              className="flex w-full items-center justify-center gap-2 rounded-full py-3 text-[15px] font-semibold"
              style={{ background: hexA(C.green, 0.12), color: C.green }}
            >
              {app.t("إنهاء الخطوة الحالية", "Finish current step")} <DemoTag />
            </Pressable>
          </>
        ) : (
          <Pressable onClick={() => app.setVisitStep(1)} className="w-full rounded-full py-3 text-center text-[15px] font-semibold" style={{ background: hexA(C.blue, 0.12), color: C.blue }}>
            {app.t("إعادة ضبط الخطة التجريبية", "Reset demo plan")}
          </Pressable>
        )}
      </div>

      <AppointmentEditSheet
        open={editing}
        appointment={app.appointment}
        onClose={() => setEditing(false)}
        onSave={(updated) => {
          app.setAppointment(updated);
          app.setAppointmentImported(true);
          app.showToast("تم حفظ تعديلات الموعد", "Appointment updated");
        }}
      />
      <ActionSheet
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        title={app.t("حذف الموعد المستورد؟", "Remove the imported appointment?")}
        actions={[{ label: app.t("حذف", "Remove"), destructive: true, onClick: () => { app.setAppointment(sampleAppointment()); app.setAppointmentImported(false); } }]}
      />
    </Screen>
  );
}
