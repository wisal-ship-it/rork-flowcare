import SwiftUI
import AVFoundation

enum CameraAccess { case checking, authorized, denied, unavailable }

enum ScanMode { case appointment, location }

struct ScannerView: View {
    var mode: ScanMode = .appointment
    @Environment(AppState.self) private var app
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL
    @State private var access: CameraAccess = .checking
    @State private var scanned: Appointment?
    @State private var scannedCode: String?
    @State private var isDemo = false
    @State private var laser = false
    @State private var editing = false
    @State private var unknownCode: String?
    @State private var lastRejected: String?

    var body: some View {
        ZStack {
            Color(hex: 0x0B1626).ignoresSafeArea()

            switch access {
            case .authorized:
                BarcodeCameraView { code in
                    handle(code, demo: false)
                }
                .ignoresSafeArea()
            case .checking:
                ProgressView().tint(.white)
            case .denied:
                messageState(symbol: "camera.fill", ar: "الوصول إلى الكاميرا مرفوض", en: "Camera access denied",
                             detailAr: "فعّل الكاميرا من الإعدادات لمسح الباركود.", detailEn: "Enable the camera in Settings to scan barcodes.",
                             showSettings: true)
            case .unavailable:
                messageState(symbol: "camera.metering.unknown", ar: "لا توجد كاميرا متاحة", en: "No camera available",
                             detailAr: "يمكنك تجربة مسح تجريبي بالأسفل.", detailEn: "You can try a demo scan below.",
                             showSettings: false)
            }

            if access == .authorized || access == .unavailable {
                viewfinder
            }

            VStack {
                topBar
                Spacer()
                if let scanned {
                    resultSheet(scanned)
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                } else if let unknownCode {
                    unknownSheet(unknownCode)
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                } else {
                    bottomHint
                }
            }
        }
        .environment(\.layoutDirection, app.lang == .ar ? .rightToLeft : .leftToRight)
        .task { await checkAccess() }
        .sensoryFeedback(.success, trigger: scanned)
        .sensoryFeedback(.error, trigger: unknownCode)
        .sheet(isPresented: $editing) {
            if let current = scanned {
                AppointmentEditSheet(appointment: current) { updated in
                    scanned = updated
                }
                .environment(app)
            }
        }
    }

    private func handle(_ code: String, demo: Bool) {
        guard scanned == nil, unknownCode == nil else { return }
        if mode == .location {
            if let node = app.map.node(forScannedCode: code) {
                app.setStart(node.id)
                app.showToast("تم تحديد موقعك: \(node.ar)", "Location set: \(node.en)", symbol: "qrcode.viewfinder", demo: demo)
                dismiss()
            } else if code != lastRejected {
                lastRejected = code
                withAnimation(.spring(response: 0.45, dampingFraction: 0.85)) { unknownCode = code }
            }
            return
        }
        scannedCode = code
        isDemo = demo
        withAnimation(.spring(response: 0.45, dampingFraction: 0.85)) { scanned = parse(code) }
    }

