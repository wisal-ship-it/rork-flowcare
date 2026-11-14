import SwiftUI
import AVFoundation
import Observation

/// Single shared speech engine so guidance never overlaps across screens.
@Observable
final class SpeechCenter: NSObject, AVSpeechSynthesizerDelegate {
    static let shared = SpeechCenter()

    /// Key of the guidance currently playing (nil when silent).
    private(set) var activeKey: String?
    private(set) var activeIsGuide = false

    @ObservationIgnored private let synth = AVSpeechSynthesizer()
    @ObservationIgnored private var lastUtterance: ObjectIdentifier?
    @ObservationIgnored private var voiceCache: [AppLanguage: AVSpeechSynthesisVoice] = [:]

    override private init() {
        super.init()
        synth.delegate = self
    }

    func speak(_ texts: [String], lang: AppLanguage, key: String, isGuide: Bool) {
        haltSynth()
        let session = AVAudioSession.sharedInstance()
        try? session.setCategory(.playback, mode: .spokenAudio, options: [.duckOthers])
        try? session.setActive(true)

        var last: AVSpeechUtterance?
        for (index, text) in texts.enumerated() where !text.isEmpty {
            let utterance = AVSpeechUtterance(string: text)
            utterance.voice = voice(for: lang)
            // Calm and slightly slower than default, for older adults.
            utterance.rate = AVSpeechUtteranceDefaultSpeechRate * 0.82
            utterance.pitchMultiplier = 0.96
            utterance.preUtteranceDelay = index == 0 ? 0.15 : 0.4
            utterance.postUtteranceDelay = 0.1
            synth.speak(utterance)
            last = utterance
        }
        lastUtterance = last.map { ObjectIdentifier($0) }
        activeKey = last == nil ? nil : key
        activeIsGuide = isGuide
    }

    /// First tap plays, second tap on the same control stops.
    func toggle(_ texts: [String], lang: AppLanguage, key: String) {
        if activeKey == key { stop() } else { speak(texts, lang: lang, key: key, isGuide: true) }
    }

    /// Stops playback; with a key, only if that guidance is the one playing.
    func stop(key: String? = nil) {
        if let key, key != activeKey { return }
        haltSynth()
        finish()
    }

    /// Stops on-demand screen guidance but leaves turn-by-turn steps alone.
    func stopGuides() {
        if activeIsGuide { stop() }
    }

    private func haltSynth() {
        lastUtterance = nil
        if synth.isSpeaking || synth.isPaused {
            synth.stopSpeaking(at: .immediate)
        }
    }

    private func finish() {
        activeKey = nil
        activeIsGuide = false
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }

    private func voice(for lang: AppLanguage) -> AVSpeechSynthesisVoice? {
        if let cached = voiceCache[lang] { return cached }
        let code = lang == .ar ? "ar-SA" : "en-US"
        let prefix = lang == .ar ? "ar" : "en-US"
        let candidates = AVSpeechSynthesisVoice.speechVoices().filter { $0.language.hasPrefix(prefix) }
        let best = candidates.max { $0.quality.rawValue < $1.quality.rawValue } ?? AVSpeechSynthesisVoice(language: code)
        voiceCache[lang] = best
        return best
    }

    private func utteranceEnded(_ id: ObjectIdentifier) {
        guard id == lastUtterance else { return }
        lastUtterance = nil
        finish()
    }

    nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
        let id = ObjectIdentifier(utterance)
        Task { @MainActor in self.utteranceEnded(id) }
    }
}

/// What each screen's voice guide explains.
enum ScreenGuide: String {
    case home, map, parking, visit, support, kids, doctor, scanner
    case memory, colorStar, bubbles, catchStars

    init(game: KidGame) {
        switch game {
        case .memory: self = .memory
        case .colorStar: self = .colorStar
        case .bubbles: self = .bubbles
        case .catchStars: self = .catchStars
        }
    }

    func text(_ lang: AppLanguage) -> String {
        lang == .ar ? ar : en
    }

