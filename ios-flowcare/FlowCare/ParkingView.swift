import SwiftUI

enum BayState { case free, occupied, reserved, mine }

struct ParkingBay: Identifiable, Equatable {
    let id: String
    var state: BayState
}

struct ParkingView: View {
    @Environment(AppState.self) private var app
    @State private var selectedBay: ParkingBay?
    @State private var showWhereParked = false
    @State private var lot: [ParkingBay] = [
        .init(id: "A-01", state: .free), .init(id: "A-02", state: .occupied),
        .init(id: "A-03", state: .occupied), .init(id: "A-04", state: .free),
        .init(id: "A-09", state: .occupied), .init(id: "A-11", state: .free),
        .init(id: "A-12", state: .free), .init(id: "A-14", state: .reserved),
    ]
    /// Simulated free bays across the whole lot (demo only).
    @State private var freeCount = 18

    /// The bay shown as "yours": the saved one, otherwise the assigned A-12.
    private var myBay: String { app.parkedCar?.bay ?? "A-12" }

    private func display(_ bay: ParkingBay) -> ParkingBay {
        bay.id == myBay ? ParkingBay(id: bay.id, state: .mine) : bay
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 14) {
                    AppHeader(guide: .parking)
                    legend
                    lotPanel
                    spotCard
                    PrimaryButton(ar: "التوجيه إلى الموقف", en: "Navigate to Spot") {
                        app.navigate(role: .parking)
                    }
                    .accessibilityIdentifier("parking.navigate")
                    whereParkedCard
                }
                .padding(.horizontal, 18)
                .padding(.top, 8)
                .padding(.bottom, 24)
            }
            .scrollIndicators(.hidden)
            .background(ScreenBackground())
            .toolbar(.hidden, for: .navigationBar)
            .confirmationDialog(
                selectedBay.map { app.t("موقف \($0.id)", "Bay \($0.id)") } ?? "",
                isPresented: Binding(get: { selectedBay != nil }, set: { if !$0 { selectedBay = nil } }),
                titleVisibility: .visible,
                presenting: selectedBay
            ) { bay in
                if bay.state == .free || bay.state == .mine {
                    Button(app.t("أوقفت سيارتي هنا", "I parked here")) { park(at: bay.id) }
                }
                Button(app.t("وجّهني إلى المواقف", "Guide me to parking")) { app.navigate(role: .parking) }
                Button(app.t("إلغاء", "Cancel"), role: .cancel) {}
            } message: { bay in
                Text(stateText(bay.state))
            }
            .sheet(isPresented: $showWhereParked) {
                WhereParkedSheet(suggestedBay: myBay)
                    .environment(app)
                    .presentationDetents([.large])
            }
            .task { await simulateLiveLot() }
        }
    }

    private func park(at bay: String) {
        app.parkedCar = ParkedCar(bay: bay, level: app.parkedCar?.level ?? "1", note: app.parkedCar?.note ?? "", savedAt: .now)
        app.showToast("تم حفظ موقع سيارتك: \(bay)", "Car location saved: \(bay)", symbol: "checkmark.circle.fill", demo: false)
    }

    /// Demo-only: bays change every few seconds to show how live sensor data would look.
    private func simulateLiveLot() async {
        while !Task.isCancelled {
            try? await Task.sleep(for: .seconds(5))
            guard !Task.isCancelled else { return }
            let candidates = lot.indices.filter { lot[$0].state == .free || lot[$0].state == .occupied }.filter { lot[$0].id != myBay }
            guard let i = candidates.randomElement() else { continue }
            withAnimation(.easeInOut(duration: 0.4)) {
                let nowFree = lot[i].state == .occupied
                lot[i].state = nowFree ? .free : .occupied
                freeCount = min(max(freeCount + (nowFree ? 1 : -1), 6), 30)
            }
        }
    }

    private func stateText(_ s: BayState) -> String {
        switch s {
        case .free: app.t("هذا الموقف شاغر", "This bay is free")
        case .occupied: app.t("هذا الموقف مشغول", "This bay is occupied")
        case .reserved: app.t("محجوز لذوي الاحتياجات الخاصة", "Reserved for accessible parking")
        case .mine: app.t("هذا موقفك", "This is your spot")
        }
    }

    private var legend: some View {
        HStack {
            legendItem(Theme.green, "شاغر", "Free")
            Spacer()
            legendItem(Theme.red, "مشغول", "Occupied")
            Spacer()
            legendItem(Theme.blue, "محجوز", "Reserved")
            Spacer()
            legendItem(Theme.orange, "موقفك", "Yours")
        }
        .card(padding: 14)
    }

    private func legendItem(_ color: Color, _ ar: String, _ en: String) -> some View {
        HStack(spacing: 6) {
            Circle().fill(color).frame(width: 10, height: 10)
            Text(app.t(ar, en)).font(.caption.weight(.semibold)).foregroundStyle(Theme.ink)
        }
    }

    private var lotPanel: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                BiText(ar: "المواقف الذكية", en: "Smart Parking", primary: .title2.weight(.bold), secondary: .subheadline,
                       primaryColor: .white, secondaryColor: .white.opacity(0.7))
                Spacer()
                VStack(alignment: .trailing, spacing: 4) {
                    Text(app.t("شاغر \(freeCount) من 40", "\(freeCount) free of 40"))
                        .font(.caption.weight(.bold).monospacedDigit())
                        .foregroundStyle(.white)
                        .contentTransition(.numericText())
                        .padding(.horizontal, 10).padding(.vertical, 6)
                        .background(.white.opacity(0.14), in: .capsule)
                    HStack(spacing: 4) {
                        Circle().fill(Theme.green).frame(width: 6, height: 6)
                        Text(app.t("مباشر · تجريبي", "Live · Demo"))
                    }
                    .font(.caption2.weight(.bold))
                    .foregroundStyle(.white.opacity(0.75))
                }
            }
            Group {
                bayRow(Array(lot.prefix(4)))
                HStack(spacing: 0) {
                    ForEach(0..<3) { _ in
                        Rectangle().fill(.white.opacity(0.25)).frame(height: 2)
                        Image(systemName: "arrow.right")
                            .font(.headline)
                            .foregroundStyle(.white.opacity(0.6))
                            .padding(.horizontal, 8)
                    }
                    Rectangle().fill(.white.opacity(0.25)).frame(height: 2)
                }
                bayRow(Array(lot.suffix(4)))
            }
            .environment(\.layoutDirection, .leftToRight)
        }
        .padding(18)
        .background(Theme.navy, in: .rect(cornerRadius: 26))
        .shadow(color: Theme.navy.opacity(0.25), radius: 16, y: 8)
    }

    private func bayRow(_ bays: [ParkingBay]) -> some View {
        HStack(spacing: 8) {
            ForEach(bays) { raw in
                let bay = display(raw)
                Button { selectedBay = bay } label: { bayCell(bay) }
                    .buttonStyle(PressableStyle())
                    .accessibilityIdentifier("bay.\(bay.id)")
            }
        }
    }

    @ViewBuilder
    private func bayCell(_ bay: ParkingBay) -> some View {
        let color: Color? = switch bay.state {
        case .free: nil
        case .occupied: Theme.red
        case .reserved: Theme.blue
        case .mine: Theme.orange
        }
        VStack(spacing: 4) {
            Image(systemName: bay.state == .reserved ? "figure.roll" : (bay.state == .free ? "parkingsign" : "car.fill"))
                .font(.headline)
            Text(bay.id).font(.footnote.weight(.heavy))
        }
        .foregroundStyle(.white.opacity(bay.state == .free ? 0.75 : 1))
        .frame(maxWidth: .infinity)
        .frame(height: 74)
        .background {
            if let color {
                RoundedRectangle(cornerRadius: 14).fill(color)
            } else {
                RoundedRectangle(cornerRadius: 14).fill(Theme.green.opacity(0.85))
            }
        }
        .overlay {
            if bay.state == .mine {
                RoundedRectangle(cornerRadius: 14).stroke(.white, lineWidth: 3)
            }
        }
        .scaleEffect(bay.state == .mine ? 1.04 : 1)
    }

    private var spotCard: some View {
        HStack(spacing: 14) {
            IconBadge(symbol: "car.fill", size: 58)
            VStack(alignment: .leading, spacing: 4) {
                BiText(ar: app.parkedCar == nil ? "موقفك المخصص" : "موقف سيارتك",
                       en: app.parkedCar == nil ? "Your Spot" : "Your Car",
                       primary: .subheadline.weight(.semibold), secondary: .caption)
                Text(app.t("موقف \(myBay)", "Spot \(myBay)"))
                    .font(.title2.weight(.heavy))
                    .foregroundStyle(Theme.navy)
                    .accessibilityIdentifier("parking.mySpot")
                let level = app.parkedCar?.level ?? "1"
                Text(app.t("المستوى \(level) · بوابة المواقف A", "Level \(level) · Parking Gate A"))
                    .font(.caption)
                    .foregroundStyle(Theme.sub)
            }
            Spacer()
        }
        .card()
    }

    private var whereParkedCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Button { showWhereParked = true } label: {
                HStack(spacing: 14) {
                    IconBadge(symbol: "car.side.fill", color: Theme.green, size: 52)
                    VStack(alignment: .leading, spacing: 2) {
                        BiText(ar: "أين أوقفت سيارتي؟", en: "Where Did I Park?")
                        if let car = app.parkedCar {
                            Text(app.t("\(car.bay) · محفوظ ", "\(car.bay) · Saved ") + car.savedAt.formatted(.relative(presentation: .named).locale(Locale(identifier: app.lang == .ar ? "ar" : "en"))))
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(Theme.green)
                                .accessibilityIdentifier("parking.savedLabel")
                        }
                    }
                    Spacer()
                    Image(systemName: "chevron.forward").foregroundStyle(Theme.sub)
                }
                .contentShape(.rect)
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("parking.whereParked")

            Button {
                park(at: myBay)
            } label: {
                BiText(ar: "حفظ الموقع", en: "Save Location", primary: .headline, secondary: .caption,
                       primaryColor: Theme.blue, alignment: .center)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(Theme.blue.opacity(0.1), in: .rect(cornerRadius: 16))
            }
            .buttonStyle(PressableStyle())
            .accessibilityIdentifier("parking.save")
        }
        .card()
    }
}