    private func checkAccess() async {
        if AppState.isUITesting { access = .unavailable; return }
        let discovery = AVCaptureDevice.DiscoverySession(deviceTypes: [.builtInWideAngleCamera, .external], mediaType: .video, position: .unspecified)
        guard !discovery.devices.isEmpty else { access = .unavailable; return }
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized: access = .authorized
        case .notDetermined:
            let granted = await AVCaptureDevice.requestAccess(for: .video)
            access = granted ? .authorized : .denied
        default: access = .denied
        }
    }

    /// Simulated extraction: known codes map to the patient's appointment, anything else to a pharmacy slip.
    private func parse(_ code: String) -> Appointment {
        var a = Appointment.sample
        a.date = Appointment.todayAt1020
        if let clinic = app.map.nodeID(for: .cardiology).flatMap({ app.map.node($0) }) {
            a.clinicNodeID = clinic.id
            a.clinicAr = clinic.ar
            a.clinicEn = clinic.en
            a.room = clinic.code ?? a.room
        }
        if code.uppercased().contains("PH") || code.count > 12 {
            a.medicationAr = "ميتفورمين 500 مغ - صيدلية الدور الأرضي"
            a.medicationEn = "Metformin 500 mg - Ground floor pharmacy"
        }
        let digits = code.filter(\.isNumber).suffix(4)
        if digits.count == 4 { a.ticket = "A-\(digits)" }
        return a
    }

    private var topBar: some View {
        VStack(spacing: 14) {
            HStack {
                Button { dismiss() } label: {
                    Image(systemName: "xmark")
                        .font(.headline.weight(.bold))
                        .foregroundStyle(.white)
                        .frame(width: 44, height: 44)
                        .background(.white.opacity(0.15), in: .circle)
                }
                .accessibilityLabel(app.t("إغلاق", "Close"))
                Spacer()
                GuideButton(guide: .scanner)
                LanguageToggle()
            }
            BiText(ar: mode == .location ? "امسح رمز الموقع القريب منك" : "مسح باركود الصيدلية والموعد",
                   en: mode == .location ? "Scan the location code near you" : "Scan Pharmacy/Appointment Barcode",
                   primary: .title3.weight(.bold), secondary: .subheadline,
                   primaryColor: .white, secondaryColor: .white.opacity(0.7), alignment: .center)
        }
        .padding(.horizontal, 18)
        .padding(.top, 8)
    }

    private var viewfinder: some View {
        GeometryReader { geo in
            let w = min(geo.size.width * 0.78, 340)
            let h = w * 0.62
            ZStack {
                ScanCorners()
                    .stroke(.white, style: StrokeStyle(lineWidth: 5, lineCap: .round))
                    .frame(width: w, height: h)
                RoundedRectangle(cornerRadius: 2)
                    .fill(
                        LinearGradient(colors: [Theme.blueLight.opacity(0), Theme.blueLight, Theme.blueLight.opacity(0)], startPoint: .leading, endPoint: .trailing)
                    )
                    .frame(width: w - 20, height: 3)
                    .shadow(color: Theme.blueLight, radius: 8)
                    .offset(y: laser ? h / 2 - 12 : -h / 2 + 12)
                    .opacity(scanned == nil ? 1 : 0)
            }
            .position(x: geo.size.width / 2, y: geo.size.height * 0.40)
            .onAppear {
                withAnimation(.easeInOut(duration: 1.6).repeatForever(autoreverses: true)) { laser = true }
            }
        }
        .allowsHitTesting(false)
    }

    private var bottomHint: some View {
        VStack(spacing: 12) {
            Text(mode == .location
                 ? app.t("تجد الرمز عند المداخل والمصاعد", "Codes are at entrances and elevators")
                 : app.t("وجّه الكاميرا نحو الباركود", "Point the camera at the barcode"))
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.white.opacity(0.85))
            Button {
                if mode == .location {
                    let candidate = app.map.nodes.first { $0.qr != nil && $0.id != app.startID && $0.kind == .elevator }
                        ?? app.map.nodes.first { $0.qr != nil && $0.id != app.startID }
                    handle(candidate?.qr ?? app.map.defaultStart, demo: true)
                } else {
                    handle("PH-2047", demo: true)
                }
            } label: {
                HStack(spacing: 8) {
                    Image(systemName: "barcode.viewfinder")
                    Text(app.t("مسح تجريبي", "Demo scan"))
                    DemoTag()
                }
                .font(.subheadline.weight(.bold))
                .foregroundStyle(.white)
                .padding(.horizontal, 18)
                .padding(.vertical, 10)
                .background(.white.opacity(0.15), in: .capsule)
            }
            .accessibilityIdentifier("scanner.demoScan")
        }
        .padding(.bottom, 30)
    }

    private func unknownSheet(_ code: String) -> some View {
        VStack(spacing: 12) {
            Image(systemName: "questionmark.diamond.fill").font(.system(size: 36)).foregroundStyle(Theme.orange)
            BiText(ar: "هذا الرمز غير موجود في خريطة المستشفى", en: "This code isn't on the hospital map",
                   primary: .headline, secondary: .caption, alignment: .center)
            Text(code)
                .font(.caption.monospaced())
                .foregroundStyle(Theme.sub)
                .lineLimit(2)
                .environment(\.layoutDirection, .leftToRight)
            PrimaryButton(ar: "امسح رمزاً آخر", en: "Scan another code", symbol: "arrow.clockwise") {
                withAnimation(.spring) { unknownCode = nil }
            }
        }
        .padding(18)
        .background(Theme.surface, in: .rect(cornerRadius: 28))
        .padding(.horizontal, 10)
        .padding(.bottom, 8)
    }

    private func resultSheet(_ a: Appointment) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Capsule().fill(Theme.hairline).frame(width: 40, height: 5).frame(maxWidth: .infinity)
            HStack(spacing: 10) {
                Image(systemName: "checkmark.circle.fill").font(.title2).foregroundStyle(Theme.green)
                BiText(ar: "تم استخراج بيانات الموعد", en: "Appointment details extracted",
                       primary: .headline, secondary: .caption)
                Spacer()
                if isDemo { DemoTag() }
            }
            VStack(spacing: 0) {
                field("person.fill", "اسم المريض", "Patient", app.t(a.patientAr, a.patientEn))
                Divider()
                field("stethoscope", "الطبيب", "Doctor", app.t(a.doctorAr, a.doctorEn))
                Divider()
                field("door.left.hand.open", "الغرفة", "Room", app.t("\(a.clinicAr) - \(a.room)", "\(a.clinicEn) - \(a.room)"))
                Divider()
                field("calendar", "الموعد", "Time", app.t(a.timeAr, a.timeEn))
                Divider()
                field("ticket.fill", "رقم الموعد", "Appointment ID", a.ticket)
                if let medAr = a.medicationAr, let medEn = a.medicationEn {
                    Divider()
                    field("pills.fill", "الدواء", "Medication", app.t(medAr, medEn))
                }
            }
            .padding(.horizontal, 12)
            .background(Theme.canvas, in: .rect(cornerRadius: 16))

            PrimaryButton(ar: "تأكيد واستيراد البيانات", en: "Confirm & Import Details", symbol: "square.and.arrow.down") {
                app.appointment = a
                app.appointmentImported = true
                app.showToast("تم استيراد بيانات الموعد \(a.ticket)", "Appointment \(a.ticket) imported", symbol: "checkmark.circle.fill", demo: isDemo)
                dismiss()
            }
            .accessibilityIdentifier("scanner.confirm")
            HStack {
                Button {
                    editing = true
                } label: {
                    Label(app.t("تعديل البيانات", "Edit details"), systemImage: "square.and.pencil")
                        .font(.subheadline.weight(.semibold))
                        .frame(maxWidth: .infinity)
                }
                .accessibilityIdentifier("scanner.edit")
                Button {
                    withAnimation(.spring) { scanned = nil }
                } label: {
                    Text(app.t("مسح مرة أخرى", "Scan again"))
                        .font(.subheadline.weight(.semibold))
                        .frame(maxWidth: .infinity)
                }
            }
            .tint(Theme.blue)
        }
        .padding(18)
        .background(Theme.surface, in: .rect(cornerRadius: 28))
        .padding(.horizontal, 10)
        .padding(.bottom, 8)
    }

    private func field(_ symbol: String, _ ar: String, _ en: String, _ value: String) -> some View {
        HStack(spacing: 10) {
            Image(systemName: symbol).foregroundStyle(Theme.blue).frame(width: 22)
            Text("\(app.t(ar, en)) / \(app.other(ar, en))")
                .font(.caption)
                .foregroundStyle(Theme.sub)
            Spacer()
            Text(value)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Theme.ink)
                .multilineTextAlignment(.trailing)
        }
        .padding(.vertical, 10)
    }

    private func messageState(symbol: String, ar: String, en: String, detailAr: String, detailEn: String, showSettings: Bool) -> some View {
        VStack(spacing: 14) {
            Image(systemName: symbol).font(.system(size: 44)).foregroundStyle(.white.opacity(0.8))
            BiText(ar: ar, en: en, primary: .title3.weight(.bold), secondary: .subheadline,
                   primaryColor: .white, secondaryColor: .white.opacity(0.7), alignment: .center)
            Text(app.t(detailAr, detailEn)).font(.footnote).foregroundStyle(.white.opacity(0.7))
            if showSettings {
                Button(app.t("فتح الإعدادات", "Open Settings")) {
                    if let url = URL(string: UIApplication.openSettingsURLString) { openURL(url) }
                }
                .buttonStyle(.borderedProminent)
                .tint(Theme.blue)
            }
        }
        .padding(30)
    }
}

