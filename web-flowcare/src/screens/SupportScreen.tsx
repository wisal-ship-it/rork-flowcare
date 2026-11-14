import { useEffect, useRef, useState } from "react";
import { ArrowUp, Accessibility, Bell, Check, ChevronDown, ChevronLeft, ChevronRight, Footprints, Mail, MessagesSquare, Phone, type LucideIcon } from "lucide-react";
import { C, useApp, type HelpRequest } from "@/lib/store";
import { ActionSheet, AppHeader, BiText, Card, DemoTag, IconBadge, Pressable, Screen, Sheet, hexA } from "@/components/fc/ui";

const FAQS = [
  { qAr: "أين أجد المختبر؟", qEn: "Where is the lab?", aAr: "يقع المختبر في الطابق الأول، بجوار قسم الأشعة.", aEn: "The lab is on the first floor, next to the Radiology department." },
  { qAr: "ما ساعات الزيارة؟", qEn: "Visiting hours?", aAr: "يومياً من 4 عصراً حتى 9 مساءً.", aEn: "Daily from 4 PM to 9 PM." },
  { qAr: "كيف ألغي موعدي؟", qEn: "Cancel appointment?", aAr: "تواصل مع الاستقبال على الرقم الداخلي 1000 قبل موعدك بـ 24 ساعة.", aEn: "Contact reception at ext. 1000 at least 24 hours before your appointment." },
  { qAr: "هل يتوفر كرسي متحرك؟", qEn: "Is a wheelchair available?", aAr: "نعم، اطلبه من زر المساعدة الفورية وسيصلك إلى موقعك.", aEn: "Yes, request it with Immediate Help and it'll be brought to you." },
];

