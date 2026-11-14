import SwiftUI
import UniformTypeIdentifiers

struct IndoorMapView: View {
    @Environment(AppState.self) private var app
    @State private var voice = VoiceGuide()
    @State private var stepIndex = 0
    @State private var zoom: CGFloat = 1
    @State private var routeProgress: CGFloat = 0
    @State private var showSearch = false
    @State private var showStart = false
    @State private var showStartScanner = false
    @State private var showMapData = false
    @State private var showAlert = true
    @State private var viewFloor: String?

    private var route: MapRoute? { app.currentRoute }
    private var steps: [RouteStep] { route?.steps ?? [] }
    private var currentStep: RouteStep? { steps.isEmpty ? nil : steps[min(stepIndex, steps.count - 1)] }
    private var shownFloor: String {
        viewFloor ?? currentStep?.floor ?? app.start?.floor ?? app.map.floors.first?.id ?? "G"
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 12) {
                    AppHeader()
                    searchBar
                    if showAlert && !app.map.unavailableElevators.isEmpty { alertBanner }
                    destinationCard
                    mapCard
                    routeChips
                    stepCard
                }
                .padding(.horizontal, 18)
                .padding(.top, 8)
                .padding(.bottom, 24)
            }
            .scrollIndicators(.hidden)
            .background(ScreenBackground())
            .toolbar(.hidden, for: .navigationBar)
            .sheet(isPresented: $showSearch) {
                DestinationSearchSheet()
                    .environment(app)
                    .presentationDetents([.medium, .large])
            }
            .sheet(isPresented: $showStart) {
                StartPointSheet(onScan: {
                    showStart = false
                    Task { @MainActor in
                        try? await Task.sleep(for: .milliseconds(450))
                        showStartScanner = true
                    }
                })
                .environment(app)
                .presentationDetents([.medium, .large])
            }
            .sheet(isPresented: $showMapData) {
                MapDataSheet()
                    .environment(app)
                    .presentationDetents([.large])
            }
            .fullScreenCover(isPresented: $showStartScanner) {
                ScannerView(mode: .location)
            }
        }
        .onAppear { restartRoute(speak: false) }
        .onChange(of: app.navigationRequestID) { restartRoute(speak: true) }
        .onChange(of: app.currentRoute) { restartRoute(speak: true) }
        .onChange(of: app.lang) { voice.stop() }
        .onDisappear { voice.stop() }
    }

    private func restartRoute(speak: Bool) {
        stepIndex = 0
        viewFloor = nil
        routeProgress = 0
        withAnimation(.easeInOut(duration: 1.2)) { routeProgress = 1 }
        if speak && voice.isOn { speakFullRoute() }
    }

    private func speakCurrent() {
        guard let step = currentStep else { return }
        voice.speak(app.t(step.ar, step.en), lang: app.lang)
    }

    private var routeSummary: String {
        guard let route, let s = app.start, let d = app.destination else {
            return app.t("لا يوجد مسار متاح لهذه الوجهة حالياً", "No route is available to this place right now")
        }
        return app.t(
            "المسار من \(s.ar) إلى \(d.ar): \(route.meters) متراً، حوالي \(route.minutes) دقيقة، في \(route.steps.count) خطوات.",
            "Route from \(s.en) to \(d.en): \(route.meters) meters, about \(route.minutes) minutes, in \(route.steps.count) steps."
        )
    }

    /// Big speaker: explains the map, summarises the route, then reads every step.
    private func speakFullRoute() {
        var texts = [ScreenGuide.map.text(app.lang), routeSummary]
        texts += steps.map { app.t("الخطوة \($0.id + 1): \($0.ar)", "Step \($0.id + 1): \($0.en)") }
        SpeechCenter.shared.speak(texts, lang: app.lang, key: VoiceGuide.stepKey, isGuide: false)
    }

    private func goToStep(_ index: Int) {
        guard steps.indices.contains(index) else { return }
        withAnimation(.spring(response: 0.4)) {
            stepIndex = index
            viewFloor = steps[index].floor
        }
        speakCurrent()
    }

    // MARK: Search

    private var searchBar: some View {
        HStack(spacing: 10) {
            Button { showSearch = true } label: {
                HStack(spacing: 10) {
                    Image(systemName: "magnifyingglass").foregroundStyle(Theme.sub)
                    Text(app.t("ابحث عن عيادة أو قسم", "Search for a clinic or department"))
                        .foregroundStyle(Theme.sub)
                    Spacer()
                }
                .contentShape(.rect)
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("map.search")
            Button {
                app.showToast("البحث الصوتي غير متاح في النسخة التجريبية", "Voice search isn't available in this demo", symbol: "mic.fill")
            } label: {
                Image(systemName: "mic.fill").foregroundStyle(Theme.blue)
            }
            .accessibilityLabel(app.t("بحث صوتي", "Voice search"))
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
        .background(Theme.surface, in: .capsule)
        .overlay(Capsule().stroke(Theme.hairline, lineWidth: 1))
    }

    private var alertBanner: some View {
        let names = app.map.unavailableElevators
        let ar = names.map(\.ar).joined(separator: " و")
        let en = names.map(\.en).joined(separator: " & ")
        return HStack(spacing: 12) {
            IconBadge(symbol: "exclamationmark.triangle.fill", color: Theme.orange, size: 44)
            BiText(ar: "\(ar) تحت الصيانة - تم تغيير المسار تلقائياً",
                   en: "\(en) under maintenance - route changed automatically",
                   primary: .subheadline.weight(.bold), secondary: .caption,
                   primaryColor: Color(hex: 0x8A4B00))
            Spacer(minLength: 0)
            Button {
                withAnimation(.spring) { showAlert = false }
            } label: {
                Image(systemName: "xmark").font(.caption.weight(.bold)).foregroundStyle(Theme.sub)
            }
            .accessibilityLabel(app.t("إغلاق", "Dismiss"))
        }
        .padding(14)
        .background(Color(hex: 0xFFF4DE), in: .rect(cornerRadius: 20))
        .overlay(RoundedRectangle(cornerRadius: 20).stroke(Theme.orange.opacity(0.3), lineWidth: 1))
        .transition(.move(edge: .top).combined(with: .opacity))
    }

    private var destinationCard: some View {
        VStack(spacing: 12) {
            Button { showSearch = true } label: {
                HStack(spacing: 14) {
                    IconBadge(symbol: app.destination?.icon ?? "mappin")
                    let d = app.destination
                    let code = d?.code.map { " \($0)" } ?? ""
                    BiText(ar: d?.ar ?? "-", en: "\(d?.en ?? "-")\(code)",
                           primary: .title3.weight(.bold), secondary: .subheadline)
                    Spacer()
                    VStack(alignment: .trailing, spacing: 2) {
                        let meters = route?.meters ?? 0
                        let minutes = route?.minutes ?? 0
                        Text(app.t("\(meters) م", "\(meters) m")).font(.headline).foregroundStyle(Theme.blue)
                        Text(app.t("\(minutes) دقيقة", "\(minutes) min")).font(.caption).foregroundStyle(Theme.sub)
                    }
                }
                .contentShape(.rect)
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("map.destinationCard")

            Divider()

            HStack(spacing: 10) {
                Image(systemName: "figure.stand")
                    .font(.subheadline.weight(.bold))
                    .foregroundStyle(Theme.green)
                    .frame(width: 30, height: 30)
                    .background(Theme.green.opacity(0.12), in: .circle)
                VStack(alignment: .leading, spacing: 1) {
                    Text(app.t("من: ", "From: ") + app.t(app.start?.ar ?? "-", app.start?.en ?? "-"))
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Theme.ink)
                        .lineLimit(1)
                    Text(floorName(app.start?.floor))
                        .font(.caption)
                        .foregroundStyle(Theme.sub)
                }
                .accessibilityElement(children: .combine)
                .accessibilityIdentifier("map.fromLabel")
                Spacer(minLength: 0)
                Button { showStart = true } label: {
                    Text(app.t("تغيير", "Change")).font(.footnote.weight(.bold))
                }
                .buttonStyle(.bordered)
                .tint(Theme.blue)
                .accessibilityIdentifier("map.changeStart")
                Button { showStartScanner = true } label: {
                    Image(systemName: "qrcode.viewfinder").font(.headline)
                }
                .buttonStyle(.borderedProminent)
                .tint(Theme.blue)
                .accessibilityLabel(app.t("امسح رمز موقعك", "Scan your location code"))
                .accessibilityIdentifier("map.scanStart")
            }
        }
        .card(padding: 14)
    }

    private func floorName(_ id: String?) -> String {
        guard let f = app.map.floor(id) else { return "" }
        return app.t(f.nameAr, f.nameEn)
    }

    // MARK: Map

    private var mapCard: some View {
        ZStack(alignment: .bottom) {
            GeometryReader { geo in
                FloorPlanCanvas(
                    dataset: app.map,
                    floorID: shownFloor,
                    route: route,
                    start: app.start,
                    destination: app.destination,
                    routeColor: app.routeType.color,
                    progress: routeProgress,
                    size: geo.size
                )
                .environment(\.layoutDirection, .leftToRight)
                .scaleEffect(zoom, anchor: zoomAnchor)
                .animation(.spring(response: 0.4, dampingFraction: 0.85), value: zoom)
                .id(shownFloor)
                .transition(.opacity)
            }
            .clipShape(.rect(cornerRadius: 22))

            VStack {
                HStack(alignment: .top) {
                    dataBadge
                    Spacer()
                    floorPicker
                }
                Spacer()
                HStack(alignment: .bottom) {
                    VStack(spacing: 8) {
                        zoomButton("plus") { zoom = min(zoom + 0.25, 2) }
                        zoomButton("minus") { zoom = max(zoom - 0.25, 1) }
                    }
                    Spacer()
                }
            }
            .padding(12)
            .environment(\.layoutDirection, .leftToRight)

            speakerButton
                .padding(.bottom, 14)
        }
        .frame(height: 400)
        .background(Color(hex: 0xEEF3F8), in: .rect(cornerRadius: 22))
        .overlay(RoundedRectangle(cornerRadius: 22).stroke(Theme.hairline, lineWidth: 1))
    }

    private var zoomAnchor: UnitPoint {
        let pts = [app.start, app.destination].compactMap { $0 }.filter { $0.floor == shownFloor }
        guard !pts.isEmpty else { return .center }
        return UnitPoint(x: pts.map(\.x).reduce(0, +) / Double(pts.count), y: pts.map(\.y).reduce(0, +) / Double(pts.count))
    }

    private var dataBadge: some View {
        Button { showMapData = true } label: {
            HStack(spacing: 5) {
                Image(systemName: app.map.demo ? "map" : "checkmark.seal.fill")
                Text(app.map.demo ? app.t("خريطة تجريبية", "Demo map") : app.t("بيانات المستشفى", "Hospital data"))
            }
            .font(.caption2.weight(.heavy))
            .foregroundStyle(app.map.demo ? Theme.orange : Theme.green)
            .padding(.horizontal, 9)
            .padding(.vertical, 6)
            .background(.white.opacity(0.95), in: .capsule)
            .shadow(color: .black.opacity(0.08), radius: 4, y: 1)
        }
        .buttonStyle(PressableStyle())
        .accessibilityIdentifier("map.dataBadge")
    }

    private var floorPicker: some View {
        let routeFloors = Set(route?.floors ?? [])
        return VStack(spacing: 4) {
            ForEach(app.map.floorsTopDown) { floor in
                let selected = floor.id == shownFloor
                Button {
                    withAnimation(.easeInOut(duration: 0.25)) { viewFloor = floor.id }
                } label: {
                    Text(floor.label)
                        .font(.footnote.weight(.heavy))
                        .foregroundStyle(selected ? .white : Theme.ink)
                        .frame(width: 36, height: 34)
                        .background(selected ? Theme.navy : .white, in: .rect(cornerRadius: 10))
                        .overlay(alignment: .topTrailing) {
                            if routeFloors.contains(floor.id) && !selected {
                                Circle().fill(app.routeType.color).frame(width: 8, height: 8).offset(x: 2, y: -2)
                            }
                        }
                }
                .buttonStyle(PressableStyle())
                .accessibilityLabel(app.t(floor.nameAr, floor.nameEn))
                .accessibilityIdentifier("map.floor.\(floor.id)")
            }
        }
        .padding(4)
        .background(.white.opacity(0.6), in: .rect(cornerRadius: 13))
        .shadow(color: .black.opacity(0.08), radius: 6, y: 2)
    }

    private func zoomButton(_ symbol: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: symbol)
                .font(.headline)
                .foregroundStyle(Theme.ink)
                .frame(width: 40, height: 40)
                .background(Theme.surface, in: .circle)
                .shadow(color: .black.opacity(0.1), radius: 6, y: 2)
        }
        .buttonStyle(PressableStyle())
    }

    private var speakerButton: some View {
        Button {
            voice.isOn.toggle()
            if voice.isOn {
                speakFullRoute()
                app.showToast("تم تفعيل الإرشاد الصوتي", "Voice guidance on", symbol: "speaker.wave.3.fill", demo: false)
            } else {
                voice.stop()
                app.showToast("تم إيقاف الإرشاد الصوتي", "Voice guidance off", symbol: "speaker.slash.fill", demo: false)
            }
        } label: {
            VStack(spacing: 4) {
                Image(systemName: voice.isOn ? "speaker.wave.3.fill" : "speaker.slash.fill")
                    .font(.system(size: 26, weight: .bold))
                    .foregroundStyle(.white)
                    .symbolEffect(.variableColor.iterative, isActive: voice.isOn)
                    .frame(width: 70, height: 70)
                    .background(voice.isOn ? Theme.blue : Theme.sub, in: .circle)
                    .overlay(Circle().stroke(.white, lineWidth: 4))
                    .shadow(color: Theme.blue.opacity(0.35), radius: 12, y: 6)
                Text(voice.isOn ? app.t("الإرشاد الصوتي مفعّل", "Voice guide on") : app.t("الإرشاد الصوتي", "Voice guide"))
                    .font(.caption.weight(.bold))
                    .foregroundStyle(Theme.ink)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 4)
                    .background(.white.opacity(0.92), in: .capsule)
            }
        }
        .buttonStyle(PressableStyle())
        .sensoryFeedback(.impact(weight: .medium), trigger: voice.isOn)
        .accessibilityLabel(app.t("تشغيل أو إيقاف الإرشاد الصوتي", "Toggle voice guidance"))
        .accessibilityValue(voice.isOn ? "on" : "off")
        .accessibilityIdentifier("map.voiceButton")
    }

    // MARK: Route options

    private var routeChips: some View {
        HStack(spacing: 10) {
            ForEach(RouteType.allCases) { type in
                let selected = app.routeType == type
                Button {
                    if type == .elderly && !voice.isOn {
                        voice.isOn = true
                        app.showToast("مسار كبار السن: تم تفعيل الإرشاد الصوتي تلقائياً", "Elderly route: voice guidance turned on", symbol: "speaker.wave.3.fill", demo: false)
                    }
                    withAnimation(.spring(response: 0.35)) { app.routeType = type }
                } label: {
                    VStack(spacing: 6) {
                        Image(systemName: type.symbol)
                            .font(.title2)
                            .foregroundStyle(type.color)
                        Text(app.t(type.ar, type.en)).font(.subheadline.weight(.bold)).foregroundStyle(Theme.ink)
                        Text(app.other(type.ar, type.en)).font(.caption).foregroundStyle(Theme.sub)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(selected ? Theme.green.opacity(0.1) : Theme.surface, in: .rect(cornerRadius: 18))
                    .overlay(RoundedRectangle(cornerRadius: 18).stroke(selected ? Theme.green : Theme.hairline, lineWidth: selected ? 2 : 1))
                }
                .buttonStyle(PressableStyle())
                .sensoryFeedback(.selection, trigger: selected)
                .accessibilityIdentifier("map.route.\(type.rawValue)")
            }
        }
    }

    @ViewBuilder
    private var stepCard: some View {
        if let step = currentStep {
            VStack(alignment: .leading, spacing: 12) {
                HStack(spacing: 12) {
                    Image(systemName: step.symbol)
                        .font(.title2.weight(.bold))
                        .foregroundStyle(.white)
                        .frame(width: 52, height: 52)
                        .background(app.routeType.color, in: .rect(cornerRadius: 16))
                        .flipsForRightToLeftLayoutDirection(false)
                    BiText(ar: step.ar, en: step.en, primary: .headline, secondary: .footnote)
                        .accessibilityElement(children: .combine)
                        .accessibilityIdentifier("map.stepText")
                    Spacer(minLength: 0)
                }
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(app.t("الخطوة \(stepIndex + 1) من \(steps.count)", "Step \(stepIndex + 1) of \(steps.count)"))
                            .font(.footnote.weight(.semibold))
                            .foregroundStyle(Theme.sub)
                            .accessibilityIdentifier("map.stepCounter")
                        Text(floorName(step.floor))
                            .font(.caption2.weight(.bold))
                            .foregroundStyle(Theme.blue)
                    }
                    Spacer()
                    Button {
                        goToStep(max(stepIndex - 1, 0))
                    } label: {
                        Image(systemName: "chevron.backward").frame(width: 40, height: 36)
                    }
                    .buttonStyle(.bordered)
                    .disabled(stepIndex == 0)
                    .accessibilityLabel(app.t("الخطوة السابقة", "Previous step"))
                    .accessibilityIdentifier("map.prevStep")
                    Button {
                        if stepIndex < steps.count - 1 {
                            goToStep(stepIndex + 1)
                            if stepIndex == steps.count - 1 {
                                app.showToast("وصلت إلى وجهتك", "You've arrived", symbol: "mappin.circle.fill", demo: false)
                            }
                        } else {
                            restartRoute(speak: false)
                            speakCurrent()
                        }
                    } label: {
                        Text(stepIndex < steps.count - 1 ? app.t("التالي", "Next") : app.t("إعادة", "Restart"))
                            .font(.subheadline.weight(.bold))
                            .frame(minWidth: 70, minHeight: 28)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(Theme.blue)
                    .accessibilityIdentifier("map.nextStep")
                }
            }
            .card()
        } else {
            HStack(spacing: 12) {
                IconBadge(symbol: "exclamationmark.triangle.fill", color: Theme.orange, size: 44)
                BiText(ar: "لا يوجد مسار متاح بهذه الشروط. جرّب نوع مسار آخر أو نقطة بداية أخرى.",
                       en: "No route matches these settings. Try another route type or start point.",
                       primary: .subheadline.weight(.bold), secondary: .caption)
                Spacer(minLength: 0)
            }
            .card()
        }
    }
}

