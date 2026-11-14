import SwiftUI

enum KidGame: CaseIterable, Identifiable {
    case memory, colorStar, bubbles, catchStars
    var id: Self { self }
    var ar: String { switch self { case .memory: "لعبة الذاكرة"; case .colorStar: "لوّن النجمة"; case .bubbles: "فقاعات الصابون"; case .catchStars: "اصطد النجوم" } }
    var en: String { switch self { case .memory: "Memory Match"; case .colorStar: "Color the Star"; case .bubbles: "Soap Bubbles"; case .catchStars: "Catch the Stars" } }
    var symbol: String { switch self { case .memory: "square.grid.2x2.fill"; case .colorStar: "paintpalette.fill"; case .bubbles: "bubbles.and.sparkles.fill"; case .catchStars: "star.fill" } }
    var color: Color { switch self { case .memory: Theme.kidSky; case .colorStar: Theme.kidCoral; case .bubbles: Theme.kidMint; case .catchStars: Theme.kidYellow } }
}

struct KidsZoneView: View {
    @Environment(AppState.self) private var app
    @State private var wave = false

    var body: some View {
        ScrollView {
            VStack(spacing: 18) {
                mascot
                turnBanner
                LazyVGrid(columns: [GridItem(.flexible(), spacing: 14), GridItem(.flexible(), spacing: 14)], spacing: 14) {
                    ForEach(KidGame.allCases) { game in
                        NavigationLink {
                            KidGameScreen(game: game)
                        } label: {
                            gameTile(game)
                        }
                        .buttonStyle(PressableStyle())
                    }
                }
            }
            .padding(.horizontal, 18)
            .padding(.bottom, 30)
        }
        .background {
            ZStack {
                Color(hex: 0xFFF8EC).ignoresSafeArea()
                Circle().fill(Theme.kidYellow.opacity(0.35)).frame(width: 300).blur(radius: 60).offset(x: 140, y: -300)
                Circle().fill(Theme.kidMint.opacity(0.25)).frame(width: 280).blur(radius: 70).offset(x: -150, y: 320)
            }
            .ignoresSafeArea()
        }
        .navigationTitle(app.t("ركن الأطفال", "Kids Zone"))
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(.hidden, for: .tabBar)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) { GuideButton(guide: .kids) }
            ToolbarItem(placement: .topBarTrailing) { LanguageToggle() }
        }
    }

    private var mascot: some View {
        VStack(spacing: 10) {
            ZStack {
                Circle().fill(Theme.kidYellow.opacity(0.45)).frame(width: 150, height: 150)
                Text("🧸")
                    .font(.system(size: 92))
                    .rotationEffect(.degrees(wave ? 8 : -8))
                    .animation(.easeInOut(duration: 1.1).repeatForever(autoreverses: true), value: wave)
            }
            .onAppear { wave = true }
            BiText(ar: "أهلاً يا بطل!", en: "Hello, Champ!",
                   primary: .system(.largeTitle, design: .rounded).weight(.heavy), secondary: .headline,
                   primaryColor: Theme.ink, secondaryColor: Theme.sub, alignment: .center)
            Text(app.t("العب واستمتع حتى يحين دورك", "Play and have fun until it's your turn"))
                .font(.subheadline)
                .foregroundStyle(Theme.sub)
        }
        .padding(.top, 8)
    }

    private var turnBanner: some View {
        HStack(spacing: 12) {
            Image(systemName: "hourglass")
                .font(.title2.weight(.bold))
                .foregroundStyle(.white)
                .frame(width: 46, height: 46)
                .background(.white.opacity(0.25), in: .circle)
                .symbolEffect(.pulse)
            BiText(ar: "دورك بعد \(app.appointment.minutes) دقيقة", en: "Your turn in \(app.appointment.minutes) min",
                   primary: .headline, secondary: .footnote,
                   primaryColor: .white, secondaryColor: .white.opacity(0.85))
            Spacer()
            Text(app.appointment.ticket)
                .font(.subheadline.weight(.heavy).monospacedDigit())
                .foregroundStyle(Theme.kidCoral)
                .padding(.horizontal, 10).padding(.vertical, 6)
                .background(.white, in: .capsule)
        }
        .padding(14)
        .background(LinearGradient(colors: [Theme.kidCoral, Color(hex: 0xFFA98F)], startPoint: .leading, endPoint: .trailing), in: .rect(cornerRadius: 24))
        .shadow(color: Theme.kidCoral.opacity(0.35), radius: 14, y: 6)
    }

    private func gameTile(_ game: KidGame) -> some View {
        VStack(spacing: 10) {
            Image(systemName: game.symbol)
                .font(.system(size: 34, weight: .bold))
                .foregroundStyle(.white)
                .frame(width: 72, height: 72)
                .background(.white.opacity(0.3), in: .circle)
            BiText(ar: game.ar, en: game.en, primary: .system(.headline, design: .rounded).weight(.bold), secondary: .caption,
                   primaryColor: Theme.ink, secondaryColor: Theme.ink.opacity(0.65), alignment: .center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 20)
        .background(game.color, in: .rect(cornerRadius: 28))
        .shadow(color: game.color.opacity(0.45), radius: 12, y: 6)
    }
}

