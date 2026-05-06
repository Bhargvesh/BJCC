import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { getTranslations } from "./ui_translations";
import { useTheme } from "../context/ThemeContext";


/* ─────────────────────── DATA ─────────────────────── */
const QUOTES = [
  "Satyameva Jayate — Truth alone triumphs.",
  "Justice must be accessible in every language.",
  "Nyaya sabke liye, bina bhedbhaav ke.",
  "Law protects dignity, equality, and constitutional rights.",
  "Samvidhan is the guiding light of governance.",
];

/** UI language labels (BJCC reference) → API/UI translation keys */
const BJCC_LANGUAGES = [
  "English",
  "हिंदी",
  "বাংলা",
  "తెలుగు",
  "मराठी",
  "தமிழ்",
  "ગુજરાતી",
  "ಕನ್ನಡ",
  "മലയാളം",
  "ਪੰਜਾਬੀ",
  "ଓଡ଼ିଆ",
  "অসমীয়া",
  "मैथिली",
  "संस्कृत",
  "سندھی",
  "नेपाली",
  "डोगरी",
  "कोंकणी",
  "बोडो",
  "মৈতৈলোন্",
  "اُردُو",
  "کٲشُر",
];

const LABEL_TO_LANG = {
  English: "en",
  हिंदी: "hi",
  বাংলা: "bn",
  తెలుగు: "te",
  मराठी: "mr",
  தமிழ்: "ta",
  ગુજરાતી: "gu",
  ಕನ್ನಡ: "kn",
  മലയാളം: "ml",
  ਪੰਜਾਬੀ: "pa",
  ଓଡ଼ିଆ: "or",
  অসমীয়া: "as",
  मैथिली: "mai",
  संस्कृत: "sa",
  سندھی: "sd",
  नेपाली: "ne",
  डोगरी: "doi",
  कोंकणी: "kok",
  बोडो: "brx",
  মৈতৈলোন্: "mni",
  اُردُو: "ur",
  کٲشُر: "ks",
};

const FEATURES = [
  {
    icon: "⚖️",
    title: "Multilingual Justice",
    desc: "Access judgments in English, Hindi, Dogri, Kashmiri & Urdu — powered by Bhashini ASR + Translation.",
    delay: "0s",
    offset: "0px",
  },
  {
    icon: "🔍",
    title: "Judicial Search",
    desc: "Search 50,000+ cases from the Supreme Court, High Courts & Subordinate Courts instantly.",
    delay: "0.4s",
    offset: "-14px",
  },
  {
    icon: "🤖",
    title: "AI Legal Assistant",
    desc: "Real-time conversational AI that summarises case law and explains legal concepts in plain language.",
    delay: "0.8s",
    offset: "-6px",
  },
  {
    icon: "🎙️",
    title: "Voice-First UX",
    desc: "Dictate queries & hear verdicts read aloud — making justice accessible for citizens of all literacy levels.",
    delay: "1.2s",
    offset: "-20px",
  },
];

const STATS = [
  { value: "50K+", label: "Judicial Documents" },
  { value: "5", label: "Indian Languages" },
  { value: "3", label: "Court Tiers" },
  { value: "∞", label: "Access to Justice" },
];

const TESTIMONIALS = [
  {
    quote: "Bharat Judicial Court Connect transformed how our NGO advises rural communities on land disputes.",
    author: "Priya Sharma",
    role: "Legal Aid Volunteer, Rajasthan",
    delay: "0s",
  },
  {
    quote: "Finally, case law in Dogri. My clients in Jammu can understand their own rights.",
    author: "Adv. Vikram Singh",
    role: "District Court Advocate, Udhampur",
    delay: "0.6s",
  },
  {
    quote: "The Bhashini voice flow is revolutionary — we used it in our legal literacy camps across 12 villages.",
    author: "Meena Rathore",
    role: "Community Paralegal, MP",
    delay: "1.2s",
  },
];

const UI_TRANSLATIONS = {
  en: {
    hdrTitle: "Bharat Judicial Court Connect",
    hdrSub: "Multilingual legal access via ASR / Translation / TTS (prototype)",
    backBtn: "Back to Dashboard",
    searchLabel: "Search",
    courtLabel: "Court filter",
    langLabel: "Language",
    btnSearch: "Search",
    btnExamples: "Load examples",
    resultsHdr: "Results",
    btnOpen: "Open",
    btnOriginal: "Original page",
    btnSpeak: "Speak",
    assistantHdr: "Real-time Judicial Assistant (Bhashini flow)",
    assistantSub: "Dictate (ASR), translate/simplify, and get contextual legal summaries.",
    askPlaceholder: "Ask: What are key points on Aadhaar privacy?",
    btnAsk: "Ask",
    btnDictate: "Dictate (voice→text)",
    archHdr: "System Architecture",
    allCourts: "All courts",
    scIndia: "Supreme Court of India",
    hcIndia: "High Courts of India",
    subCourts: "Subordinate Courts",
  },
  hi: {
    hdrTitle: "भारत न्यायिक कोर्ट कनेक्ट",
    hdrSub: "एएसआर / अनुवाद / टीटीएस के माध्यम से बहुभाषी कानूनी पहुंच (प्रोटोटाइप)",
    backBtn: "डैशबोर्ड पर वापस जाएं",
    searchLabel: "खोजें",
    courtLabel: "अदालती फिल्टर",
    langLabel: "भाषा",
    btnSearch: "खोजें",
    btnExamples: "उदाहरण लोड करें",
    resultsHdr: "परिणाम",
    btnOpen: "खोलें",
    btnOriginal: "मूल पृष्ठ",
    btnSpeak: "बोलें",
    assistantHdr: "रीयल-टाइम न्यायिक सहायक (भाषिणी प्रवाह)",
    assistantSub: "डिक्टेट (एएसआर), अनुवाद/सरल बनाएं, और कानूनी विवरणी प्राप्त करें।",
    askPlaceholder: "पूछें: आधार गोपनीयता पर मुख्य बिंदु क्या हैं?",
    btnAsk: "पूछें",
    btnDictate: "डिक्टेट (आवाज→टेक्स्ट)",
    archHdr: "सिस्टम आर्किटेक्चर",
    allCourts: "सभी अदालतें",
    scIndia: "भारत का सर्वोच्च न्यायालय",
    hcIndia: "भारत के उच्च न्यायालय",
    subCourts: "अधीनस्थ न्यायालय",
  },
  doi: {
    hdrTitle: "भारत न्यायिक कोर्ट कनेक्ट",
    hdrSub: "एएसआर / अनुवाद / टीटीएस दे समर्थन कन्नै बहुभाषी कानूनी पहुंच",
    backBtn: "डैशबोर्ड पर वापस जाओ",
    searchLabel: "खोज्जो",
    courtLabel: "अदालती फिल्टर",
    langLabel: "भाषा",
    btnSearch: "खोज्जो",
    btnExamples: "उदाहरण लोड करो",
    resultsHdr: "नतीजे",
    btnOpen: "खोलो",
    btnOriginal: "असल सफा",
    btnSpeak: "बोलो",
    assistantHdr: "असली-समां न्यायिक सहायक (भाषिणी)",
    assistantSub: "डिक्टेट (एएसआर), अनुवाद करो ते कानूनी सारांश पाओ।",
    askPlaceholder: "पुच्छो: आधार गोपनीयता पर मुख्य गल्लां क्या न?",
    btnAsk: "पुच्छो",
    btnDictate: "डिक्टेट (आवाज→टेक्स्ट)",
    archHdr: "सिस्टम आर्किटेक्चर",
    allCourts: "सभै अदालतें",
    scIndia: "भारत दी उच्चतम न्यायालय",
    hcIndia: "भारत दे उच्च न्यायालय",
    subCourts: "तल्लियां अदालतें",
  },
  ks: {
    hdrTitle: "भारत न्यायिक अदालत कनेक्ट",
    hdrSub: "बहुभाषी कानूनी रसाई (ASR / तर्जुमा / TTS)",
    backBtn: "वापस डैशबोर्ड",
    searchLabel: "तलाश",
    courtLabel: "अदालत फिल्टर",
    langLabel: "ज़बान",
    btnSearch: "तलाश",
    btnExamples: "मिसालें",
    resultsHdr: "नतीजे",
    btnOpen: "खोलें",
    btnOriginal: "असल सफा",
    btnSpeak: "बोलें",
    assistantHdr: "रीयल-टाइम न्यायिक सहायक",
    assistantSub: "तर्जुमा ते कानूनी खुलासे हासिल करन।",
    askPlaceholder: "پوچھو: آدھار پرائیویسی کیا ہے؟",
    btnAsk: "پوچھیں",
    btnDictate: "آواز",
    archHdr: "سسٹم آرکیٹیکچر",
    allCourts: "سری أدالتیں",
    scIndia: "सुप्रीम कोर्ट",
    hcIndia: "हाई कोर्ट",
    subCourts: "अधिनस्थ अदालतें",
  },
  ur: {
    hdrTitle: "بھارت عدالتی کورٹ کنیکٹ",
    hdrSub: "کثیر لسانی قانونی رسائی (ASR / ترجمہ / TTS)",
    backBtn: "ڈیش بورڈ پر واپس جائیں",
    searchLabel: "تلاش",
    courtLabel: "عدالتی فلٹر",
    langLabel: "زبان",
    btnSearch: "تلاش کریں",
    btnExamples: "مثالیں لوڈ کریں",
    resultsHdr: "نتائج",
    btnOpen: "کھولیں",
    btnOriginal: "اصل صفحہ",
    btnSpeak: "بولیں",
    assistantHdr: "ریئل ٹائم عدالتی معاون",
    assistantSub: "قانونی خلاصے اور ترجمہ حاصل کریں۔",
    askPlaceholder: "پوچھیں: آدھار پرائیویسی پر اہم نکات کیا ہیں؟",
    btnAsk: "پوچھیں",
    btnDictate: "وائس",
    archHdr: "سسٹم آرکیٹیکچر",
    allCourts: "تمام عدالتیں",
    scIndia: "سپریم کورٹ آف انڈیا",
    hcIndia: "ہائی کورٹس آف انڈیا",
    subCourts: "ماتحت عدالتیں",
  },
};

