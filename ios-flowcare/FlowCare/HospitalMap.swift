import SwiftUI

// MARK: - Dataset (decoded from JSON so hospital-approved data can replace the demo)

struct MapDataset: Codable, Equatable {
    var schemaVersion: Int?
    var id: String
    var version: String?
    var isDemo: Bool?
    var nameAr: String
    var nameEn: String
    /// Meters represented by one normalised unit (the full floor width).
    var metersPerUnit: Double?
    var defaultStart: String
    /// App roles (reception, lab, cardiology, parking, kids...) mapped to node ids.
    var roles: [String: String]?
    var floors: [MapFloor]
    var nodes: [MapNode]
    var edges: [MapEdge]

    var demo: Bool { isDemo ?? false }
    var scale: Double { metersPerUnit ?? 140 }

    func node(_ id: String?) -> MapNode? {
        guard let id else { return nil }
        return nodes.first { $0.id == id }
    }

    func floor(_ id: String?) -> MapFloor? { floors.first { $0.id == id } }

    func nodeID(for role: PlaceRole) -> String? {
        if let id = roles?[role.rawValue], node(id) != nil { return id }
        return nil
    }

    /// Floors from top to bottom, for the floor picker.
    var floorsTopDown: [MapFloor] { floors.sorted { $0.level > $1.level } }

    var destinations: [MapNode] { nodes.filter { $0.searchable ?? false } }

    var clinics: [MapNode] { nodes.filter { $0.kind == .clinic } }

    /// Points a visitor can start from: entrances, QR-tagged spots and searchable places.
    var startPoints: [MapNode] {
        nodes.filter { $0.kind == .entrance || $0.qr != nil || ($0.searchable ?? false) }
    }

    var unavailableElevators: [MapNode] {
        var seen = Set<String>()
        return nodes.filter { $0.kind == .elevator && !$0.isOpen }.filter { seen.insert($0.code ?? $0.id).inserted }
    }

    /// Accepts `FC-START:<id>`, `flowcare://start/<id>`, a node's own `qr` value, or a bare node id.
    func node(forScannedCode raw: String) -> MapNode? {
        let code = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        if let match = nodes.first(where: { $0.qr == code }) { return match }
        let prefixes = ["FC-START:", "flowcare://start/", "FLOWCARE-START:"]
        for prefix in prefixes where code.lowercased().hasPrefix(prefix.lowercased()) {
            return node(String(code.dropFirst(prefix.count)))
        }
        return node(code)
    }
}

struct MapFloor: Codable, Identifiable, Equatable {
    var id: String
    var level: Int
    var code: String?
    var nameAr: String
    var nameEn: String
    var rooms: [MapRect]?

    var label: String { code ?? id }
}

struct MapRect: Codable, Equatable {
    var x: Double, y: Double, w: Double, h: Double
}

enum NodeKind: String, Codable {
    case entrance, clinic, service, elevator, stairs, ramp, junction, restroom, parking, kids
}

enum NodeStatus: String, Codable { case open, maintenance, closed }

struct MapNode: Codable, Identifiable, Equatable, Hashable {
    var id: String
    var kind: NodeKind
    var floor: String
    var x: Double
    var y: Double
    var nameAr: String?
    var nameEn: String?
    var code: String?
    var symbol: String?
    var searchable: Bool?
    var status: NodeStatus?
    var qr: String?

    var point: CGPoint { CGPoint(x: x, y: y) }
    var isOpen: Bool { (status ?? .open) == .open }
    var ar: String { nameAr ?? nameEn ?? id }
    var en: String { nameEn ?? nameAr ?? id }
    var isNamed: Bool { kind != .junction && (nameAr != nil || nameEn != nil) }

    var icon: String {
        if let symbol { return symbol }
        switch kind {
        case .entrance: return "door.left.hand.open"
        case .clinic: return code == "204" ? "heart.text.square.fill" : "stethoscope"
        case .service:
            let n = en.lowercased()
            if n.contains("lab") { return "testtube.2" }
            if n.contains("pharm") { return "pills.fill" }
            if n.contains("recep") { return "person.text.rectangle.fill" }
            if n.contains("radio") { return "rays" }
            return "cross.case.fill"
        case .elevator: return "arrow.up.arrow.down.square.fill"
        case .stairs: return "figure.stairs"
        case .ramp: return "figure.roll"
        case .junction: return "circle"
        case .restroom: return "toilet.fill"
        case .parking: return "car.fill"
        case .kids: return "teddybear.fill"
        }
    }
}