struct WhereParkedSheet: View {
    @Environment(AppState.self) private var app
    @Environment(\.dismiss) private var dismiss
    let suggestedBay: String

    @State private var bay = ""
    @State private var level = "1"
    @State private var note = ""
    @State private var editing = false

    private let levels = ["B1", "1", "2"]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 18) {
                    Image(systemName: "car.circle.fill")
                        .font(.system(size: 64))
                        .foregroundStyle(Theme.green)
                        .symbolEffect(.bounce, value: app.parkedCar)
                    if let car = app.parkedCar, !editing {
                        savedView(car)
                    } else {
                        form
                    }
                }
                .padding(24)
            }
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(app.t("إغلاق", "Close")) { dismiss() }
                }
            }
        }
        .environment(\.layoutDirection, app.lang == .ar ? .rightToLeft : .leftToRight)
        .onAppear { load() }
    }

    private func load() {
        bay = app.parkedCar?.bay ?? suggestedBay
        level = app.parkedCar?.level ?? "1"
        note = app.parkedCar?.note ?? ""
    }

    private func savedView(_ car: ParkedCar) -> some View {
        VStack(spacing: 14) {
            BiText(ar: "سيارتك في الموقف \(car.bay)، المستوى \(car.level)", en: "Your car is at \(car.bay), Level \(car.level)",
                   primary: .title3.weight(.bold), secondary: .subheadline, alignment: .center)
                .accessibilityElement(children: .combine)
                .accessibilityIdentifier("whereParked.summary")
            if !car.note.isEmpty {
                Label(car.note, systemImage: "note.text")
                    .font(.subheadline)
                    .foregroundStyle(Theme.ink)
                    .padding(12)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Theme.canvas, in: .rect(cornerRadius: 14))
            }
            Text(car.savedAt.formatted(date: .abbreviated, time: .shortened))
                .font(.headline.monospacedDigit())
                .foregroundStyle(Theme.sub)
            PrimaryButton(ar: "خذني إلى سيارتي", en: "Take me to my car", color: Theme.green) {
                dismiss()
                app.navigate(role: .parking)
            }
            .accessibilityIdentifier("whereParked.go")
            HStack {
                Button {
                    load()
                    withAnimation { editing = true }
                } label: {
                    Label(app.t("تعديل", "Edit"), systemImage: "square.and.pencil").frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
                .tint(Theme.blue)
                Button(role: .destructive) {
                    app.parkedCar = nil
                    load()
                    app.showToast("تم مسح موقع السيارة", "Car location cleared", symbol: "trash", demo: false)
                } label: {
                    Label(app.t("مسح", "Clear"), systemImage: "trash").frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
                .accessibilityIdentifier("whereParked.clear")
            }
        }
    }

    private var form: some View {
        VStack(alignment: .leading, spacing: 14) {
            BiText(ar: app.parkedCar == nil ? "لم تحفظ موقع سيارتك بعد" : "تعديل موقع السيارة",
                   en: app.parkedCar == nil ? "You haven't saved your car location yet" : "Edit car location",
                   primary: .title3.weight(.bold), secondary: .subheadline, alignment: .center)
                .frame(maxWidth: .infinity)
            VStack(alignment: .leading, spacing: 6) {
                Text(app.t("رقم الموقف", "Bay number")).font(.caption.weight(.semibold)).foregroundStyle(Theme.sub)
                TextField("A-12", text: $bay)
                    .textInputAutocapitalization(.characters)
                    .autocorrectionDisabled()
                    .padding(12)
                    .background(Theme.canvas, in: .rect(cornerRadius: 12))
                    .accessibilityIdentifier("whereParked.bay")
            }
            VStack(alignment: .leading, spacing: 6) {
                Text(app.t("المستوى", "Level")).font(.caption.weight(.semibold)).foregroundStyle(Theme.sub)
                Picker(app.t("المستوى", "Level"), selection: $level) {
                    ForEach(levels, id: \.self) { Text($0).tag($0) }
                }
                .pickerStyle(.segmented)
            }
            VStack(alignment: .leading, spacing: 6) {
                Text(app.t("ملاحظة (اختياري)", "Note (optional)")).font(.caption.weight(.semibold)).foregroundStyle(Theme.sub)
                TextField(app.t("مثال: بجانب العمود الأزرق", "e.g. next to the blue pillar"), text: $note)
                    .padding(12)
                    .background(Theme.canvas, in: .rect(cornerRadius: 12))
                    .accessibilityIdentifier("whereParked.note")
            }
            PrimaryButton(ar: "احفظ الموقع", en: "Save location", symbol: "mappin.and.ellipse") {
                let trimmed = bay.trimmingCharacters(in: .whitespaces).uppercased()
                let value = trimmed.isEmpty ? suggestedBay : trimmed
                app.parkedCar = ParkedCar(bay: value, level: level, note: note.trimmingCharacters(in: .whitespaces), savedAt: .now)
                withAnimation { editing = false }
                app.showToast("تم حفظ موقع سيارتك: \(value)", "Car location saved: \(value)", symbol: "checkmark.circle.fill", demo: false)
            }
            .accessibilityIdentifier("whereParked.save")
        }
    }
}
