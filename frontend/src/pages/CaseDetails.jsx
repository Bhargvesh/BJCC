import React, { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import "./IndiaInnovation.css";
import "../styles/case_react.css";
import "../styles/global.css";
import { useTheme } from "../context/ThemeContext";

/* ─── helpers ─── */
function esc(s) {
  const d = document.createElement("div");
  d.textContent = String(s ?? "");
  return d.innerHTML;
}

function renderSummaryHtml(text) {
  if (!text) return "<p>No summary available.</p>";
  const lines = text.split("\n");
  let html = "";
  let inParagraph = false;
  const closeParagraph = () => {
    if (inParagraph) { html += "</p>"; inParagraph = false; }
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) { closeParagraph(); continue; }
    const isHeading = line === line.toUpperCase() && line.length > 4 && /[A-Z]{3}/.test(line);
    if (isHeading) { closeParagraph(); html += `<h3 class="sumHeading">${esc(line)}</h3>`; continue; }
    if (line.startsWith("•") || line.startsWith("-") || /^\d+\.\s/.test(line)) {
      closeParagraph();
      const content = line.replace(/^[•\-]\s*/, "").replace(/^\d+\.\s*/, "");
      html += `<div class="sumBullet"><span class="sumBulletDot">▸</span><span>${esc(content)}</span></div>`;
      continue;
    }
    if (!inParagraph) { html += "<p class='sumPara'>"; inParagraph = true; } else { html += " "; }
    html += esc(line);
  }
  closeParagraph();
  return html;
}

/* ─── Google Translate TTS helpers ─── */

/** Split text into ≤180-char chunks on sentence/word boundaries.
 *  Google Translate TTS silently fails beyond ~200 chars per request. */
function splitIntoChunks(text, maxLen = 180) {
  const sentences = text.split(/(?<=[.!?।])\s+/);
  const chunks = [];
  let current = "";
  for (const sentence of sentences) {
    if ((current + " " + sentence).trim().length <= maxLen) {
      current = (current + " " + sentence).trim();
    } else {
      if (current) chunks.push(current);
      if (sentence.length > maxLen) {
        const words = sentence.split(/\s+/);
        let wordChunk = "";
        for (const w of words) {
          if ((wordChunk + " " + w).trim().length <= maxLen) {
            wordChunk = (wordChunk + " " + w).trim();
          } else {
            if (wordChunk) chunks.push(wordChunk);
            wordChunk = w;
          }
        }
        current = wordChunk;
      } else {
        current = sentence;
      }
    }
  }
  if (current) chunks.push(current);
  return chunks.filter(Boolean);
}

/**
 * Module-level audio singleton — only ONE Audio element may play at a time.
 * Every call to playNext() and resetState() goes through _stopGlobalAudio()
 * before touching the DOM, which eliminates the double-audio race condition.
 */
let _globalAudio = null;

function _stopGlobalAudio() {
  if (_globalAudio) {
    _globalAudio.onended = null;   // remove callbacks first
    _globalAudio.onerror = null;
    _globalAudio.pause();
    try { _globalAudio.src = ""; } catch (_) { /* ignore */ }
    _globalAudio = null;
  }
}

/* ─── Judgment section keys & labels ─── */
const SECTION_KEYS = [
  "facts",
  "issues",
  "petitioner_arguments",
  "respondent_arguments",
  "analysis_of_law",
  "precedent_analysis",
  "court_reasoning",
  "conclusion",
];

const _secEn = {
  facts: "Facts", issues: "Issues",
  petitioner_arguments: "Petitioner's Arguments", respondent_arguments: "Respondent's Arguments",
  analysis_of_law: "Analysis of Law", precedent_analysis: "Precedent Analysis",
  court_reasoning: "Court Reasoning", conclusion: "Conclusion",
};
const SECTION_LABELS = {
  en: _secEn,
  hi: { facts: "तथ्य", issues: "मुद्दे", petitioner_arguments: "याचिकाकर्ता के तर्क", respondent_arguments: "प्रतिवादी के तर्क", analysis_of_law: "कानून का विश्लेषण", precedent_analysis: "पूर्व-निर्णय विश्लेषण", court_reasoning: "न्यायालय का तर्क", conclusion: "निष्कर्ष" },
  bn: { facts: "তথ্য", issues: "বিষয়সমূহ", petitioner_arguments: "আবেদনকারীর যুক্তি", respondent_arguments: "প্রতিবাদীর যুক্তি", analysis_of_law: "আইনের বিশ্লেষণ", precedent_analysis: "নজির বিশ্লেষণ", court_reasoning: "আদালতের যুক্তি", conclusion: "উপসংহার" },
  te: { facts: "వాస్తవాలు", issues: "అంశాలు", petitioner_arguments: "పిటిషనర్ వాదనలు", respondent_arguments: "ప్రతివాది వాదనలు", analysis_of_law: "చట్ట విశ్లేషణ", precedent_analysis: "ముందస్తు విశ్లేషణ", court_reasoning: "న్యాయస్థానం తర్కం", conclusion: "తీర్మానం" },
  mr: { facts: "तथ्य", issues: "मुद्दे", petitioner_arguments: "याचिकाकर्त्याचे युक्तिवाद", respondent_arguments: "प्रतिवादीचे युक्तिवाद", analysis_of_law: "कायद्याचे विश्लेषण", precedent_analysis: "पूर्व-निर्णय विश्लेषण", court_reasoning: "न्यायालयाचे तर्कशास्त्र", conclusion: "निष्कर्ष" },
  ta: { facts: "உண்மைகள்", issues: "சிக்கல்கள்", petitioner_arguments: "மனுதாரர் வாதங்கள்", respondent_arguments: "பிரதிவாதி வாதங்கள்", analysis_of_law: "சட்ட பகுப்பாய்வு", precedent_analysis: "முன்னுதாரண பகுப்பாய்வு", court_reasoning: "நீதிமன்ற நியாயம்", conclusion: "முடிவு" },
  gu: { facts: "તથ્ય", issues: "મુદ્દા", petitioner_arguments: "અરજદારની દલીલો", respondent_arguments: "પ્રતિવાદીની દલીલો", analysis_of_law: "કાયદાનું વિશ્લેષણ", precedent_analysis: "દાખલા વિશ્લેષણ", court_reasoning: "અદાલતનું તર્ક", conclusion: "નિષ્કર્ષ" },
  kn: { facts: "ಸಂಗತಿಗಳು", issues: "ವಿಷಯಗಳು", petitioner_arguments: "ಅರ್ಜಿದಾರರ ವಾದಗಳು", respondent_arguments: "ಪ್ರತಿವಾದಿ ವಾದಗಳು", analysis_of_law: "ಕಾನೂನಿನ ವಿಶ್ಲೇಷಣೆ", precedent_analysis: "ಮುನ್ನಡೆ ವಿಶ್ಲೇಷಣೆ", court_reasoning: "ನ್ಯಾಯಾಲಯದ ತರ್ಕ", conclusion: "ತೀರ್ಮಾನ" },
  ml: { facts: "വസ്തുതകൾ", issues: "പ്രശ്നങ്ങൾ", petitioner_arguments: "ഹർജിക്കാരന്റെ വാദങ്ങൾ", respondent_arguments: "എതിർകക്ഷിയുടെ വാദങ്ങൾ", analysis_of_law: "നിയമ വിശകലനം", precedent_analysis: "മുൻമാതൃകാ വിശകലനം", court_reasoning: "കോടതി ന്യായം", conclusion: "നിഗമനം" },
  pa: { facts: "ਤੱਥ", issues: "ਮੁੱਦੇ", petitioner_arguments: "ਪਟੀਸ਼ਨਰ ਦੀਆਂ ਦਲੀਲਾਂ", respondent_arguments: "ਜਵਾਬਦੇਹ ਦੀਆਂ ਦਲੀਲਾਂ", analysis_of_law: "ਕਾਨੂੰਨ ਦਾ ਵਿਸ਼ਲੇਸ਼ਣ", precedent_analysis: "ਮਿਸਾਲ ਵਿਸ਼ਲੇਸ਼ਣ", court_reasoning: "ਅਦਾਲਤ ਦੀ ਦਲੀਲ", conclusion: "ਸਿੱਟਾ" },
  or: { facts: "ତଥ୍ୟ", issues: "ମୁଦ୍ଦା", petitioner_arguments: "ଆବେଦନକାରୀଙ୍କ ଯୁକ୍ତି", respondent_arguments: "ପ୍ରତିବାଦୀଙ୍କ ଯୁକ୍ତି", analysis_of_law: "ଆଇନର ବିଶ୍ଳେଷଣ", precedent_analysis: "ପୂର୍ବ ନଜୀର ବିଶ୍ଳେଷଣ", court_reasoning: "ଆଦାଲତର ଯୁକ୍ତି", conclusion: "ନିଷ୍କର୍ଷ" },
  as: { facts: "তথ্য", issues: "বিষয়সমূহ", petitioner_arguments: "আবেদনকাৰীৰ যুক্তি", respondent_arguments: "প্ৰতিবাদীৰ যুক্তি", analysis_of_law: "আইনৰ বিশ্লেষণ", precedent_analysis: "নজিৰ বিশ্লেষণ", court_reasoning: "আদালতৰ যুক্তি", conclusion: "সিদ্ধান্ত" },
  mai: { facts: "तथ्य", issues: "मुद्दा", petitioner_arguments: "याचिकाकर्ता केर तर्क", respondent_arguments: "प्रतिवादी केर तर्क", analysis_of_law: "कानून केर विश्लेषण", precedent_analysis: "पूर्व-निर्णय विश्लेषण", court_reasoning: "अदालत केर तर्क", conclusion: "निष्कर्ष" },
  sa: { facts: "तथ्यानि", issues: "विषयाः", petitioner_arguments: "अभियोक्तुः तर्काः", respondent_arguments: "प्रत्यर्थिनः तर्काः", analysis_of_law: "विधेः विश्लेषणम्", precedent_analysis: "पूर्वनिर्णय विश्लेषणम्", court_reasoning: "न्यायालयस्य तर्कः", conclusion: "निष्कर्षः" },
  sd: { facts: "حقيقتون", issues: "مسئلا", petitioner_arguments: "درخواست ڏيندڙ جا دلائل", respondent_arguments: "جواب ڏيندڙ جا دلائل", analysis_of_law: "قانون جو تجزيو", precedent_analysis: "نظير جو تجزيو", court_reasoning: "عدالت جو استدلال", conclusion: "نتيجو" },
  ne: { facts: "तथ्यहरू", issues: "मुद्दाहरू", petitioner_arguments: "निवेदकका तर्कहरू", respondent_arguments: "प्रतिवादीका तर्कहरू", analysis_of_law: "कानूनको विश्लेषण", precedent_analysis: "मिसाल विश्लेषण", court_reasoning: "अदालतको तर्क", conclusion: "निष्कर्ष" },
  doi: { facts: "तथ्य", issues: "मसले", petitioner_arguments: "याचिकाकर्ता दे तर्क", respondent_arguments: "प्रतिवादी दे तर्क", analysis_of_law: "कानून दा विश्लेषण", precedent_analysis: "पूर्व-निर्णय विश्लेषण", court_reasoning: "अदालत दा तर्क", conclusion: "निष्कर्ष" },
  kok: { facts: "तथ्य", issues: "मुद्दे", petitioner_arguments: "अर्जदाराचे युक्तिवाद", respondent_arguments: "प्रतिवादीचे युक्तिवाद", analysis_of_law: "कायद्याचे विश्लेषण", precedent_analysis: "पूर्वनिर्णय विश्लेषण", court_reasoning: "न्यायालयाचे तर्क", conclusion: "निष्कर्ष" },
  brx: { facts: "जानाय", issues: "सोमोन्दो", petitioner_arguments: "बिनायनायारिनि गोरोबथा", respondent_arguments: "फिनजाबनायारिनि गोरोबथा", analysis_of_law: "कानूनआ बिजिरनाय", precedent_analysis: "सिगांनि बिजिरनाय", court_reasoning: "बिसारसालिआ गोरोबथा", conclusion: "जोबथा" },
  mni: { facts: "ফেক্ট", issues: "ইসু", petitioner_arguments: "পিটিশনারগী ৱাফম", respondent_arguments: "রেস্পন্দেন্টকী ৱাফম", analysis_of_law: "আইনগী এনালিসিস", precedent_analysis: "প্রিসিডেন্ট এনালিসিস", court_reasoning: "কোর্টকী রিজনিং", conclusion: "কনক্লুজন" },
  ur: { facts: "حقائق", issues: "مسائل", petitioner_arguments: "درخواست گزار کے دلائل", respondent_arguments: "جواب دہندہ کے دلائل", analysis_of_law: "قانون کا تجزیہ", precedent_analysis: "نظیر کا تجزیہ", court_reasoning: "عدالت کی دلیل", conclusion: "نتیجہ" },
  ks: { facts: "حقیقت", issues: "مسئلہ", petitioner_arguments: "عرضی دارن ہند دلائل", respondent_arguments: "جواب دہندگان ہند دلائل", analysis_of_law: "قانونک تجزیہ", precedent_analysis: "اگوک تجزیہ", court_reasoning: "عدالتی استدلال", conclusion: "نتیجہ" },
};