enum EdgeKind: String, Codable { case walk, ramp, stairs, elevator }

struct MapEdge: Codable, Equatable {
    var from: String
    var to: String
    var kind: EdgeKind?
    var meters: Double?
    /// false = not usable for wheelchairs, elderly or pregnant routes.
    var accessible: Bool?
    /// false = one-way (from → to).
    var bidirectional: Bool?
}

/// App-level places that a hospital dataset maps to its own node ids via `roles`.
enum PlaceRole: String {
    case reception, triage, lab, cardiology, pharmacy, parking, kids, restroom
}

// MARK: - Loading & replacing data

enum MapDataError: LocalizedError {
    case unreadable(String)
    case invalid(String)

    var errorDescription: String? {
        switch self {
        case .unreadable(let m): "Could not read map file: \(m)"
        case .invalid(let m): "Map data is not valid: \(m)"
        }
    }
}

enum MapLoader {
    static let bundledName = "demo_map"

    /// Hospital-approved data imported on the device replaces the bundled demo.
    static var customURL: URL {
        URL.documentsDirectory.appending(path: "hospital_map.json")
    }

    static func load() -> (dataset: MapDataset, isCustom: Bool) {
        if let data = try? Data(contentsOf: customURL),
           let custom = try? decode(data) {
            return (custom, true)
        }
        return (bundled(), false)
    }

    static func bundled() -> MapDataset {
        guard let url = Bundle.main.url(forResource: bundledName, withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let dataset = try? decode(data) else {
            return fallback
        }
        return dataset
    }

    static func decode(_ data: Data) throws -> MapDataset {
        let dataset: MapDataset
        do {
            dataset = try JSONDecoder().decode(MapDataset.self, from: data)
        } catch {
            throw MapDataError.unreadable(String(describing: error))
        }
        try validate(dataset)
        return dataset
    }

    static func validate(_ d: MapDataset) throws {
        let ids = d.nodes.map(\.id)
        if Set(ids).count != ids.count { throw MapDataError.invalid("duplicate node ids") }
        let floorIDs = Set(d.floors.map(\.id))
        if floorIDs.isEmpty { throw MapDataError.invalid("no floors") }
        if let bad = d.nodes.first(where: { !floorIDs.contains($0.floor) }) {
            throw MapDataError.invalid("node \(bad.id) uses unknown floor \(bad.floor)")
        }
        let idSet = Set(ids)
        if let bad = d.edges.first(where: { !idSet.contains($0.from) || !idSet.contains($0.to) }) {
            throw MapDataError.invalid("edge \(bad.from) → \(bad.to) references a missing node")
        }
        if !idSet.contains(d.defaultStart) { throw MapDataError.invalid("defaultStart \(d.defaultStart) not found") }
        if d.destinations.isEmpty { throw MapDataError.invalid("no searchable destinations") }
    }

    /// Validates and installs a JSON file chosen by staff (e.g. from Files).
    static func install(from url: URL) throws -> MapDataset {
        let scoped = url.startAccessingSecurityScopedResource()
        defer { if scoped { url.stopAccessingSecurityScopedResource() } }
        let data: Data
        do { data = try Data(contentsOf: url) } catch { throw MapDataError.unreadable(error.localizedDescription) }
        let dataset = try decode(data)
        try data.write(to: customURL, options: .atomic)
        return dataset
    }

    static func removeCustom() {
        try? FileManager.default.removeItem(at: customURL)
    }

    private static let fallback = MapDataset(
        schemaVersion: 1, id: "empty", version: nil, isDemo: true,
        nameAr: "لا توجد بيانات خريطة", nameEn: "No map data", metersPerUnit: 140,
        defaultStart: "A", roles: nil,
        floors: [MapFloor(id: "G", level: 0, code: "G", nameAr: "الأرضي", nameEn: "Ground", rooms: [])],
        nodes: [MapNode(id: "A", kind: .entrance, floor: "G", x: 0.5, y: 0.9, nameAr: "المدخل", nameEn: "Entrance", searchable: true)],
        edges: []
    )
}

// MARK: - Routing

struct RouteLeg: Equatable {
    let from: MapNode
    let to: MapNode
    let kind: EdgeKind
    let meters: Double
    var vertical: Bool { from.floor != to.floor || kind == .elevator || kind == .stairs }
}

struct RouteStep: Identifiable, Equatable {
    let id: Int
    let ar: String
    let en: String
    let symbol: String
    let floor: String
}

struct MapRoute: Equatable {
    let nodes: [MapNode]
    let legs: [RouteLeg]
    let steps: [RouteStep]
    let meters: Int