// MARK: - Game host

struct KidGameScreen: View {
    @Environment(AppState.self) private var app
    let game: KidGame

    var body: some View {
        ZStack {
            game.color.opacity(0.22).ignoresSafeArea()
            Color(hex: 0xFFF8EC).opacity(0.6).ignoresSafeArea()
            switch game {
            case .memory: MemoryGame()
            case .colorStar: ColorStarGame()
            case .bubbles: BubblesGame()
            case .catchStars: CatchStarsGame()
            }
        }
        .navigationTitle(app.t(game.ar, game.en))
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(.hidden, for: .tabBar)
        .toolbar { ToolbarItem(placement: .topBarTrailing) { GuideButton(guide: ScreenGuide(game: game)) } }
    }
}

// MARK: - Memory

private struct MemoryCard: Identifiable {
    let id = UUID()
    let face: String
    var up = false
    var matched = false
}

struct MemoryGame: View {
    @Environment(AppState.self) private var app
    @State private var cards: [MemoryCard] = MemoryGame.deal()
    @State private var moves = 0
    @State private var busy = false

    fileprivate static func deal() -> [MemoryCard] {
        ["🐻", "🦁", "🐰", "🐢", "🦄", "🐳"].flatMap { [MemoryCard(face: $0), MemoryCard(face: $0)] }.shuffled()
    }

    var body: some View {
        VStack(spacing: 18) {
            HStack {
                Label("\(moves)", systemImage: "hand.tap.fill")
                Spacer()
                Button(app.t("من جديد", "Restart")) { withAnimation { cards = Self.deal(); moves = 0 } }
                    .buttonStyle(.borderedProminent).tint(Theme.kidCoral)
            }
            .font(.headline)
            .foregroundStyle(Theme.ink)
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 12), count: 3), spacing: 12) {
                ForEach(cards.indices, id: \.self) { i in
                    let card = cards[i]
                    Button { flip(i) } label: {
                        ZStack {
                            RoundedRectangle(cornerRadius: 20).fill(card.up || card.matched ? .white : Theme.kidSky)
                            if card.up || card.matched {
                                Text(card.face).font(.system(size: 44))
                            } else {
                                Image(systemName: "questionmark").font(.title.weight(.heavy)).foregroundStyle(.white)
                            }
                        }
                        .frame(height: 96)
                        .opacity(card.matched ? 0.55 : 1)
                        .rotation3DEffect(.degrees(card.up || card.matched ? 0 : 180), axis: (0, 1, 0))
                    }
                    .buttonStyle(.plain)
                }
            }
            if cards.allSatisfy(\.matched) {
                BiText(ar: "رائع! وجدت كل الأزواج 🎉", en: "Great! You found all pairs 🎉", primary: .title3.weight(.heavy), alignment: .center)
                    .transition(.scale.combined(with: .opacity))
            }
            Spacer()
        }
        .padding(20)
        .sensoryFeedback(.success, trigger: cards.filter(\.matched).count)
    }

    private func flip(_ i: Int) {
        guard !busy, !cards[i].up, !cards[i].matched else { return }
        withAnimation(.spring(response: 0.35)) { cards[i].up = true }
        let open = cards.indices.filter { cards[$0].up && !cards[$0].matched }
        guard open.count == 2 else { return }
        moves += 1
        if cards[open[0]].face == cards[open[1]].face {
            withAnimation(.spring) { for j in open { cards[j].matched = true; cards[j].up = false } }
        } else {
            busy = true
            Task {
                try? await Task.sleep(for: .seconds(0.8))
                withAnimation(.spring(response: 0.35)) { for j in open { cards[j].up = false } }
                busy = false
            }
        }
    }
}