/* Section accent colors for highlighting */
const SECTION_COLORS = {
  facts: "rgba(59, 130, 246, 0.15)",
  issues: "rgba(168, 85, 247, 0.15)",
  petitioner_arguments: "rgba(236, 72, 153, 0.15)",
  respondent_arguments: "rgba(245, 158, 11, 0.15)",
  analysis_of_law: "rgba(16, 185, 129, 0.15)",
  precedent_analysis: "rgba(99, 102, 241, 0.15)",
  court_reasoning: "rgba(14, 165, 233, 0.15)",
  conclusion: "rgba(34, 197, 94, 0.15)",
};

const SECTION_BORDER_COLORS = {
  facts: "rgba(59, 130, 246, 0.6)",
  issues: "rgba(168, 85, 247, 0.6)",
  petitioner_arguments: "rgba(236, 72, 153, 0.6)",
  respondent_arguments: "rgba(245, 158, 11, 0.6)",
  analysis_of_law: "rgba(16, 185, 129, 0.6)",
  precedent_analysis: "rgba(99, 102, 241, 0.6)",
  court_reasoning: "rgba(14, 165, 233, 0.6)",
  conclusion: "rgba(34, 197, 94, 0.6)",
};

function normalizePlainText(value) {
  const raw = String(value || "");
  let decoded = raw;
  if (typeof document !== "undefined") {
    const ta = document.createElement("textarea");
    ta.innerHTML = raw;
    decoded = ta.value;
  }
  return decoded.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function summarizeCleanText(text, maxSentences = 8) {
  const sentences = normalizePlainText(text)
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const seen = new Set();
  const uniq = [];
  for (const s of sentences) {
    const k = s.toLowerCase();
    if (k.length < 25 || seen.has(k)) continue;
    seen.add(k);
    uniq.push(s);
    if (uniq.length >= maxSentences) break;
  }
  return uniq.join(" ");
}

function inferKeyPoints(text) {
  const lines = summarizeCleanText(text, 10)
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 30);
  return lines.slice(0, 6);
}

function buildFallbackJudgmentSections(docLike) {
  const summary = normalizePlainText(docLike?.full_summary || docLike?.summary || "");
  const points = Array.isArray(docLike?.key_points)
    ? docLike.key_points.map((p) => normalizePlainText(p)).filter(Boolean)
    : [];
  const acts = Array.isArray(docLike?.acts) ? docLike.acts.filter(Boolean) : [];
  const sections = Array.isArray(docLike?.sections) ? docLike.sections.filter(Boolean) : [];
  const citations = Array.isArray(docLike?.citations) ? docLike.citations.filter(Boolean) : [];

  // Group summary into 3 logical parts for fallbacks
  const sentences = summary.split(/(?<=[.!?])\s+/).filter(Boolean);
  const part = (start, end) => sentences.slice(Math.floor(sentences.length * start), Math.floor(sentences.length * end)).join(" ");

  return {
    facts: part(0, 0.25) || points[0] || summary || "Facts extraction in progress.",
    issues: part(0.25, 0.4) || points[1] || "Core legal issues inferred from text.",
    petitioner_arguments: points[2] || "Petitioner arguments discussed in judgment text.",
    respondent_arguments: points[3] || "Respondent arguments discussed in judgment text.",
    analysis_of_law:
      acts.length || sections.length
        ? `Relevant Acts: ${acts.join(", ") || "N/A"}. Sections: ${sections.join(", ") || "N/A"}`
        : part(0.4, 0.7) || "Legal analysis summarized from content.",
    precedent_analysis:
      citations.length > 0
        ? `Citations: ${citations.join(" · ")}`
        : points[4] || "Precedent discussion available in full text.",
    court_reasoning: part(0.7, 0.9) || points.slice(1, 4).join(" ") || summary,
    conclusion: sentences.slice(-3).join(" ") || points[points.length - 1] || summary,
  };
}

