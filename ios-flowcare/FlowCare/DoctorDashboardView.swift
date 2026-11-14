import SwiftUI

private struct QueuePatient: Identifiable, Equatable {
    let id: String
    let nameAr: String
    let nameEn: String
    let timeLabel: String
    var urgent = false
}

struct DoctorDashboardView: View {
    @Environment(AppState.self) private var app
    @State private var queue: [QueuePatient] = [
        QueuePatient(id: "A-2047", nameAr: "أحمد الشمري", nameEn: "Ahmed Al-Shammari", timeLabel: "10:20"),
        QueuePatient(id: "A-2048", nameAr: "ليلى الحربي", nameEn: "Layla Al-Harbi", timeLabel: "10:35", urgent: true),
        QueuePatient(id: "A-2049", nameAr: "خالد الدوسري", nameEn: "Khalid Al-Dosari", timeLabel: "10:50"),
    ]
    @State private var seenToday = 14
    @State private var current: QueuePatient?
    @State private var callCount = 0

    var body: some View {
        @Bindable var app = app
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                doctorCard
                VStack(alignment: .leading, spacing: 10) {
                    BiText(ar: "حالة العيادة", en: "Clinic status", primary: .headline, secondary: .caption)
                    Picker(app.t("حالة العيادة", "Clinic status"), selection: $app.clinicStatus) {
                        ForEach(ClinicStatus.allCases) { s in
                            Text(app.t(s.ar, s.en)).tag(s)
                        }
                    }
                    .pickerStyle(.segmented)
                    HStack(spacing: 6) {
                        Circle().fill(app.clinicStatus.color).frame(width: 8, height: 8)
                        Text(app.t("تظهر هذه الحالة للمرضى في الصفحة الرئيسية", "Patients see this status on their home screen"))
                            .font(.caption).foregroundStyle(Theme.sub)
                    }
                }
                .card()

                HStack(spacing: 10) {
                    metric("person.2.fill", "\(queue.count)", "منتظرون", "Waiting", Theme.blue)
                    metric("clock.fill", "\(queue.isEmpty ? 0 : 12)", "متوسط الانتظار (د)", "Avg wait (min)", Theme.orange)
                    metric("checkmark.seal.fill", "\(seenToday)", "رأيتهم اليوم", "Seen today", Theme.green)
                }

                if let current {
                    HStack(spacing: 12) {
                        IconBadge(symbol: "speaker.wave.2.fill", color: Theme.green, size: 44)
                        BiText(ar: "في العيادة الآن: \(current.nameAr)", en: "In clinic now: \(current.nameEn)", primary: .subheadline.weight(.semibold), secondary: .caption)
                        Spacer()
                        Text(current.id).font(.caption.weight(.bold).monospacedDigit()).foregroundStyle(Theme.green)
                    }
                    .card(padding: 12)
                    .transition(.move(edge: .top).combined(with: .opacity))
                }

                VStack(alignment: .leading, spacing: 0) {
                    BiText(ar: "طابور المرضى", en: "Patient queue", primary: .headline, secondary: .caption)
                        .padding(.bottom, 8)
                    if queue.isEmpty {
                        Text(app.t("لا يوجد مرضى في الانتظار", "No patients waiting"))
                            .font(.subheadline).foregroundStyle(Theme.sub)
                            .frame(maxWidth: .infinity).padding(.vertical, 20)
                    }
                    ForEach(Array(queue.enumerated()), id: \.element.id) { index, p in
                        if index > 0 { Divider() }
                        queueRow(p, isNext: index == 0)
                    }
                }
                .card()
            }
            .padding(.horizontal, 18)
            .padding(.top, 8)
            .padding(.bottom, 110)
        }
        .background(ScreenBackground())
        .safeAreaInset(edge: .bottom) {
            PrimaryButton(ar: "استدعاء المريض التالي", en: "Call Next Patient", symbol: "megaphone.fill",
                          color: queue.isEmpty ? Theme.sub : Theme.blue) { callNext() }
                .disabled(queue.isEmpty)
                .padding(.horizontal, 18)
                .padding(.bottom, 8)
        }
        .navigationTitle(app.t("لوحة الطبيب", "Doctor Dashboard"))
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(.hidden, for: .tabBar)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) { GuideButton(guide: .doctor) }
            ToolbarItem(placement: .topBarTrailing) { LanguageToggle() }
        }
        .sensoryFeedback(.impact(weight: .medium), trigger: callCount)
        .sensoryFeedback(.selection, trigger: app.clinicStatus)
    }

    private var doctorCard: some View {
        HStack(spacing: 14) {
            Image(systemName: "stethoscope")
                .font(.title2.weight(.semibold))
                .foregroundStyle(.white)
                .frame(width: 56, height: 56)
                .background(.white.opacity(0.2), in: .rect(cornerRadius: 18))
            BiText(ar: app.appointment.doctorAr, en: app.appointment.doctorEn, primary: .title3.weight(.bold), secondary: .subheadline,
                   primaryColor: .white, secondaryColor: .white.opacity(0.8))
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                Text(app.t("غرفة", "Room")).font(.caption).foregroundStyle(.white.opacity(0.8))
                Text(app.appointment.room).font(.title2.weight(.heavy).monospacedDigit()).foregroundStyle(.white)
            }
        }
        .padding(18)
        .background(Theme.heroGradient, in: .rect(cornerRadius: 24))
        .shadow(color: Theme.blue.opacity(0.3), radius: 16, y: 8)
    }

    private func metric(_ symbol: String, _ value: String, _ ar: String, _ en: String, _ color: Color) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Image(systemName: symbol).foregroundStyle(color)
            Text(value)
                .font(.system(.title, design: .rounded).weight(.heavy).monospacedDigit())
                .foregroundStyle(Theme.ink)
                .contentTransition(.numericText())
            Text(app.t(ar, en)).font(.caption.weight(.semibold)).foregroundStyle(Theme.ink).lineLimit(2)
            Text(app.other(ar, en)).font(.caption2).foregroundStyle(Theme.sub).lineLimit(2)
        }
        .card(padding: 12)
    }

    private func queueRow(_ p: QueuePatient, isNext: Bool) -> some View {
        HStack(spacing: 12) {
            Text(p.id)
                .font(.caption.weight(.heavy).monospacedDigit())
                .foregroundStyle(isNext ? .white : Theme.blue)
                .padding(.horizontal, 8).padding(.vertical, 6)
                .background(isNext ? Theme.blue : Theme.blue.opacity(0.12), in: .rect(cornerRadius: 10))
            BiText(ar: p.nameAr, en: p.nameEn, primary: .subheadline.weight(.semibold), secondary: .caption)
            Spacer()
            if p.urgent {
                Text(app.t("مستعجل", "Urgent"))
                    .font(.caption2.weight(.heavy))
                    .foregroundStyle(Theme.red)
                    .padding(.horizontal, 8).padding(.vertical, 4)
                    .background(Theme.red.opacity(0.12), in: .capsule)
            }
            Text(p.timeLabel).font(.caption.monospacedDigit()).foregroundStyle(Theme.sub)
        }
        .padding(.vertical, 10)
    }

    private func callNext() {
        guard !queue.isEmpty else { return }
        let next = queue[0]
        withAnimation(.spring(response: 0.4, dampingFraction: 0.85)) {
            current = next
            queue.removeFirst()
            seenToday += 1
        }
        callCount += 1
        app.showToast("تم استدعاء \(next.nameAr) (\(next.id)) إلى غرفة \(app.appointment.room)",
                      "Called \(next.nameEn) (\(next.id)) to room \(app.appointment.room)",
                      symbol: "megaphone.fill", demo: true)
    }
}