// MARK: - Color the star

struct StarSegment: Shape {
    let index: Int
    func path(in rect: CGRect) -> Path {
        let c = CGPoint(x: rect.midX, y: rect.midY)
        let r = min(rect.width, rect.height) / 2
        let inner = r * 0.45
        func pt(_ k: Double, _ rad: CGFloat) -> CGPoint {
            let a = -Double.pi / 2 + k * Double.pi / 5
            return CGPoint(x: c.x + rad * cos(a), y: c.y + rad * sin(a))
        }
        let k = Double(index * 2)
        var p = Path()
        p.move(to: c)
        p.addLine(to: pt(k - 1, inner))
        p.addLine(to: pt(k, r))
        p.addLine(to: pt(k + 1, inner))
        p.closeSubpath()
        return p
    }
}

struct ColorStarGame: View {
    @Environment(AppState.self) private var app
    @State private var fills: [Color?] = Array(repeating: nil, count: 5)
    @State private var selected = Theme.kidYellow
    private let palette: [Color] = [Theme.kidYellow, Theme.kidCoral, Theme.kidMint, Theme.kidSky, Theme.purple, Theme.red]

    var body: some View {
        VStack(spacing: 24) {
            Text(app.t("اختر لوناً ثم المس أجزاء النجمة", "Pick a color, then tap the star"))
                .font(.headline).foregroundStyle(Theme.ink)
            ZStack {
                ForEach(0..<5, id: \.self) { i in
                    StarSegment(index: i)
                        .fill(fills[i] ?? .white)
                        .overlay(StarSegment(index: i).stroke(Theme.ink.opacity(0.7), lineWidth: 3))
                        .contentShape(StarSegment(index: i))
                        .onTapGesture { withAnimation(.easeOut(duration: 0.25)) { fills[i] = selected } }
                }
            }
            .frame(width: 280, height: 280)
            .scaleEffect(fills.allSatisfy { $0 != nil } ? 1.06 : 1)
            .animation(.spring(response: 0.4, dampingFraction: 0.5), value: fills.allSatisfy { $0 != nil })
            .sensoryFeedback(.impact(weight: .light), trigger: fills.compactMap { $0 }.count)

            HStack(spacing: 12) {
                ForEach(palette.indices, id: \.self) { i in
                    Circle().fill(palette[i])
                        .frame(width: 44, height: 44)
                        .overlay(Circle().stroke(.white, lineWidth: selected == palette[i] ? 4 : 0))
                        .shadow(color: palette[i].opacity(0.5), radius: selected == palette[i] ? 8 : 0)
                        .scaleEffect(selected == palette[i] ? 1.15 : 1)
                        .onTapGesture { withAnimation(.spring) { selected = palette[i] } }
                }
            }
            Button(app.t("امسح الألوان", "Clear")) { withAnimation { fills = Array(repeating: nil, count: 5) } }
                .buttonStyle(.bordered).tint(Theme.kidCoral)
            Spacer()
        }
        .padding(20)
    }
}

// MARK: - Bubbles

private struct Bubble: Identifiable {
    let id = UUID()
    let x: CGFloat
    let size: CGFloat
    let born: Date
    let speed: Double
    let color: Color
}

struct BubblesGame: View {
    @Environment(AppState.self) private var app
    @State private var bubbles: [Bubble] = []
    @State private var popped = 0

    var body: some View {
        GeometryReader { geo in
            TimelineView(.animation) { timeline in
                let now = timeline.date
                ZStack {
                    ForEach(bubbles) { b in
                        let t = now.timeIntervalSince(b.born)
                        let y = geo.size.height + b.size - CGFloat(t * b.speed)
                        Circle()
                            .fill(RadialGradient(colors: [.white.opacity(0.9), b.color.opacity(0.35)], center: .topLeading, startRadius: 2, endRadius: b.size))
                            .overlay(Circle().stroke(b.color.opacity(0.7), lineWidth: 2))
                            .frame(width: b.size, height: b.size)
                            .position(x: b.x + CGFloat(sin(t * 2)) * 12, y: y)
                            .onTapGesture { pop(b) }
                    }
                }
            }
            .task { await spawn(width: geo.size.width) }
        }
        .overlay(alignment: .top) {
            Label("\(popped)", systemImage: "bubbles.and.sparkles.fill")
                .font(.title2.weight(.heavy))
                .foregroundStyle(Theme.ink)
                .padding(.horizontal, 18).padding(.vertical, 8)
                .background(.white, in: .capsule)
                .padding(.top, 12)
        }
        .sensoryFeedback(.impact(weight: .light), trigger: popped)
    }