    var minutes: Int { max(1, Int((Double(meters) / 60).rounded(.up))) }
    var floors: [String] {
        var out: [String] = []
        for n in nodes where out.last != n.floor { out.append(n.floor) }
        return out
    }

    /// Same-floor polylines to draw on one floor.
    func polylines(on floor: String) -> [[CGPoint]] {
        var lines: [[CGPoint]] = []
        var current: [CGPoint] = []
        for leg in legs {
            if !leg.vertical && leg.from.floor == floor {
                if current.isEmpty { current.append(leg.from.point) }
                current.append(leg.to.point)
            } else if !current.isEmpty {
                lines.append(current)
                current = []
            }
        }
        if !current.isEmpty { lines.append(current) }
        if lines.isEmpty, nodes.count == 1, nodes[0].floor == floor { lines = [[nodes[0].point]] }
        return lines
    }

    /// Elevators or stairs where the route changes floor, as seen on one floor.
    func transitions(on floor: String) -> [MapNode] {
        var seen = Set<String>()
        return legs.filter(\.vertical).flatMap { [$0.from, $0.to] }
            .filter { $0.floor == floor && seen.insert($0.id).inserted }
    }
}

enum Router {
    static func route(in d: MapDataset, from startID: String, to endID: String, type: RouteType) -> MapRoute? {
        guard let start = d.node(startID), let end = d.node(endID) else { return nil }
        if start.id == end.id {
            return MapRoute(nodes: [start], legs: [], steps: buildSteps([start], legs: [], dataset: d), meters: 0)
        }
        let index = Dictionary(uniqueKeysWithValues: d.nodes.enumerated().map { ($1.id, $0) })
        var adjacency = Array(repeating: [(to: Int, kind: EdgeKind, meters: Double, cost: Double)](), count: d.nodes.count)
        let stepFree = type == .elderly || type == .pregnant

        for e in d.edges {
            guard let a = index[e.from], let b = index[e.to] else { continue }
            let na = d.nodes[a], nb = d.nodes[b]
            let kind = e.kind ?? (na.floor == nb.floor ? .walk : .elevator)
            if stepFree && (kind == .stairs || e.accessible == false) { continue }
            let blocked = { (n: MapNode) in !n.isOpen && n.id != start.id && n.id != end.id }
            if blocked(na) || blocked(nb) { continue }
            let meters = e.meters ?? (na.floor == nb.floor ? hypot(na.x - nb.x, na.y - nb.y) * d.scale : 20)
            var cost = meters
            if type == .elderly && kind == .ramp { cost *= 0.55 }
            if kind == .elevator { cost += 4 }
            adjacency[a].append((b, kind, meters, cost))
            if e.bidirectional ?? true { adjacency[b].append((a, kind, meters, cost)) }
        }

        guard let s = index[start.id], let t = index[end.id] else { return nil }
        var dist = Array(repeating: Double.infinity, count: d.nodes.count)
        var prev = Array(repeating: (node: -1, kind: EdgeKind.walk, meters: 0.0), count: d.nodes.count)
        var done = Array(repeating: false, count: d.nodes.count)
        dist[s] = 0
        for _ in 0..<d.nodes.count {
            var u = -1
            for i in 0..<dist.count where !done[i] && dist[i] < .infinity && (u == -1 || dist[i] < dist[u]) { u = i }
            if u == -1 || u == t { break }
            done[u] = true
            for edge in adjacency[u] where dist[u] + edge.cost < dist[edge.to] {
                dist[edge.to] = dist[u] + edge.cost
                prev[edge.to] = (u, edge.kind, edge.meters)
            }
        }
        guard dist[t] < .infinity else { return nil }

        var path: [Int] = [t]
        var legs: [RouteLeg] = []
        var cur = t
        while cur != s {
            let p = prev[cur]
            legs.insert(RouteLeg(from: d.nodes[p.node], to: d.nodes[cur], kind: p.kind, meters: p.meters), at: 0)
            path.insert(p.node, at: 0)
            cur = p.node
        }
        let nodes = path.map { d.nodes[$0] }
        let meters = Int(legs.reduce(0) { $0 + $1.meters }.rounded())
        return MapRoute(nodes: nodes, legs: legs, steps: buildSteps(nodes, legs: legs, dataset: d), meters: meters)
    }