export default function SupportScreen() {
  const app = useApp();
  const [choice, setChoice] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(0);
  const [chat, setChat] = useState(false);
  const Fwd = app.lang === "ar" ? ChevronLeft : ChevronRight;

  const request = (ar: string, en: string) => {
    app.setHelpRequest({ kindAr: ar, kindEn: en, created: new Date().toISOString() });
    app.showToast(`تم إرسال طلبك: ${ar}`, `Request sent: ${en}`);
  };

  const sectionTitle = (ar: string, en: string) => (
    <div className="mb-1.5 flex items-baseline gap-1.5">
      <span className="text-[20px] font-black" style={{ color: C.blue }}>{app.t(ar, en)}</span>
      <span className="text-[15px]" style={{ color: C.sub }}>/ {app.other(ar, en)}</span>
    </div>
  );

  const contactRow = (Icon: LucideIcon, color: string, ar: string, en: string, onClick: () => void, testId?: string) => (
    <Pressable onClick={onClick} data-testid={testId} className="flex w-full items-center gap-3.5 py-1.5">
      <IconBadge icon={Icon} color={color} size={46} />
      <BiText ar={ar} en={en} primary="headline" secondary="footnote" className="flex-1" />
      <Fwd size={18} color={C.sub} />
    </Pressable>
  );

  return (
    <Screen>
      <AppHeader guide="support" />

      <Pressable
        onClick={() => setChoice(true)}
        data-testid="support.help"
        className="flex w-full items-center gap-3.5 rounded-[24px] p-[18px]"
        style={{ background: `linear-gradient(135deg, ${C.orange}, #F08A0B)`, boxShadow: `0 8px 14px ${hexA(C.orange, 0.35)}` }}
      >
        <div className="flex gap-2 text-white">
          {[Accessibility, Bell].map((I, i) => (
            <span key={i} className="flex h-[46px] w-[46px] items-center justify-center rounded-[14px]" style={{ background: "rgba(255,255,255,0.22)" }}><I size={22} strokeWidth={2.4} /></span>
          ))}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
          <BiText ar="اطلب مساعدة فورية" en="Request Immediate Help" primary="title3" secondary="subheadline" primaryColor="#fff" secondaryColor="rgba(255,255,255,0.85)" primaryClass="font-black" />
          <span className="text-[12px] font-semibold text-white/90">{app.t("موظف استقبال • كرسي متحرك", "Receptionist • Wheelchair")}</span>
        </div>
        <Fwd size={20} color="#fff" />
      </Pressable>

      {app.helpRequest && <RequestStatus r={app.helpRequest} onCancel={() => app.setHelpRequest(null)} />}

      <Card>
        {sectionTitle("الأسئلة الشائعة", "FAQs")}
        {FAQS.map((f, i) => {
          const open = expanded === i;
          return (
            <div key={i} className={i > 0 ? "border-t" : ""} style={{ borderColor: C.hairline }}>
              <div className="flex flex-col gap-2 py-2">
                <Pressable onClick={() => setExpanded(open ? null : i)} aria-expanded={open} className="flex w-full items-center gap-3">
                  <ChevronDown size={17} strokeWidth={2.8} color={open ? C.blue : C.sub} className="shrink-0 transition-transform duration-300" style={{ transform: `rotate(${open ? 0 : app.lang === "ar" ? 90 : -90}deg)` }} />
                  <BiText ar={f.qAr} en={f.qEn} primary="headline" secondary="footnote" className="flex-1" />
                </Pressable>
                {open && (
                  <div className="fc-fade rounded-[14px] p-3" style={{ background: hexA(C.blue, 0.07) }}>
                    <BiText ar={f.aAr} en={f.aEn} primary="subheadline" secondary="caption" />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </Card>

      <Card>
        {sectionTitle("تواصل مع الدعم", "Contact Support")}
        <div className="flex flex-col divide-y" style={{ borderColor: C.hairline }}>
          {contactRow(MessagesSquare, C.blue, "محادثة مباشرة", "Live Chat", () => setChat(true), "support.chat")}
          {contactRow(Phone, C.green, "اتصال داخلي 1000", "Call 1000", () => { window.location.href = "tel:1000"; })}
          {contactRow(Mail, C.purple, "الشكاوى", "support@flowcare.app", () => { window.location.href = "mailto:support@flowcare.app?subject=FlowCare"; })}
        </div>
      </Card>

      <ActionSheet
        open={choice}
        onClose={() => setChoice(false)}
        title={app.t("ما نوع المساعدة؟", "What do you need?")}
        actions={[
          { label: app.t("موظف استقبال", "Receptionist"), onClick: () => request("موظف استقبال", "Receptionist"), testId: "help.reception" },
          { label: app.t("كرسي متحرك", "Wheelchair"), onClick: () => request("كرسي متحرك", "Wheelchair"), testId: "help.wheelchair" },
        ]}
      />
      <Sheet open={chat} onClose={() => setChat(false)} titleAr="استفسارات واقتراحات" titleEn="Questions & Suggestions" tall testId="chat.sheet">
        <ChatBody />
      </Sheet>
    </Screen>
  );
}

function RequestStatus({ r, onCancel }: { r: HelpRequest; onCancel: () => void }) {
  const app = useApp();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const elapsed = Math.floor((now - new Date(r.created).getTime()) / 1000);
  const remaining = Math.max(0, 180 - elapsed);
  const mmss = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`;
  const circ = 2 * Math.PI * 21;
  return (
    <div className="fc-fade">
      <Card>
        <div className="flex items-center gap-3.5">
          <div className="relative h-12 w-12 shrink-0">
            <svg viewBox="0 0 48 48" className="h-12 w-12 -rotate-90">
              <circle cx="24" cy="24" r="21" fill="none" stroke={hexA(C.orange, 0.2)} strokeWidth="5" />
              <circle cx="24" cy="24" r="21" fill="none" stroke={C.orange} strokeWidth="5" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ * (remaining / 180)} style={{ transition: "stroke-dashoffset 1s linear" }} />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center" style={{ color: C.orange }}>
              {remaining === 0 ? <Check size={18} strokeWidth={3} /> : <Footprints size={18} strokeWidth={2.5} />}
            </span>
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
            <div className="flex items-center gap-1.5">
              <span className="text-[17px] font-semibold" style={{ color: C.ink }}>{app.t(r.kindAr, r.kindEn)}</span>
              <DemoTag />
            </div>
            <span className="text-[12px]" style={{ color: C.sub }}>
              {remaining === 0 ? app.t("وصل الموظف إلى موقعك", "Staff has arrived") : app.t(`في الطريق إليك · الدور 2، الجناح B · ${mmss}`, `On the way · Floor 2, Wing B · ${mmss}`)}
            </span>
          </div>
          <Pressable onClick={onCancel} className="text-[13px] font-bold" style={{ color: C.red }}>{app.t("إلغاء", "Cancel")}</Pressable>
        </div>
      </Card>
    </div>
  );
}

interface Msg { id: number; text: string; fromUser: boolean }
const QUICK: [string, string][] = [
  ["أين يقع مختبر التحاليل؟", "Where is the lab?"],
  ["ساعات الزيارة", "Visiting hours"],
  ["أين الصيدلية؟", "Where is the pharmacy?"],
  ["أريد تقديم اقتراح", "I have a suggestion"],
];

function ChatBody() {
  const app = useApp();
  const [messages, setMessages] = useState<Msg[]>(() => [{ id: 0, fromUser: false, text: app.t("مرحباً! أنا مساعد FlowCare. كيف أساعدك اليوم؟", "Hi! I'm the FlowCare assistant. How can I help today?") }]);
  const [draft, setDraft] = useState("");
  const [typing, setTyping] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages, typing]);

  const reply = (text: string) => {
    const t = text.toLowerCase();
    if (t.includes("مختبر") || t.includes("lab")) return app.t("المختبر في الطابق الأول بجوار الأشعة. يمكنك الضغط على \"وجّهني\" من تبويب زيارتي.", "The lab is on the first floor next to Radiology. Tap \"Guide me\" from My Visit.");
    if (t.includes("زيارة") || t.includes("visit") || t.includes("hour")) return app.t("ساعات الزيارة يومياً من 4 عصراً حتى 9 مساءً.", "Visiting hours are daily from 4 PM to 9 PM.");
    if (t.includes("صيدلية") || t.includes("pharm")) return app.t("الصيدلية في الطابق الأرضي قرب المدخل الرئيسي (P-1).", "The pharmacy is on the ground floor near the main entrance (P-1).");
    if (t.includes("اقتراح") || t.includes("suggest")) return app.t("شكراً لك! اكتب اقتراحك وسيصل لفريق تجربة المرضى.", "Thank you! Write your suggestion and it will reach the patient experience team.");
    if (t.includes("موقف") || t.includes("park")) return app.t("موقفك المخصص A-12 في المستوى 1. افتح تبويب المواقف للتوجيه.", "Your assigned spot is A-12 on Level 1. Open the Parking tab for directions.");
    return app.t("شكراً لرسالتك. سيتواصل معك فريق خدمة المرضى قريباً، أو اتصل على 1000.", "Thanks for your message. The patient care team will follow up soon, or call ext. 1000.");
  };

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setMessages((m) => [...m, { id: Date.now(), text: trimmed, fromUser: true }]);
    setDraft("");
    setTyping(true);
    window.setTimeout(() => {
      setTyping(false);
      setMessages((m) => [...m, { id: Date.now() + 1, text: reply(trimmed), fromUser: false }]);
    }, 900);
  };

  return (
    <div className="flex min-h-[60dvh] flex-col">
      <div className="flex flex-1 flex-col gap-2.5 pb-2">
        <div className="flex items-center justify-center gap-1.5 pt-1"><DemoTag /><span className="text-[12px]" style={{ color: C.sub }}>{app.t("مساعد ذكي تجريبي بردود جاهزة", "Demo assistant with preset answers")}</span></div>
        {messages.map((m) => (
          <div key={m.id} className={`fc-fade flex ${m.fromUser ? "justify-end" : "justify-start"}`}>
            <div className="max-w-[80%] rounded-[18px] px-3.5 py-2.5 text-[17px] leading-snug" style={{ background: m.fromUser ? C.blue : C.surface, color: m.fromUser ? "#fff" : C.ink }}>{m.text}</div>
          </div>
        ))}
        {typing && (
          <div className="flex justify-start">
            <div className="flex gap-1 rounded-[18px] bg-white px-4 py-3.5">
              {[0, 1, 2].map((i) => <span key={i} className="fc-dots h-2 w-2 rounded-full" style={{ background: C.sub, animationDelay: `${i * 0.15}s` }} />)}
            </div>
          </div>
        )}
        <div ref={end} />
      </div>
      <div className="sticky bottom-0 -mx-4 bg-[#F2F5F9] px-4 pb-1 pt-2">
        <div className="fc-no-scrollbar -mx-4 mb-2 flex gap-2 overflow-x-auto px-4">
          {QUICK.map((q) => (
            <Pressable key={q[1]} onClick={() => send(app.t(q[0], q[1]))} className="shrink-0 rounded-full px-3 py-2 text-[13px] font-semibold" style={{ background: hexA(C.blue, 0.12), color: C.blue }}>
              {app.t(q[0], q[1])}
            </Pressable>
          ))}
        </div>
        <form className="flex items-center gap-2.5" onSubmit={(e) => { e.preventDefault(); send(draft); }}>
          <input
            data-testid="chat.input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={app.t("اكتب رسالتك...", "Type your message...")}
            enterKeyHint="send"
            className="min-w-0 flex-1 rounded-full border bg-white px-4 py-3 text-[16px] outline-none"
            style={{ borderColor: C.hairline, color: C.ink }}
          />
          <button type="submit" aria-label={app.t("إرسال", "Send")} disabled={!draft.trim()} className="fc-press flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white" style={{ background: draft.trim() ? C.blue : hexA(C.sub, 0.4) }}>
            <ArrowUp size={20} strokeWidth={3} />
          </button>
        </form>
      </div>
    </div>
  );
}