// MARK: - Floor plan drawing (from map data)

struct FloorPlanCanvas: View {
    let dataset: MapDataset
    let floorID: String
    let route: MapRoute?
    let start: MapNode?
    let destination: MapNode?
    let routeColor: Color
    let progress: CGFloat
    let size: CGSize

    private func p(_ n: CGPoint) -> CGPoint { CGPoint(x: n.x * size.width, y: n.y * size.height) }

    private var floor: MapFloor? { dataset.floor(floorID) }
    private var lines: [[CGPoint]] { route?.polylines(on: floorID) ?? [] }
    private var transitions: [MapNode] { route?.transitions(on: floorID) ?? [] }
    private var landmarks: [MapNode] {
        dataset.nodes.filter {
            $0.floor == floorID && [.elevator, .stairs, .restroom, .entrance, .parking].contains($0.kind)
                && $0.id != destination?.id && $0.id != start?.id
        }
    }

    var body: some View {
        ZStack {
            Canvas { ctx, sz in
                var grid = Path()
                stride(from: 0, through: sz.width, by: 22).forEach { x in
                    grid.move(to: CGPoint(x: x, y: 0)); grid.addLine(to: CGPoint(x: x, y: sz.height))
                }
                stride(from: 0, through: sz.height, by: 22).forEach { y in
                    grid.move(to: CGPoint(x: 0, y: y)); grid.addLine(to: CGPoint(x: sz.width, y: y))
                }
                ctx.stroke(grid, with: .color(Color(hex: 0xDDE6F0).opacity(0.6)), lineWidth: 0.5)

                for r in floor?.rooms ?? [] {
                    let rect = CGRect(x: r.x * sz.width, y: r.y * sz.height, width: r.w * sz.width, height: r.h * sz.height)
                    let path = Path(roundedRect: rect, cornerRadius: 8)
                    ctx.fill(path, with: .color(Color(hex: 0xDFE7F1)))
                    ctx.stroke(path, with: .color(Color(hex: 0xC9D5E3)), lineWidth: 1.5)
                }
            }

            if let floor {
                Text(floor.label)
                    .font(.system(size: 64, weight: .heavy, design: .rounded))
                    .foregroundStyle(Theme.navy.opacity(0.06))
                    .position(x: size.width * 0.5, y: size.height * 0.5)
            }

            if let d = destination, d.floor == floorID {
                RoundedRectangle(cornerRadius: 10)
                    .fill(Theme.blue.opacity(0.15))
                    .frame(width: 70, height: 50)
                    .position(p(d.point))
            }

            ForEach(Array(lines.enumerated()), id: \.offset) { _, line in
                let pts = line.map(p)
                RoutePath(points: pts)
                    .trim(from: 0, to: progress)
                    .stroke(routeColor.opacity(0.25), style: StrokeStyle(lineWidth: 18, lineCap: .round, lineJoin: .round))
                RoutePath(points: pts)
                    .trim(from: 0, to: progress)
                    .stroke(routeColor, style: StrokeStyle(lineWidth: 9, lineCap: .round, lineJoin: .round))
                ForEach(Array(zip(pts.indices.dropLast(), pts.indices.dropFirst())), id: \.0) { pair in
                    let a = pts[pair.0], b = pts[pair.1]
                    if hypot(b.x - a.x, b.y - a.y) > 40 {
                        Image(systemName: "arrowtriangle.right.fill")
                            .font(.system(size: 9, weight: .bold))
                            .foregroundStyle(.white)
                            .rotationEffect(.radians(atan2(b.y - a.y, b.x - a.x)))
                            .position(x: (a.x + b.x) / 2, y: (a.y + b.y) / 2)
                            .opacity(progress > 0.9 ? 1 : 0)
                    }
                }
            }

            ForEach(landmarks) { node in
                landmark(node)
            }

            ForEach(transitions) { node in
                transitionBadge(node)
            }

            if let d = destination, d.floor == floorID {
                VStack(spacing: 2) {
                    Image(systemName: "mappin.circle.fill")
                        .font(.system(size: 30))
                        .foregroundStyle(.white, Theme.blue)
                        .symbolEffect(.bounce, value: d.id)
                    Text(d.code ?? "")
                        .font(.caption.weight(.heavy))
                        .foregroundStyle(Theme.navy)
                }
                .position(x: p(d.point).x, y: p(d.point).y - 8)
            }

            if let s = start, s.floor == floorID {
                YouAreHere().position(p(s.point))
            }
        }
    }

