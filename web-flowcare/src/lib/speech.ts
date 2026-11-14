import { useSyncExternalStore } from "react";
import type { Lang } from "./store";
import { track } from "./analytics";

/** Single shared speech engine so guidance never overlaps across screens. */
class SpeechCenter {
  activeKey: string | null = null;
  activeIsGuide = false;
  private listeners = new Set<() => void>();
  private token = 0;

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  private emit() { this.listeners.forEach((l) => l()); }

  get supported() { return typeof window !== "undefined" && "speechSynthesis" in window; }

  private voice(lang: Lang) {
    if (!this.supported) return undefined;
    const prefix = lang === "ar" ? "ar" : "en";
    const voices = window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith(prefix));
    return voices.find((v) => /premium|enhanced|natural|google/i.test(v.name)) ?? voices[0];
  }

  speak(texts: string[], lang: Lang, key: string, isGuide: boolean) {
    this.halt();
    if (!this.supported) return;
    const list = texts.filter(Boolean);
    if (!list.length) { this.finish(); return; }
    const token = ++this.token;
    const voice = this.voice(lang);
    list.forEach((text, i) => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang === "ar" ? "ar-SA" : "en-US";
      if (voice) u.voice = voice;
      u.rate = 0.88; // calm and slightly slower, for older adults
      u.pitch = 0.96;
      if (i === list.length - 1) u.onend = () => { if (token === this.token) this.finish(); };
      u.onerror = () => { if (token === this.token && i === list.length - 1) this.finish(); };
      window.speechSynthesis.speak(u);
    });
    this.activeKey = key;
    this.activeIsGuide = isGuide;
    this.emit();
    track("voice_play", { screen: key });
  }

  /** First tap plays, second tap on the same control stops. */
  toggle(texts: string[], lang: Lang, key: string) {
    if (this.activeKey === key) this.stop();
    else this.speak(texts, lang, key, true);
  }

  stop(key?: string) {
    if (key && key !== this.activeKey) return;
    this.halt();
    this.finish();
  }

  stopGuides() { if (this.activeIsGuide) this.stop(); }

  private halt() {
    this.token++;
    if (this.supported) window.speechSynthesis.cancel();
  }
  private finish() {
    this.activeKey = null;
    this.activeIsGuide = false;
    this.emit();
  }
}

export const speech = new SpeechCenter();
if (typeof window !== "undefined" && "speechSynthesis" in window) {
  window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
}

export function useActiveSpeechKey() {
  return useSyncExternalStore(speech.subscribe, () => speech.activeKey, () => null);
}

export type ScreenGuide =
  | "home" | "map" | "parking" | "visit" | "support" | "kids" | "doctor" | "scanner"
  | "memory" | "colorStar" | "bubbles" | "catchStars";

