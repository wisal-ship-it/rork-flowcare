import SwiftUI

/// Lets staff or patients correct a scanned demo appointment before saving it.
struct AppointmentEditSheet: View {
    @Environment(AppState.self) private var app
    @Environment(\.dismiss) private var dismiss
    let onSave: (Appointment) -> Void

    @State private var draft: Appointment
    @State private var patient: String
    @State private var doctor: String

    init(appointment: Appointment, onSave: @escaping (Appointment) -> Void) {
        self.onSave = onSave
        _draft = State(initialValue: appointment)
        _patient = State(initialValue: appointment.patientAr)
        _doctor = State(initialValue: appointment.doctorAr)
    }

    private var canSave: Bool {
        !patient.trimmingCharacters(in: .whitespaces).isEmpty
            && !doctor.trimmingCharacters(in: .whitespaces).isEmpty
            && !draft.ticket.trimmingCharacters(in: .whitespaces).isEmpty
    }

    var body: some View {
        NavigationStack {
            Form {
                Section(app.t("المريض", "Patient")) {
                    TextField(app.t("اسم المريض", "Patient name"), text: $patient)
                        .textContentType(.name)
                        .accessibilityIdentifier("edit.patient")
                    TextField(app.t("رقم الموعد", "Appointment ID"), text: $draft.ticket)
                        .textInputAutocapitalization(.characters)
                        .autocorrectionDisabled()
                        .accessibilityIdentifier("edit.ticket")
                }
                Section(app.t("الموعد", "Appointment")) {
                    TextField(app.t("اسم الطبيب", "Doctor name"), text: $doctor)
                        .accessibilityIdentifier("edit.doctor")
                    Picker(app.t("العيادة", "Clinic"), selection: $draft.clinicNodeID) {
                        ForEach(app.map.clinics) { clinic in
                            Text(app.t("\(clinic.ar) \(clinic.code ?? "")", "\(clinic.en) \(clinic.code ?? "")"))
                                .tag(clinic.id)
                        }
                    }
                    .accessibilityIdentifier("edit.clinic")
                    DatePicker(app.t("التاريخ والوقت", "Date & time"), selection: $draft.date, in: Calendar.current.startOfDay(for: .now)...)
                        .environment(\.locale, Locale(identifier: app.lang == .ar ? "ar" : "en"))
                }
                Section {
                    HStack {
                        DemoTag()
                        Text(app.t("بيانات تجريبية تُحفظ على هذا الجهاز فقط", "Demo data saved on this device only"))
                            .font(.footnote)
                            .foregroundStyle(Theme.sub)
                    }
                }
            }
            .navigationTitle(app.t("تعديل بيانات الموعد", "Edit appointment"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(app.t("إلغاء", "Cancel")) { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(app.t("حفظ", "Save")) { save() }
                        .disabled(!canSave)
                        .accessibilityIdentifier("edit.save")
                }
            }
        }
        .environment(\.layoutDirection, app.lang == .ar ? .rightToLeft : .leftToRight)
    }

    private func save() {
        var a = draft
        let p = patient.trimmingCharacters(in: .whitespaces)
        let d = doctor.trimmingCharacters(in: .whitespaces)
        if p != draft.patientAr { a.patientAr = p; a.patientEn = p }
        if d != draft.doctorAr { a.doctorAr = d; a.doctorEn = d }
        a.ticket = a.ticket.trimmingCharacters(in: .whitespaces).uppercased()
        if let clinic = app.map.node(a.clinicNodeID) {
            a.clinicAr = clinic.ar
            a.clinicEn = clinic.en
            a.room = clinic.code ?? a.room
        }
        onSave(a)
        dismiss()
    }
}