struct ScanCorners: Shape {
    func path(in rect: CGRect) -> Path {
        let l: CGFloat = 32
        var p = Path()
        p.move(to: CGPoint(x: rect.minX, y: rect.minY + l)); p.addLine(to: CGPoint(x: rect.minX, y: rect.minY)); p.addLine(to: CGPoint(x: rect.minX + l, y: rect.minY))
        p.move(to: CGPoint(x: rect.maxX - l, y: rect.minY)); p.addLine(to: CGPoint(x: rect.maxX, y: rect.minY)); p.addLine(to: CGPoint(x: rect.maxX, y: rect.minY + l))
        p.move(to: CGPoint(x: rect.maxX, y: rect.maxY - l)); p.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY)); p.addLine(to: CGPoint(x: rect.maxX - l, y: rect.maxY))
        p.move(to: CGPoint(x: rect.minX + l, y: rect.maxY)); p.addLine(to: CGPoint(x: rect.minX, y: rect.maxY)); p.addLine(to: CGPoint(x: rect.minX, y: rect.maxY - l))
        return p
    }
}

// MARK: - Camera

struct BarcodeCameraView: UIViewControllerRepresentable {
    let onCode: (String) -> Void

    func makeUIViewController(context: Context) -> BarcodeScannerController {
        let vc = BarcodeScannerController()
        vc.onCode = onCode
        return vc
    }

