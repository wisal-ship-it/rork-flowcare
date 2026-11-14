import SwiftUI
import AVFoundation

/// Primary line in the active language, secondary line in the other language.
struct BiText: View {
    @Environment(AppState.self) private var app
    let ar: String
    let en: String
    var primary: Font = .headline
    var secondary: Font = .subheadline
    var primaryColor: Color = Theme.ink
    var secondaryColor: Color = Theme.sub
    var alignment: HorizontalAlignment = .leading

    var body: some View {
        VStack(alignment: alignment, spacing: 2) {
            Text(app.t(ar, en))
                .font(primary)
                .foregroundStyle(primaryColor)
            Text(app.other(ar, en))
                .font(secondary)
                .foregroundStyle(secondaryColor)
        }
        .multilineTextAlignment(alignment == .center ? .center : .leading)
    }
}

struct LanguageToggle: View {
    @Environment(AppState.self) private var app

    var body: some View {
        HStack(spacing: 2) {
            segment(.ar, "AR")
            segment(.en, "EN")
        }
        .padding(3)
        .background(Theme.surface, in: .capsule)
        .overlay(Capsule().stroke(Theme.hairline, lineWidth: 1).allowsHitTesting(false))
        .sensoryFeedback(.selection, trigger: app.lang)
    }

    private func segment(_ lang: AppLanguage, _ label: String) -> some View {
        Button {
            withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) { app.lang = lang }
        } label: {
            Text(label)
                .font(.subheadline.weight(.bold))
                .foregroundStyle(app.lang == lang ? .white : Theme.sub)
                .frame(width: 46, height: 32)
                .contentShape(.capsule)
                .background {
                    if app.lang == lang {
                        Capsule().fill(Theme.blue)
                    }
                }
        }
        .buttonStyle(PressableStyle())
        .accessibilityLabel(lang == .ar ? "العربية" : "English")
        .accessibilityAddTraits(app.lang == lang ? .isSelected : [])
        .accessibilityIdentifier("lang.\(label.lowercased())")
    }
}

struct AppHeader<Trailing: View>: View {
    var guide: ScreenGuide? = nil
    @ViewBuilder var trailing: () -> Trailing

    var body: some View {
        HStack(spacing: 10) {
            Text("FlowCare")
                .font(.system(size: 30, weight: .heavy, design: .rounded))
                .foregroundStyle(
                    LinearGradient(colors: [Theme.navy, Theme.blue], startPoint: .leading, endPoint: .trailing)
                )
            Spacer()
            if let guide { GuideButton(guide: guide) }
            trailing()
            LanguageToggle()
        }
    }
}

extension AppHeader where Trailing == EmptyView {
    init(guide: ScreenGuide? = nil) {
        self.guide = guide
        self.trailing = { EmptyView() }
    }
}

struct DemoTag: View {
    @Environment(AppState.self) private var app
    var body: some View {
        Text(app.t("تجريبي", "DEMO"))
            .font(.caption2.weight(.heavy))
            .foregroundStyle(Theme.orange)
            .padding(.horizontal, 7)
            .padding(.vertical, 3)
            .background(Theme.orange.opacity(0.14), in: .capsule)
    }
}

struct ToastView: View {
    @Environment(AppState.self) private var app

    var body: some View {
        if let toast = app.toast {
            HStack(spacing: 12) {
                Image(systemName: toast.symbol)
                    .font(.title3)
                    .foregroundStyle(toast.isDemo ? Theme.orange : Theme.green)
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 6) {
                        Text(app.t(toast.ar, toast.en))
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(Theme.ink)
                        if toast.isDemo { DemoTag() }
                    }
                    Text(app.other(toast.ar, toast.en))
                        .font(.caption)
                        .foregroundStyle(Theme.sub)
                }
                Spacer(minLength: 0)
            }
            .padding(14)
            .background(.regularMaterial, in: .rect(cornerRadius: 18))
            .overlay(RoundedRectangle(cornerRadius: 18).stroke(Theme.hairline, lineWidth: 1))
            .shadow(color: .black.opacity(0.12), radius: 18, y: 8)
            .padding(.horizontal, 16)
            .padding(.top, 6)
            .transition(.move(edge: .top).combined(with: .opacity))
            .onTapGesture { withAnimation { app.toast = nil } }
            .id(toast.id)
            .sensoryFeedback(.success, trigger: toast.id)
        }
    }
}

struct PrimaryButton: View {
    let ar: String
    let en: String
    var symbol: String = "chevron.forward"
    var color: Color = Theme.blue
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack {
                Spacer()
                BiText(ar: ar, en: en, primary: .headline, secondary: .footnote,
                       primaryColor: .white, secondaryColor: .white.opacity(0.8), alignment: .center)
                Spacer()
                Image(systemName: symbol)
                    .font(.headline)
                    .foregroundStyle(.white)
                    .flipsForRightToLeftLayoutDirection(true)
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 14)
            .background(color, in: .rect(cornerRadius: 20))
            .shadow(color: color.opacity(0.3), radius: 12, y: 6)
        }
        .buttonStyle(PressableStyle())
    }
}

/// Turn-by-turn guidance in Arabic or English, played through the shared speech engine.
@Observable
final class VoiceGuide {
    static let stepKey = "map-step"
    var isOn = false

    func speak(_ text: String, lang: AppLanguage) {
        guard isOn else { return }
        SpeechCenter.shared.speak([text], lang: lang, key: Self.stepKey, isGuide: false)
    }

    func stop() { SpeechCenter.shared.stop() }
}