    private func landmark(_ node: MapNode) -> some View {
        let broken = !node.isOpen
        let symbol: String = switch node.kind {
        case .elevator: broken ? "wrench.and.screwdriver.fill" : "arrow.up.arrow.down"
        case .stairs: "stairs"
        case .restroom: "toilet"
        case .entrance: "door.left.hand.open"
        case .parking: "car.fill"
        default: node.icon
        }
        let tint: Color = broken ? Theme.orange : (node.kind == .elevator ? Theme.green : Theme.sub)
        return VStack(spacing: 1) {
            Image(systemName: symbol)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(tint)
                .frame(width: 30, height: 30)
                .background(.white, in: .rect(cornerRadius: 8))
                .shadow(color: .black.opacity(0.08), radius: 3, y: 1)
            if node.kind == .elevator || node.kind == .entrance {
                Text(node.code ?? "").font(.system(size: 9, weight: .bold)).foregroundStyle(tint)
            }
        }
        .position(p(node.point))
    }

    /// Shows which floor the route continues on when it changes floor here.
    private func transitionBadge(_ node: MapNode) -> some View {
        let otherFloor: String? = route?.legs.first(where: { $0.vertical && $0.from.id == node.id })?.to.floor
            ?? route?.legs.last(where: { $0.vertical && $0.to.id == node.id }).map { _ in floorID }
        let goingOn = route?.legs.contains { $0.vertical && $0.from.id == node.id } ?? false
        let finalFloor = goingOn ? lastFloorOfRun(from: node) : nil
        return VStack(spacing: 2) {
            Image(systemName: node.kind == .stairs ? "figure.stairs" : "arrow.up.arrow.down.square.fill")
                .font(.system(size: 16, weight: .bold))
                .foregroundStyle(.white)
                .frame(width: 34, height: 34)
                .background(routeColor, in: .rect(cornerRadius: 10))
                .overlay(RoundedRectangle(cornerRadius: 10).stroke(.white, lineWidth: 2))
            if let finalFloor, let f = dataset.floor(finalFloor) {
                Text("→ \(f.label)")
                    .font(.system(size: 10, weight: .heavy))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 6).padding(.vertical, 2)
                    .background(Theme.navy, in: .capsule)
            } else if otherFloor != nil {
                Text(node.code ?? "")
                    .font(.system(size: 10, weight: .heavy))
                    .foregroundStyle(Theme.navy)
            }
        }
        .position(p(node.point))
    }

    private func lastFloorOfRun(from node: MapNode) -> String? {
        guard let legs = route?.legs, var i = legs.firstIndex(where: { $0.vertical && $0.from.id == node.id }) else { return nil }
        while i + 1 < legs.count && legs[i + 1].vertical { i += 1 }
        return legs[i].to.floor
    }
}

