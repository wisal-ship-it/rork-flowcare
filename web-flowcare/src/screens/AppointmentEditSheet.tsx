import { useEffect, useState } from "react";
import { C, useApp, type Appointment } from "@/lib/store";
import { nodeAr, nodeEn, findNode } from "@/lib/map";
import { DemoTag, Pressable, SheetSection } from "@/components/fc/ui";

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Lets staff or patients correct a scanned demo appointment before saving it. */
export default function AppointmentEditSheet({ open, appointment, onClose, onSave }: {
  open: boolean; appointment: Appointment; onClose: () => void; onSave: (updated: Appointment) => void;
}) {
  const app = useApp();
  const [draft, setDraft] = useState(appointment);
  const [patient, setPatient] = useState(appointment.patientAr);
  const [doctor, setDoctor] = useState(appointment.doctorAr);

  useEffect(() => {
    if (!open) return;
    setDraft(appointment);
    setPatient(appointment.patientAr);
    setDoctor(appointment.doctorAr);
  }, [open, appointment]);

  if (!open) return null;
  const clinics = app.map.nodes.filter((n) => n.kind === "clinic");
  const canSave = patient.trim() !== "" && doctor.trim() !== "" && draft.ticket.trim() !== "";
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const save = () => {
    const a = { ...draft };
    const p = patient.trim(), d = doctor.trim();
    if (p !== draft.patientAr) { a.patientAr = p; a.patientEn = p; }
    if (d !== draft.doctorAr) { a.doctorAr = d; a.doctorEn = d; }
    a.ticket = a.ticket.trim().toUpperCase();
    const clinic = findNode(app.map, a.clinicNodeID);
    if (clinic) {
      a.clinicAr = nodeAr(clinic);
      a.clinicEn = nodeEn(clinic);
      a.room = clinic.code ?? a.room;
    }
    onSave(a);
    onClose();
  };

  const field = "w-full bg-transparent px-4 py-3 text-[17px] outline-none";
  return (
    <div className="fixed inset-0 z-[55] flex items-end justify-center" role="dialog" aria-modal="true" aria-label={app.t("تعديل بيانات الموعد", "Edit appointment")}>
      <div className="fc-fade absolute inset-0 bg-black/35" onClick={onClose} />
      <div className="fc-sheet relative flex max-h-[92dvh] min-h-[70dvh] w-full max-w-[480px] flex-col rounded-t-[28px]" style={{ background: "#F2F5F9" }}>
        <div className="mx-auto mt-2 h-[5px] w-9 rounded-full bg-black/15" />
        <div className="flex items-center gap-2 px-4 py-2">
          <Pressable onClick={onClose} className="text-[17px]" style={{ color: C.blue }}>{app.t("إلغاء", "Cancel")}</Pressable>
          <div className="flex-1 text-center text-[17px] font-semibold" style={{ color: C.ink }}>{app.t("تعديل بيانات الموعد", "Edit appointment")}</div>
          <Pressable onClick={save} disabled={!canSave} data-testid="edit.save" className="text-[17px] font-semibold" style={{ color: C.blue }}>{app.t("حفظ", "Save")}</Pressable>
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-2">
          <SheetSection title={app.t("المريض", "Patient")}>
            <input data-testid="edit.patient" className={field} value={patient} onChange={(e) => setPatient(e.target.value)} placeholder={app.t("اسم المريض", "Patient name")} autoComplete="name" style={{ color: C.ink }} />
            <input data-testid="edit.ticket" dir="ltr" className={`${field} ${app.lang === "ar" ? "text-right" : ""}`} value={draft.ticket} onChange={(e) => setDraft({ ...draft, ticket: e.target.value.toUpperCase() })} placeholder={app.t("رقم الموعد", "Appointment ID")} autoCapitalize="characters" autoCorrect="off" style={{ color: C.ink }} />
          </SheetSection>
          <SheetSection title={app.t("الموعد", "Appointment")}>
            <input data-testid="edit.doctor" className={field} value={doctor} onChange={(e) => setDoctor(e.target.value)} placeholder={app.t("اسم الطبيب", "Doctor name")} style={{ color: C.ink }} />
            <label className="flex items-center justify-between gap-3 px-4 py-2.5">
              <span className="text-[17px]" style={{ color: C.ink }}>{app.t("العيادة", "Clinic")}</span>
              <select data-testid="edit.clinic" value={draft.clinicNodeID} onChange={(e) => setDraft({ ...draft, clinicNodeID: e.target.value })} className="max-w-[60%] bg-transparent text-[17px] outline-none" style={{ color: C.sub }}>
                {clinics.map((c) => (
                  <option key={c.id} value={c.id}>{app.t(`${nodeAr(c)} ${c.code ?? ""}`, `${nodeEn(c)} ${c.code ?? ""}`)}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center justify-between gap-3 px-4 py-2.5">
              <span className="text-[17px]" style={{ color: C.ink }}>{app.t("التاريخ والوقت", "Date & time")}</span>
              <input
                type="datetime-local"
                data-testid="edit.date"
                min={toLocalInput(today.toISOString())}
                value={toLocalInput(draft.date)}
                onChange={(e) => { if (e.target.value) setDraft({ ...draft, date: new Date(e.target.value).toISOString() }); }}
                className="rounded-lg px-2 py-1 text-[15px] outline-none"
                style={{ background: "rgba(118,118,128,0.12)", color: C.ink }}
              />
            </label>
          </SheetSection>
          <SheetSection>
            <div className="flex items-center gap-2 px-4 py-3">
              <DemoTag />
              <span className="text-[13px]" style={{ color: C.sub }}>{app.t("بيانات تجريبية تُحفظ على هذا الجهاز فقط", "Demo data saved on this device only")}</span>
            </div>
          </SheetSection>
        </div>
      </div>
    </div>
  );
}
