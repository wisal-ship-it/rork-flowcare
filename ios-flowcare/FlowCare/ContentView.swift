import SwiftUI

struct ContentView: View {
    @State private var app = AppState()

    var body: some View {
        @Bindable var app = app
        TabView(selection: $app.tab) {
            Tab(app.t("الرئيسية", "Home"), systemImage: "house.fill", value: AppTab.home) {
                HomeView()
            }
            Tab(app.t("الخريطة", "Map"), systemImage: "mappin.and.ellipse", value: AppTab.map) {
                IndoorMapView()
            }
            Tab(app.t("المواقف", "Parking"), systemImage: "parkingsign.circle", value: AppTab.parking) {
                ParkingView()
            }
            Tab(app.t("زيارتي", "My Visit"), systemImage: "calendar.badge.clock", value: AppTab.visit) {
                VisitView()
            }
            Tab(app.t("الدعم", "Support"), systemImage: "headphones", value: AppTab.support) {
                SupportView()
            }
        }
        .tint(Theme.blue)
        .sensoryFeedback(.selection, trigger: app.tab)
        .onChange(of: app.tab) { SpeechCenter.shared.stopGuides() }
        .onChange(of: app.lang) { SpeechCenter.shared.stop() }
        .overlay(alignment: .top) { ToastView() }
        .environment(app)
        .environment(\.layoutDirection, app.lang == .ar ? .rightToLeft : .leftToRight)
        .environment(\.locale, Locale(identifier: app.lang == .ar ? "ar" : "en"))
    }
}

#Preview {
    ContentView()
}