struct RoutePath: Shape {
    let points: [CGPoint]
    func path(in rect: CGRect) -> Path {
        var path = Path()
        guard let first = points.first else { return path }
        path.move(to: first)
        if points.count == 1 { path.addLine(to: first) }
        for pt in points.dropFirst() { path.addLine(to: pt) }
        return path
    }
}

struct YouAreHere: View {
    @Environment(AppState.self) private var app
    @State private var pulse = false

    var body: some View {
        ZStack {
            Circle()
                .fill(Theme.blue.opacity(0.2))
                .frame(width: pulse ? 54 : 30)
                .opacity(pulse ? 0 : 1)
            Circle().fill(.white).frame(width: 22)
            Circle().fill(Theme.blue).frame(width: 15)
            Text(app.t("أنت هنا", "You are here"))
                .font(.caption2.weight(.bold))
                .foregroundStyle(.white)
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(Theme.green, in: .capsule)
                .offset(y: -26)
                .fixedSize()
        }
        .onAppear {
            withAnimation(.easeOut(duration: 1.6).repeatForever(autoreverses: false)) { pulse = true }
        }
    }
}

// MARK: - Search sheet

struct DestinationSearchSheet: View {
    @Environment(AppState.self) private var app
    @Environment(\.dismiss) private var dismiss
    @State private var query = ""

