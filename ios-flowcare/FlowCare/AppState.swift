import SwiftUI
import Observation

enum AppLanguage: String, Codable { case ar, en }

enum AppTab: Hashable { case home, map, parking, visit, support }

enum ClinicStatus: CaseIterable, Identifiable {
    case available, busy, away
    var id: Self { self }
    var ar: String { switch self { case .available: "متاحة"; case .busy: "مشغولة"; case .away: "غير متواجد" } }
    var en: String { switch self { case .available: "Available"; case .busy: "Busy"; case .away: "Away" } }
    var color: Color { switch self { case .available: Theme.green; case .busy: Theme.orange; case .away: Theme.sub } }
}

enum RouteType: String, CaseIterable, Identifiable, Codable {
    case elderly, pregnant, urgent
    var id: Self { self }
    var ar: String { switch self { case .elderly: "كبار السن"; case .pregnant: "حوامل"; case .urgent: "مستعجل" } }
    var en: String { switch self { case .elderly: "Elderly"; case .pregnant: "Pregnant"; case .urgent: "Urgent" } }
    var symbol: String { switch self { case .elderly: "figure.walk.motion"; case .pregnant: "figure.stand.dress"; case .urgent: "bolt.fill" } }
    var color: Color { switch self { case .elderly: Theme.orange; case .pregnant: Theme.purple; case .urgent: Theme.green } }
}

struct Appointment: Equatable, Codable {
    var ticket: String
    var patientAr: String
    var patientEn: String
    var doctorAr: String
    var doctorEn: String
    var clinicAr: String
    var clinicEn: String
    var clinicNodeID: String
    var room: String
    var date: Date
    var medicationAr: String?
    var medicationEn: String?
    var ahead: Int
    var minutes: Int

    var timeAr: String { Self.format(date, locale: "ar") }
    var timeEn: String { Self.format(date, locale: "en") }

    private static func format(_ date: Date, locale: String) -> String {
        let cal = Calendar.current
        let loc = Locale(identifier: locale)
        let time = date.formatted(Date.FormatStyle(date: .omitted, time: .shortened).locale(loc))
        if cal.isDateInToday(date) { return locale == "ar" ? "اليوم \(time)" : "Today \(time)" }
        if cal.isDateInTomorrow(date) { return locale == "ar" ? "غداً \(time)" : "Tomorrow \(time)" }
        let day = date.formatted(Date.FormatStyle().weekday(.wide).day().month(.abbreviated).locale(loc))
        return "\(day) · \(time)"
    }

    static var todayAt1020: Date {
        Calendar.current.date(bySettingHour: 10, minute: 20, second: 0, of: .now) ?? .now
    }

    static let sample = Appointment(
        ticket: "A-2047",
        patientAr: "أحمد الشمري", patientEn: "Ahmed Al-Shammari",
        doctorAr: "د. سارة أحمد", doctorEn: "Dr. Sara Ahmed",
        clinicAr: "عيادة القلب", clinicEn: "Cardiology",
        clinicNodeID: "CLN-CARD-204",
        room: "204",
        date: todayAt1020,
        medicationAr: nil, medicationEn: nil,
        ahead: 3, minutes: 15
    )
}

struct ParkedCar: Equatable, Codable {
    var bay: String
    var level: String
    var note: String
    var savedAt: Date
}

struct Toast: Identifiable, Equatable {
    let id = UUID()
    let ar: String
    let en: String
    var symbol: String = "info.circle.fill"
    var isDemo: Bool = true
}

struct HelpRequest: Equatable {
    var kindAr: String
    var kindEn: String
    var created: Date
}

@Observable
final class AppState {
    var lang: AppLanguage = .ar { didSet { save(lang, Keys.lang) } }
    var tab: AppTab = .home

    /// The appointment shown everywhere. `appointmentImported` is true once the user scanned or edited one.
    var appointment: Appointment = .sample { didSet { save(appointment, Keys.appointment) } }
    var appointmentImported = false { didSet { save(appointmentImported, Keys.imported) } }
    var clinicStatus: ClinicStatus = .available

    // Indoor navigation (data-driven)
    private(set) var map: MapDataset
    private(set) var mapIsCustom: Bool
    var destinationID: String { didSet { recomputeRoute() } }
    var startID: String { didSet { save(startID, Keys.start); recomputeRoute() } }
    var routeType: RouteType = .urgent { didSet { recomputeRoute() } }
    private(set) var currentRoute: MapRoute?
    var navigationRequestID = UUID()

    // Parking
    var parkedCar: ParkedCar? { didSet { save(parkedCar, Keys.parked) } }

    // Visit plan: index of the step in progress (0...4, 4 = all done)
    var visitStep: Int = 1 { didSet { save(visitStep, Keys.visitStep) } }

    // Support
    var helpRequest: HelpRequest?

    var toast: Toast?

