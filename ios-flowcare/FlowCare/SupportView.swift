import SwiftUI

struct FAQ: Identifiable {
    let id: Int
    let qAr: String, qEn: String, aAr: String, aEn: String
}

struct SupportView: View {
    @Environment(AppState.self) private var app
    @Environment(\.openURL) private var openURL
    @State private var showHelpChoice = false
    @State private var expanded: Int? = 0
    @State private var showChat = false

    private let faqs: [FAQ] = [
        .init(id: 0, qAr: "أين أجد المختبر؟", qEn: "Where is the lab?",
              aAr: "يقع المختبر في الطابق الأول، بجوار قسم الأشعة.", aEn: "The lab is on the first floor, next to the Radiology department."),
        .init(id: 1, qAr: "ما ساعات الزيارة؟", qEn: "Visiting hours?",
              aAr: "يومياً من 4 عصراً حتى 9 مساءً.", aEn: "Daily from 4 PM to 9 PM."),
        .init(id: 2, qAr: "كيف ألغي موعدي؟", qEn: "Cancel appointment?",
              aAr: "تواصل مع الاستقبال على الرقم الداخلي 1000 قبل موعدك بـ 24 ساعة.", aEn: "Contact reception at ext. 1000 at least 24 hours before your appointment."),
        .init(id: 3, qAr: "هل يتوفر كرسي متحرك؟", qEn: "Is a wheelchair available?",
              aAr: "نعم، اطلبه من زر المساعدة الفورية وسيصلك إلى موقعك.", aEn: "Yes, request it with Immediate Help and it'll be brought to you."),
    ]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 14) {
                    AppHeader(guide: .support)
                    helpButton
                    if let request = app.helpRequest { requestStatus(request) }
                    faqSection
                    contactSection
                }
                .padding(.horizontal, 18)
                .padding(.top, 8)
                .padding(.bottom, 24)
            }
            .scrollIndicators(.hidden)
            .background(ScreenBackground())
            .toolbar(.hidden, for: .navigationBar)
            .confirmationDialog(app.t("ما نوع المساعدة؟", "What do you need?"), isPresented: $showHelpChoice, titleVisibility: .visible) {
                Button(app.t("موظف استقبال", "Receptionist")) { request("موظف استقبال", "Receptionist") }
                Button(app.t("كرسي متحرك", "Wheelchair")) { request("كرسي متحرك", "Wheelchair") }
                Button(app.t("إلغاء", "Cancel"), role: .cancel) {}
            }
            .sheet(isPresented: $showChat) {
                ChatView().environment(app)
            }
        }
    }

    private func request(_ ar: String, _ en: String) {
        withAnimation(.spring) { app.helpRequest = HelpRequest(kindAr: ar, kindEn: en, created: .now) }
        app.showToast("تم إرسال طلبك: \(ar)", "Request sent: \(en)", symbol: "bell.badge.fill")
    }

    private var helpButton: some View {
        Button { showHelpChoice = true } label: {
            HStack(spacing: 14) {
                HStack(spacing: 8) {
                    Image(systemName: "figure.roll")
                        .frame(width: 46, height: 46)
                        .background(.white.opacity(0.22), in: .rect(cornerRadius: 14))
                    Image(systemName: "bell.fill")
                        .frame(width: 46, height: 46)
                        .background(.white.opacity(0.22), in: .rect(cornerRadius: 14))
                }
                .font(.title3.weight(.semibold))
                .foregroundStyle(.white)
                VStack(alignment: .leading, spacing: 3) {
                    BiText(ar: "اطلب مساعدة فورية", en: "Request Immediate Help",
                           primary: .title3.weight(.heavy), secondary: .subheadline,
                           primaryColor: .white, secondaryColor: .white.opacity(0.85))
                    Text(app.t("موظف استقبال • كرسي متحرك", "Receptionist • Wheelchair"))
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.white.opacity(0.9))
                }
                Spacer(minLength: 0)
                Image(systemName: "chevron.forward").foregroundStyle(.white)
            }
            .padding(18)
            .background(
                LinearGradient(colors: [Theme.orange, Color(hex: 0xF08A0B)], startPoint: .topLeading, endPoint: .bottomTrailing),
                in: .rect(cornerRadius: 24)
            )
            .shadow(color: Theme.orange.opacity(0.35), radius: 14, y: 8)
        }
        .buttonStyle(PressableStyle())
        .sensoryFeedback(.impact(weight: .heavy), trigger: showHelpChoice)
    }

    private func requestStatus(_ r: HelpRequest) -> some View {
        TimelineView(.periodic(from: r.created, by: 1)) { context in
            let elapsed = Int(context.date.timeIntervalSince(r.created))
            let remaining = max(0, 180 - elapsed)
            HStack(spacing: 14) {
                ZStack {
                    Circle().stroke(Theme.orange.opacity(0.2), lineWidth: 5)
                    Circle()
                        .trim(from: 0, to: CGFloat(180 - remaining) / 180)
                        .stroke(Theme.orange, style: StrokeStyle(lineWidth: 5, lineCap: .round))
                        .rotationEffect(.degrees(-90))
                    Image(systemName: remaining == 0 ? "checkmark" : "figure.walk")
                        .foregroundStyle(Theme.orange)
                }
                .frame(width: 48, height: 48)
                VStack(alignment: .leading, spacing: 3) {
                    HStack(spacing: 6) {
                        Text(app.t(r.kindAr, r.kindEn)).font(.headline).foregroundStyle(Theme.ink)
                        DemoTag()
                    }
                    Text(remaining == 0
                         ? app.t("وصل الموظف إلى موقعك", "Staff has arrived")
                         : app.t("في الطريق إليك · الدور 2، الجناح B · \(remaining / 60):\(String(format: "%02d", remaining % 60))",
                                 "On the way · Floor 2, Wing B · \(remaining / 60):\(String(format: "%02d", remaining % 60))"))
                        .font(.caption)
                        .foregroundStyle(Theme.sub)
                }
                Spacer(minLength: 0)
                Button(app.t("إلغاء", "Cancel")) {
                    withAnimation(.spring) { app.helpRequest = nil }
                }
                .font(.footnote.weight(.bold))
                .tint(Theme.red)
            }
            .card()
        }
        .transition(.scale(scale: 0.95).combined(with: .opacity))
    }

    private var faqSection: some View {
        VStack(alignment: .leading, spacing: 4) {
            sectionTitle("الأسئلة الشائعة", "FAQs")
            ForEach(faqs) { faq in
                VStack(alignment: .leading, spacing: 8) {
                    Button {
                        withAnimation(.spring(response: 0.35)) { expanded = expanded == faq.id ? nil : faq.id }
                    } label: {
                        HStack(spacing: 12) {
                            Image(systemName: "chevron.down")
                                .font(.subheadline.weight(.bold))
                                .foregroundStyle(expanded == faq.id ? Theme.blue : Theme.sub)
                                .rotationEffect(.degrees(expanded == faq.id ? 0 : (app.lang == .ar ? 90 : -90)))
                            BiText(ar: faq.qAr, en: faq.qEn, primary: .headline, secondary: .footnote)
                            Spacer()
                        }
                        .contentShape(.rect)
                    }
                    .buttonStyle(.plain)
                    if expanded == faq.id {
                        BiText(ar: faq.aAr, en: faq.aEn, primary: .subheadline, secondary: .caption)
                            .padding(12)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(Theme.blue.opacity(0.07), in: .rect(cornerRadius: 14))
                            .transition(.opacity.combined(with: .move(edge: .top)))
                    }
                }
                .padding(.vertical, 8)
                if faq.id != faqs.count - 1 { Divider() }
            }
        }
        .card()
    }

    private var contactSection: some View {
        VStack(alignment: .leading, spacing: 4) {
            sectionTitle("تواصل مع الدعم", "Contact Support")
            contactRow(symbol: "bubble.left.and.bubble.right.fill", color: Theme.blue, ar: "محادثة مباشرة", en: "Live Chat") {
                showChat = true
            }
            Divider()
            contactRow(symbol: "phone.fill", color: Theme.green, ar: "اتصال داخلي 1000", en: "Call 1000") {
                if let url = URL(string: "tel:1000") {
                    openURL(url) { accepted in
                        if !accepted {
                            app.showToast("الاتصال غير متاح على هذا الجهاز", "Calling isn't available on this device", symbol: "phone.down.fill")
                        }
                    }
                }
            }
            Divider()
            contactRow(symbol: "envelope.fill", color: Theme.purple, ar: "الشكاوى", en: "support@flowcare.app") {
                if let url = URL(string: "mailto:support@flowcare.app?subject=FlowCare") {
                    openURL(url) { accepted in
                        if !accepted {
                            app.showToast("لا يوجد تطبيق بريد على هذا الجهاز", "No mail app on this device", symbol: "envelope.badge")
                        }
                    }
                }
            }
        }
        .card()
    }

    private func sectionTitle(_ ar: String, _ en: String) -> some View {
        HStack(spacing: 6) {
            Text(app.t(ar, en)).font(.title3.weight(.heavy)).foregroundStyle(Theme.blue)
            Text("/ " + app.other(ar, en)).font(.subheadline).foregroundStyle(Theme.sub)
        }
        .padding(.bottom, 6)
    }

    private func contactRow(symbol: String, color: Color, ar: String, en: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 14) {
                IconBadge(symbol: symbol, color: color, size: 46)
                BiText(ar: ar, en: en, primary: .headline, secondary: .footnote)
                Spacer()
                Image(systemName: "chevron.forward").foregroundStyle(Theme.sub)
            }
            .padding(.vertical, 6)
            .contentShape(.rect)
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Chat