    private var results: [MapNode] {
        let all = app.map.destinations
        guard !query.isEmpty else { return all }
        return all.filter {
            $0.ar.contains(query) || $0.en.localizedCaseInsensitiveContains(query) || ($0.code ?? "").localizedCaseInsensitiveContains(query)
        }
    }

    var body: some View {
        NavigationStack {
            List(results) { d in
                Button {
                    app.navigate(to: d.id)
                    dismiss()
                } label: {
                    HStack(spacing: 12) {
                        IconBadge(symbol: d.icon, size: 40)
                        VStack(alignment: .leading, spacing: 2) {
                            BiText(ar: d.ar, en: d.en, primary: .headline, secondary: .caption)
                            if let f = app.map.floor(d.floor) {
                                Text(app.t(f.nameAr, f.nameEn)).font(.caption2).foregroundStyle(Theme.blue)
                            }
                        }
                        Spacer()
                        Text(d.code ?? "").font(.subheadline.weight(.bold)).foregroundStyle(Theme.blue)
                    }
                }
                .accessibilityIdentifier("dest.\(d.id)")
            }
            .overlay {
                if results.isEmpty {
                    ContentUnavailableView.search(text: query)
                }
            }
            .searchable(text: $query, placement: .navigationBarDrawer(displayMode: .always), prompt: app.t("ابحث عن عيادة أو قسم", "Search clinic or department"))
            .navigationTitle(app.t("إلى أين؟", "Where to?"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(app.t("إغلاق", "Close")) { dismiss() }
                }
            }
        }
        .environment(\.layoutDirection, app.lang == .ar ? .rightToLeft : .leftToRight)
    }
}