    func updateUIViewController(_ uiViewController: BarcodeScannerController, context: Context) {
        uiViewController.onCode = onCode
    }
}

final class BarcodeScannerController: UIViewController, AVCaptureMetadataOutputObjectsDelegate {
    var onCode: ((String) -> Void)?
    private let session = AVCaptureSession()
    private var previewLayer: AVCaptureVideoPreviewLayer?

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black
        configure()
    }

    private func configure() {
        let discovery = AVCaptureDevice.DiscoverySession(deviceTypes: [.builtInWideAngleCamera, .external], mediaType: .video, position: .unspecified)
        let device = discovery.devices.first(where: { $0.position == .back }) ?? discovery.devices.first
        guard let device, let input = try? AVCaptureDeviceInput(device: device), session.canAddInput(input) else { return }
        session.beginConfiguration()
        session.addInput(input)
        let output = AVCaptureMetadataOutput()
        if session.canAddOutput(output) {
            session.addOutput(output)
            output.setMetadataObjectsDelegate(self, queue: .main)
            let wanted: [AVMetadataObject.ObjectType] = [.qr, .ean13, .ean8, .code128, .code39, .pdf417, .dataMatrix, .aztec, .upce]
            output.metadataObjectTypes = wanted.filter { output.availableMetadataObjectTypes.contains($0) }
        }
        session.commitConfiguration()

        let layer = AVCaptureVideoPreviewLayer(session: session)
        layer.videoGravity = .resizeAspectFill
        layer.frame = view.bounds
        view.layer.addSublayer(layer)
        previewLayer = layer

        let session = self.session
        DispatchQueue.global(qos: .userInitiated).async { session.startRunning() }
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        previewLayer?.frame = view.bounds
    }

    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        let session = self.session
        DispatchQueue.global(qos: .userInitiated).async { session.stopRunning() }
    }

    nonisolated func metadataOutput(_ output: AVCaptureMetadataOutput, didOutput metadataObjects: [AVMetadataObject], from connection: AVCaptureConnection) {
        let value = (metadataObjects.first as? AVMetadataMachineReadableCodeObject)?.stringValue
        guard let value else { return }
        MainActor.assumeIsolated {
            self.onCode?(value)
        }
    }
}