struct ChatMessage: Identifiable, Equatable {
    let id = UUID()
    let text: String
    let fromUser: Bool
}

struct ChatView: View {
    @Environment(AppState.self) private var app
    @Environment(\.dismiss) private var dismiss
    @State private var messages: [ChatMessage] = []
    @State private var draft = ""
    @State private var typing = false

    private var quickReplies: [(String, String)] {
        [("أين يقع مختبر التحاليل؟", "Where is the lab?"),
         ("ساعات الزيارة", "Visiting hours"),
         ("أين الصيدلية؟", "Where is the pharmacy?"),
         ("أريد تقديم اقتراح", "I have a suggestion")]
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                ScrollViewReader { proxy in
                    ScrollView {
                        LazyVStack(spacing: 10) {
                            HStack { DemoTag(); Text(app.t("مساعد ذكي تجريبي بردود جاهزة", "Demo assistant with preset answers")).font(.caption).foregroundStyle(Theme.sub) }
                                .padding(.top, 8)
                            ForEach(messages) { bubble($0).id($0.id) }
                            if typing {
                                HStack {
                                    ProgressView().padding(12).background(Theme.surface, in: .rect(cornerRadius: 18))
                                    Spacer()
                                }
                                .id("typing")
                            }
                        }
                        .padding(16)
                    }
                    .onChange(of: messages) {
                        withAnimation { proxy.scrollTo(messages.last?.id, anchor: .bottom) }
                    }
                }
                ScrollView(.horizontal) {
                    HStack(spacing: 8) {
                        ForEach(quickReplies, id: \.1) { q in
                            Button(app.t(q.0, q.1)) { send(app.t(q.0, q.1)) }
                                .buttonStyle(.bordered)
                                .tint(Theme.blue)
                                .font(.footnote.weight(.semibold))
                        }
                    }
                    .padding(.horizontal, 16)
                }
                .scrollIndicators(.hidden)
                .padding(.vertical, 8)
                HStack(spacing: 10) {
                    TextField(app.t("اكتب رسالتك...", "Type your message..."), text: $draft)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 12)
                        .background(Theme.surface, in: .capsule)
                        .overlay(Capsule().stroke(Theme.hairline))
                        .submitLabel(.send)
                        .onSubmit { send(draft) }
                    Button { send(draft) } label: {
                        Image(systemName: "arrow.up")
                            .font(.headline.weight(.bold))
                            .foregroundStyle(.white)
                            .frame(width: 44, height: 44)
                            .background(draft.trimmingCharacters(in: .whitespaces).isEmpty ? Theme.sub.opacity(0.4) : Theme.blue, in: .circle)
                    }
                    .disabled(draft.trimmingCharacters(in: .whitespaces).isEmpty)
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 12)
            }
            .background(Theme.canvas)
            .navigationTitle(app.t("استفسارات واقتراحات", "Questions & Suggestions"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button(app.t("إغلاق", "Close")) { dismiss() } }
            }
        }
        .environment(\.layoutDirection, app.lang == .ar ? .rightToLeft : .leftToRight)
        .onAppear {
            if messages.isEmpty {
                messages.append(ChatMessage(text: app.t("مرحباً! أنا مساعد FlowCare. كيف أساعدك اليوم؟", "Hi! I'm the FlowCare assistant. How can I help today?"), fromUser: false))
            }
        }
    }

    private func bubble(_ m: ChatMessage) -> some View {
        HStack {
            if m.fromUser { Spacer(minLength: 50) }
            Text(m.text)
                .font(.body)
                .foregroundStyle(m.fromUser ? .white : Theme.ink)
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(m.fromUser ? Theme.blue : Theme.surface, in: .rect(cornerRadius: 18))
            if !m.fromUser { Spacer(minLength: 50) }
        }
    }

    private func send(_ text: String) {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        messages.append(ChatMessage(text: trimmed, fromUser: true))
        draft = ""
        typing = true
        Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(900))
            typing = false
            messages.append(ChatMessage(text: reply(to: trimmed), fromUser: false))
        }
    }

    private func reply(to text: String) -> String {
        let t = text.lowercased()
        if t.contains("مختبر") || t.contains("lab") {
            return app.t("المختبر في الطابق الأول بجوار الأشعة. يمكنك الضغط على \"وجّهني\" من تبويب زيارتي.", "The lab is on the first floor next to Radiology. Tap \"Guide me\" from My Visit.")
        }
        if t.contains("زيارة") || t.contains("visit") || t.contains("hour") {
            return app.t("ساعات الزيارة يومياً من 4 عصراً حتى 9 مساءً.", "Visiting hours are daily from 4 PM to 9 PM.")
        }
        if t.contains("صيدلية") || t.contains("pharm") {
            return app.t("الصيدلية في الطابق الأرضي قرب المدخل الرئيسي (P-1).", "The pharmacy is on the ground floor near the main entrance (P-1).")
        }
        if t.contains("اقتراح") || t.contains("suggest") {
            return app.t("شكراً لك! اكتب اقتراحك وسيصل لفريق تجربة المرضى.", "Thank you! Write your suggestion and it will reach the patient experience team.")
        }
        if t.contains("موقف") || t.contains("park") {
            return app.t("موقفك المخصص A-12 في المستوى 1. افتح تبويب المواقف للتوجيه.", "Your assigned spot is A-12 on Level 1. Open the Parking tab for directions.")
        }
        return app.t("شكراً لرسالتك. سيتواصل معك فريق خدمة المرضى قريباً، أو اتصل على 1000.", "Thanks for your message. The patient care team will follow up soon, or call ext. 1000.")
    }
}