    private var ar: String {
        switch self {
        case .home:
            "هذه الصفحة الرئيسية. في الأعلى تجد موعدك القادم، واسم الطبيب ورقم الغرفة. اضغط على زر بدء الذهاب للعيادة، وسأرشدك إليها خطوة بخطوة. يمكنك أيضاً مسح باركود الموعد بالكاميرا. وفي الأسفل أربع خدمات: المواقف، والملاحة الداخلية، وركن الأطفال، وطلب المساعدة."
        case .map:
            "هذه خريطة المستشفى. النقطة الزرقاء هي مكانك الآن. إذا كان مكانك غير صحيح، اضغط تغيير، أو امسح رمز الموقع القريب منك. اتبع الخط الملون حتى تصل إلى الدبوس الأزرق. أزرار الأدوار على الخريطة تعرض كل دور. اختر مسار كبار السن أو الحوامل ليأخذك بدون درج. اضغط على زر التالي في الأسفل لسماع كل خطوة."
        case .parking:
            "هذه صفحة المواقف. المربعات الخضراء مواقف فارغة، والحمراء مشغولة، والزرقاء محجوزة، والبرتقالية موقفك. اضغط على أي موقف فارغ ثم اختر أوقفت سيارتي هنا. اضغط على زر التوجيه إلى الموقف ليرشدك إليه. وبعد أن تركن سيارتك، اضغط على حفظ الموقع، حتى تجد سيارتك بسهولة عند العودة."
        case .visit:
            "هذه خطة زيارتك اليوم. الخطوات مرتبة من الاستقبال حتى الطبيب. الخطوة المظللة هي خطوتك الحالية. اضغط على زر أرشدني، لأوصلك إلى مكان الخطوة التالية."
        case .support:
            "هذه صفحة الدعم. إذا احتجت مساعدة الآن، اضغط على الزر البرتقالي، طلب مساعدة فورية، واختر موظف استقبال أو كرسي متحرك، وسيأتي أحد الموظفين إليك. يمكنك أيضاً قراءة الأسئلة الشائعة، أو المحادثة معنا، أو الاتصال بالرقم ألف."
        case .kids:
            "أهلاً يا بطل! هذا ركن الأطفال. اختر لعبة من الألعاب الأربع والعب حتى يحين دورك. سنخبرك بالوقت المتبقي في الشريط البرتقالي."
        case .doctor:
            "هذه لوحة الطبيب. اختر حالة العيادة من الأعلى: متاحة، أو مشغولة، أو غير متواجد، وسيراها المرضى فوراً. تحتها قائمة المرضى المنتظرين. اضغط على زر استدعاء المريض التالي في الأسفل."
        case .scanner:
            "وجّه الكاميرا نحو الباركود الموجود على ورقة الموعد أو الدواء، وأبقِ الهاتف ثابتاً. عندما تظهر بياناتك، اضغط على تأكيد واستيراد البيانات."
        case .memory:
            "لعبة الذاكرة. اقلب بطاقتين في كل مرة، وحاول أن تجد الحيوانين المتشابهين. اعثر على كل الأزواج لتفوز."
        case .colorStar:
            "لوّن النجمة. اختر لوناً من الدوائر في الأسفل، ثم المس أجزاء النجمة لتلوينها بألوانك المفضلة."
        case .bubbles:
            "فقاعات الصابون. الفقاعات تطير إلى الأعلى. المسها بإصبعك لتفرقعها، وكم فقاعة تستطيع أن تفرقع؟"
        case .catchStars:
            "اصطد النجوم. النجوم تسقط من السماء. المسها بسرعة لتجمعها قبل أن ينتهي الوقت."
        }
    }

    private var en: String {
        switch self {
        case .home:
            "This is the home screen. At the top is your next appointment, with your doctor and room number. Tap Go to Clinic, and I will guide you there step by step. You can also scan your appointment barcode with the camera. Below are four services: parking, indoor navigation, the kids zone, and requesting assistance."
        case .map:
            "This is the hospital map. The blue dot shows where you are. If that's not right, tap Change, or scan the location code near you. Follow the colored line until you reach the blue pin. The floor buttons on the map show each floor. Choose the elderly or pregnant route to avoid stairs. Tap Next at the bottom to hear each step."
        case .parking:
            "This is the parking screen. Green bays are free, red bays are taken, blue bays are reserved, and the orange bay is yours. Tap a free bay, then choose I parked here. Tap Navigate to Spot to be guided there. After you park, tap Save Location, so you can find your car easily when you return."
        case .visit:
            "This is your visit plan for today. The steps go in order, from reception to your doctor. The highlighted step is where you are now. Tap Guide me, and I will take you to your next stop."
        case .support:
            "This is the support screen. If you need help right now, tap the orange button, Request Immediate Help, and choose a receptionist or a wheelchair. A staff member will come to you. You can also read common questions, chat with us, or call one thousand."
        case .kids:
            "Hello, champ! This is the kids zone. Pick one of the four games and play until it is your turn. The orange bar shows how much time is left."
        case .doctor:
            "This is the doctor dashboard. Choose the clinic status at the top: available, busy, or away. Patients will see it right away. Below is the list of waiting patients. Tap Call Next Patient at the bottom."
        case .scanner:
            "Point the camera at the barcode on your appointment or pharmacy slip, and hold the phone steady. When your details appear, tap Confirm and Import Details."
        case .memory:
            "Memory match. Flip two cards at a time, and try to find two matching animals. Find all the pairs to win."
        case .colorStar:
            "Color the star. Pick a color from the circles below, then tap the parts of the star to paint it."
        case .bubbles:
            "Soap bubbles. The bubbles float up. Tap them to pop them. How many can you pop?"
        case .catchStars:
            "Catch the stars. Stars are falling from the sky. Tap them quickly to catch them before time runs out."
        }
    }
}

/// Small speaker button in the header that reads the current screen's guide.
struct GuideButton: View {
    @Environment(AppState.self) private var app
    let guide: ScreenGuide

    private var speech: SpeechCenter { SpeechCenter.shared }
    private var playing: Bool { speech.activeKey == guide.rawValue }

    var body: some View {
        Button {
            speech.toggle([guide.text(app.lang)], lang: app.lang, key: guide.rawValue)
        } label: {
            Image(systemName: playing ? "speaker.wave.3.fill" : "speaker.wave.2.fill")
                .font(.headline)
                .foregroundStyle(playing ? .white : Theme.blue)
                .symbolEffect(.variableColor.iterative, isActive: playing)
                .frame(width: 40, height: 40)
                .background(playing ? Theme.blue : Theme.surface, in: .circle)
                .overlay(Circle().stroke(playing ? Theme.blue : Theme.hairline, lineWidth: 1))
                .flipsForRightToLeftLayoutDirection(false)
        }
        .buttonStyle(PressableStyle())
        .sensoryFeedback(.impact(weight: .light), trigger: playing)
        .accessibilityLabel(playing ? app.t("إيقاف الإرشاد الصوتي", "Stop voice guide") : app.t("استمع لشرح الصفحة", "Hear screen guide"))
        .onDisappear { speech.stop(key: guide.rawValue) }
    }
}