    private static func angle(_ leg: RouteLeg) -> Double {
        atan2(leg.to.y - leg.from.y, leg.to.x - leg.from.x) * 180 / .pi
    }

    /// Signed turn in degrees; positive = right (screen y grows downward).
    private static func turn(_ a: RouteLeg, _ b: RouteLeg) -> Double {
        var diff = angle(b) - angle(a)
        while diff > 180 { diff -= 360 }
        while diff <= -180 { diff += 360 }
        return diff
    }

    static func buildSteps(_ nodes: [MapNode], legs: [RouteLeg], dataset d: MapDataset) -> [RouteStep] {
        guard let start = nodes.first, let end = nodes.last else { return [] }
        var steps: [(ar: String, en: String, symbol: String, floor: String)] = []
        var i = 0
        while i < legs.count {
            let leg = legs[i]
            if leg.vertical {
                var j = i
                while j < legs.count && legs[j].vertical && legs[j].kind == leg.kind { j += 1 }
                let target = legs[j - 1].to
                let floorName = d.floor(target.floor)
                let up = (d.floor(target.floor)?.level ?? 0) > (d.floor(leg.from.floor)?.level ?? 0)
                let fAr = floorName?.nameAr ?? target.floor, fEn = floorName?.nameEn ?? target.floor
                if leg.kind == .stairs {
                    steps.append((up ? "اصعد الدرج إلى \(fAr)" : "انزل الدرج إلى \(fAr)",
                                  up ? "Take the stairs up to the \(fEn)" : "Take the stairs down to the \(fEn)",
                                  "figure.stairs", leg.from.floor))
                } else {
                    steps.append(("اركب \(leg.from.ar) إلى \(fAr)", "Take \(leg.from.en) to the \(fEn)",
                                  up ? "arrow.up.square.fill" : "arrow.down.square.fill", leg.from.floor))
                }
                i = j
                continue
            }
            var meters = leg.meters
            var ramp = leg.kind == .ramp
            var j = i + 1
            while j < legs.count && !legs[j].vertical && abs(turn(legs[j - 1], legs[j])) < 25 {
                meters += legs[j].meters
                ramp = ramp || legs[j].kind == .ramp
                j += 1
            }
            let m = max(Int(meters.rounded()), 3)
            let walkAr = ramp ? "اتبع ممر المنحدر \(m) متراً" : "امشِ للأمام \(m) متراً"
            let walkEn = ramp ? "Follow the ramp corridor for \(m) meters" : "Walk forward \(m) meters"
            let runEnd = legs[j - 1].to
            var ar: String, en: String, symbol: String
            if j == legs.count {
                ar = "\(walkAr) حتى تصل إلى \(end.ar)"
                en = "\(walkEn) to reach \(end.en)"
                symbol = "arrow.up"
            } else if legs[j].vertical {
                ar = "\(walkAr) حتى \(runEnd.ar)"
                en = "\(walkEn) to \(runEnd.en)"
                symbol = ramp ? "figure.roll" : "arrow.up"
            } else {
                let right = turn(legs[j - 1], legs[j]) > 0
                let at = runEnd.isNamed
                ar = "\(walkAr)، ثم اتجه \(right ? "يميناً" : "يساراً")\(at ? " عند \(runEnd.ar)" : "")"
                en = "\(walkEn), then turn \(right ? "right" : "left")\(at ? " at \(runEnd.en)" : "")"
                symbol = right ? "arrow.turn.up.right" : "arrow.turn.up.left"
            }
            if i == 0 {
                ar = "ابدأ من \(start.ar). " + ar
                en = "Start at \(start.en). " + en
            }
            steps.append((ar, en, symbol, leg.from.floor))
            i = j
        }
        let code = end.code.map { " \($0)" } ?? ""
        steps.append(("لقد وصلت إلى \(end.ar)\(code)", "You have arrived at \(end.en)\(code)", "mappin.circle.fill", end.floor))
        return steps.enumerated().map { RouteStep(id: $0.offset, ar: $0.element.ar, en: $0.element.en, symbol: $0.element.symbol, floor: $0.element.floor) }
    }
}