// MARK: - Start point sheet

struct StartPointSheet: View {
    @Environment(AppState.self) private var app
    @Environment(\.dismiss) private var dismiss
    var onScan: () -> Void

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Button(action: onScan) {
                        HStack(spacing: 12) {
                            IconBadge(symbol: "qrcode.viewfinder", size: 40)
                            BiText(ar: "امسح رمز QR قريباً منك", en: "Scan a nearby QR code", primary: .headline, secondary: .caption)
                        }
                    }
                    .accessibilityIdentifier("start.scan")
                } footer: {
                    Text(app.t("تُلصق رموز QR عند المداخل والمصاعد. كل رمز يحدد مكانك على الخريطة.",
                               "QR codes are placed at entrances and elevators. Each one marks your spot on the map."))
                }
                ForEach(app.map.floorsTopDown.reversed()) { floor in
                    let points = app.map.startPoints.filter { $0.floor == floor.id }
                    if !points.isEmpty {
                        Section(app.t(floor.nameAr, floor.nameEn)) {
                            ForEach(points) { node in
                                Button {
                                    app.setStart(node.id)
                                    app.showToast("نقطة البداية: \(node.ar)", "Starting from \(node.en)", symbol: "figure.stand", demo: false)
                                    dismiss()
                                } label: {
                                    HStack(spacing: 12) {
                                        IconBadge(symbol: node.icon, color: node.kind == .entrance ? Theme.green : Theme.blue, size: 36)
                                        BiText(ar: node.ar, en: node.en, primary: .subheadline.weight(.semibold), secondary: .caption)
                                        Spacer()
                                        if node.id == app.startID {
                                            Image(systemName: "checkmark.circle.fill").foregroundStyle(Theme.green)
                                        }
                                    }
                                }
                                .accessibilityIdentifier("start.\(node.id)")
                            }
                        }
                    }
                }
            }
            .navigationTitle(app.t("أين أنت الآن؟", "Where are you now?"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(app.t("إغلاق", "Close")) { dismiss() }
                }
            }
        }
        .environment(\.layoutDirection, app.lang == .ar ? .rightToLeft : .leftToRight)
    }
}

