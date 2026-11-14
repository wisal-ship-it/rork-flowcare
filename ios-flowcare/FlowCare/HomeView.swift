import SwiftUI

enum HomeRoute: Hashable { case kids, doctor }

struct HomeView: View {
    @Environment(AppState.self) private var app
    @State private var path: [HomeRoute] = []
    @State private var showScanner = false

    var body: some View {
        NavigationStack(path: $path) {
            ScrollView {
                VStack(spacing: 14) {
                    AppHeader(guide: .home) {
                        Button {
                            path.append(.doctor)
                        } label: {
                            Image(systemName: "stethoscope")
                                .font(.headline)
                                .foregroundStyle(Theme.blue)
                                .frame(width: 40, height: 40)
                                .background(Theme.surface, in: .circle)
                                .overlay(Circle().stroke(Theme.hairline, lineWidth: 1))
                        }
                        .buttonStyle(PressableStyle())
                        .accessibilityLabel(app.t("لوحة الطبيب", "Doctor Dashboard"))
                    }
                    .padding(.bottom, 4)

                    appointmentCard
                    scanRow
                    servicesGrid
                    onTrackBanner
                }
                .padding(.horizontal, 18)
                .padding(.top, 8)
                .padding(.bottom, 24)
            }
            .scrollIndicators(.hidden)
            .background(ScreenBackground())
            .toolbar(.hidden, for: .navigationBar)
            .navigationDestination(for: HomeRoute.self) { route in
                switch route {
                case .kids: KidsZoneView()
                case .doctor: DoctorDashboardView()
                }
            }
            .fullScreenCover(isPresented: $showScanner) {
                ScannerView()
            }
        }
    }

    // MARK: Appointment

    private var appointmentCard: some View {
        let a = app.appointment
        return VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .top) {
                BiText(ar: "موعدك القادم", en: "Next appointment",
                       primary: .title2.weight(.bold), secondary: .subheadline,
                       primaryColor: .white, secondaryColor: .white.opacity(0.8))
                Spacer()
                Text(a.ticket)
                    .font(.footnote.weight(.bold).monospacedDigit())
                    .foregroundStyle(.white)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(.white.opacity(0.18), in: .capsule)
                    .environment(\.layoutDirection, .leftToRight)
            }

            infoRow(symbol: "calendar", ar: a.timeAr, en: a.timeEn)
            infoRow(symbol: "person.crop.circle", ar: "\(a.doctorAr) - \(a.room)", en: "\(a.doctorEn) - \(a.room)")

            HStack(spacing: 8) {
                statusBadge
                HStack(spacing: 6) {
                    Image(systemName: "person.3.fill")
                    Text(app.t("\(a.ahead) قبلك · \(a.minutes) د", "\(a.ahead) ahead · \(a.minutes) min"))
                }
                .font(.footnote.weight(.semibold))
                .foregroundStyle(.white)
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(.white.opacity(0.18), in: .capsule)
                Spacer(minLength: 0)
            }

            Button {
                app.navigate(to: app.appointment.clinicNodeID)
            } label: {
                HStack {
                    Spacer()
                    BiText(ar: "بدء الذهاب للعيادة", en: "Go to Clinic",
                           primary: .headline, secondary: .footnote,
                           primaryColor: Theme.blue, secondaryColor: Theme.sub, alignment: .center)
                    Spacer()
                    Image(systemName: "chevron.forward")
                        .font(.headline)
                        .foregroundStyle(Theme.blue)
                }
                .padding(.horizontal, 20)
                .padding(.vertical, 12)
                .background(.white, in: .capsule)
            }
            .buttonStyle(PressableStyle())
            .accessibilityIdentifier("home.goToClinic")
        }
        .padding(20)
        .background {
            ZStack {
                Theme.heroGradient
                Circle().fill(.white.opacity(0.10)).frame(width: 260).offset(x: 140, y: -90)
                Circle().fill(.white.opacity(0.07)).frame(width: 200).offset(x: -150, y: 120)
            }
            .allowsHitTesting(false)
        }
        .clipShape(.rect(cornerRadius: 26))
        .shadow(color: Theme.blue.opacity(0.28), radius: 18, y: 10)
    }

    private var statusBadge: some View {
        HStack(spacing: 6) {
            Circle().fill(app.clinicStatus.color).frame(width: 8, height: 8)
            Text(app.t(app.clinicStatus.ar, app.clinicStatus.en))
        }
        .font(.footnote.weight(.bold))
        .foregroundStyle(Theme.ink)
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(.white, in: .capsule)
    }

    private func infoRow(symbol: String, ar: String, en: String) -> some View {
        HStack(spacing: 12) {
            Image(systemName: symbol)
                .font(.title3)
                .foregroundStyle(.white)
                .frame(width: 46, height: 46)
                .background(.white.opacity(0.18), in: .rect(cornerRadius: 14))
            BiText(ar: ar, en: en, primary: .headline, secondary: .footnote,
                   primaryColor: .white, secondaryColor: .white.opacity(0.8))
        }
    }

    // MARK: Scan

    private var scanRow: some View {
        Button { showScanner = true } label: {
            HStack(spacing: 14) {
                IconBadge(symbol: "camera.fill")
                BiText(ar: "امسح باركود الموعد", en: "Scan appointment barcode")
                Spacer()
                Image(systemName: "chevron.forward")
                    .foregroundStyle(Theme.sub)
            }
            .card()
        }
        .buttonStyle(PressableStyle())
        .accessibilityIdentifier("home.scan")
    }

    // MARK: Services

    private var servicesGrid: some View {
        LazyVGrid(columns: [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)], spacing: 12) {
            serviceTile(symbol: "parkingsign.circle.fill", color: Theme.green, ar: "المواقف الذكية", en: "Smart Parking") {
                app.tab = .parking
            }
            serviceTile(symbol: "location.north.fill", color: Theme.purple, ar: "الملاحة الداخلية", en: "Indoor Navigation") {
                app.tab = .map
            }
            serviceTile(symbol: "figure.2.and.child.holdinghands", color: Theme.orange, ar: "ركن الأطفال", en: "Kids Zone") {
                path.append(.kids)
            }
            .accessibilityIdentifier("home.kids")
            serviceTile(symbol: "headphones", color: Theme.blueLight, ar: "طلب مساعدة", en: "Request Assistance") {
                app.tab = .support
            }
        }
    }

    private func serviceTile(symbol: String, color: Color, ar: String, en: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 10) {
                IconBadge(symbol: symbol, color: color, size: 50)
                BiText(ar: ar, en: en, primary: .headline, secondary: .footnote)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }
            .card(padding: 14)
        }
        .buttonStyle(PressableStyle())
    }

    private var onTrackBanner: some View {
        Button { app.tab = .visit } label: {
            HStack(spacing: 14) {
                Image(systemName: "checkmark")
                    .font(.headline.weight(.bold))
                    .foregroundStyle(.white)
                    .frame(width: 48, height: 48)
                    .background(.white.opacity(0.22), in: .circle)
                BiText(ar: "أنت على المسار الصحيح", en: "You are on track",
                       primary: .headline, secondary: .footnote,
                       primaryColor: .white, secondaryColor: .white.opacity(0.85))
                Spacer()
            }
            .padding(16)
            .background(
                LinearGradient(colors: [Theme.green, Theme.greenSoft], startPoint: .leading, endPoint: .trailing),
                in: .rect(cornerRadius: 22)
            )
        }
        .buttonStyle(PressableStyle())
    }
}
