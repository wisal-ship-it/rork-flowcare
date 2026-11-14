import SwiftUI

struct VisitStep: Identifiable {
    let id: Int
    let ar: String
    let en: String
    let symbol: String
    /// nil = the treating doctor's clinic from the appointment.
    let role: PlaceRole?
}

struct VisitView: View {
    @Environment(AppState.self) private var app
    @State private var showScanner = false
    @State private var editing = false
    @State private var confirmClear = false

    private let steps: [VisitStep] = [
        .init(id: 0, ar: "الاستقبال والتسجيل", en: "Reception & Registration", symbol: "person.text.rectangle", role: .reception),
        .init(id: 1, ar: "عيادة الفرز والأولويات", en: "Triage & Priorities", symbol: "stethoscope", role: .triage),
        .init(id: 2, ar: "مختبر التحاليل", en: "Laboratory", symbol: "testtube.2", role: .lab),
        .init(id: 3, ar: "الطبيب المعالج", en: "Treating Doctor", symbol: "heart.text.square", role: nil),
    ]

    private func go(_ step: VisitStep) {
        if let role = step.role { app.navigate(role: role) } else { app.navigate(to: app.appointment.clinicNodeID) }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 14) {
                    AppHeader(guide: .visit)
                    appointmentCard
                    summary
                    timeline
                    actions
                }
                .padding(.horizontal, 18)
                .padding(.top, 8)
                .padding(.bottom, 24)
            }
            .scrollIndicators(.hidden)
            .background(ScreenBackground())
            .toolbar(.hidden, for: .navigationBar)
            .fullScreenCover(isPresented: $showScanner) {
                ScannerView()
            }
            .sheet(isPresented: $editing) {
                AppointmentEditSheet(appointment: app.appointment) { updated in
                    app.appointment = updated
                    app.appointmentImported = true
                    app.showToast("تم حفظ تعديلات الموعد", "Appointment updated", symbol: "checkmark.circle.fill")
                }
                .environment(app)
            }
            .confirmationDialog(app.t("حذف الموعد المستورد؟", "Remove the imported appointment?"), isPresented: $confirmClear, titleVisibility: .visible) {
                Button(app.t("حذف", "Remove"), role: .destructive) {
                    app.appointment = .sample
                    app.appointmentImported = false
                }
            }
        }
    }

    // MARK: My appointment

    private var appointmentCard: some View {
        let a = app.appointment
        return VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 12) {
                IconBadge(symbol: "calendar.badge.clock", size: 46)
                BiText(ar: "موعدي", en: "My appointment", primary: .headline, secondary: .caption)
                Spacer()
                if app.appointmentImported {
                    Text(a.ticket)
                        .font(.footnote.weight(.bold).monospacedDigit())
                        .foregroundStyle(Theme.blue)
                        .padding(.horizontal, 10).padding(.vertical, 5)
                        .background(Theme.blue.opacity(0.1), in: .capsule)
                        .environment(\.layoutDirection, .leftToRight)
                        .accessibilityIdentifier("visit.ticket")
                }
                DemoTag()
            }
            if app.appointmentImported {
                VStack(alignment: .leading, spacing: 6) {
                    row("person.fill", app.t(a.patientAr, a.patientEn))
                    row("stethoscope", app.t("\(a.doctorAr) · \(a.clinicAr) \(a.room)", "\(a.doctorEn) · \(a.clinicEn) \(a.room)"))
                    row("clock.fill", app.t(a.timeAr, a.timeEn))
                }
                .accessibilityElement(children: .combine)
                .accessibilityIdentifier("visit.appointmentDetails")
                HStack(spacing: 8) {
                    Button { editing = true } label: {
                        Label(app.t("تعديل", "Edit"), systemImage: "square.and.pencil").font(.footnote.weight(.bold))
                    }
                    .buttonStyle(.bordered)
                    .accessibilityIdentifier("visit.edit")
                    Button { showScanner = true } label: {
                        Label(app.t("مسح جديد", "Scan again"), systemImage: "barcode.viewfinder").font(.footnote.weight(.bold))
                    }
                    .buttonStyle(.bordered)
                    Spacer()
                    Button(role: .destructive) { confirmClear = true } label: {
                        Image(systemName: "trash")
                    }
                    .buttonStyle(.bordered)
                    .accessibilityLabel(app.t("حذف الموعد", "Remove appointment"))
                }
                .tint(Theme.blue)
            } else {
                Text(app.t("امسح باركود ورقة الموعد لإضافة موعدك إلى خطة الزيارة.", "Scan your appointment slip to add it to your visit plan."))
                    .font(.footnote)
                    .foregroundStyle(Theme.sub)
                Button { showScanner = true } label: {
                    Label(app.t("امسح باركود الموعد", "Scan appointment barcode"), systemImage: "barcode.viewfinder")
                        .font(.subheadline.weight(.bold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 4)
                }
                .buttonStyle(.borderedProminent)
                .tint(Theme.blue)
                .accessibilityIdentifier("visit.scan")
            }
        }
        .card()
    }

    private func row(_ symbol: String, _ text: String) -> some View {
        HStack(spacing: 8) {
            Image(systemName: symbol).font(.caption).foregroundStyle(Theme.blue).frame(width: 18)
            Text(text).font(.subheadline).foregroundStyle(Theme.ink)
        }
    }

    private var summary: some View {
        HStack(spacing: 16) {
            ZStack {
                Circle().stroke(Theme.blue.opacity(0.15), lineWidth: 8)
                Circle()
                    .trim(from: 0, to: CGFloat(app.visitStep) / CGFloat(steps.count))
                    .stroke(Theme.blue, style: StrokeStyle(lineWidth: 8, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                Text("\(min(app.visitStep, steps.count))/\(steps.count)")
                    .font(.headline.monospacedDigit())
                    .foregroundStyle(Theme.ink)
                    .environment(\.layoutDirection, .leftToRight)
            }
            .frame(width: 64, height: 64)
            .animation(.spring, value: app.visitStep)
            BiText(ar: "خطوات زيارتي اليوم", en: "My visit steps today",
                   primary: .title3.weight(.bold), secondary: .subheadline)
            Spacer()
        }
        .card()
    }

    private var timeline: some View {
        VStack(spacing: 0) {
            ForEach(steps) { step in
                stepRow(step, isLast: step.id == steps.count - 1)
            }
        }
        .card()
    }

    private func stepRow(_ step: VisitStep, isLast: Bool) -> some View {
        let done = step.id < app.visitStep
        let active = step.id == app.visitStep
        let next = step.id == app.visitStep + 1
        let color: Color = done ? Theme.green : (active ? Theme.blue : Theme.sub.opacity(0.5))
        return HStack(alignment: .top, spacing: 14) {
            VStack(spacing: 0) {
                ZStack {
                    Circle().fill(color.opacity(done || active ? 1 : 0.15)).frame(width: 40, height: 40)
                    if active {
                        Circle().stroke(Theme.blue.opacity(0.3), lineWidth: 6).frame(width: 50, height: 50)
                    }
                    Image(systemName: done ? "checkmark" : step.symbol)
                        .font(.subheadline.weight(.bold))
                        .foregroundStyle(done || active ? .white : Theme.sub)
                }
                .frame(width: 50, height: 50)
                if !isLast {
                    Rectangle()
                        .fill(done ? Theme.green : Theme.hairline)
                        .frame(width: 3)
                        .frame(minHeight: 34)
                }
            }
            VStack(alignment: .leading, spacing: 6) {
                BiText(ar: "\(step.id + 1). \(step.ar)", en: "\(step.id + 1). \(step.en)",
                       primary: .headline, secondary: .footnote)
                statusPill(done: done, active: active, next: next)
                if next || active {
                    Button {
                        go(step)
                    } label: {
                        Label(app.t("وجّهني إلى \(step.ar)", "Guide me to \(step.en)"), systemImage: "location.north.fill")
                            .font(.footnote.weight(.bold))
                    }
                    .buttonStyle(.bordered)
                    .tint(Theme.blue)
                }
            }
            .padding(.top, 6)
            .padding(.bottom, isLast ? 0 : 14)
            Spacer(minLength: 0)
        }
    }

    private func statusPill(done: Bool, active: Bool, next: Bool) -> some View {
        let (ar, en, color): (String, String, Color) =
            done ? ("مكتملة", "Completed", Theme.green)
            : active ? ("قيد الإجراء", "In progress", Theme.blue)
            : next ? ("الخطوة القادمة", "Next step", Theme.orange)
            : ("لاحقاً", "Later", Theme.sub)
        return Text(app.t(ar, en))
            .font(.caption.weight(.bold))
            .foregroundStyle(color)
            .padding(.horizontal, 10)
            .padding(.vertical, 4)
            .background(color.opacity(0.12), in: .capsule)
    }

    private var actions: some View {
        VStack(spacing: 10) {
            if app.visitStep < steps.count {
                let next = steps[min(app.visitStep + 1, steps.count - 1)]
                if app.visitStep + 1 < steps.count {
                    PrimaryButton(ar: "وجّهني إلى \(next.ar)", en: "Guide me to \(next.en)", symbol: "location.north.fill") {
                        go(next)
                    }
                }
                Button {
                    withAnimation(.spring) { app.visitStep += 1 }
                    if app.visitStep < steps.count {
                        let s = steps[app.visitStep]
                        app.showToast("الخطوة التالية: \(s.ar)", "Next step: \(s.en)", symbol: "arrow.forward.circle.fill")
                    } else {
                        app.showToast("اكتملت زيارتك اليوم، سلامتك!", "Your visit is complete. Get well soon!", symbol: "checkmark.seal.fill")
                    }
                } label: {
                    HStack {
                        Text(app.t("إنهاء الخطوة الحالية", "Finish current step"))
                        DemoTag()
                    }
                    .font(.subheadline.weight(.semibold))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 6)
                }
                .buttonStyle(.bordered)
                .tint(Theme.green)
                .sensoryFeedback(.success, trigger: app.visitStep)
            } else {
                Button {
                    withAnimation(.spring) { app.visitStep = 1 }
                } label: {
                    Text(app.t("إعادة ضبط الخطة التجريبية", "Reset demo plan"))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 6)
                }
                .buttonStyle(.bordered)
            }
        }
    }
}