// MARK: - Map data sheet (replace demo data with hospital-approved data)

struct MapDataSheet: View {
    @Environment(AppState.self) private var app
    @Environment(\.dismiss) private var dismiss
    @State private var importing = false
    @State private var error: String?
    @State private var confirmRestore = false

    var body: some View {
        NavigationStack {
            List {
                Section {
                    HStack(spacing: 12) {
                        IconBadge(symbol: app.map.demo ? "map" : "checkmark.seal.fill",
                                  color: app.map.demo ? Theme.orange : Theme.green, size: 44)
                        VStack(alignment: .leading, spacing: 4) {
                            BiText(ar: app.map.nameAr, en: app.map.nameEn, primary: .headline, secondary: .caption)
                            if app.map.demo { DemoTag() }
                        }
                    }
                    LabeledContent(app.t("الإصدار", "Version"), value: app.map.version ?? "-")
                    LabeledContent(app.t("المصدر", "Source"), value: app.mapIsCustom ? app.t("ملف مستورد", "Imported file") : app.t("مضمّن في التطبيق", "Built into the app"))
                    LabeledContent(app.t("الأدوار", "Floors"), value: "\(app.map.floors.count)")
                    LabeledContent(app.t("الوجهات", "Destinations"), value: "\(app.map.destinations.count)")
                    LabeledContent(app.t("نقاط وممرات", "Points · paths"), value: "\(app.map.nodes.count) · \(app.map.edges.count)")
                }

                Section {
                    Button {
                        importing = true
                    } label: {
                        Label(app.t("استيراد خريطة المستشفى (JSON)", "Import hospital map (JSON)"), systemImage: "square.and.arrow.down")
                    }
                    .accessibilityIdentifier("mapdata.import")
                    if app.mapIsCustom {
                        Button(role: .destructive) {
                            confirmRestore = true
                        } label: {
                            Label(app.t("استعادة الخريطة التجريبية", "Restore demo map"), systemImage: "arrow.uturn.backward")
                        }
                    }
                } header: {
                    Text(app.t("استبدال البيانات", "Replace data"))
                } footer: {
                    Text(app.t("استخدم ملفاً بنفس صيغة الخريطة التجريبية بعد اعتماده من إدارة المستشفى. يتم فحص الملف قبل استخدامه.",
                               "Use a file in the same format as the demo map, once approved by the hospital. The file is checked before it is used."))
                }

                Section {
                    ForEach(app.map.nodes.filter { $0.qr != nil }) { node in
                        HStack(spacing: 14) {
                            QRCodeImage(text: node.qr ?? "")
                                .frame(width: 72, height: 72)
                            VStack(alignment: .leading, spacing: 4) {
                                BiText(ar: node.ar, en: node.en, primary: .subheadline.weight(.semibold), secondary: .caption)
                                Text(node.qr ?? "")
                                    .font(.caption2.monospaced())
                                    .foregroundStyle(Theme.sub)
                                    .environment(\.layoutDirection, .leftToRight)
                            }
                        }
                        .padding(.vertical, 4)
                    }
                } header: {
                    Text(app.t("رموز نقاط البداية", "Start point codes"))
                } footer: {
                    Text(app.t("اطبع هذه الرموز وضعها في أماكنها للتجربة، أو امسحها من شاشة أخرى.",
                               "Print these codes and place them on site for the pilot, or scan them from another screen."))
                }
            }
            .navigationTitle(app.t("بيانات الخريطة", "Map data"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button(app.t("تم", "Done")) { dismiss() }
                }
            }
            .fileImporter(isPresented: $importing, allowedContentTypes: [.json]) { result in
                switch result {
                case .success(let url):
                    do {
                        try app.importMap(from: url)
                        app.showToast("تم استيراد الخريطة", "Map imported", symbol: "checkmark.circle.fill", demo: false)
                    } catch {
                        self.error = error.localizedDescription
                    }
                case .failure(let err):
                    error = err.localizedDescription
                }
            }
            .alert(app.t("تعذّر استيراد الملف", "Couldn't import the file"),
                   isPresented: Binding(get: { error != nil }, set: { if !$0 { error = nil } })) {
                Button(app.t("حسناً", "OK"), role: .cancel) {}
            } message: {
                Text(error ?? "")
            }
            .confirmationDialog(app.t("استعادة الخريطة التجريبية؟", "Restore the demo map?"), isPresented: $confirmRestore, titleVisibility: .visible) {
                Button(app.t("استعادة", "Restore"), role: .destructive) {
                    app.restoreDemoMap()
                    app.showToast("تمت استعادة الخريطة التجريبية", "Demo map restored", symbol: "arrow.uturn.backward")
                }
            }
        }
        .environment(\.layoutDirection, app.lang == .ar ? .rightToLeft : .leftToRight)
    }
}