const UI_EN_KEYS = {
  hdrTitle: "Bharat Judicial Court Connect",
  hdrSub: "Multilingual legal access via ASR / Translation / TTS (prototype)",
  quote1: "Satyameva Jayate — Truth alone triumphs.",
  quote2: "Justice must be accessible in every language.",
  quote3: "Nyaya sabke liye, bina bhedbhaav ke.",
  quote4: "Law protects dignity, equality, and constitutional rights.",
  quote5: "Samvidhan is the guiding light of governance.",
  navFeatures: "Features",
  navSearch: "Search",
  navAssistant: "AI Assistant",
  navAbout: "About",
  navSignIn: "Sign in",
  badgePoweredBy: "POWERED BY BHASHINI · GOVERNMENT OF INDIA INITIATIVE",
  heroCtaSearch: "Search Case Law",
  heroCtaAsk: "Ask AI Assistant",
  whyLabel: "Why BJCC",
  whyTitle: "Justice, in every Indian language.",
  whySub:
    "A full-stack multilingual legal platform bridging the gap between citizens and the Indian judicial system through ASR, AI translation, and voice synthesis.",
  featureTitle1: "Multilingual Justice",
  featureTitle2: "Judicial Search",
  featureTitle3: "AI Legal Assistant",
  featureTitle4: "Voice-First UX",
  featureDesc1:
    "Access judgments in English, Hindi, Dogri, Kashmiri & Urdu — powered by Bhashini ASR + Translation.",
  featureDesc2:
    "Search 50,000+ cases from the Supreme Court, High Courts & Subordinate Courts instantly.",
  featureDesc3:
    "Real-time conversational AI that summarises case law and explains legal concepts in plain language.",
  featureDesc4:
    "Dictate queries & hear verdicts read aloud — making justice accessible for citizens of all literacy levels.",
  stat1: "Judicial Documents",
  stat2: "Indian Languages",
  stat3: "Court Tiers",
  stat4: "Access to Justice",
  searchDbLabel: "Judicial Database",
  searchTitle: "Search case law.",
  searchLabel: "Search",
  courtLabel: "Court filter",
  allCourts: "All courts",
  scIndia: "Supreme Court of India",
  hcIndia: "High Courts of India",
  subCourts: "Subordinate Courts",
  btnSearch: "Search",
  btnExamples: "Load examples",
  resultsHdr: "Results",
  btnOpen: "Open",
  btnOriginal: "Original page",
  btnSpeak: "Speak",
  tabSearch: "Search",
  tabKanoon: "Bharat Judicial Court",
  kanoonTitle: "Bharat Judicial Court Connect explore",
  kanoonRefresh: "Refresh",
  kanoonEmpty: "No recent legal cases loaded. Try clicking Refresh Feed.",
  assistantFlowLabel: "Bhashini AI Flow",
  assistantHdr: "Real-time Judicial Assistant (Bhashini flow)",
  assistantSub: "Dictate (ASR), translate/simplify, and get contextual legal summaries.",
  assistantQuickEmpty: "Ask any legal question below…",
  askPlaceholder: "Ask: What are key points on Aadhaar privacy?",
  btnAsk: "Ask",
  whoYou: "You",
  whoAssistant: "AI Assistant",
  assistantSuggested1: "What is Article 21?",
  assistantSuggested2: "Explain Kesavananda Bharati case",
  assistantSuggested3: "Rights of arrested persons in India",
  impactLabel: "Impact Stories",
  impactTitle: "Voices from the field.",
  testimonialQuote1:
    "Bharat Judicial Court Connect transformed how our NGO advises rural communities on land disputes.",
  testimonialQuote2:
    "Finally, case law in Dogri. My clients in Jammu can understand their own rights.",
  testimonialQuote3:
    "The Bhashini voice flow is revolutionary — we used it in our legal literacy camps across 12 villages.",
  testimonialRole1: "Legal Aid Volunteer, Rajasthan",
  testimonialRole2: "District Court Advocate, Udhampur",
  testimonialRole3: "Community Paralegal, MP",
  ctaTitle: "Every citizen deserves to know their rights.",
  ctaSub:
    "Start exploring Indian case law in your language today — no legal expertise required.",
  ctaBrowseJudgments: "Browse Judgments",
  ctaBrowseLaws: "Browse Laws",
  ctaLogin: "Sign In",
  footerSub:
    "A prototype under the Bhashini initiative — Government of India.\nMultilingual legal access for every Indian citizen.",
  footerBrowseLaws: "Browse Laws",
  footerJudgments: "Judgments",
  footerMicropayment: "Offline Micropayment",
  footerApiDocs: "API Docs",
  footerLogin: "Login",
};

/* ─────────────────────── UTILS ─────────────────────── */
function langToVoice(lang) {
  return { en: "en-IN", hi: "hi-IN", doi: "hi-IN", ur: "ur-PK", ks: "hi-IN" }[lang] || "en-IN";
}

function stripHtml(text) {
  const raw = String(text || "");
  if (typeof document !== "undefined") {
    const ta = document.createElement("textarea");
    ta.innerHTML = raw;
    return ta.value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  }
  return raw.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function waitForVoices() {
  return new Promise((resolve) => {
    if (!("speechSynthesis" in window)) { resolve([]); return; }
    const now = window.speechSynthesis.getVoices();
    if (now.length) { resolve(now); return; }
    const done = () => { window.speechSynthesis.removeEventListener("voiceschanged", done); resolve(window.speechSynthesis.getVoices()); };
    window.speechSynthesis.addEventListener("voiceschanged", done);
    setTimeout(done, 1200);
  });
}

async function chooseVoice(lang) {
  const voices = await waitForVoices();
  const wanted = langToVoice(lang).toLowerCase();
  return voices.find((v) => (v.lang || "").toLowerCase() === wanted) ||
    voices.find((v) => (v.lang || "").toLowerCase().startsWith(wanted.split("-")[0])) ||
    voices.find((v) => (v.lang || "").toLowerCase().startsWith("en")) || null;
}

async function speakText(text, lang) {
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
    const voice = await chooseVoice(lang);
    const chunks = String(text || "").match(/[^.!?]+[.!?]?/g) || [String(text || "")];
    for (const chunk of chunks) {
      const c = chunk.trim();
      if (!c) continue;
      await new Promise((resolve) => {
        const u = new SpeechSynthesisUtterance(c);
        u.lang = langToVoice(lang);
        if (voice) u.voice = voice;
        u.rate = 0.95;
        u.onend = () => resolve(true);
        u.onerror = () => resolve(false);
        window.speechSynthesis.speak(u);
      });
    }
  }
}

