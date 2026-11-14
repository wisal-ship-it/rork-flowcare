import XCTest

final class FlowCareUITests: XCTestCase {

    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    @MainActor
    private func launchFresh() -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = ["-uiTestReset", "-uiTesting"]
        app.launch()
        return app
    }

    @MainActor
    private func element(_ app: XCUIApplication, _ id: String) -> XCUIElement {
        app.descendants(matching: .any).matching(identifier: id).firstMatch
    }

    @MainActor
    func testMapPickDestinationShowsRouteAndVoice() throws {
        let app = launchFresh()
        app.tabBars.buttons["الخريطة"].tap()

        let search = element(app, "map.search")
        XCTAssertTrue(search.waitForExistence(timeout: 10))
        search.tap()

        let field = app.searchFields.firstMatch
        XCTAssertTrue(field.waitForExistence(timeout: 5), "search field missing")
        field.tap()
        field.typeText("Lab")
        let lab = element(app, "dest.SVC-LAB")
        XCTAssertTrue(lab.waitForExistence(timeout: 5), "lab result missing")
        lab.tap()

        let card = element(app, "map.destinationCard")
        XCTAssertTrue(card.waitForExistence(timeout: 5), "destination card missing")
        XCTAssertTrue(card.label.contains("مختبر التحاليل"), "card was \(card.label)")
        let counter = element(app, "map.stepCounter")
        XCTAssertTrue(counter.waitForExistence(timeout: 5), "step counter missing")
        XCTAssertTrue(counter.label.hasPrefix("الخطوة 1"), "counter was \(counter.label)")
        let stepText = element(app, "map.stepText")
        XCTAssertTrue(stepText.label.contains("المدخل الرئيسي"), "step was \(stepText.label)")

        element(app, "map.nextStep").tap()
        XCTAssertTrue(counter.label.hasPrefix("الخطوة 2"), "counter was \(counter.label)")

        let voice = element(app, "map.voiceButton")
        XCTAssertEqual(voice.value as? String, "off")
        voice.tap()
        XCTAssertEqual(voice.value as? String, "on")
    }

    @MainActor
    func testScanStartPointQRChangesStart() throws {
        let app = launchFresh()
        app.tabBars.buttons["الخريطة"].tap()

        let from = element(app, "map.fromLabel")
        XCTAssertTrue(from.waitForExistence(timeout: 10))
        XCTAssertTrue(from.label.contains("المدخل الرئيسي"))

        element(app, "map.scanStart").tap()
        let demo = element(app, "scanner.demoScan")
        XCTAssertTrue(demo.waitForExistence(timeout: 5))
        demo.tap()

        XCTAssertTrue(from.waitForExistence(timeout: 5))
        let predicate = NSPredicate(format: "label CONTAINS %@", "المصعد 3")
        expectation(for: predicate, evaluatedWith: from)
        waitForExpectations(timeout: 5)
    }

    @MainActor
    func testSwitchLanguageArabicToEnglish() throws {
        let app = launchFresh()
        XCTAssertTrue(app.tabBars.buttons["الرئيسية"].waitForExistence(timeout: 10))

        let en = element(app, "lang.en")
        XCTAssertTrue(en.waitForExistence(timeout: 5), "EN toggle missing")
        let info = "type=\(en.elementType.rawValue) frame=\(en.frame) hittable=\(en.isHittable) label=\(en.label) window=\(app.windows.firstMatch.frame)"
        en.tap()
        XCTAssertTrue(app.buttons["Doctor Dashboard"].waitForExistence(timeout: 5),
                      "content did not switch to English: \(info)")
        let homeTab = app.tabBars.buttons["Home"]
        XCTAssertTrue(homeTab.waitForExistence(timeout: 5),
                      "Home tab not in English; tabs: \(app.tabBars.buttons.allElementsBoundByIndex.map(\.label))")
        XCTAssertTrue(app.tabBars.buttons["Map"].exists, "Map tab not in English")
        XCTAssertTrue(app.tabBars.buttons["My Visit"].exists, "My Visit tab not in English")

        element(app, "lang.ar").tap()
        XCTAssertTrue(app.tabBars.buttons["الرئيسية"].waitForExistence(timeout: 5), "did not switch back to Arabic")
    }

    @MainActor
    func testSaveAndRecallParkingLocation() throws {
        let app = launchFresh()
        app.tabBars.buttons["المواقف"].tap()

        let bay = element(app, "bay.A-04")
        XCTAssertTrue(bay.waitForExistence(timeout: 10), "bay A-04 missing")
        bay.tap()
        let parkedHere = app.buttons["أوقفت سيارتي هنا"]
        XCTAssertTrue(parkedHere.waitForExistence(timeout: 5), "park-here action missing")
        parkedHere.tap()

        let saved = element(app, "parking.whereParked")
        XCTAssertTrue(saved.waitForExistence(timeout: 5), "where-parked card missing")
        let hasBay = NSPredicate(format: "label CONTAINS %@", "A-04")
        expectation(for: hasBay, evaluatedWith: saved)
        waitForExpectations(timeout: 5)

        saved.tap()
        let summary = element(app, "whereParked.summary")
        XCTAssertTrue(summary.waitForExistence(timeout: 5), "summary missing")
        XCTAssertTrue(summary.label.contains("A-04"), "summary was \(summary.label)")

        // Persists across relaunch (no reset argument).
        app.terminate()
        let relaunched = XCUIApplication()
        relaunched.launchArguments = ["-uiTesting"]
        relaunched.launch()
        relaunched.tabBars.buttons["المواقف"].tap()
        let again = element(relaunched, "parking.whereParked")
        XCTAssertTrue(again.waitForExistence(timeout: 10), "card missing after relaunch")
        XCTAssertTrue(again.label.contains("A-04"), "after relaunch: \(again.label)")
    }

    @MainActor
    func testDemoAppointmentScanEditAndShowInVisit() throws {
        let app = launchFresh()
        app.tabBars.buttons["زيارتي"].tap()

        let scan = element(app, "visit.scan")
        XCTAssertTrue(scan.waitForExistence(timeout: 10))
        scan.tap()

        let demo = element(app, "scanner.demoScan")
        XCTAssertTrue(demo.waitForExistence(timeout: 5))
        demo.tap()

        let edit = element(app, "scanner.edit")
        XCTAssertTrue(edit.waitForExistence(timeout: 5))
        edit.tap()

        let ticket = element(app, "edit.ticket")
        XCTAssertTrue(ticket.waitForExistence(timeout: 5))
        ticket.tap()
        ticket.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: 12) + "B-7788")
        element(app, "edit.save").tap()

        let confirm = element(app, "scanner.confirm")
        XCTAssertTrue(confirm.waitForExistence(timeout: 5))
        confirm.tap()

        let visitTicket = element(app, "visit.ticket")
        XCTAssertTrue(visitTicket.waitForExistence(timeout: 5))
        XCTAssertTrue(visitTicket.label.contains("B-7788"), "ticket was \(visitTicket.label)")
        XCTAssertTrue(element(app, "visit.appointmentDetails").exists)
    }

    @MainActor
    func testOpenKidsZoneFromHome() throws {
        let app = launchFresh()
        let kids = element(app, "home.kids")
        XCTAssertTrue(kids.waitForExistence(timeout: 10))
        kids.tap()
        XCTAssertTrue(app.staticTexts["أهلاً يا بطل!"].waitForExistence(timeout: 5))
    }
}
