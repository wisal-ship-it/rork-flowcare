import SwiftUI

enum Theme {
    static let canvas = Color(hex: 0xF4F8FC)
    static let surface = Color.white
    static let blue = Color(hex: 0x1E6FD9)
    static let blueLight = Color(hex: 0x4FA3F7)
    static let navy = Color(hex: 0x173865)
    static let ink = Color(hex: 0x0F2A43)
    static let sub = Color(hex: 0x5B6B7C)
    static let green = Color(hex: 0x22A06B)
    static let greenSoft = Color(hex: 0x3DAE7C)
    static let orange = Color(hex: 0xF59E0B)
    static let red = Color(hex: 0xE5484D)
    static let purple = Color(hex: 0x8B5CF6)
    static let hairline = Color(hex: 0xE3EBF4)

    // Kids palette
    static let kidYellow = Color(hex: 0xFFD166)
    static let kidCoral = Color(hex: 0xFF8A73)
    static let kidMint = Color(hex: 0x6FD6B5)
    static let kidSky = Color(hex: 0x7CC4FF)

    static let heroGradient = LinearGradient(
        colors: [Color(hex: 0x1E6FD9), Color(hex: 0x2F86EA), Color(hex: 0x58AEF8)],
        startPoint: .topLeading, endPoint: .bottomTrailing
    )
}

extension Color {
    init(hex: UInt32, opacity: Double = 1) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255,
            opacity: opacity
        )
    }
}

struct CardStyle: ViewModifier {
    var padding: CGFloat = 16
    func body(content: Content) -> some View {
        content
            .padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.surface, in: .rect(cornerRadius: 22))
            .overlay(RoundedRectangle(cornerRadius: 22).stroke(Theme.hairline, lineWidth: 1))
            .shadow(color: Theme.navy.opacity(0.05), radius: 12, y: 4)
    }
}

extension View {
    func card(padding: CGFloat = 16) -> some View { modifier(CardStyle(padding: padding)) }
}

/// Press feedback used by all tappable cards.
struct PressableStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .opacity(configuration.isPressed ? 0.9 : 1)
            .animation(.spring(response: 0.25, dampingFraction: 0.7), value: configuration.isPressed)
    }
}

/// Soft atmospheric background shared by every screen.
struct ScreenBackground: View {
    var body: some View {
        ZStack {
            Theme.canvas
            Circle()
                .fill(Theme.blueLight.opacity(0.16))
                .frame(width: 360, height: 360)
                .blur(radius: 70)
                .offset(x: 150, y: -320)
            Circle()
                .fill(Theme.green.opacity(0.08))
                .frame(width: 300, height: 300)
                .blur(radius: 80)
                .offset(x: -160, y: 360)
        }
        .ignoresSafeArea()
        .allowsHitTesting(false)
    }
}

struct IconBadge: View {
    let symbol: String
    var color: Color = Theme.blue
    var size: CGFloat = 48
    var body: some View {
        Image(systemName: symbol)
            .font(.system(size: size * 0.44, weight: .semibold))
            .foregroundStyle(color)
            .frame(width: size, height: size)
            .background(color.opacity(0.13), in: .rect(cornerRadius: size * 0.3))
    }
}