async function apiGet(path) {
  const token = localStorage.getItem("isi_token") || "";
  const r = await fetch(path, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (r.status === 401) { localStorage.removeItem("isi_token"); window.location.href = "/login?msg=Session+expired.+Please+login+again."; return null; }
  return await r.json();
}

async function apiPost(path, body) {
  const token = localStorage.getItem("isi_token") || "";
  const r = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  if (r.status === 401) { localStorage.removeItem("isi_token"); window.location.href = "/login?msg=Session+expired.+Please+login+again."; return null; }
  return await r.json();
}

/* ─────────────────────── MAIN COMPONENT ─────────────────────── */
export default function IndiaInnovation() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [q, setQ] = useState("Aadhaar privacy");
  const [court, setCourt] = useState("Supreme Court of India");
  const [lang, setLang] = useState("en");
  const [hits, setHits] = useState([]);
  const [kanoonRecent, setKanoonRecent] = useState([]);
  const [resultsEmpty, setResultsEmpty] = useState(true);
  const [resultsMessage, setResultsMessage] = useState("Run a search to see results.");
  const [assistantMsg, setAssistantMsg] = useState("");
  const [chat, setChat] = useState([]);
  const [whoChip, setWhoChip] = useState("Account");
  const [quoteText, setQuoteText] = useState(QUOTES[0]);
  const [quoteClass, setQuoteClass] = useState("");
  const [searchCache, setSearchCache] = useState({});
  const [heroTilt, setHeroTilt] = useState({ x: 0, y: 0 });
  const [activeSection, setActiveSection] = useState("search");
  const [uiI18n, setUiI18n] = useState({});
  const chatLogRef = useRef(null);
  const heroRef = useRef(null);
  const langWrapRef = useRef(null);
  const [langOpen, setLangOpen] = useState(false);
  const [selectedLangDisplay, setSelectedLangDisplay] = useState("English");

  /* ── Auth / Init ── */
  useEffect(() => {
    const token = localStorage.getItem("isi_token") || "";
    (async () => {
      if (token) {
        try {
          const r = await fetch("/api/innovation/auth/me", { headers: { Authorization: `Bearer ${token}` } });
          if (r.ok) { const me = await r.json(); const who = me?.user?.name || me?.user?.email; if (who) setWhoChip(who); }
          else if (r.status === 401) localStorage.removeItem("isi_token");
        } catch { /* ignore */ }
      }
      setResultsMessage("Type your query and click Search.");
    })();
  }, []);

  useEffect(() => {
    if (!langOpen) return;
    const onDoc = (e) => {
      if (langWrapRef.current && !langWrapRef.current.contains(e.target)) setLangOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [langOpen]);

  /* ── Chat scroll ── */
  useEffect(() => { const el = chatLogRef.current; if (el) el.scrollTop = el.scrollHeight; }, [chat]);

  /* ── Quote rotation ── */
  useEffect(() => {
    const quotesNow = [
      uiI18n.quote1 || QUOTES[0],
      uiI18n.quote2 || QUOTES[1],
      uiI18n.quote3 || QUOTES[2],
      uiI18n.quote4 || QUOTES[3],
      uiI18n.quote5 || QUOTES[4],
    ];
    let idx = 0;
    setQuoteText(quotesNow[idx]);
    const id = window.setInterval(() => {
      setQuoteClass("fade-out");
      window.setTimeout(() => {
        idx = (idx + 1) % quotesNow.length;
        setQuoteText(quotesNow[idx]);
        setQuoteClass("fade-in");
        window.setTimeout(() => setQuoteClass(""), 650);
      }, 620);
    }, 5000);
    return () => clearInterval(id);
  }, [uiI18n]);

  /* ── Lang re-search ── */
  useEffect(() => { if (q && (hits.length > 0 || resultsEmpty)) void runJudicialSearch(q, court, lang); }, [lang]);

  /* ── Hero mouse parallax ── */
  const onHeroMouseMove = useCallback((e) => {
    const rect = heroRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = (e.clientX - cx) / (rect.width / 2);
    const dy = (e.clientY - cy) / (rect.height / 2);
    setHeroTilt({ x: dy * -8, y: dx * 8 });
  }, []);
  const onHeroMouseLeave = useCallback(() => setHeroTilt({ x: 0, y: 0 }), []);

  /* ── Data fetching ── */
  const appendChat = useCallback((who, text) => setChat((prev) => [...prev, { who, text }]), []);

  const runJudicialSearch = useCallback(async (qVal, courtVal, langVal) => {
    const cacheKey = `${qVal}|${courtVal}|${langVal}`;
    if (searchCache[cacheKey]) { const d = searchCache[cacheKey]; const list = d.results || []; setHits(list); setResultsEmpty(list.length === 0); return; }
    const url = `/api/innovation/judicial/search?q=${encodeURIComponent(qVal)}&court=${encodeURIComponent(courtVal)}&lang=${encodeURIComponent(langVal)}&limit=20`;
    try {
      const d = await apiGet(url);
      if (d?.detail) { setHits([]); setResultsEmpty(true); setResultsMessage("Error: " + d.detail); return; }
      const list = d.results || [];
      setHits(list); setResultsEmpty(list.length === 0);
      setResultsMessage("No results. Try different keywords (Act name / section / parties).");
      setSearchCache((prev) => ({ ...prev, [cacheKey]: d }));
    } catch (err) { setHits([]); setResultsEmpty(true); setResultsMessage("Request Failed: " + err.message); console.error(err); }
  }, [searchCache]);

  const doSearch = useCallback(() => runJudicialSearch(q, court, lang), [q, court, lang, runJudicialSearch]);

  const loadKanoonRecent = useCallback(async (langVal = "en") => {
    try {
      const d = await apiGet(`/api/innovation/judicial/search?q=${encodeURIComponent("recent judgments india")}&limit=8&lang=${langVal}`);
      const list = (d?.results || []).filter((x) => (x?.official_source || "").toLowerCase().includes("kanoon") || (x?.publication_url || "").includes("indiankanoon.org"));
      const seen = new Set(); const unique = [];
      const strip = (s) => (s || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim().toLowerCase();
      for (const item of list) {
        const key = `${strip(item?.title)}|${(item?.date || "0000").split("-")[0]}`;
        if (seen.has(key)) continue; seen.add(key); unique.push(item); if (unique.length >= 6) break;
      }
      setKanoonRecent(unique);
    } catch { setKanoonRecent([]); }
  }, []);

  useEffect(() => { void loadKanoonRecent(lang); }, [lang, loadKanoonRecent]);

  const askAssistant = useCallback(async (forcedMessage) => {
    const msg = (forcedMessage ?? assistantMsg).trim();
    if (!msg) return;
    setAssistantMsg("");
    appendChat("user", msg);
    const res = await apiPost("/api/innovation/assistant/chat", { message: msg, lang });
    if (res == null) return;
    appendChat("bot", res.reply || JSON.stringify(res));
  }, [assistantMsg, lang, appendChat]);

  const voiceToText = useCallback(async () => {
    const token = localStorage.getItem("isi_token") || "";
    if (!token) { navigate("/signup"); return; }
    appendChat("bot", "Listening… (allow microphone if prompted)");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      const chunks = [];
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.start();
      await new Promise((r) => setTimeout(r, 3500));
      rec.stop();
      const blob = await new Promise((resolve) => { rec.onstop = () => resolve(new Blob(chunks, { type: "audio/webm" })); });
      stream.getTracks().forEach((t) => t.stop());
      const fd = new FormData();
      fd.append("audio", blob, "voice.webm");
      const r = await fetch("/api/innovation/voice-to-text", { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : {}, body: fd });
      const d = await r.json();
      const txt = (d.text || "").trim();
      if (!txt) { appendChat("bot", "No transcript returned."); return; }
      appendChat("user", `[dictation] ${txt}`);
      await askAssistant(txt);
    } catch (err) { appendChat("bot", "Error capturing voice: " + err.message); }
  }, [navigate, lang, appendChat, askAssistant]);

  const onWhoChipClick = useCallback((e) => {
    const token = localStorage.getItem("isi_token");
    if (!token) return;
    e.preventDefault();
    let u = {};
    try { u = JSON.parse(localStorage.getItem("isi_user") || "{}"); } catch { u = {}; }
    const name = (u?.name || u?.email || "Account").toString();
    const ok = window.confirm(`Logged in as: ${name}\n\nPress OK to logout.`);
    if (ok) { localStorage.removeItem("isi_token"); localStorage.removeItem("isi_user"); navigate("/signup"); }
  }, [navigate]);

  const openDocFromSearch = useCallback((doc) => {
    if (!doc?.id) return;
    try { sessionStorage.setItem(`isi_case_cache_${doc.id}`, JSON.stringify(doc)); } catch { }
    navigate(`/case?id=${encodeURIComponent(doc.id)}`);
  }, [navigate]);

  const openSource = useCallback((url) => { if (!url) return; window.open(url, "_blank", "noopener,noreferrer"); }, []);

  const t = UI_TRANSLATIONS[lang] || UI_TRANSLATIONS.en;

  const ui = useCallback(
    (key, fallback) => {
      const v = uiI18n?.[key];
      return (typeof v === "string" && v.length) ? v : (fallback ?? UI_EN_KEYS[key] ?? key);
    },
    [uiI18n],
  );

  const localizedFeatures = useMemo(
    () =>
      FEATURES.map((f, i) => ({
        ...f,
        title: ui(`featureTitle${i + 1}`, f.title),
        desc: ui(`featureDesc${i + 1}`, f.desc),
      })),
    [ui],
  );
  const localizedStats = useMemo(
    () => STATS.map((s, i) => ({ ...s, label: ui(`stat${i + 1}`, s.label) })),
    [ui],
  );
  const localizedTestimonials = useMemo(
    () =>
      TESTIMONIALS.map((tm, i) => ({
        ...tm,
        quote: ui(`testimonialQuote${i + 1}`, tm.quote),
        role: ui(`testimonialRole${i + 1}`, tm.role),
      })),
    [ui],
  );

  const pickDisplayLang = useCallback((label) => {
    setSelectedLangDisplay(label);
    setLang(LABEL_TO_LANG[label] ?? "en");
    setLangOpen(false);
  }, []);

  // Instant language switch — static dictionary, no API call.
  useEffect(() => {
    const l = (lang || "en").toLowerCase();
    if (l === "en") {
      setUiI18n({});
      return;
    }
    // Instantly load pre-built translations (zero latency)
    const staticData = getTranslations(l);
    setUiI18n(staticData);
  }, [lang]);

  /* ═══════════════════════════════════════════════════════════
     INLINE STYLES — the entire design system
  ═══════════════════════════════════════════════════════════ */
  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=Space+Grotesk:wght@300;400;500;600&display=swap');

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      background: linear-gradient(to bottom right, #0a0520, #1a1040, #0a0520);
      background-attachment: fixed;
      color: #fff;
      font-family: 'Space Grotesk', system-ui, sans-serif;
      font-weight: 400;
      min-height: 100vh;
      overflow-x: hidden;
    }

    .bjcc-shell {
      position: relative;
      z-index: 1;
      min-height: 100vh;
    }

    /* ── BJCC sticky top nav (reference design) ── */
    .bjcc-topnav {
      position: sticky;
      top: 0;
      z-index: 1001;
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      background-color: rgba(10, 5, 32, 0.85);
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }
    .bjcc-topnav-inner {
      max-width: 100%;
      padding: 1rem 3rem;
      display: flex;
      align-items: center;
    }
    .bjcc-logo {
      display: flex;
      flex: 1;
      justify-content: flex-start;
      align-items: center;
      gap: 0.5rem;
      color: #a78bfa;
      font-weight: bold;
      font-size: 1.25rem;
      text-decoration: none;
    }
    .bjcc-nav-links {
      display: flex;
      flex: 1;
      justify-content: center;
      align-items: center;
      gap: 2rem;
      font-size: 0.875rem;
    }
    .bjcc-nav-links a,
    .bjcc-nav-links button.nav-a {
      text-decoration: none;
      color: rgba(255, 255, 255, 0.8);
      transition: color 0.2s;
      cursor: pointer;
      background: none;
      border: none;
      font: inherit;
      font-size: 0.875rem;
    }
    .bjcc-nav-links a:hover,
    .bjcc-nav-links button.nav-a:hover {
      color: #fff;
    }
    .bjcc-right {
      display: flex;
      flex: 1;
      justify-content: flex-end;
      align-items: center;
      gap: 1rem;
    }
    .bjcc-lang-btn {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem 1.25rem;
      background-color: #1e293b;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 0.75rem;
      color: white;
      font-size: 1rem;
      cursor: pointer;
      min-width: 180px;
      justify-content: space-between;
      transition: border-color 0.2s;
    }
    .bjcc-lang-btn:hover {
      border-color: rgba(255, 255, 255, 0.4);
    }
    .bjcc-lang-dd {
      position: absolute;
      top: 100%;
      right: 0;
      margin-top: 0.5rem;
      width: 320px;
      background-color: #1e293b;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 0.75rem;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
      max-height: 384px;
      overflow-y: auto;
    }
    .bjcc-lang-dd::-webkit-scrollbar { width: 8px; }
    .bjcc-lang-dd::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.2);
      border-radius: 4px;
    }
    .bjcc-lang-opt {
      width: 100%;
      padding: 0.875rem 1.25rem;
      text-align: left;
      font-size: 1rem;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      border: none;
      cursor: pointer;
      transition: all 0.2s;
      background: transparent;
      color: white;
    }
    .bjcc-lang-opt:hover {
      background-color: rgba(255, 255, 255, 0.1);
    }
    .bjcc-lang-opt.is-on {
      background-color: rgba(103, 232, 249, 0.9);
      color: #111827;
      font-weight: 500;
    }
    .bjcc-user {
      padding: 0.75rem 1.5rem;
      border: 2px solid rgba(255, 255, 255, 0.2);
      border-radius: 0.75rem;
      color: white;
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      background: transparent;
      transition: all 0.2s;
      line-height: 1.2;
      text-decoration: none;
      display: inline-block;
      text-align: center;
      font-family: inherit;
    }
    .bjcc-user:hover {
      border-color: #a78bfa;
    }
    .bjcc-hero-title-flat {
      font-family: 'Syne', sans-serif !important;
      background: none !important;
      -webkit-text-fill-color: #fff !important;
      color: #fff !important;
      animation: fadeSlideUp .9s .15s ease both !important;
      white-space: nowrap !important;
      background-size: auto !important;
      font-size: clamp(1.2rem, 3.5vw, 3.2rem) !important;
    }
    .bjcc-hero {
      padding-top: 5rem !important;
      padding-bottom: 5rem !important;
    }
    .bjcc-eyebrow {
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-size: 0.75rem;
    }
    .bjcc-lang-pill-row {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 0.75rem;
      margin-top: 2rem;
      max-width: 1100px;
      margin-left: auto;
      margin-right: auto;
    }
    .bjcc-lang-pill {
      padding: 0.625rem 1.25rem;
      border-radius: 9999px;
      font-size: 0.875rem;
      cursor: pointer;
      transition: all 0.2s;
      border: 1px solid rgba(255, 255, 255, 0.15);
      background: transparent;
      color: rgba(255, 255, 255, 0.6);
      font-family: inherit;
    }
    .bjcc-lang-pill:hover {
      border-color: rgba(167, 139, 250, 0.5);
      color: rgba(255, 255, 255, 0.85);
    }
    .bjcc-lang-pill.is-on {
      border: 1px solid #a78bfa;
      background: rgba(124, 58, 237, 0.2);
      color: #fff;
    }
    @media (max-width: 768px) {
      .bjcc-nav-links { display: none !important; }
    }

    ::-webkit-scrollbar { width: 8px; }
    ::-webkit-scrollbar-track { background: rgba(0,0,0,.4); }
    ::-webkit-scrollbar-thumb { background: rgba(124,58,237,.5); border-radius: 999px; }
    ::-webkit-scrollbar-thumb:hover { background: rgba(124,58,237,.8); }

    /* ── Keyframes ── */
    @keyframes float {
      0%   { transform: translateY(0px); }
      100% { transform: translateY(-12px); }
    }
    @keyframes levitate {
      0%   { transform: translateY(0px) rotate(0deg); }
      100% { transform: translateY(-12px) rotate(.35deg); }
    }
    @keyframes drift {
      0%   { transform: translate(0, 0) scale(1); }
      33%  { transform: translate(30px, -20px) scale(1.05); }
      66%  { transform: translate(-20px, 15px) scale(.95); }
      100% { transform: translate(0, 0) scale(1); }
    }
    @keyframes twinkle {
      0%, 100% { opacity: .15; transform: scale(1); }
      50%       { opacity: 1;   transform: scale(1.4); }
    }
    @keyframes navFloat {
      0%   { transform: translateX(-50%) translateY(0px); }
      100% { transform: translateX(-50%) translateY(-5px); }
    }
    @keyframes fadeSlideUp {
      from { opacity: 0; transform: translateY(40px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes gradientShift {
      0%   { background-position: 0% 50%; }
      50%  { background-position: 100% 50%; }
      100% { background-position: 0% 50%; }
    }
    @keyframes pulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(124,58,237,.4); }
      50%       { box-shadow: 0 0 0 20px rgba(124,58,237,0); }
    }
    @keyframes quoteIn {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* ── Starfield ── */
    .ag-starfield {
      position: fixed; inset: 0;
      pointer-events: none; z-index: 0;
      overflow: hidden;
    }
    .ag-star {
      position: absolute;
      border-radius: 50%;
      background: #fff;
      animation: twinkle var(--dur) var(--delay) infinite ease-in-out;
    }

    /* ── Background nebula orbs ── */
    .ag-orb {
      position: fixed;
      border-radius: 50%;
      filter: blur(80px);
      pointer-events: none;
      z-index: 0;
      animation: drift var(--orb-dur) var(--orb-delay) infinite ease-in-out alternate;
    }

    /* ── Navbar ── */
    .ag-nav {
      position: fixed;
      top: 24px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 1000;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 20px 10px 16px;
      background: rgba(255,255,255,.06);
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      border: 1px solid rgba(255,255,255,.12);
      border-radius: 999px;
      box-shadow: 0 8px 48px rgba(0,0,0,.4), 0 0 0 1px rgba(255,255,255,.04) inset;
      white-space: nowrap;
      animation: navFloat 3s ease-in-out infinite alternate;
      max-width: calc(100vw - 32px);
    }
    .ag-nav-brand {
      font-family: 'Syne', sans-serif;
      font-weight: 800;
      font-size: .9rem;
      background: linear-gradient(135deg, #fff 0%, #a78bfa 50%, #06B6D4 100%);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
      background-clip: text;
      margin-right: 8px;
    }
    .ag-nav-link {
      text-decoration: none;
      color: rgba(255,255,255,.6);
      font-size: .82rem;
      font-weight: 500;
      padding: 6px 12px;
      border-radius: 999px;
      transition: color .2s ease, background .2s ease;
    }
    .ag-nav-link:hover, .ag-nav-link.active {
      color: #fff;
      background: rgba(255,255,255,.08);
    }
    .ag-nav-divider {
      width: 1px; height: 16px;
      background: rgba(255,255,255,.12);
    }
    .ag-nav-cta {
      padding: 8px 18px;
      background: linear-gradient(135deg, #7C3AED, #06B6D4);
      border: none; border-radius: 999px;
      color: #fff;
      font-size: .82rem; font-weight: 600;
      cursor: pointer;
      transition: box-shadow .25s ease, transform .2s ease;
      text-decoration: none;
    }
    .ag-nav-cta:hover {
      box-shadow: 0 0 28px rgba(124,58,237,.7);
      transform: translateY(-1px);
    }

    /* ── Page wrapper ── */
    .ag-page {
      position: relative; z-index: 1;
      min-height: 100vh;
    }

    /* ── Hero ── */
    .ag-hero {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 160px 24px 100px;
      position: relative;
    }
    .ag-hero-eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 16px;
      border-radius: 999px;
      border: 1px solid rgba(124,58,237,.4);
      background: rgba(124,58,237,.12);
      color: #a78bfa;
      font-size: .8rem;
      font-weight: 600;
      letter-spacing: .08em;
      text-transform: uppercase;
      margin-bottom: 28px;
      animation: fadeSlideUp .8s ease both;
    }
    .ag-hero-badge-dot {
      width: 6px; height: 6px;
      border-radius: 50%;
      background: #7C3AED;
      animation: pulse 2s infinite;
    }
    .ag-hero-title {
      font-family: 'Syne', sans-serif;
      font-weight: 800;
      font-size: clamp(1.8rem, 4.5vw, 3.2rem);
      letter-spacing: -1px;
      line-height: 1.2;
      white-space: nowrap;
      background: linear-gradient(135deg, #ffffff 0%, #c4b5fd 30%, #06B6D4 60%, #F472B6 90%, #ffffff 100%);
      background-size: 300% 300%;
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
      background-clip: text;
      animation: fadeSlideUp .9s .15s ease both, gradientShift 6s ease-in-out infinite;
      width: 100%;
      max-width: 1200px;
      margin-bottom: 24px;
    }
    .ag-hero-subtitle {
      font-size: clamp(.95rem, 1.8vw, 1.2rem);
      font-weight: 300;
      color: rgba(255,255,255,.5);
      max-width: 560px;
      line-height: 1.7;
      animation: fadeSlideUp .9s .28s ease both;
      margin-bottom: 40px;
    }
    .ag-hero-ctas {
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
      justify-content: center;
      animation: fadeSlideUp .9s .42s ease both;
    }

    /* ── Buttons ── */
    .ag-btn-primary {
      padding: 16px 36px;
      border-radius: 999px;
      background: linear-gradient(135deg, #7C3AED, #2563EB);
      border: none;
      color: #fff;
      font-family: 'Space Grotesk', sans-serif;
      font-size: 1rem; font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 32px rgba(124,58,237,.45);
      transition: box-shadow .3s ease, transform .2s ease;
      text-decoration: none;
      display: inline-flex; align-items: center; gap: 8px;
    }
    .ag-btn-primary:hover {
      box-shadow: 0 8px 60px rgba(124,58,237,.8);
      transform: translateY(-2px);
    }
    .ag-btn-secondary {
      padding: 15px 32px;
      border-radius: 999px;
      background: transparent;
      border: 1px solid rgba(255,255,255,.18);
      color: rgba(255,255,255,.75);
      font-family: 'Space Grotesk', sans-serif;
      font-size: 1rem; font-weight: 500;
      cursor: pointer;
      transition: border-color .25s ease, color .25s ease, transform .2s ease, background .25s ease;
      text-decoration: none;
      display: inline-flex; align-items: center; gap: 8px;
    }
    .ag-btn-secondary:hover {
      border-color: rgba(255,255,255,.4);
      color: #fff;
      background: rgba(255,255,255,.06);
      transform: translateY(-2px);
    }
    .ag-btn-sm {
      padding: 9px 18px;
      border-radius: 999px;
      background: rgba(255,255,255,.06);
      border: 1px solid rgba(255,255,255,.12);
      color: rgba(255,255,255,.7);
      font-family: 'Space Grotesk', sans-serif;
      font-size: .82rem; font-weight: 500;
      cursor: pointer;
      transition: background .2s, border-color .2s, transform .15s, color .2s;
    }
    .ag-btn-sm:hover {
      background: rgba(255,255,255,.12);
      border-color: rgba(255,255,255,.22);
      color: #fff;
      transform: translateY(-1px);
    }
    .ag-btn-sm.accent {
      background: rgba(124,58,237,.2);
      border-color: rgba(124,58,237,.4);
      color: #c4b5fd;
    }
    .ag-btn-sm.accent:hover {
      background: rgba(124,58,237,.35);
      box-shadow: 0 0 20px rgba(124,58,237,.4);
    }

    /* ── Quote strip ── */
    .ag-quote-strip {
      text-align: center;
      padding: 0 24px 64px;
    }
    .ag-quote-text {
      font-family: 'Syne', sans-serif;
      font-size: clamp(1rem, 2vw, 1.25rem);
      font-weight: 600;
      color: rgba(255,255,255,.45);
      letter-spacing: .06em;
      text-transform: uppercase;
      transition: opacity .6s ease, transform .6s ease;
    }
    .ag-quote-text.fade-out { opacity: 0; transform: translateY(8px); }
    .ag-quote-text.fade-in { opacity: 1; transform: translateY(0); animation: quoteIn .5s ease; }

    /* ── Section common ── */
    .ag-section {
      padding: 80px 24px;
      max-width: 1200px;
      margin: 0 auto;
    }
    .ag-section-label {
      font-size: .78rem; font-weight: 600;
      letter-spacing: .14em; text-transform: uppercase;
      color: #7C3AED;
      margin-bottom: 14px;
    }
    .ag-section-title {
      font-family: 'Syne', sans-serif;
      font-weight: 700;
      font-size: clamp(1.4rem, 3.5vw, 2.2rem);
      letter-spacing: -0.5px;
      line-height: 1.3;
      color: #fff;
      margin-bottom: 16px;
    }
    .ag-section-sub {
      color: rgba(255,255,255,.45);
      font-size: 1.05rem;
      font-weight: 300;
      max-width: 520px;
      line-height: 1.65;
    }

    /* ── Glass card ── */
    .ag-glass-card {
      border-radius: 24px;
      background: rgba(255,255,255,.03);
      border: 1px solid rgba(255,255,255,.08);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      padding: 28px;
      position: relative;
      overflow: hidden;
      transition: border-color .3s ease, transform .3s ease, box-shadow .3s ease;
    }
    .ag-glass-card::before {
      content: '';
      position: absolute; inset: 0;
      border-radius: 24px;
      background: radial-gradient(ellipse at top left, rgba(124,58,237,.08), transparent 60%);
      opacity: 0;
      transition: opacity .3s ease;
      pointer-events: none;
    }
    .ag-glass-card:hover {
      border-color: rgba(255,255,255,.15);
      box-shadow: 0 24px 80px rgba(0,0,0,.5), 0 0 0 1px rgba(124,58,237,.15) inset;
    }
    .ag-glass-card:hover::before { opacity: 1; }

    /* ── Features grid ── */
    .ag-features-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 24px;
      margin-top: 64px;
    }
    .ag-feature-card {
      animation: levitate var(--card-dur, 4s) var(--card-delay, 0s) ease-in-out infinite alternate;
    }
    .ag-feature-card:hover {
      transform: translateY(-10px) rotate(.5deg) !important;
      animation-play-state: paused;
    }
    .ag-feature-icon {
      font-size: 2.2rem;
      margin-bottom: 16px;
      display: block;
    }
    .ag-feature-title {
      font-family: 'Syne', sans-serif;
      font-weight: 700;
      font-size: 1.15rem;
      color: #fff;
      margin-bottom: 10px;
      letter-spacing: -.3px;
    }
    .ag-feature-desc {
      color: rgba(255,255,255,.5);
      font-size: .9rem;
      line-height: 1.65;
    }

    /* ── Stats ── */
    .ag-stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 2px;
      border-radius: 24px;
      overflow: hidden;
      border: 1px solid rgba(255,255,255,.08);
      background: rgba(255,255,255,.03);
      backdrop-filter: blur(20px);
    }
    .ag-stat-item {
      padding: 40px 24px;
      text-align: center;
      border-right: 1px solid rgba(255,255,255,.06);
      transition: background .25s ease;
    }
    .ag-stat-item:last-child { border-right: none; }
    .ag-stat-item:hover { background: rgba(124,58,237,.08); }
    .ag-stat-value {
      font-family: 'Syne', sans-serif;
      font-weight: 800;
      font-size: clamp(2.2rem, 5vw, 3.5rem);
      letter-spacing: -2px;
      background: linear-gradient(135deg, #fff 0%, #a78bfa 50%, #06B6D4 100%);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .ag-stat-label {
      color: rgba(255,255,255,.4);
      font-size: .82rem;
      font-weight: 500;
      letter-spacing: .06em;
      text-transform: uppercase;
      margin-top: 6px;
    }

    /* ── Search section ── */
    .ag-search-panel {
      display: flex;
      flex-direction: column;
      gap: 32px;
    }
    .ag-search-box {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .ag-field-label {
      font-size: .72rem; font-weight: 600;
      letter-spacing: .12em; text-transform: uppercase;
      color: rgba(255,255,255,.4);
      margin-bottom: 6px;
    }
    .ag-input, .ag-select {
      width: 100%;
      padding: 13px 16px;
      border-radius: 14px;
      border: 1px solid rgba(255,255,255,.1);
      background: rgba(255,255,255,.04);
      color: #fff;
      font-family: 'Space Grotesk', sans-serif;
      font-size: .9rem;
      outline: none;
      transition: border-color .2s ease, box-shadow .2s ease;
      backdrop-filter: blur(10px);
    }
    .ag-input::placeholder { color: rgba(255,255,255,.3); }
    .ag-input:focus, .ag-select:focus {
      border-color: rgba(124,58,237,.6);
      box-shadow: 0 0 0 3px rgba(124,58,237,.15);
    }
    .ag-select option { background: #1a0a2e; color: #fff; }
    .ag-search-actions { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 4px; }

    /* ── Results list ── */
    .ag-results-list { display: flex; flex-direction: column; gap: 12px; margin-top: 16px; }
    .ag-result-item {
      padding: 16px 18px;
      border-radius: 16px;
      border: 1px solid rgba(255,255,255,.08);
      background: rgba(255,255,255,.03);
      backdrop-filter: blur(10px);
      transition: border-color .2s, transform .2s, box-shadow .2s;
    }
    .ag-result-item:hover {
      border-color: rgba(6,182,212,.3);
      transform: translateY(-3px);
      box-shadow: 0 12px 40px rgba(0,0,0,.4);
    }
    .ag-result-title { font-weight: 600; font-size: .95rem; color: #e0e7ff; margin-bottom: 6px; }
    .ag-result-summary { font-size: .84rem; color: rgba(255,255,255,.5); line-height: 1.5; margin-bottom: 8px; }
    .ag-result-meta { font-size: .76rem; color: rgba(255,255,255,.3); margin-bottom: 10px; }
    .ag-result-actions { display: flex; gap: 8px; flex-wrap: wrap; }
    .ag-empty-state {
      text-align: center;
      padding: 40px;
      color: rgba(255,255,255,.3);
      font-size: .9rem;
      border: 1px dashed rgba(255,255,255,.1);
      border-radius: 16px;
    }

    /* ── Chat / Assistant ── */
    .ag-chat-log {
      max-height: 260px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 16px;
      border-radius: 14px;
      border: 1px solid rgba(255,255,255,.07);
      background: rgba(0,0,0,.25);
      margin-bottom: 12px;
    }
    .ag-msg { display: flex; flex-direction: column; gap: 2px; }
    .ag-msg-who { font-size: .72rem; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
    .ag-msg.user .ag-msg-who { color: #a78bfa; }
    .ag-msg.bot .ag-msg-who { color: #06B6D4; }
    .ag-msg-text { font-size: .88rem; color: rgba(255,255,255,.75); line-height: 1.55; }
    .ag-chat-input-row { display: flex; gap: 10px; }
    .ag-chat-input {
      flex: 1;
      padding: 12px 16px;
      border-radius: 12px;
      border: 1px solid rgba(255,255,255,.1);
      background: rgba(255,255,255,.04);
      color: #fff;
      font-family: 'Space Grotesk', sans-serif;
      font-size: .88rem;
      outline: none;
      transition: border-color .2s;
    }
    .ag-chat-input:focus { border-color: rgba(124,58,237,.5); }
    .ag-chat-input::placeholder { color: rgba(255,255,255,.3); }

    /* ── Testimonials ── */
    .ag-testimonials-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 24px;
      margin-top: 64px;
    }
    .ag-testimonial-card {
      animation: levitate var(--t-dur, 5s) var(--t-delay, 0s) ease-in-out infinite alternate;
    }
    .ag-testimonial-card:hover {
      transform: translateY(-10px) rotate(-.4deg) !important;
      animation-play-state: paused;
    }
    .ag-quote-mark {
      font-family: 'Syne', sans-serif;
      font-size: 3.5rem;
      color: rgba(124,58,237,.35);
      line-height: .8;
      margin-bottom: 12px;
      display: block;
    }
    .ag-testimonial-text {
      font-size: .92rem;
      color: rgba(255,255,255,.65);
      line-height: 1.7;
      margin-bottom: 20px;
    }
    .ag-testimonial-author { font-weight: 600; font-size: .88rem; color: #fff; }
    .ag-testimonial-role { font-size: .8rem; color: rgba(255,255,255,.35); margin-top: 2px; }

    /* ── CTA box ── */
    .ag-cta-box {
      text-align: center;
      padding: 80px 40px;
      border-radius: 32px;
      background: rgba(255,255,255,.03);
      border: 1px solid rgba(124,58,237,.25);
      position: relative;
      overflow: hidden;
    }
    .ag-cta-box::before {
      content: '';
      position: absolute;
      top: -60%;
      left: 50%;
      transform: translateX(-50%);
      width: 600px;
      height: 400px;
      background: radial-gradient(ellipse, rgba(124,58,237,.25) 0%, transparent 70%);
      pointer-events: none;
    }
    .ag-cta-title {
      font-family: 'Syne', sans-serif;
      font-weight: 800;
      font-size: clamp(2rem, 4.5vw, 3.5rem);
      letter-spacing: -2px;
      color: #fff;
      margin-bottom: 16px;
      position: relative;
    }
    .ag-cta-sub {
      color: rgba(255,255,255,.45);
      font-size: 1.05rem;
      font-weight: 300;
      max-width: 480px;
      margin: 0 auto 36px;
      line-height: 1.65;
      position: relative;
    }
    .ag-section {
      max-width: 1280px;
      margin: 0 auto;
      padding: 100px 24px;
      position: relative;
    }
    .ag-section:target {
      animation: targetFadeOpen 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
    @keyframes targetFadeOpen {
      0% {
        opacity: 0.2;
        transform: scale(0.97) translateY(20px);
      }
      100% {
        opacity: 1;
        transform: scale(1) translateY(0);
      }
    }
    .ag-cta-buttons { display: flex; gap: 16px; justify-content: center; flex-wrap: wrap; position: relative; }

    /* ── Tab nav ── */
    .ag-tab-nav {
      display: flex;
      gap: 4px;
      padding: 4px;
      background: rgba(255,255,255,.04);
      border-radius: 12px;
      border: 1px solid rgba(255,255,255,.07);
      margin-bottom: 24px;
      width: fit-content;
    }
    .ag-tab {
      padding: 8px 18px;
      border-radius: 9px;
      border: none;
      background: none;
      color: rgba(255,255,255,.45);
      font-family: 'Space Grotesk', sans-serif;
      font-size: .84rem; font-weight: 500;
      cursor: pointer;
      transition: background .2s, color .2s;
    }
    .ag-tab.active {
      background: rgba(255,255,255,.1);
      color: #fff;
    }

    /* ── Footer ── */
    .ag-footer {
      text-align: center;
      padding: 48px 24px 36px;
      border-top: 1px solid rgba(255,255,255,.04);
      max-width: 1200px;
      margin: 0 auto;
    }
    .ag-footer-logo {
      font-family: 'Syne', sans-serif;
      font-weight: 800;
      font-size: 1.2rem;
      background: linear-gradient(135deg, #fff, #a78bfa);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
      background-clip: text;
      margin-bottom: 12px;
    }
    .ag-footer-sub {
      color: rgba(255,255,255,.2);
      font-size: .82rem;
      line-height: 1.7;
    }
    .ag-footer-links {
      display: flex;
      justify-content: center;
      gap: 24px;
      margin-top: 20px;
      flex-wrap: wrap;
    }
    .ag-footer-link {
      color: rgba(255,255,255,.3);
      text-decoration: none;
      font-size: .8rem;
      transition: color .2s;
    }
    .ag-footer-link:hover { color: rgba(255,255,255,.7); }

    /* ── Language pill chips ── */
    .ag-lang-row {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-top: 16px;
    }
    .ag-lang-chip {
      padding: 6px 14px;
      border-radius: 999px;
      border: 1px solid rgba(255,255,255,.1);
      background: rgba(255,255,255,.04);
      color: rgba(255,255,255,.5);
      font-size: .78rem;
      font-weight: 500;
      cursor: pointer;
      transition: border-color .2s, background .2s, color .2s;
    }
    .ag-lang-chip:hover, .ag-lang-chip.active {
      border-color: rgba(124,58,237,.5);
      background: rgba(124,58,237,.15);
      color: #c4b5fd;
    }

    /* ── Responsive ── */
    @media (max-width: 640px) {
      .ag-nav-link { display: none; }
      .ag-nav-divider { display: none; }
      .ag-hero { padding: 140px 20px 80px; }
      .ag-search-panel { grid-template-columns: 1fr; }
      .ag-features-grid { grid-template-columns: 1fr; }
      .ag-testimonials-grid { grid-template-columns: 1fr; }
      .ag-stats { grid-template-columns: 1fr 1fr; }
      .ag-stat-item { border-right: none; border-bottom: 1px solid rgba(255,255,255,.06); }
      .ag-cta-box { padding: 48px 24px; }
    }

    @media (prefers-reduced-motion: reduce) {
      .ag-feature-card, .ag-testimonial-card { animation: none !important; }
    }

    /* ══════════════════════════════════════════════
       LIGHT THEME OVERRIDES (inside injected style)
    ══════════════════════════════════════════════ */
    [data-theme="light"] body {
      background: linear-gradient(to bottom right, #e8f0fe, #dce8f5, #cfe0f0) !important;
      color: #0d1f30 !important;
    }
    [data-theme="light"] .bjcc-topnav {
      background-color: rgba(255,255,255,.9) !important;
      border-bottom-color: rgba(0,0,0,.1) !important;
    }
    [data-theme="light"] .bjcc-nav-links a,
    [data-theme="light"] .bjcc-nav-links button.nav-a {
      color: rgba(13,31,48,.75) !important;
    }
    [data-theme="light"] .bjcc-nav-links a:hover,
    [data-theme="light"] .bjcc-nav-links button.nav-a:hover { color: #0d1f30 !important; }
    [data-theme="light"] .bjcc-logo { color: #000000 !important; }
    [data-theme="light"] .bjcc-lang-btn {
      background-color: #f8fafc !important;
      border-color: rgba(0,0,0,.15) !important;
      color: #0d1f30 !important;
    }
    [data-theme="light"] .bjcc-lang-dd {
      background-color: #fff !important;
      border-color: rgba(0,0,0,.12) !important;
    }
    [data-theme="light"] .bjcc-lang-opt { color: #0d1f30 !important; }
    [data-theme="light"] .bjcc-user {
      border-color: rgba(0,0,0,.2) !important;
      color: #0d1f30 !important;
    }
    [data-theme="light"] .ag-nav {
      background: rgba(255,255,255,.88) !important;
      border-color: rgba(0,0,0,.1) !important;
      box-shadow: 0 8px 48px rgba(0,0,0,.12) !important;
    }
    [data-theme="light"] .ag-nav-link { color: rgba(13,31,48,.65) !important; }
    [data-theme="light"] .ag-nav-link:hover,
    [data-theme="light"] .ag-nav-link.active { color: #0d1f30 !important; background: rgba(0,0,0,.05) !important; }
    [data-theme="light"] .ag-nav-divider { background: rgba(0,0,0,.1) !important; }
    [data-theme="light"] .ag-hero-eyebrow { color: #7c3aed; }
    [data-theme="light"] .ag-hero-subtitle { color: rgba(13,31,48,.62) !important; }
    [data-theme="light"] .bjcc-hero-title-flat {
      -webkit-text-fill-color: #0d1f30 !important;
      color: #0d1f30 !important;
    }
    [data-theme="light"] .ag-section-title { color: #0d1f30 !important; }
    [data-theme="light"] .ag-section-sub { color: rgba(13,31,48,.62) !important; }
    [data-theme="light"] .ag-glass-card {
      background: rgba(255,255,255,.72) !important;
      border-color: rgba(0,0,0,.1) !important;
    }
    [data-theme="light"] .ag-glass-card:hover {
      border-color: rgba(0,0,0,.18) !important;
      box-shadow: 0 24px 80px rgba(0,0,0,.1) !important;
    }
    [data-theme="light"] .ag-feature-title { color: #0d1f30 !important; }
    [data-theme="light"] .ag-feature-desc { color: rgba(13,31,48,.65) !important; }
    [data-theme="light"] .ag-stats {
      background: rgba(255,255,255,.65) !important;
      border-color: rgba(0,0,0,.1) !important;
    }
    [data-theme="light"] .ag-stat-item { border-right-color: rgba(0,0,0,.06) !important; }
    [data-theme="light"] .ag-stat-label { color: rgba(13,31,48,.5) !important; }
    [data-theme="light"] .ag-field-label { color: rgba(13,31,48,.5) !important; }
    [data-theme="light"] .ag-input, [data-theme="light"] .ag-select {
      border-color: rgba(0,0,0,.14) !important;
      background: rgba(255,255,255,.8) !important;
      color: #0d1f30 !important;
    }
    [data-theme="light"] .ag-input::placeholder { color: rgba(13,31,48,.38) !important; }
    [data-theme="light"] .ag-select option { background: #e8f0fe !important; color: #0d1f30 !important; }
    [data-theme="light"] .ag-result-item {
      border-color: rgba(0,0,0,.1) !important;
      background: rgba(255,255,255,.65) !important;
    }
    [data-theme="light"] .ag-result-title { color: #1a2c42 !important; }
    [data-theme="light"] .ag-result-summary { color: rgba(13,31,48,.65) !important; }
    [data-theme="light"] .ag-result-meta { color: rgba(13,31,48,.45) !important; }
    [data-theme="light"] .ag-empty-state { color: rgba(13,31,48,.4) !important; border-color: rgba(0,0,0,.1) !important; }
    [data-theme="light"] .ag-chat-log {
      border-color: rgba(0,0,0,.08) !important;
      background: rgba(255,255,255,.65) !important;
    }
    [data-theme="light"] .ag-msg-text { color: rgba(13,31,48,.8) !important; }
    [data-theme="light"] .ag-chat-input {
      border-color: rgba(0,0,0,.12) !important;
      background: rgba(255,255,255,.75) !important;
      color: #0d1f30 !important;
    }
    [data-theme="light"] .ag-chat-input::placeholder { color: rgba(13,31,48,.38) !important; }
    [data-theme="light"] .ag-testimonial-text { color: rgba(13,31,48,.72) !important; }
    [data-theme="light"] .ag-testimonial-author { color: #0d1f30 !important; }
    [data-theme="light"] .ag-testimonial-role { color: rgba(13,31,48,.45) !important; }
    [data-theme="light"] .ag-cta-box {
      background: rgba(255,255,255,.65) !important;
      border-color: rgba(124,58,237,.2) !important;
    }
    [data-theme="light"] .ag-cta-title { color: #0d1f30 !important; }
    [data-theme="light"] .ag-cta-sub { color: rgba(13,31,48,.62) !important; }
    [data-theme="light"] .ag-btn-secondary {
      border-color: rgba(0,0,0,.18) !important;
      color: rgba(13,31,48,.75) !important;
    }
    [data-theme="light"] .ag-btn-secondary:hover {
      border-color: rgba(0,0,0,.35) !important;
      color: #0d1f30 !important;
      background: rgba(0,0,0,.04) !important;
    }
    [data-theme="light"] .ag-btn-sm {
      background: rgba(0,0,0,.05) !important;
      border-color: rgba(0,0,0,.12) !important;
      color: rgba(13,31,48,.72) !important;
    }
    [data-theme="light"] .ag-btn-sm:hover { background: rgba(0,0,0,.1) !important; color: #0d1f30 !important; }
    [data-theme="light"] .ag-tab-nav {
      background: rgba(0,0,0,.04) !important;
      border-color: rgba(0,0,0,.08) !important;
    }
    [data-theme="light"] .ag-tab { color: rgba(13,31,48,.48) !important; }
    [data-theme="light"] .ag-tab.active { background: rgba(0,0,0,.08) !important; color: #0d1f30 !important; }
    [data-theme="light"] .ag-quote-text { color: rgba(13,31,48,.52) !important; }
    [data-theme="light"] .ag-footer { border-top-color: rgba(0,0,0,.08) !important; }
    [data-theme="light"] .ag-footer-sub { color: rgba(13,31,48,.38) !important; }
    [data-theme="light"] .ag-footer-link { color: rgba(13,31,48,.4) !important; }
    [data-theme="light"] .ag-footer-link:hover { color: rgba(13,31,48,.75) !important; }
    [data-theme="light"] .ag-lang-chip {
      border-color: rgba(0,0,0,.12) !important;
      background: rgba(0,0,0,.04) !important;
      color: rgba(13,31,48,.58) !important;
    }
    [data-theme="light"] .ag-lang-chip:hover,
    [data-theme="light"] .ag-lang-chip.active {
      border-color: rgba(124,58,237,.45) !important;
      background: rgba(124,58,237,.1) !important;
      color: #5b21b6 !important;
    }
    [data-theme="light"] .bjcc-lang-pill { border-color: rgba(0,0,0,.14) !important; color: rgba(13,31,48,.58) !important; }
    [data-theme="light"] .bjcc-lang-pill:hover { color: rgba(13,31,48,.85) !important; }
    [data-theme="light"] .bjcc-lang-pill.is-on { border-color: #5b21b6 !important; background: rgba(124,58,237,.12) !important; color: #0d1f30 !important; }
    [data-theme="light"] ::-webkit-scrollbar-track { background: rgba(0,0,0,.06) !important; }
    [data-theme="light"] ::-webkit-scrollbar-thumb { background: rgba(124,58,237,.35) !important; }
    [data-theme="light"] ::-webkit-scrollbar-thumb:hover { background: rgba(124,58,237,.55) !important; }
  `;

  return (
    <>
      {/* Inject styles */}
      <style dangerouslySetInnerHTML={{ __html: css }} />

      <div className="bjcc-shell">
      <nav className="bjcc-topnav" role="navigation" aria-label="Main navigation">
        <div className="bjcc-topnav-inner">
          <a
            href="#top"
            className="bjcc-logo"
            onClick={(e) => {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            style={{ alignItems: "center" }}
          >
            <div style={{
              width: 44,
              height: 44,
              backgroundColor: "#ffffff",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 3,
              boxShadow: "0 2px 8px rgba(0,0,0,0.2)"
            }}>
              <img
                src="/ashoka-emblem.png"
                alt="Ashoka Emblem"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                }}
              />
            </div>
            <span style={{ fontSize: "1.4rem", fontWeight: 800, marginLeft: 4 }}>BJCC</span>
          </a>
          <div className="bjcc-nav-links">
            <a href="/">{ui("navExplore", "Explore")}</a>
            <a href="#features">{ui("navFeatures")}</a>
            <a href="#search">{ui("navSearch")}</a>
            <a href="#about">{ui("navAbout")}</a>
          </div>
          <div className="bjcc-right">
            <div ref={langWrapRef} style={{ position: "relative" }}>
              <button
                type="button"
                className="bjcc-lang-btn"
                onClick={() => setLangOpen(!langOpen)}
                aria-expanded={langOpen}
                aria-haspopup="listbox"
              >
                <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span style={{ color: "#67e8f9" }}>🌐</span>
                  <span>{selectedLangDisplay}</span>
                </span>
                <span style={{ transform: langOpen ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s" }}>▼</span>
              </button>
              {langOpen && (
                <div className="bjcc-lang-dd" role="listbox">
                  {BJCC_LANGUAGES.map((label) => (
                    <button
                      type="button"
                      key={label}
                      className={`bjcc-lang-opt${selectedLangDisplay === label ? " is-on" : ""}`}
                      onClick={() => pickDisplayLang(label)}
                      role="option"
                      aria-selected={selectedLangDisplay === label}
                    >
                      {selectedLangDisplay === label && <span style={{ color: "#0891b2" }}>🌐</span>}
                      {selectedLangDisplay !== label && <span style={{ width: "20px", display: "inline-block" }} />}
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {whoChip === "Account" ? (
              <Link to="/login" className="bjcc-user">
                {ui("navSignIn")}
              </Link>
            ) : (
              <button type="button" className="bjcc-user" onClick={onWhoChipClick}>
                {whoChip}
              </button>
            )}
            {/* ── Theme toggle ── */}
            <button
              id="theme-toggle-btn"
              className="theme-toggle-btn"
              onClick={toggleTheme}
              title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
              aria-label={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {theme === "dark" ? "☀️" : "🌙"}
            </button>
          </div>
        </div>
      </nav>

      <div className="ag-page" id="top">

        {/* ═══════════════ HERO ═══════════════ */}
        <section
          className="ag-hero bjcc-hero"
          ref={heroRef}
          onMouseMove={onHeroMouseMove}
          onMouseLeave={onHeroMouseLeave}
          aria-label="Hero section"
        >
          <div className="ag-hero-eyebrow bjcc-eyebrow">
            <span className="ag-hero-badge-dot" />
            {ui("badgePoweredBy")}
          </div>

          <h1
            className="ag-hero-title bjcc-hero-title-flat"
            style={{
              transform: `perspective(1000px) rotateX(${heroTilt.x}deg) rotateY(${heroTilt.y}deg)`,
              transition: "transform .1s ease-out",
              willChange: "transform",
            }}
          >
            {ui("hdrTitle", t.hdrTitle)}
          </h1>

          <p className="ag-hero-subtitle">{ui("hdrSub", t.hdrSub)}</p>

          <div className="ag-hero-ctas">
            <a href="#search" className="ag-btn-primary" id="hero-cta-search">
              🔍 {ui("heroCtaSearch")}
            </a>
          </div>

          <div className="bjcc-lang-pill-row" aria-label="Language selector">
            {BJCC_LANGUAGES.map((lbl) => (
              <button
                type="button"
                key={lbl}
                id={`lang-pill-${lbl}`}
                className={`bjcc-lang-pill${selectedLangDisplay === lbl ? " is-on" : ""}`}
                onClick={() => pickDisplayLang(lbl)}
                aria-pressed={selectedLangDisplay === lbl}
              >
                {lbl}
              </button>
            ))}
          </div>
        </section>

        {/* ── Quote strip ── */}
        <div className="ag-quote-strip">
          <p className={`ag-quote-text${quoteClass ? ` ${quoteClass}` : ""}`} aria-live="polite">
            "{quoteText}"
          </p>
        </div>

        {/* ═══════════════ FEATURES ═══════════════ */}
        <section className="ag-section" id="features" aria-labelledby="features-heading">
          <div style={{ maxWidth: 560 }}>
            <p className="ag-section-label">{ui("whyLabel")}</p>
            <h2 className="ag-section-title" id="features-heading">
              {ui("whyTitle")}
            </h2>
            <p className="ag-section-sub">
              {ui("whySub")}
            </p>
          </div>

          <div className="ag-features-grid">
            {localizedFeatures.map((f, i) => (
              <div
                key={i}
                className="ag-feature-card ag-glass-card"
                style={{
                  "--card-dur": `${3.5 + i * 0.5}s`,
                  "--card-delay": f.delay,
                  marginTop: f.offset,
                }}
              >
                <span className="ag-feature-icon" aria-hidden="true">{f.icon}</span>
                <h3 className="ag-feature-title">{f.title}</h3>
                <p className="ag-feature-desc">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ═══════════════ SEARCH ═══════════════ */}
        <section className="ag-section" id="search" aria-labelledby="search-heading">
          <p className="ag-section-label">{ui("searchDbLabel")}</p>
          <h2 className="ag-section-title" id="search-heading">{ui("searchTitle")}</h2>

          <div className="ag-tab-nav" role="tablist">
            <button
              className={`ag-tab${activeSection === "search" ? " active" : ""}`}
              onClick={() => setActiveSection("search")}
              role="tab"
              aria-selected={activeSection === "search"}
            >
              🔍 {ui("tabSearch")}
            </button>
            <button
              className={`ag-tab${activeSection === "kanoon" ? " active" : ""}`}
              onClick={() => setActiveSection("kanoon")}
              role="tab"
              aria-selected={activeSection === "kanoon"}
            >
              📰 {ui("tabKanoon")}
            </button>
          </div>

          <div className="ag-glass-card">
            {activeSection === "search" && (
              <>
                <div className="ag-search-panel">
                  <div className="ag-search-box">
                    <div>
                      <label htmlFor="ii-q" className="ag-field-label">{ui("searchLabel", t.searchLabel)}</label>
                      <input
                        id="ii-q"
                        className="ag-input"
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder={ui("askPlaceholder", t.askPlaceholder)}
                        onKeyDown={(e) => e.key === "Enter" && void doSearch()}
                      />
                    </div>
                    <div>
                      <label htmlFor="ii-court" className="ag-field-label">{ui("courtLabel", t.courtLabel)}</label>
                      <select id="ii-court" className="ag-select" value={court} onChange={(e) => setCourt(e.target.value)}>
                        <option value="">{ui("allCourts", t.allCourts)}</option>
                        <option value="Supreme Court of India">{ui("scIndia", t.scIndia)}</option>
                        <option value="High Courts of India">{ui("hcIndia", t.hcIndia)}</option>
                        <option value="Subordinate Courts (Lower Courts)">{ui("subCourts", t.subCourts)}</option>
                      </select>
                    </div>
                    <div className="ag-search-actions">
                      <button id="btn-search" className="ag-btn-primary" style={{ padding: "12px 28px", fontSize: ".9rem" }} onClick={() => void doSearch()}>
                        {ui("btnSearch", t.btnSearch)}
                      </button>
                      <button
                        id="btn-examples"
                        className="ag-btn-secondary"
                        style={{ padding: "11px 20px", fontSize: ".9rem" }}
                        onClick={() => { setQ("Aadhaar privacy"); setCourt("Supreme Court of India"); void runJudicialSearch("Aadhaar privacy", "Supreme Court of India", lang); }}
                      >
                        {ui("btnExamples", t.btnExamples)}
                      </button>
                    </div>
                  </div>

                  {/* Results */}
                  <div>
                    <h3 style={{ fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: "1rem", color: "rgba(255,255,255,.6)", marginBottom: 12, letterSpacing: "-.3px" }}>
                      {ui("resultsHdr", t.resultsHdr)}
                    </h3>
                    {resultsEmpty ? (
                      <div className="ag-empty-state">{resultsMessage}</div>
                    ) : (
                      <div className="ag-results-list">
                        {hits.map((d) => (
                          <div key={d.id} className="ag-result-item">
                            <div className="ag-result-title">{d.title}</div>
                            <div className="ag-result-summary">
                              {stripHtml(d.summary || d.full_summary || "").slice(0, 180)}...
                            </div>
                            <div className="ag-result-meta">{d.court} · {d.date} · {d.id}</div>
                            <div className="ag-result-actions">
                              <button className="ag-btn-sm accent" id={`open-${d.id}`} onClick={() => openDocFromSearch(d)}>{ui("btnOpen", t.btnOpen)}</button>
                              {d.publication_url && <button className="ag-btn-sm" onClick={() => openSource(d.publication_url)}>{ui("btnOriginal", t.btnOriginal)}</button>}
                              <button className="ag-btn-sm" onClick={() => speakText(stripHtml(d.summary || d.title), lang)}>🔊 {ui("btnSpeak", t.btnSpeak)}</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {activeSection === "kanoon" && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <h3 style={{ fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: "1.05rem", color: "#fff", letterSpacing: "-.3px" }}>
                    {ui("kanoonTitle")}
                  </h3>
                  <button id="btn-refresh-kanoon" className="ag-btn-sm" onClick={() => void loadKanoonRecent(lang)}>⟳ {ui("kanoonRefresh")}</button>
                </div>
                {kanoonRecent.length ? (
                  <div className="ag-results-list">
                    {kanoonRecent.map((d) => (
                      <div key={`k-${d.id}`} className="ag-result-item">
                        <div className="ag-result-title">{d.title}</div>
                        <div className="ag-result-summary">{stripHtml(d.summary || "").slice(0, 220)}...</div>
                        <div className="ag-result-meta">{d.court} · {d.date || "N/A"}</div>
                        <div className="ag-result-actions">
                          <button className="ag-btn-sm accent" onClick={() => openDocFromSearch(d)}>{ui("btnOpen", t.btnOpen)}</button>
                          {d.publication_url && <button className="ag-btn-sm" onClick={() => openSource(d.publication_url)}>{ui("btnOriginal", t.btnOriginal)}</button>}
                          <button className="ag-btn-sm" onClick={() => speakText(stripHtml(d.summary || d.title), lang)}>🔊 {ui("btnSpeak", t.btnSpeak)}</button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="ag-empty-state">{ui("kanoonEmpty")}</div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* AI Assistant removed per user request */}

        {/* ═══════════════ TESTIMONIALS ═══════════════ */}
        <section className="ag-section" id="about" aria-labelledby="testimonials-heading">
          <p className="ag-section-label">{ui("impactLabel")}</p>
          <h2 className="ag-section-title" id="testimonials-heading">
            {ui("impactTitle").split("\n")[0]}
          </h2>

          <div className="ag-testimonials-grid">
            {localizedTestimonials.map((tm, i) => (
              <div
                key={i}
                className="ag-testimonial-card ag-glass-card"
                style={{ "--t-dur": `${4.5 + i * 0.6}s`, "--t-delay": tm.delay }}
              >
                <span className="ag-quote-mark" aria-hidden="true">"</span>
                <p className="ag-testimonial-text">{tm.quote}</p>
                <div>
                  <div className="ag-testimonial-author">{tm.author}</div>
                  <div className="ag-testimonial-role">{tm.role}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ═══════════════ BOTTOM CTA ═══════════════ */}
        <section className="ag-section" aria-labelledby="cta-heading">
          <div className="ag-cta-box">
            <h2 className="ag-cta-title" id="cta-heading">
              {ui("ctaTitle")}
            </h2>
            <p className="ag-cta-sub">
              {ui("ctaSub")}
            </p>
            <div className="ag-cta-buttons">
              {/* Buttons removed per user request */}
            </div>
          </div>
        </section>

        {/* ═══════════════ FOOTER ═══════════════ */}
        <footer className="ag-footer" role="contentinfo">
          <div className="ag-footer-logo">⚖️ Bharat Judicial Court Connect</div>
          <p className="ag-footer-sub">
            {ui("footerSub").split("\n")[0]}<br />
            {ui("footerSub").split("\n")[1] || ""}
          </p>
          <nav className="ag-footer-links" aria-label="Footer navigation">
            <Link to="/browse-laws" className="ag-footer-link">{ui("footerBrowseLaws")}</Link>
            <Link to="/browse-judgments" className="ag-footer-link">{ui("footerJudgments")}</Link>
            <Link to="/payment-demo" className="ag-footer-link">{ui("footerMicropayment")}</Link>
            <a href="/docs" className="ag-footer-link" target="_blank" rel="noreferrer">{ui("footerApiDocs")}</a>
            <Link to="/login" className="ag-footer-link">{ui("footerLogin")}</Link>
          </nav>
          <p style={{ color: "rgba(255,255,255,.1)", fontSize: ".75rem", marginTop: 28 }}>
            Backend: <code style={{ background: "rgba(255,255,255,.06)", padding: "2px 8px", borderRadius: 6, fontFamily: "monospace" }}>http://127.0.0.1:8010</code>
          </p>
        </footer>

      </div>
      </div>
    </>
  );
}