const AR: Record<ScreenGuide, string> = {
  home: "هذه الصفحة الرئيسية. في الأعلى تجد موعدك القادم، واسم الطبيب ورقم الغرفة. اضغط على زر بدء الذهاب للعيادة، وسأرشدك إليها خطوة بخطوة. يمكنك أيضاً مسح باركود الموعد بالكاميرا. وفي الأسفل أربع خدمات: المواقف، والملاحة الداخلية، وركن الأطفال، وطلب المساعدة.",
  map: "هذه خريطة المستشفى. النقطة الزرقاء هي مكانك الآن. إذا كان مكانك غير صحيح، اضغط تغيير، أو امسح رمز الموقع القريب منك. اتبع الخط الملون حتى تصل إلى الدبوس الأزرق. أزرار الأدوار على الخريطة تعرض كل دور. اختر مسار كبار السن أو الحوامل ليأخذك بدون درج. اضغط على زر التالي في الأسفل لسماع كل خطوة.",
  parking: "هذه صفحة المواقف. المربعات الخضراء مواقف فارغة، والحمراء مشغولة، والزرقاء محجوزة، والبرتقالية موقفك. اضغط على أي موقف فارغ ثم اختر أوقفت سيارتي هنا. اضغط على زر التوجيه إلى الموقف ليرشدك إليه. وبعد أن تركن سيارتك، اضغط على حفظ الموقع، حتى تجد سيارتك بسهولة عند العودة.",
  visit: "هذه خطة زيارتك اليوم. الخطوات مرتبة من الاستقبال حتى الطبيب. الخطوة المظللة هي خطوتك الحالية. اضغط على زر أرشدني، لأوصلك إلى مكان الخطوة التالية.",
  support: "هذه صفحة الدعم. إذا احتجت مساعدة الآن، اضغط على الزر البرتقالي، طلب مساعدة فورية، واختر موظف استقبال أو كرسي متحرك، وسيأتي أحد الموظفين إليك. يمكنك أيضاً قراءة الأسئلة الشائعة، أو المحادثة معنا، أو الاتصال بالرقم ألف.",
  kids: "أهلاً يا بطل! هذا ركن الأطفال. اختر لعبة من الألعاب الأربع والعب حتى يحين دورك. سنخبرك بالوقت المتبقي في الشريط البرتقالي.",
  doctor: "هذه لوحة الطبيب. اختر حالة العيادة من الأعلى: متاحة، أو مشغولة، أو غير متواجد، وسيراها المرضى فوراً. تحتها قائمة المرضى المنتظرين. اضغط على زر استدعاء المريض التالي في الأسفل.",
  scanner: "وجّه الكاميرا نحو الباركود الموجود على ورقة الموعد أو الدواء، وأبقِ الهاتف ثابتاً. عندما تظهر بياناتك، اضغط على تأكيد واستيراد البيانات.",
  memory: "لعبة الذاكرة. اقلب بطاقتين في كل مرة، وحاول أن تجد الحيوانين المتشابهين. اعثر على كل الأزواج لتفوز.",
  colorStar: "لوّن النجمة. اختر لوناً من الدوائر في الأسفل، ثم المس أجزاء النجمة لتلوينها بألوانك المفضلة.",
  bubbles: "فقاعات الصابون. الفقاعات تطير إلى الأعلى. المسها بإصبعك لتفرقعها، وكم فقاعة تستطيع أن تفرقع؟",
  catchStars: "اصطد النجوم. النجوم تسقط من السماء. المسها بسرعة لتجمعها قبل أن ينتهي الوقت.",
};

const EN: Record<ScreenGuide, string> = {
  home: "This is the home screen. At the top is your next appointment, with your doctor and room number. Tap Go to Clinic, and I will guide you there step by step. You can also scan your appointment barcode with the camera. Below are four services: parking, indoor navigation, the kids zone, and requesting assistance.",
  map: "This is the hospital map. The blue dot shows where you are. If that's not right, tap Change, or scan the location code near you. Follow the colored line until you reach the blue pin. The floor buttons on the map show each floor. Choose the elderly or pregnant route to avoid stairs. Tap Next at the bottom to hear each step.",
  parking: "This is the parking screen. Green bays are free, red bays are taken, blue bays are reserved, and the orange bay is yours. Tap a free bay, then choose I parked here. Tap Navigate to Spot to be guided there. After you park, tap Save Location, so you can find your car easily when you return.",
  visit: "This is your visit plan for today. The steps go in order, from reception to your doctor. The highlighted step is where you are now. Tap Guide me, and I will take you to your next stop.",
  support: "This is the support screen. If you need help right now, tap the orange button, Request Immediate Help, and choose a receptionist or a wheelchair. A staff member will come to you. You can also read common questions, chat with us, or call one thousand.",
  kids: "Hello, champ! This is the kids zone. Pick one of the four games and play until it is your turn. The orange bar shows how much time is left.",
  doctor: "This is the doctor dashboard. Choose the clinic status at the top: available, busy, or away. Patients will see it right away. Below is the list of waiting patients. Tap Call Next Patient at the bottom.",
  scanner: "Point the camera at the barcode on your appointment or pharmacy slip, and hold the phone steady. When your details appear, tap Confirm and Import Details.",
  memory: "Memory match. Flip two cards at a time, and try to find two matching animals. Find all the pairs to win.",
  colorStar: "Color the star. Pick a color from the circles below, then tap the parts of the star to paint it.",
  bubbles: "Soap bubbles. The bubbles float up. Tap them to pop them. How many can you pop?",
  catchStars: "Catch the stars. Stars are falling from the sky. Tap them quickly to catch them before time runs out.",
};

export const guideText = (g: ScreenGuide, lang: Lang) => (lang === "ar" ? AR[g] : EN[g]);
export const MAP_STEP_KEY = "map-step";
