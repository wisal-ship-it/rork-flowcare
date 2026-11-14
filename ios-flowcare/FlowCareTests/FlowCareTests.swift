import Foundation
import Testing
@testable import FlowCare

@MainActor
struct MapDataTests {
    let map = MapLoader.bundled()

    @Test func bundledDemoMapLoadsAndValidates() throws {
        #expect(map.id == "flowcare-demo")
        #expect(map.demo)
        #expect(map.floors.count == 3)
        try MapLoader.validate(map)
        for role in [PlaceRole.reception, .triage, .lab, .cardiology, .pharmacy, .parking, .kids, .restroom] {
            #expect(map.nodeID(for: role) != nil, "role \(role.rawValue) should be mapped")
        }
    }

    @Test func elevatorUnderMaintenanceIsListedOnce() {
        let broken = map.unavailableElevators
        #expect(broken.count == 1)
        #expect(broken.first?.code == "E2")
    }

    @Test func rejectsEdgeToMissingNode() throws {
        var bad = map
        bad.edges.append(MapEdge(from: "ENT-MAIN", to: "NOWHERE"))
        #expect(throws: MapDataError.self) { try MapLoader.validate(bad) }
    }

    @Test func rejectsMalformedJSON() {
        #expect(throws: MapDataError.self) { try MapLoader.decode(Data("{\"id\": 1}".utf8)) }
    }

    @Test func resolvesScannedStartCodes() {
        #expect(map.node(forScannedCode: "FC-START:E3-1")?.id == "E3-1")
        #expect(map.node(forScannedCode: "flowcare://start/ENT-ER")?.id == "ENT-ER")
        #expect(map.node(forScannedCode: "  SVC-RECEPTION \n")?.id == "SVC-RECEPTION")
        #expect(map.node(forScannedCode: "FC-START:UNKNOWN") == nil)
        #expect(map.node(forScannedCode: "random text") == nil)
    }
}

@MainActor
struct RouterTests {
    let map = MapLoader.bundled()

    @Test func urgentRouteReachesCardiologyAvoidingBrokenElevator() throws {
        let route = try #require(Router.route(in: map, from: "ENT-MAIN", to: "CLN-CARD-204", type: .urgent))
        #expect(route.nodes.first?.id == "ENT-MAIN")
        #expect(route.nodes.last?.id == "CLN-CARD-204")
        #expect(!route.nodes.contains { $0.code == "E2" })
        #expect(route.floors.first == "G")
        #expect(route.floors.last == "2")
        #expect(route.meters > 0)
    }

    @Test func elderlyAndPregnantRoutesNeverUseStairs() throws {
        for type in [RouteType.elderly, .pregnant] {
            let route = try #require(Router.route(in: map, from: "ENT-MAIN", to: "CLN-CARD-204", type: type))
            #expect(!route.legs.contains { $0.kind == .stairs }, "\(type) used stairs")
            #expect(route.nodes.contains { $0.id == "E3-G" }, "\(type) should take elevator 3")
        }
    }

    @Test func elderlyRoutePrefersRampCorridor() throws {
        let route = try #require(Router.route(in: map, from: "ENT-MAIN", to: "CLN-CARD-204", type: .elderly))
        #expect(route.legs.contains { $0.kind == .ramp })
    }

    @Test func stepsEndWithArrivalInBothLanguages() throws {
        let route = try #require(Router.route(in: map, from: "ENT-MAIN", to: "SVC-LAB", type: .urgent))
        let last = try #require(route.steps.last)
        #expect(last.ar.contains("وصلت"))
        #expect(last.en.contains("arrived"))
        #expect(route.steps.first?.ar.contains("المدخل الرئيسي") == true)
        #expect(route.steps.contains { $0.symbol == "figure.stairs" || $0.symbol.hasPrefix("arrow.up.square") })
    }

    @Test func sameStartAndDestinationGivesArrivalOnly() throws {
        let route = try #require(Router.route(in: map, from: "SVC-KIDS", to: "SVC-KIDS", type: .urgent))
        #expect(route.steps.count == 1)
        #expect(route.meters == 0)
    }

    @Test func startFromScannedElevatorChangesRoute() throws {
        let fromEntrance = try #require(Router.route(in: map, from: "ENT-MAIN", to: "SVC-LAB", type: .elderly))
        let fromFloor1 = try #require(Router.route(in: map, from: "E3-1", to: "SVC-LAB", type: .elderly))
        #expect(fromFloor1.meters < fromEntrance.meters)
        #expect(fromFloor1.floors == ["1"])
    }
}