    private enum Keys {
        static let lang = "fc.lang", appointment = "fc.appointment", imported = "fc.appointmentImported"
        static let start = "fc.startID", parked = "fc.parkedCar", visitStep = "fc.visitStep"
        static let all = [lang, appointment, imported, start, parked, visitStep]
    }

    static var isUITesting: Bool { ProcessInfo.processInfo.arguments.contains("-uiTesting") }

    init() {
        let defaults = UserDefaults.standard
        if ProcessInfo.processInfo.arguments.contains("-uiTestReset") {
            Keys.all.forEach { defaults.removeObject(forKey: $0) }
            MapLoader.removeCustom()
        }
        let loaded = MapLoader.load()
        map = loaded.dataset
        mapIsCustom = loaded.isCustom

        let storedStart = defaults.string(forKey: Keys.start)
        startID = loaded.dataset.node(storedStart) != nil ? storedStart! : loaded.dataset.defaultStart
        destinationID = loaded.dataset.nodeID(for: .cardiology) ?? loaded.dataset.destinations.first?.id ?? loaded.dataset.defaultStart

        if let l: AppLanguage = Self.load(Keys.lang) { lang = l }
        if let a: Appointment = Self.load(Keys.appointment) { appointment = a }
        if let i: Bool = Self.load(Keys.imported) { appointmentImported = i }
        parkedCar = Self.load(Keys.parked)
        if let v: Int = Self.load(Keys.visitStep) { visitStep = v }
        if map.node(appointment.clinicNodeID) == nil, let fallback = map.nodeID(for: .cardiology) {
            appointment.clinicNodeID = fallback
        }
        recomputeRoute()
    }

    // MARK: Persistence

    private func save<T: Encodable>(_ value: T?, _ key: String) {
        guard let value, let data = try? JSONEncoder().encode(value) else {
            UserDefaults.standard.removeObject(forKey: key)
            return
        }
        UserDefaults.standard.set(data, forKey: key)
    }

    private static func load<T: Decodable>(_ key: String) -> T? {
        guard let data = UserDefaults.standard.data(forKey: key) else { return nil }
        return try? JSONDecoder().decode(T.self, from: data)
    }

    // MARK: Helpers

    func t(_ ar: String, _ en: String) -> String { lang == .ar ? ar : en }
    func other(_ ar: String, _ en: String) -> String { lang == .ar ? en : ar }

    func showToast(_ ar: String, _ en: String, symbol: String = "info.circle.fill", demo: Bool = true) {
        withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) {
            toast = Toast(ar: ar, en: en, symbol: symbol, isDemo: demo)
        }
        let current = toast?.id
        Task { @MainActor in
            try? await Task.sleep(for: .seconds(2.8))
            if self.toast?.id == current {
                withAnimation(.easeInOut) { self.toast = nil }
            }
        }
    }

    // MARK: Navigation

    var destination: MapNode? { map.node(destinationID) }
    var start: MapNode? { map.node(startID) }

    private func recomputeRoute() {
        currentRoute = Router.route(in: map, from: startID, to: destinationID, type: routeType)
    }

    /// Opens the indoor navigation module routed to a node id.
    func navigate(to id: String, route: RouteType? = nil) {
        guard map.node(id) != nil else {
            showToast("هذه الوجهة غير موجودة في بيانات الخريطة", "This place isn't in the map data", symbol: "exclamationmark.triangle.fill")
            return
        }
        destinationID = id
        if let route { routeType = route }
        navigationRequestID = UUID()
        tab = .map
    }

    func navigate(role: PlaceRole, route: RouteType? = nil) {
        guard let id = map.nodeID(for: role) else {
            showToast("هذه الوجهة غير مضافة في بيانات الخريطة", "This place isn't mapped yet", symbol: "exclamationmark.triangle.fill")
            return
        }
        navigate(to: id, route: route)
    }

    /// Sets where the visitor is standing (from a list or a scanned QR code).
    func setStart(_ id: String) {
        guard map.node(id) != nil else { return }
        startID = id
        navigationRequestID = UUID()
    }

    // MARK: Map data

    func replaceMap(with dataset: MapDataset, custom: Bool) {
        map = dataset
        mapIsCustom = custom
        if dataset.node(startID) == nil { startID = dataset.defaultStart }
        if dataset.node(destinationID) == nil {
            destinationID = dataset.nodeID(for: .cardiology) ?? dataset.destinations.first?.id ?? dataset.defaultStart
        }
        if dataset.node(appointment.clinicNodeID) == nil, let c = dataset.nodeID(for: .cardiology) ?? dataset.clinics.first?.id {
            appointment.clinicNodeID = c
        }
        recomputeRoute()
        navigationRequestID = UUID()
    }

    func importMap(from url: URL) throws {
        let dataset = try MapLoader.install(from: url)
        replaceMap(with: dataset, custom: true)
    }

    func restoreDemoMap() {
        MapLoader.removeCustom()
        replaceMap(with: MapLoader.bundled(), custom: false)
    }
}