function normalizeDocForView(rawDoc, fallbackId) {
  const doc = rawDoc || {};
  const normalizedSummary = normalizePlainText(doc?.summary || "");
  const normalizedFullSummary = normalizePlainText(doc?.full_summary || doc?.summary || "");
  const mergedText = `${normalizedFullSummary} ${normalizedSummary}`.trim();
  const improvedSummary = summarizeCleanText(mergedText, 25) || normalizedSummary || normalizedFullSummary;
  const inferredKeyPoints = inferKeyPoints(mergedText);
  const existingSections =
    doc?.judgment_sections && Object.keys(doc.judgment_sections).length > 0
      ? doc.judgment_sections
      : buildFallbackJudgmentSections({ ...doc, summary: improvedSummary, full_summary: normalizedFullSummary });

  return {
    id: doc?.id || fallbackId || "UNKNOWN-DOC",
    title: doc?.title || "Judicial document",
    parties: doc?.parties || "",
    court: doc?.court || "Unknown Court",
    date: doc?.date || "N/A",
    summary: improvedSummary,
    full_summary: normalizedFullSummary || improvedSummary,
    key_points:
      Array.isArray(doc?.key_points) && doc.key_points.length
        ? doc.key_points.map((x) => normalizePlainText(x)).filter(Boolean)
        : inferredKeyPoints,
    acts: Array.isArray(doc?.acts) ? doc.acts : [],
    sections: Array.isArray(doc?.sections) ? doc.sections : [],
    citations: Array.isArray(doc?.citations) ? doc.citations : [],
    publication_url: doc?.publication_url || "",
    official_source: doc?.official_source || "",
    judgment_sections: existingSections || {},
  };
}