    private func pop(_ b: Bubble) {
        withAnimation(.easeOut(duration: 0.15)) { bubbles.removeAll { $0.id == b.id } }
        popped += 1
    }

    private func spawn(width: CGFloat) async {
        let colors = [Theme.kidSky, Theme.kidMint, Theme.kidCoral, Theme.purple]
        while !Task.isCancelled {
            let size = CGFloat.random(in: 50...95)
            bubbles.append(Bubble(x: .random(in: size / 2...max(size / 2 + 1, width - size / 2)), size: size, born: .now, speed: .random(in: 70...140), color: colors.randomElement()!))
            bubbles.removeAll { Date.now.timeIntervalSince($0.born) > 14 }
            try? await Task.sleep(for: .seconds(0.7))
        }
    }
}

// MARK: - Catch the stars

private struct FallingStar: Identifiable {
    let id = UUID()
    let x: CGFloat
    let born: Date
    let speed: Double
}

struct CatchStarsGame: View {
    @Environment(AppState.self) private var app
    @State private var stars: [FallingStar] = []
    @State private var score = 0
    @State private var remaining = 30
    @State private var round = 0

    var body: some View {
        GeometryReader { geo in
            ZStack {
                TimelineView(.animation) { timeline in
                    ZStack {
                        ForEach(stars) { s in
                            let t = timeline.date.timeIntervalSince(s.born)
                            Image(systemName: "star.fill")
                                .font(.system(size: 46))
                                .foregroundStyle(Theme.kidYellow)
                                .shadow(color: Theme.orange.opacity(0.6), radius: 6)
                                .rotationEffect(.degrees(t * 90))
                                .frame(width: 70, height: 70)
                                .contentShape(Rectangle())
                                .position(x: s.x, y: -40 + CGFloat(t * s.speed))
                                .onTapGesture { catchStar(s) }
                        }
                    }
                }
                if remaining == 0 {
                    VStack(spacing: 14) {
                        Text("⭐️ \(score)").font(.system(size: 54, weight: .heavy, design: .rounded))
                        BiText(ar: "أحسنت يا بطل!", en: "Well done, champ!", primary: .title2.weight(.heavy), alignment: .center)
                        Button(app.t("العب مجدداً", "Play again")) { score = 0; remaining = 30; round += 1 }
                            .buttonStyle(.borderedProminent).tint(Theme.kidCoral).controlSize(.large)
                    }
                    .padding(28)
                    .background(.white, in: .rect(cornerRadius: 28))
                    .transition(.scale)
                }
            }
            .task(id: round) { await run(width: geo.size.width, height: geo.size.height) }
        }
        .overlay(alignment: .top) {
            HStack {
                Label("\(score)", systemImage: "star.fill")
                Spacer()
                Label("\(remaining)s", systemImage: "timer")
            }
            .font(.title3.weight(.heavy).monospacedDigit())
            .foregroundStyle(Theme.ink)
            .padding(.horizontal, 18).padding(.vertical, 10)
            .background(.white, in: .capsule)
            .padding(.horizontal, 20).padding(.top, 12)
        }
        .sensoryFeedback(.success, trigger: score)
    }

    private func catchStar(_ s: FallingStar) {
        guard remaining > 0 else { return }
        withAnimation(.easeOut(duration: 0.15)) { stars.removeAll { $0.id == s.id } }
        score += 1
    }

    private func run(width: CGFloat, height: CGFloat) async {
        var tick = 0
        while !Task.isCancelled && remaining > 0 {
            stars.append(FallingStar(x: .random(in: 40...max(41, width - 40)), born: .now, speed: .random(in: 120...220)))
            stars.removeAll { Date.now.timeIntervalSince($0.born) * 220 > Double(height) + 120 }
            try? await Task.sleep(for: .seconds(0.5))
            tick += 1
            if tick % 2 == 0 { remaining -= 1 }
        }
        withAnimation { stars.removeAll() }
    }
}