async function enrichFromKanoonIfNeeded(docLike, token) {
  const doc = docLike || {};
  const url = String(doc.publication_url || "");
  const hasUsefulSections = doc?.judgment_sections && Object.keys(doc.judgment_sections || {}).length > 0;
  const summary = String(doc.summary || "");
  const hasWeakSummary =
    !summary ||
    summary.length < 260 ||
    summary.includes("&#x") ||
    summary.toLowerCase().includes("recent judgment");
  if (!url.includes("indiankanoon.org")) return doc;
  if (hasUsefulSections && !hasWeakSummary) return doc;

  try {
    const r = await fetch(`/api/innovation/kanoon/extract?url=${encodeURIComponent(url)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!r.ok) return doc;
    const ext = await r.json();
    return normalizeDocForView(
      {
        ...doc,
        title: ext?.title || doc.title,
        summary: ext?.summary || doc.summary,
        full_summary: ext?.full_summary || doc.full_summary || doc.summary,
        key_points: Array.isArray(ext?.key_points) && ext.key_points.length ? ext.key_points : doc.key_points,
        acts: Array.isArray(ext?.acts) && ext.acts.length ? ext.acts : doc.acts,
        sections: Array.isArray(ext?.sections) && ext.sections.length ? ext.sections : doc.sections,
        citations: Array.isArray(ext?.citations) && ext.citations.length ? ext.citations : doc.citations,
        judgment_sections:
          ext?.judgment_sections && Object.keys(ext.judgment_sections).length
            ? ext.judgment_sections
            : doc.judgment_sections,
        official_source: ext?.official_source || doc.official_source,
      },
      doc.id
    );
  } catch {
    return doc;
  }
}

/* ─── UI Translations for all 22 languages ─── */
const _uiEn = {
  viewerHdr: "Judicial Document Viewer", backBtn: "Back to Dashboard",
  summary: "Summary", keyPoints: "Key Points", legalActs: "Legal Acts", sections: "Key Sections",
  citations: "Citations", publication: "Official Publication", openPub: "Open publication",
  speakBtn: "Speak summary", stopBtn: "Stop speaking", loadingAudio: "Loading audio...",
  fetching: "Fetching Case Details...", back: "Go back", demo: "Use Demo Login",
  selectParts: "Select the following parts of the judgment", getPdf: "Get in PDF",
  showAll: "Show All", clearAll: "Clear All",
  noSections: "Judgment sections not available for this document.", chooseLang: "Choose Language:",
  caseStudy: "Case Study", navigation: "Navigation",
};
const UI_TRANSLATIONS = {
  en: _uiEn,
  hi: { viewerHdr: "न्यायिक दस्तावेज दर्शक", backBtn: "डैशबोर्ड पर वापस जाएं", summary: "सारांश", keyPoints: "मुख्य बिंदु", legalActs: "कानूनी अधिनियम", sections: "मुख्य धाराएं", citations: "उद्धरण", publication: "आधिकारिक प्रकाशन", openPub: "प्रकाशन खोलें", speakBtn: "सारांश बोलें", stopBtn: "बोलना बंद करें", loadingAudio: "ऑडियो लोड हो रहा है...", fetching: "मामले के विवरण प्राप्त किए जा रहे हैं...", back: "वापस जाएं", demo: "डेमो लॉगिन", selectParts: "निर्णय के भागों का चयन करें", getPdf: "PDF में प्राप्त करें", showAll: "सभी दिखाएं", clearAll: "सभी हटाएं", noSections: "निर्णय अनुभाग उपलब्ध नहीं हैं।", chooseLang: "भाषा चुनें:", caseStudy: "केस अध्ययन", navigation: "नेविगेशन" },
  bn: { viewerHdr: "বিচারিক নথি দর্শক", backBtn: "ড্যাশবোর্ডে ফিরুন", summary: "সারসংক্ষেপ", keyPoints: "মূল বিষয়", legalActs: "আইনি অ্যাক্ট", sections: "মূল ধারা", citations: "উদ্ধৃতি", publication: "সরকারি প্রকাশনা", openPub: "প্রকাশনা খুলুন", speakBtn: "সারসংক্ষেপ বলুন", stopBtn: "বলা বন্ধ করুন", loadingAudio: "অডিও লোড হচ্ছে...", fetching: "মামলার বিবরণ আনা হচ্ছে...", back: "ফিরে যান", getPdf: "PDF পান", showAll: "সব দেখান", clearAll: "সব মুছুন", noSections: "এই নথির জন্য বিভাগ উপলব্ধ নেই।", chooseLang: "ভাষা চয়ন:", caseStudy: "কেস স্টাডি", navigation: "নেভিগেশন" },
  te: { viewerHdr: "న్యాయ పత్ర వీక్షకం", backBtn: "డాష్‌బోర్డ్‌కు తిరిగి", summary: "సారాంశం", keyPoints: "కీలక అంశాలు", legalActs: "న్యాయ చట్టాలు", sections: "కీలక సెక్షన్లు", citations: "ఉల్లేఖనలు", speakBtn: "సారాంశం చెప్పండి", stopBtn: "మాట్లాడడం ఆపు", fetching: "కేసు వివరాలు తెస్తోంది...", back: "వెనక్కి", getPdf: "PDF పొందండి", showAll: "అన్నీ చూపించు", clearAll: "అన్నీ తొలగించు", chooseLang: "భాష ఎంచుకోండి:", caseStudy: "కేస్ స్టడీ", navigation: "నావిగేషన్" },
  mr: { viewerHdr: "न्यायिक दस्तऐवज दर्शक", backBtn: "डॅशबोर्डवर परत", summary: "सारांश", keyPoints: "मुख्य मुद्दे", legalActs: "कायदेशीर कायदे", sections: "मुख्य कलम", citations: "उद्धरण", speakBtn: "सारांश बोला", stopBtn: "बोलणे थांबवा", fetching: "प्रकरण तपशील आणत आहे...", back: "परत जा", getPdf: "PDF मिळवा", showAll: "सर्व दर्शवा", clearAll: "सर्व हटवा", chooseLang: "भाषा निवडा:", caseStudy: "केस अभ्यास", navigation: "मार्गदर्शन" },
  ta: { viewerHdr: "நீதித்துறை ஆவண காட்சி", backBtn: "டாஷ்போர்டுக்கு", summary: "சுருக்கம்", keyPoints: "முக்கிய அம்சங்கள்", legalActs: "சட்ட நடவடிக்கைகள்", sections: "முக்கிய பிரிவுகள்", citations: "மேற்கோள்கள்", speakBtn: "சுருக்கம் பேசு", stopBtn: "பேச்சை நிறுத்து", fetching: "வழக்கு விவரங்கள் பெறப்படுகிறது...", back: "பின் செல்", getPdf: "PDF பெறு", showAll: "அனைத்தும் காட்டு", clearAll: "அனைத்தும் அழி", chooseLang: "மொழியைத் தேர்ந்தெடு:", caseStudy: "வழக்கு ஆய்வு", navigation: "வழிசெலுத்தல்" },
  gu: { viewerHdr: "ન્યાયિક દસ્તાવેજ દર્શક", backBtn: "ડેશબોર્ડ પર પાછા", summary: "સારાંશ", keyPoints: "મુખ્ય મુદ્દા", speakBtn: "સારાંશ બોલો", stopBtn: "બોલવાનું બંધ કરો", fetching: "કેસ વિગતો મેળવી રહ્યા છે...", back: "પાછા જાઓ", getPdf: "PDF મેળવો", showAll: "બધું જુઓ", clearAll: "બધું દૂર કરો", chooseLang: "ભાષા પસંદ કરો:", caseStudy: "કેસ અભ્યાસ", navigation: "નેવિગેશન" },
  kn: { viewerHdr: "ನ್ಯಾಯಾಂಗ ಡಾಕ್ಯುಮೆಂಟ್ ವೀವರ್", backBtn: "ಡ್ಯಾಶ್‌ಬೋರ್ಡ್‌ಗೆ ಹಿಂತಿರುಗಿ", summary: "ಸಾರಾಂಶ", keyPoints: "ಪ್ರಮುಖ ಅಂಶಗಳು", speakBtn: "ಸಾರಾಂಶ ಹೇಳಿ", stopBtn: "ಮಾತನಾಡುವುದನ್ನು ನಿಲ್ಲಿಸಿ", fetching: "ಪ್ರಕರಣ ವಿವರ ತರುತ್ತಿದೆ...", back: "ಹಿಂದೆ ಹೋಗಿ", getPdf: "PDF ಪಡೆಯಿರಿ", showAll: "ಎಲ್ಲಾ ತೋರಿಸಿ", clearAll: "ಎಲ್ಲಾ ತೆಗೆಯಿರಿ", chooseLang: "ಭಾಷೆ ಆಯ್ಕೆ:", caseStudy: "ಕೇಸ್ ಸ್ಟಡಿ", navigation: "ನ್ಯಾವಿಗೇಶನ್" },
  ml: { viewerHdr: "ജുഡീഷ്യർ ഡോക്യുമെന്റ് വ്യൂവർ", backBtn: "ഡാഷ്‌ബോർഡിലേക്ക്", summary: "സംഗ്രഹം", keyPoints: "പ്രധാന കാര്യങ്ങൾ", speakBtn: "സംഗ്രഹം സംസാരിക്കുക", stopBtn: "സംസാരം നിർത്തുക", fetching: "കേസ് വിവരങ്ങൾ...", back: "തിരിച്ചു പോകൂ", getPdf: "PDF ലഭിക്കുക", showAll: "എല്ലാം കാണിക്കുക", clearAll: "എല്ലാം മായ്‌ക്കുക", chooseLang: "ഭാഷ തിരഞ്ഞെടുക്കുക:", caseStudy: "കേസ് പഠനം", navigation: "നാവിഗേഷൻ" },
  pa: { viewerHdr: "ਨਿਆਂਇਕ ਦਸਤਾਵੇਜ਼ ਵਿਊਅਰ", backBtn: "ਡੈਸ਼ਬੋਰਡ ਤੇ ਵਾਪਸ", summary: "ਸਾਰ", keyPoints: "ਮੁੱਖ ਨੁਕਤੇ", speakBtn: "ਸਾਰ ਬੋਲੋ", stopBtn: "ਬੋਲਣਾ ਬੰਦ ਕਰੋ", fetching: "ਕੇਸ ਵੇਰਵੇ ਮਿਲ ਰਹੇ ਹਨ...", back: "ਵਾਪਸ ਜਾਓ", getPdf: "PDF ਪ੍ਰਾਪਤ ਕਰੋ", showAll: "ਸਭ ਦਿਖਾਓ", clearAll: "ਸਭ ਹਟਾਓ", chooseLang: "ਭਾਸ਼ਾ ਚੁਣੋ:", caseStudy: "ਕੇਸ ਅਧਿਐਨ", navigation: "ਨੈਵੀਗੇਸ਼ਨ" },
  or: { viewerHdr: "ନ୍ୟାୟିକ ଡକ୍ୟୁମେଣ୍ଟ ଭିୟୁଅର", backBtn: "ଡ୍ୟାସବୋର୍ଡକୁ ଫେରନ୍ତୁ", summary: "ସାରାଂଶ", keyPoints: "ମୁଖ୍ୟ ବିଷୟ", speakBtn: "ସାରାଂଶ କୁହନ୍ତୁ", stopBtn: "କହିବା ବନ୍ଦ କରନ୍ତୁ", fetching: "ମାମଲା ବିବରଣୀ ଆଣୁଛି...", back: "ପଛକୁ ଯାଆନ୍ତୁ", getPdf: "PDF ପାଆନ୍ତୁ", showAll: "ସବୁ ଦେଖନ୍ତୁ", clearAll: "ସବୁ ହଟାନ୍ତୁ", chooseLang: "ଭାଷା ବାଛନ୍ତୁ:", caseStudy: "କେସ ଅଧ୍ୟୟନ", navigation: "ନାବିଗେସନ" },
  as: { viewerHdr: "ন্যায়িক দস্তাবেজ দৰ্শক", backBtn: "ডেচব'ৰ্ডলৈ ঘূৰি যাওক", summary: "সাৰাংশ", speakBtn: "সাৰাংশ কওক", stopBtn: "ক'বলৈ বন্ধ কৰক", fetching: "গোচৰৰ বিৱৰণ আনি আছে...", back: "পুনৰ যাওক", getPdf: "PDF পাওক", showAll: "সকলো দেখুৱাওক", chooseLang: "ভাষা বাছনি কৰক:", caseStudy: "কেচ অধ্যয়ন", navigation: "নেভিগেশ্বন" },
  mai: { backBtn: "डैशबोर्ड पर वापस जाउ", summary: "सारांश", speakBtn: "सारांश बोलू", fetching: "मामला केर विवरण अनल जा रहल अछि...", back: "वापस जाउ", getPdf: "PDF मे लिअ", showAll: "सबटा देखाउ", chooseLang: "भाषा चुनू:", caseStudy: "केस अध्ययन", navigation: "नेविगेशन" },
  sa: { backBtn: "डैशबोर्ड् प्रति", summary: "सारांशम्", speakBtn: "सारांशं वदतु", fetching: "प्रकरणस्य विवरणं आनयति...", back: "पुनः गच्छतु", showAll: "सर्वं दर्शयतु", chooseLang: "भाषां वृणोतु:", caseStudy: "प्रकरण अध्ययनम्", navigation: "दिशानिर्देशः" },
  sd: { backBtn: "ڊيش بورڊ ڏانهن واپس وڃو", summary: "خلاصو", speakBtn: "خلاصو ٻڌايو", fetching: "ڪيس جا تفصيل آڻي پيا آهن...", back: "واپس وڃو", showAll: "سڀ ڏيکاريو", chooseLang: "ٻولي چونيو:", caseStudy: "ڪيس اسٽڊي" },
  ne: { backBtn: "ड्यासबोर्डमा फर्कनुहोस्", summary: "सारांश", speakBtn: "सारांश बोल्नुहोस्", fetching: "मुद्दा विवरण ल्याउँदैछ...", back: "पछाडि जानुहोस्", getPdf: "PDF पाउनुहोस्", showAll: "सबै देखाउनुहोस्", chooseLang: "भाषा छान्नुहोस्:", caseStudy: "केस अध्ययन", navigation: "नेभिगेसन" },
  doi: { viewerHdr: "न्यायिक दस्तावेज दर्शक", backBtn: "डैशबोर्ड पर वापस जाओ", summary: "सारांश", keyPoints: "खास नुक्ते", legalActs: "कानूनी नियम", sections: "मुख्य धाराएं", citations: "उद्धरण", publication: "आधिकारिक प्रकाशन", openPub: "प्रकाशन खोलो", speakBtn: "सारांश बोलो", stopBtn: "बोलना बंद करो", loadingAudio: "ऑडियो लोड होआ करा दा है...", fetching: "मामले दी जानकारी लीती जा करा दी है...", back: "वापस जाओ", selectParts: "निर्णय दे एह हिस्से चुणो", getPdf: "PDF च लओ", showAll: "सभैं दिखाओ", clearAll: "सभ हटाओ", noSections: "एस दस्तावेज लिए निर्णय अनुभाग उपलब्ध नै ने।", chooseLang: "बोली चुणो:", caseStudy: "केस अध्ययन", navigation: "नेविगेशन" },
  kok: { backBtn: "डॅशबोर्डाक परतात", summary: "सारांश", speakBtn: "सारांश सांगात", fetching: "प्रकरण तपशील हाडटा...", back: "परतात", showAll: "सगळें दाखयात", chooseLang: "भाशा वेंचात:", caseStudy: "केस अभ्यास" },
  brx: { backBtn: "डेसबर्डाव थांनाय", summary: "सारांश", speakBtn: "सारांश राव", fetching: "केस जानाय आबगासिनो दं...", back: "थांनाय", showAll: "गासैबो दिन्थि", chooseLang: "रावखौ सायख:", caseStudy: "केस बिजिरनाय" },
  mni: { backBtn: "ডেশবোর্দদা হনবিরক্কদবা", summary: "সংখ্যেপ", speakBtn: "সংখ্যেপ ৱাউ", fetching: "কেসকী তফসিল পুরকপা...", back: "হনবিরক্কউ", showAll: "পুম্নমক উৎপা", chooseLang: "লোলগী খনবা:", caseStudy: "কেস ষ্টদি" },
  ur: { viewerHdr: "عدالتی دستاویز دیکھنے والا", backBtn: "ڈیش بورڈ پر واپس جائیں", summary: "خلاصہ", keyPoints: "اہم نکات", legalActs: "قانونی ایکٹ", sections: "اہم دفعات", citations: "حوالہ جات", publication: "سرکاری اشاعت", openPub: "اشاعت کھولیں", speakBtn: "خلاصہ بولیں", stopBtn: "بولنا بند کریں", loadingAudio: "آڈیو لوڈ ہو رہا ہے...", fetching: "کیس کی تفصیلات لائی جا رہی ہیں...", back: "واپس جائیں", selectParts: "فیصلے کے حصوں کو منتخب کریں", getPdf: "پی ڈی ایف میں حاصل کریں", showAll: "سب دکھائیں", clearAll: "سب ہٹائیں", noSections: "فیصلے کے حصے دستیاب نہیں۔", chooseLang: "زبان منتخب کریں:", caseStudy: "کیس اسٹڈی", navigation: "نیویگیشن" },
  ks: { viewerHdr: "عدالتی دستاویز وچھن وٲل", backBtn: "ڈیش بورڈس پؠٹھ واپس", summary: "خلاصہ", keyPoints: "اہم نکتہٕ", legalActs: "قانونی ایکٹ", sections: "اہم دفعات", citations: "حوالہٕ", speakBtn: "خلاصہ بولیو", stopBtn: "بولن بند کریو", loadingAudio: "آڈیو لوڈ گژھان...", fetching: "کیسچ تفصیلات یوان...", back: "واپس گژھیو", selectParts: "فیصلک حصہٕ منتخب کریو", getPdf: "پی ڈی ایف منز حٲصل کریو", showAll: "سٲری دکھٲویو", clearAll: "سٲری ہٹٲویو", noSections: "حصہٕ دستیاب نہٕ.", chooseLang: "زوان ژارِو:", caseStudy: "کیس اسٹڈی", navigation: "نیویگیشن" },
};

/* ─── Inline Styles ─── */
const cardStyle = {
  background: "linear-gradient(145deg, rgba(255,255,255,0.09) 0%, rgba(255,255,255,0.05) 100%)",
  borderRadius: 18,
  border: "1px solid rgba(255,255,255,0.14)",
  padding: 18,
  marginBottom: 20,
};

const chipBtnStyle = {
  display: "inline-block",
  textDecoration: "none",
  color: "#bfe6ff",
  background: "rgba(61,159,217,0.12)",
  border: "1px solid rgba(61,159,217,0.35)",
  padding: "10px 14px",
  borderRadius: 999,
  fontWeight: 800,
  fontSize: "0.86rem",
  cursor: "pointer",
};

/* ─── Component ─── */
export default function CaseDetails() {
  const [searchParams] = useSearchParams();
  const caseId = searchParams.get("id");
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [doc, setDoc] = useState(null);
  const [speakLang, setSpeakLang] = useState("en");

  const [isSpeaking, setIsSpeaking] = useState(false);
  const isSpeakingRef = useRef(false);
  const [speakingSection, setSpeakingSection] = useState(null);
  const speakingSectionRef = useRef(null);
  const [btnText, setBtnText] = useState("Speak summary");
  const speakCancelFn = useRef(null); // call to abort current playback
  const currentAudioRef = useRef(null); // currently playing HTML5 Audio element

  /* Active view: "case-study" | "all" | section key */
  const [activeView, setActiveView] = useState("case-study");
  const sectionRefs = useRef({});

  useEffect(() => {
    // Stop playback whenever language changes
    if (isSpeakingRef.current) {
      if (speakCancelFn.current) speakCancelFn.current();
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current.src = "";
        currentAudioRef.current = null;
      }
      isSpeakingRef.current = false;
      speakingSectionRef.current = null;
      setIsSpeaking(false);
      setSpeakingSection(null);
    }
    setBtnText(UI_TRANSLATIONS[speakLang]?.speakBtn || UI_TRANSLATIONS.en.speakBtn);
  }, [speakLang]);

  useEffect(() => {
    const token = localStorage.getItem("isi_token");
    if (!token) { navigate("/signup"); return; }
    loadCaseData();
  }, [caseId, speakLang]);

  // Cleanup: stop audio when the component unmounts
  useEffect(() => {
    return () => {
      if (speakCancelFn.current) speakCancelFn.current();
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current.src = "";
      }
    };
  }, []);

/* Language names for display */
  const LANG_NAMES = { en: "English", hi: "हिंदी", bn: "বাংলা", te: "తెలుగు", mr: "मराठी", ta: "தமிழ்", gu: "ગુજરાતી", kn: "ಕನ್ನಡ", ml: "മലയാളം", pa: "ਪੰਜਾਬੀ", or: "ଓଡ଼ିଆ", as: "অসমীয়া", mai: "मैथिली", sa: "संस्कृत", sd: "سندھی", ne: "नेपाली", doi: "डोगरी", kok: "कोंकणी", brx: "बोडो", mni: "মৈতৈলোন্", ur: "اُردُو", ks: "کٲشُر" };
  const [translating, setTranslating] = useState(false);

  const loadCaseData = async () => {
    const lang = speakLang;
    if (!caseId) { setErrorMsg("Error: No case ID provided."); setLoading(false); return; }

    // ── 1. Serve from per-language cache instantly (< 50ms) ──────
    const cacheKey = `isi_case_${caseId}_${lang}`;
    const cachedRaw = sessionStorage.getItem(cacheKey);
    if (cachedRaw) {
      try {
        setDoc(JSON.parse(cachedRaw));
        setErrorMsg("");
        setLoading(false);
        setTranslating(false);
        return;
      } catch { /* corrupt entry — fall through */ }
    }

    // ── 2. Show loading while fetching from backend ───────────────
    if (doc && lang !== "en") setTranslating(true);
    else setLoading(true);
    setErrorMsg("");

    try {
      const token = localStorage.getItem("isi_token");
      const r = await fetch(
        `/api/innovation/judicial/${encodeURIComponent(caseId)}?lang=${encodeURIComponent(lang)}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      if (r.status === 401) {
        localStorage.removeItem("isi_token");
        navigate("/login?msg=Session+expired.+Please+login+again.");
        return;
      }
      const data = await r.json();
      if (data.detail) {
        // Fallback: use cached English if available
        const enCached = sessionStorage.getItem(`isi_case_${caseId}_en`);
        if (enCached) { try { setDoc(JSON.parse(enCached)); setErrorMsg(""); return; } catch {} }
        setErrorMsg(data.detail);
      } else {
        const normalized = normalizeDocForView(data, caseId);
        const enriched = lang === "en"
          ? await enrichFromKanoonIfNeeded(normalized, token || "")
          : normalized;

        // ── 3. Save to per-language cache ─────────────────────────
        try { sessionStorage.setItem(cacheKey, JSON.stringify(enriched)); } catch {}
        setDoc(enriched);

        // ── 4. Background-preload Hindi, Urdu, Bengali after English
        if (lang === "en") {
          ["hi", "ur", "bn"].forEach((bg) => {
            if (sessionStorage.getItem(`isi_case_${caseId}_${bg}`)) return;
            fetch(
              `/api/innovation/judicial/${encodeURIComponent(caseId)}?lang=${encodeURIComponent(bg)}`,
              { headers: token ? { Authorization: `Bearer ${token}` } : {} }
            )
              .then(res => res.ok ? res.json() : null)
              .then(d => {
                if (d && !d.detail) {
                  try {
                    sessionStorage.setItem(
                      `isi_case_${caseId}_${bg}`,
                      JSON.stringify(normalizeDocForView(d, caseId))
                    );
                  } catch {}
                }
              })
              .catch(() => {});
          });
        }
      }
    } catch (err) { setErrorMsg(err.message); }
    finally { setLoading(false); setTranslating(false); }
  };


  /* Scroll to section top */
  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  /* ─── PDF Export ─── */
  const exportPdf = useCallback(() => {
    if (!doc) return;
    const sections = doc.judgment_sections || {};
    const labels = SECTION_LABELS[speakLang] || SECTION_LABELS.en;
    const t = UI_TRANSLATIONS[speakLang] || UI_TRANSLATIONS.en;

    /* Determine which sections to include in the PDF */
    const keysToExport = (activeView !== "all" && activeView !== "case-study")
      ? SECTION_KEYS.filter(k => k === activeView && sections[k])
      : SECTION_KEYS.filter(k => sections[k]);

    let bodyHtml = `
      <div style="font-family:'Segoe UI','DM Sans',Arial,sans-serif; max-width:800px; margin:0 auto; padding:40px 30px; color:#1a1a2e;">
        <div style="text-align:center; border-bottom:3px double #1a1a2e; padding-bottom:20px; margin-bottom:30px;">
          <h1 style="margin:0; font-size:22px; color:#1a1a2e;">${esc(doc.title)}</h1>
          <p style="margin:6px 0 0; font-size:14px; color:#555;">${esc(doc.parties)}</p>
          <p style="margin:4px 0 0; font-size:13px; color:#777;">${esc(doc.court)} · ${esc(doc.date)} · ${esc(doc.id)}</p>
        </div>
    `;

    /* Summary */
    bodyHtml += `
      <div style="margin-bottom:24px;">
        <h2 style="font-size:16px; color:#1a1a2e; border-bottom:1px solid #ddd; padding-bottom:6px;">${esc(t.summary)}</h2>
        <p style="font-size:13px; line-height:1.7; color:#333;">${esc(doc.summary || "")}</p>
      </div>
    `;

    /* Key Points */
    if (doc.key_points && doc.key_points.length > 0) {
      bodyHtml += `<div style="margin-bottom:24px;"><h2 style="font-size:16px; color:#1a1a2e; border-bottom:1px solid #ddd; padding-bottom:6px;">${esc(t.keyPoints)}</h2><ul style="font-size:13px; line-height:1.7; color:#333; padding-left:20px;">`;
      doc.key_points.forEach(kp => { bodyHtml += `<li style="margin-bottom:6px;">${esc(kp)}</li>`; });
      bodyHtml += `</ul></div>`;
    }

    /* Judgment Sections */
    keysToExport.forEach(key => {
      const label = labels[key] || key;
      const text = sections[key];
      bodyHtml += `
        <div style="margin-bottom:24px; border-left:4px solid ${SECTION_BORDER_COLORS[key] || '#3d9fd9'}; padding-left:14px;">
          <h2 style="font-size:16px; color:#1a1a2e; margin:0 0 8px;">${esc(label)}</h2>
          <p style="font-size:13px; line-height:1.7; color:#333; white-space:pre-wrap;">${esc(text)}</p>
        </div>
      `;
    });

    /* Citations */
    if (doc.citations && doc.citations.length > 0) {
      bodyHtml += `<div style="margin-top:30px; border-top:1px solid #ddd; padding-top:14px;"><h2 style="font-size:16px; color:#1a1a2e;">${esc(t.citations)}</h2><p style="font-size:12px; color:#555;">${esc(doc.citations.join(" · "))}</p></div>`;
    }

    bodyHtml += `
      <div style="margin-top:40px; border-top:2px solid #1a1a2e; padding-top:10px; text-align:center; font-size:11px; color:#999;">
        Generated by Bharat Judicial Court Connect · ${new Date().toLocaleDateString("en-IN")}
      </div>
    </div>`;

    const printWindow = window.open("", "_blank");
    if (!printWindow) { alert("Please allow pop-ups to generate PDF."); return; }
    printWindow.document.write(`<!DOCTYPE html><html><head><title>${esc(doc.title)} - Judgment</title><style>@page{margin:20mm 15mm;}body{margin:0;}</style></head><body>${bodyHtml}</body></html>`);
    printWindow.document.close();
    setTimeout(() => { printWindow.print(); }, 400);
  }, [doc, activeView, speakLang]);

  /* ─── TTS: Google Translate voice via backend proxy ─── */
  const toggleSpeak = useCallback((text, sectionId = "summary") => {
    if (!doc) return;

    const t_ui = UI_TRANSLATIONS[speakLang] || UI_TRANSLATIONS.en;

    // Helper: stop any current audio and reset UI state
    const resetState = () => {
      _stopGlobalAudio();          // kill the singleton — no audio can linger
      if (currentAudioRef.current) {
        currentAudioRef.current = null;
      }
      isSpeakingRef.current = false;
      speakingSectionRef.current = null;
      setIsSpeaking(false);
      setSpeakingSection(null);
      setBtnText((UI_TRANSLATIONS[speakLang] || UI_TRANSLATIONS.en).speakBtn || "Speak");
    };

    // ── STOP: same section clicked again ──────────────────────────
    if (isSpeakingRef.current && speakingSectionRef.current === sectionId) {
      if (speakCancelFn.current) speakCancelFn.current();
      resetState();
      return;
    }

    // Stop any other section that might be playing
    if (isSpeakingRef.current) {
      if (speakCancelFn.current) speakCancelFn.current();
      resetState();
    }

    // ── Clean the text ────────────────────────────────────────────
    const ttsText = (text || "")
      .replace(/[#*•▸◆→]/g, "")
      .replace(/<[^>]*>/g, "")
      .replace(/\n+/g, ". ")
      .replace(/\.{2,}/g, ".")
      .replace(/\s+/g, " ")
      .trim();
    if (!ttsText) return;

    const chunks = splitIntoChunks(ttsText, 180);
    if (!chunks.length) return;

    // ── Update UI ─────────────────────────────────────────────────
    isSpeakingRef.current = true;
    speakingSectionRef.current = sectionId;
    setIsSpeaking(true);
    setSpeakingSection(sectionId);
    setBtnText(t_ui.stopBtn || "Stop speaking");

    let idx = 0;
    let cancelled = false;
    speakCancelFn.current = () => { cancelled = true; };

    // ── Sequential Google TTS playback ────────────────────────────
    // Each call to playNext() FIRST kills any existing global audio singleton,
    // then creates a fresh Audio element for the next chunk.
    // This guarantees silence before any new chunk starts — no double audio.
    const playNext = () => {
      _stopGlobalAudio();                      // ALWAYS kill previous audio first

      if (cancelled || idx >= chunks.length) {
        if (!cancelled) resetState();
        return;
      }
      const chunk = chunks[idx++];
      const jwtToken = localStorage.getItem("isi_token") || "";
      const url = (
        `/api/innovation/tts` +
        `?lang=${encodeURIComponent(speakLang)}` +
        `&text=${encodeURIComponent(chunk)}` +
        `&token=${encodeURIComponent(jwtToken)}`
      );

      const audio = new Audio();
      _globalAudio = audio;                    // register as singleton
      currentAudioRef.current = audio;

      audio.onended = () => { if (!cancelled) playNext(); };
      audio.onerror = () => { if (!cancelled) playNext(); };

      audio.src = url;
      audio.play().catch(() => { if (!cancelled) playNext(); });
    };

    playNext();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, speakLang]);

  const t = { ..._uiEn, ...(UI_TRANSLATIONS[speakLang] || {}) };
  const sectionLabels = { ..._secEn, ...(SECTION_LABELS[speakLang] || {}) };
  const judgmentSections = doc?.judgment_sections || {};
  const hasJudgmentSections = Object.keys(judgmentSections).length > 0;


  return (
    <>
      {/* ── Inject body background to match landing page ── */}
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=Space+Grotesk:wght@300;400;500;600&display=swap');
        body {
          background: linear-gradient(to bottom right, #0a0520, #1a1040, #0a0520) !important;
          background-attachment: fixed !important;
          color: #fff;
          font-family: 'Space Grotesk', system-ui, sans-serif;
          min-height: 100vh;
          overflow-x: hidden;
        }
        @keyframes drift {
          0%   { transform: translate(0, 0) scale(1); }
          33%  { transform: translate(30px, -20px) scale(1.05); }
          66%  { transform: translate(-20px, 15px) scale(.95); }
          100% { transform: translate(0, 0) scale(1); }
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(40px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .cd-orb {
          position: fixed;
          border-radius: 50%;
          filter: blur(80px);
          pointer-events: none;
          z-index: 0;
          animation: drift var(--orb-dur) var(--orb-delay) infinite ease-in-out alternate;
        }
        .cd-lang-select {
          padding: 7px 14px;
          border-radius: 10px;
          border: 1px solid rgba(255,255,255,0.2);
          background: rgba(255,255,255,0.08);
          color: #fff;
          font-family: 'Space Grotesk', sans-serif;
          font-size: 0.82rem;
          font-weight: 600;
          cursor: pointer;
          outline: none;
          transition: border-color 0.2s;
          min-width: 140px;
        }
        .cd-lang-select:focus { border-color: rgba(124,58,237,0.6); }
        .cd-lang-select option { background: #1a0a2e; color: #fff; }
        .cd-sidebar-btn {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          padding: 10px 14px;
          border-radius: 10px;
          border: 1px solid rgba(255,255,255,0.08);
          background: transparent;
          color: rgba(255,255,255,0.55);
          cursor: pointer;
          font-size: 0.84rem;
          font-weight: 500;
          text-align: left;
          transition: all 0.2s ease;
          font-family: 'Space Grotesk', sans-serif;
        }
        .cd-sidebar-btn:hover { background: rgba(255,255,255,0.06); color: #fff; }
        .cd-sidebar-btn.active {
          color: #fff;
          font-weight: 700;
        }
        .cd-section-card {
          border-radius: 20px;
          background: linear-gradient(145deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.03) 100%);
          border: 1px solid rgba(255,255,255,0.1);
          padding: 28px 32px;
          margin-bottom: 20px;
          backdrop-filter: blur(12px);
          animation: fadeSlideUp 0.5s ease both;
        }
        .cd-section-title {
          font-family: 'Syne', sans-serif;
          font-size: 1.1rem;
          font-weight: 700;
          margin: 0 0 16px;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .cd-section-dot {
          width: 9px; height: 9px;
          border-radius: 50%;
          display: inline-block;
          flex-shrink: 0;
        }
        .cd-section-body {
          font-size: 0.93rem;
          line-height: 1.85;
          color: rgba(255,255,255,0.75);
          white-space: pre-wrap;
        }
        .cd-speak-btn {
          background: rgba(255,255,255,0.07);
          border: 1px solid rgba(255,255,255,0.15);
          padding: 6px 14px;
          border-radius: 10px;
          color: rgba(255,255,255,0.75);
          cursor: pointer;
          font-size: 0.78rem;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: all 0.2s;
          font-family: 'Space Grotesk', sans-serif;
          white-space: nowrap;
        }
        .cd-speak-btn:hover { background: rgba(255,255,255,0.12); color: #fff; }
        .cd-ctrl-btn {
          flex: 1;
          padding: 8px 10px;
          border-radius: 9px;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.05);
          color: rgba(255,255,255,0.7);
          cursor: pointer;
          font-size: 0.78rem;
          font-weight: 600;
          text-align: center;
          transition: all 0.2s;
          font-family: 'Space Grotesk', sans-serif;
        }
        .cd-ctrl-btn:hover { background: rgba(124,58,237,0.2); border-color: rgba(124,58,237,0.4); color: #c4b5fd; }
        .cd-ctrl-btn.is-all { background: rgba(124,58,237,0.25); border-color: rgba(124,58,237,0.55); color: #c4b5fd; }

        /* ── CaseDetails light-mode overrides ── */
        [data-theme="light"] body {
          background: linear-gradient(to bottom right, #e8f0fe, #dce8f5, #e8f0fe) !important;
          color: #000000;
        }
        [data-theme="light"] .cd-section-card {
          background: linear-gradient(145deg, rgba(255,255,255,.85) 0%, rgba(255,255,255,.65) 100%);
          border-color: rgba(0,0,0,.1);
        }
        [data-theme="light"] .cd-section-title { color: #000000 !important; }
        [data-theme="light"] .cd-section-body { color: #000000 !important; font-weight: 500; }
        [data-theme="light"] .cd-sidebar-btn { border-color: rgba(0,0,0,.1); color: #000000; }
        [data-theme="light"] .cd-sidebar-btn:hover { background: rgba(0,0,0,.05); color: #000000; }
        [data-theme="light"] .cd-sidebar-btn.active { color: #0d1f30; }
        [data-theme="light"] .cd-lang-select { border-color: rgba(0,0,0,.18); background: rgba(255,255,255,.8); color: #0d1f30; }
        [data-theme="light"] .cd-lang-select option { background: #e8f0fe; color: #0d1f30; }
        [data-theme="light"] .cd-speak-btn { background: rgba(0,0,0,.06); border-color: rgba(0,0,0,.14); color: rgba(13,31,48,.7); }
        [data-theme="light"] .cd-speak-btn:hover { background: rgba(0,0,0,.1); color: #0d1f30; }
        [data-theme="light"] .cd-ctrl-btn { border-color: rgba(0,0,0,.12); background: rgba(0,0,0,.04); color: rgba(13,31,48,.65); }
        [data-theme="light"] .cd-ctrl-btn:hover { background: rgba(124,58,237,.1); border-color: rgba(124,58,237,.3); color: #5b21b6; }
        [data-theme="light"] .cd-ctrl-btn.is-all { background: rgba(124,58,237,.15); border-color: rgba(124,58,237,.4); color: #5b21b6; }
      ` }} />

      {/* ── Animated nebula orbs ── */}
      <div className="cd-orb" style={{ width: 600, height: 600, top: "-10%", left: "-10%", background: "radial-gradient(circle, rgba(124,58,237,0.35) 0%, transparent 70%)", "--orb-dur": "18s", "--orb-delay": "0s" }} />
      <div className="cd-orb" style={{ width: 500, height: 500, top: "30%", right: "-8%", background: "radial-gradient(circle, rgba(6,182,212,0.25) 0%, transparent 70%)", "--orb-dur": "22s", "--orb-delay": "-6s" }} />
      <div className="cd-orb" style={{ width: 400, height: 400, bottom: "10%", left: "20%", background: "radial-gradient(circle, rgba(79,70,229,0.3) 0%, transparent 70%)", "--orb-dur": "15s", "--orb-delay": "-3s" }} />

      <div style={{ minHeight: "100vh", position: "relative", zIndex: 1 }}>

        {/* ══ NAVBAR ══ */}
        <nav style={{
          position: "sticky", top: 0, zIndex: 1001,
          background: theme === "light" ? "rgba(255,255,255,0.9)" : "rgba(10,5,32,0.88)",
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          borderBottom: theme === "light" ? "1px solid rgba(0,0,0,0.1)" : "1px solid rgba(255,255,255,0.08)",
          padding: "0 32px",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 58, width: "100%" }}>
            {/* Logo — far left */}
            <a href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", color: theme === "light" ? "#000000" : "#a78bfa", fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: "1.22rem", whiteSpace: "nowrap" }}>
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

            {/* Right controls — far right */}
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <span style={{ fontSize: "0.72rem", fontWeight: 600, color: theme === "light" ? "rgba(13,31,48,0.5)" : "rgba(255,255,255,0.38)", whiteSpace: "nowrap" }}>{t.chooseLang}</span>
                <select value={speakLang} onChange={(e) => setSpeakLang(e.target.value)} className="cd-lang-select">
                  <option value="en">English</option>
                  <option value="hi">हिंदी</option>
                  <option value="bn">বাংলা</option>
                  <option value="te">తెలుగు</option>
                  <option value="mr">मराठी</option>
                  <option value="ta">தமிழ்</option>
                  <option value="gu">ગુજરાતી</option>
                  <option value="kn">ಕನ್ನಡ</option>
                  <option value="ml">മലയാളം</option>
                  <option value="pa">ਪੰਜਾਬੀ</option>
                  <option value="or">ଓଡ଼ିଆ</option>
                  <option value="as">অসমীয়া</option>
                  <option value="mai">मैथिली</option>
                  <option value="sa">संस्कृत</option>
                  <option value="sd">سندھی</option>
                  <option value="ne">नेपाली</option>
                  <option value="doi">डोगरी</option>
                  <option value="kok">कोंकणी</option>
                  <option value="brx">बोडो</option>
                  <option value="mni">মৈতৈলোন্</option>
                  <option value="ur">اُردُو</option>
                  <option value="ks">کٲشُر</option>
                </select>
              </div>
              {doc && (
                <button onClick={exportPdf} style={{ padding: "7px 14px", borderRadius: 10, border: "1px solid rgba(34,197,94,0.4)", background: "rgba(34,197,94,0.1)", color: "#86efac", cursor: "pointer", fontSize: "0.78rem", fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", whiteSpace: "nowrap" }}>
                  📄 {t.getPdf}
                </button>
              )}
              <a href="/" style={{ padding: "7px 18px", borderRadius: 10, border: "1px solid rgba(124,58,237,0.45)", background: "rgba(124,58,237,0.12)", color: "#c4b5fd", textDecoration: "none", fontSize: "0.8rem", fontWeight: 700, whiteSpace: "nowrap" }}>
                ← {t.backBtn}
              </a>
              {/* ── Theme toggle ── */}
              <button
                id="case-theme-toggle"
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

        {/* ══ TRANSLATING OVERLAY ══ */}
        {translating && (
          <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(10,5,32,0.85)", backdropFilter: "blur(8px)" }}>
            <div style={{ textAlign: "center", animation: "fadeSlideUp 0.4s ease" }}>
              <div style={{ fontSize: "3rem", marginBottom: 16, animation: "drift 2s ease-in-out infinite alternate" }}>🌐</div>
              <p style={{ color: "#c4b5fd", fontSize: "1.1rem", fontWeight: 700, fontFamily: "'Syne', sans-serif" }}>
                Translating to {LANG_NAMES[speakLang] || speakLang}...
              </p>
              <p style={{ color: "rgba(255,255,255,0.35)", fontSize: "0.82rem", marginTop: 6 }}>Content is being translated via Bhashini</p>
            </div>
          </div>
        )}

        {/* ══ LOADING ══ */}
        {loading && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "80vh" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "3rem", marginBottom: 16 }}>⚖️</div>
              <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "1rem" }}>{t.fetching}</p>
            </div>
          </div>
        )}

        {/* ══ ERROR ══ */}
        {!loading && errorMsg && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "80vh" }}>
            <div style={{ textAlign: "center", padding: 40 }}>
              <p style={{ color: "#f87171", fontSize: "1.1rem", marginBottom: 16 }}>⚠ {errorMsg}</p>
              <a href="/" style={{ color: "#a78bfa" }}>{t.back}</a>
            </div>
          </div>
        )}

        {/* ══ MAIN CONTENT ══ */}
        {!loading && doc && !errorMsg && (() => {
          const availableKeys = SECTION_KEYS.filter(k => judgmentSections[k]);

          return (
            <div style={{ display: "flex", width: "100%", minHeight: "calc(100vh - 58px)", alignItems: "stretch" }}>

              {/* ── SIDEBAR ── */}
              <aside style={{
                width: 255,
                flexShrink: 0,
                position: "sticky",
                top: 58,
                height: "calc(100vh - 58px)",
                overflowY: "auto",
                borderRight: theme === "light" ? "1px solid rgba(0,0,0,0.1)" : "1px solid rgba(255,255,255,0.07)",
                background: theme === "light" ? "rgba(248,250,252,0.92)" : "rgba(10,5,32,0.65)",
                backdropFilter: "blur(10px)",
                WebkitBackdropFilter: "blur(10px)",
                padding: "22px 14px",
              }}>
                <div style={{ marginBottom: 18 }}>
                  <p style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: theme === "light" ? "#000000" : "rgba(255,255,255,0.28)", marginBottom: 5 }}>{t.navigation || "Navigation"}</p>
                  <p style={{ fontSize: "0.75rem", color: theme === "light" ? "#000000" : "rgba(255,255,255,0.4)", lineHeight: 1.4 }}>{doc.court} · {doc.date}</p>
                </div>

                {/* Show All button */}
                <button
                  onClick={() => setActiveView("all")}
                  className={"cd-ctrl-btn" + (activeView === "all" ? " is-all" : "")}
                  style={{ width: "100%", marginBottom: 12 }}
                >{t.showAll}</button>

                {/* Case Study nav item */}
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <button
                    className={"cd-sidebar-btn" + (activeView === "case-study" ? " active" : "")}
                    onClick={() => setActiveView("case-study")}
                    style={{
                      borderColor: activeView === "case-study" ? "rgba(124,58,237,0.6)" : undefined,
                      background: activeView === "case-study" ? "rgba(124,58,237,0.18)" : undefined,
                      color: activeView === "case-study" ? "#c4b5fd" : undefined,
                      fontWeight: activeView === "case-study" ? 700 : undefined,
                    }}
                  >
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: "rgba(167,139,250,0.9)", display: "inline-block", flexShrink: 0 }} />
                    {t.caseStudy || "Case Study"}
                  </button>

                  {/* Judgment section nav items */}
                  {availableKeys.map(key => {
                    const isActive = activeView === key;
                    return (
                      <button
                        key={key}
                        className={"cd-sidebar-btn" + (isActive ? " active" : "")}
                        onClick={() => {
                          setActiveView(key);
                          setTimeout(() => {
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }, 50);
                        }}
                        style={{
                          borderColor: isActive ? SECTION_BORDER_COLORS[key] : undefined,
                          background: isActive ? SECTION_COLORS[key] : undefined,
                          color: isActive ? "#fff" : undefined,
                          fontWeight: isActive ? 700 : undefined,
                        }}
                      >
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: SECTION_BORDER_COLORS[key], display: "inline-block", flexShrink: 0 }} />
                        {sectionLabels[key] || key}
                      </button>
                    );
                  })}
                </div>
              </aside>

              {/* ── MAIN PANEL ── */}
              <main style={{ flex: 1, minWidth: 0, padding: "32px 44px 60px" }}>

                {/* Case Header */}
                <div style={{ marginBottom: 32, animation: "fadeSlideUp 0.7s ease" }}>
                  <h1 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: "clamp(1.4rem, 2.8vw, 2.3rem)", letterSpacing: "-0.5px", color: theme === "light" ? "#000000" : "#fff", marginBottom: 10, lineHeight: 1.25 }}>
                    {doc.title}
                  </h1>
                  {doc.parties && (
                    <p style={{ fontSize: "0.95rem", color: theme === "light" ? "#000000" : "rgba(255,255,255,0.48)", marginBottom: 5, fontWeight: theme === "light" ? 600 : "normal" }}>{doc.parties}</p>
                  )}
                  <p style={{ fontSize: "0.78rem", color: theme === "light" ? "#000000" : "rgba(255,255,255,0.28)", letterSpacing: "0.04em", fontWeight: theme === "light" ? 600 : "normal" }}>
                    {doc.court} · {doc.date} · {doc.id}
                  </p>
                </div>

                {/* ── CASE STUDY — shown when activeView is "case-study" or "all" ── */}
                {(activeView === "case-study" || activeView === "all") && (
                  <div className="cd-section-card" style={{ borderLeft: "4px solid rgba(124,58,237,0.8)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
                      <h2 className="cd-section-title" style={{ color: "#c4b5fd" }}>
                        <span className="cd-section-dot" style={{ background: "rgba(167,139,250,0.9)" }} />
                        {t.caseStudy || "Case Study"}
                      </h2>
                      <button className="cd-speak-btn" onClick={() => toggleSpeak(doc.full_summary || doc.summary || doc.title, "summary")}>
                        {speakingSection === "summary" ? "🔊" : "🔈"} {speakingSection === "summary" ? btnText : t.speakBtn}
                      </button>
                    </div>
                    <div
                      className="cd-section-body"
                      dangerouslySetInnerHTML={{ __html: renderSummaryHtml(doc.full_summary || doc.summary || "No case study available.") }}
                    />
                  </div>
                )}

                {/* ── JUDGMENT SECTIONS ── */}
                {availableKeys.length > 0 ? (
                  availableKeys.map(key => {
                    // Show only when: "all" mode, or this specific key is selected
                    const shouldShow = activeView === "all" || activeView === key;
                    if (!shouldShow) return null;
                    return (
                      <div
                        key={key}
                        ref={el => { sectionRefs.current[key] = el; }}
                        className="cd-section-card"
                        style={{
                          borderLeft: `4px solid ${SECTION_BORDER_COLORS[key]}`,
                          background: activeView === key ? SECTION_COLORS[key] : undefined,
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
                          <h2 className="cd-section-title" style={{ color: "#fff" }}>
                            <span className="cd-section-dot" style={{ background: SECTION_BORDER_COLORS[key] }} />
                            {sectionLabels[key] || key}
                          </h2>
                          <button className="cd-speak-btn" onClick={() => toggleSpeak(judgmentSections[key], key)}>
                            {speakingSection === key ? "🔊" : "🔈"} {speakingSection === key ? btnText : t.speakBtn}
                          </button>
                        </div>
                        <div className="cd-section-body">{judgmentSections[key]}</div>
                      </div>
                    );
                  })
                ) : (
                  activeView !== "case-study" && (
                    <div style={{ textAlign: "center", padding: "60px 20px", color: theme === "light" ? "rgba(13,31,48,0.4)" : "rgba(255,255,255,0.35)", border: theme === "light" ? "1px dashed rgba(0,0,0,0.15)" : "1px dashed rgba(255,255,255,0.1)", borderRadius: 16 }}>
                      {t.noSections}
                    </div>
                  )
                )}

              </main>
            </div>
          );
        })()}
      </div>
    </>
  );
}
