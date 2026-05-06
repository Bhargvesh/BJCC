import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  StatusBar,
  Alert,
  Animated,
  Dimensions,
  Image,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Speech from "expo-speech";
import { Colors, Spacing, Radius } from "../theme";
import { apiGet, apiPost, getUser, removeToken } from "../api/client";
import { TTS_LOCALE_MAP } from "../constants/languages";
import { translateText } from "../constants/translationService";

const QUOTES = [
  "Satyameva Jayate — Truth alone triumphs.",
  "Justice must be accessible in every language.",
  "Nyaya sabke liye, bina bhedbhaav ke.",
  "Law protects dignity, equality, and constitutional rights.",
  "Samvidhan is the guiding light of governance.",
];

const COURTS = [
  { label: "All courts", value: "" },
  { label: "Supreme Court of India", value: "Supreme Court of India" },
  { label: "High Courts of India", value: "High Courts of India" },
  { label: "Subordinate Courts", value: "Subordinate Courts (Lower Courts)" },
];

const LANGUAGES = [
  { label: "English", value: "en" },
  { label: "Hindi", value: "hi" },
  { label: "Dogri", value: "doi" },

  { label: "Urdu", value: "ur" },
];

const UI_STRINGS = {
  en: { search: "Judicial Data Search", results: "Results", ask: "Ask a legal question…", searchBtn: "Search", assistant: "AI Assistant", quote: "Legal inspiration" },
  hi: { search: "न्यायिक डेटा खोज", results: "परिणाम", ask: "एक कानूनी प्रश्न पूछें…", searchBtn: "खोजें", assistant: "एआई सहायक", quote: "कानूनी प्रेरणा" },
  doi: { search: "न्यायिक डेटा खोज", results: "नतीजे", ask: "कानूनी सुआल पुच्छो…", searchBtn: "खोज्जो", assistant: "एआई सहायक", quote: "कानूनी प्रेरणा" },
  ks: { search: "न्यायिक डेटा तलाश", results: "नतीजे", ask: "कानूनी पुच्छो…", searchBtn: "तलाश", assistant: "एआई सहायक", quote: "कानूनी प्रेरणा" },
  ur: { search: "عدالتی ڈیٹا تلاش", results: "نتائج", ask: "قانونی سوال پوچھیں…", searchBtn: "تلاش کریں", assistant: "اے آئی معاون", quote: "قانونی تحریک" }
};

/** Inline card that asynchronously translates its content */
function TranslatableCard({ item, preview, lang, onOpen, onSpeak }) {
  const [title,   setTitle]   = React.useState(item.title   || '');
  const [summary, setSummary] = React.useState(preview      || '');
  const mountedRef = React.useRef(true);

  React.useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  React.useEffect(() => {
    setTitle(item.title || '');
    setSummary(preview   || '');
    if (!lang || lang === 'en') return;
    let cancelled = false;
    Promise.all([
      translateText(item.title || '', lang),
      translateText(preview    || '', lang),
    ]).then(([txTitle, txPreview]) => {
      if (cancelled || !mountedRef.current) return;
      setTitle(txTitle   || item.title || '');
      setSummary(txPreview || preview   || '');
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [item.title, preview, lang]);

  return (
    <View style={cardStyle.caseItem}>
      <Text style={cardStyle.caseTitle}>{title}</Text>
      <Text style={cardStyle.caseMeta}>{item.court} · {item.date}</Text>
      <Text style={cardStyle.casePreview}>{summary}</Text>
      <View style={cardStyle.caseActions}>
        <TouchableOpacity style={cardStyle.btnSmall} onPress={onOpen}>
          <Text style={cardStyle.btnSmallText}>Open</Text>
        </TouchableOpacity>
        <TouchableOpacity style={cardStyle.btnSmall} onPress={onSpeak}>
          <Text style={cardStyle.btnSmallText}>🔊 Speak</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const cardStyle = StyleSheet.create({
  caseItem:    { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
  caseTitle:   { color: '#fff',                 fontSize: 16, fontWeight: '700', marginBottom: 4 },
  caseMeta:    { color: 'rgba(255,255,255,0.45)', fontSize: 12, marginBottom: 8 },
  casePreview: { color: '#fff',                 fontSize: 14, lineHeight: 20 },
  caseActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  btnSmall:    { backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  btnSmallText:{ color: '#fff', fontSize: 12, fontWeight: '600' },
});



export default function HomeScreen({ navigation }) {
  const [q, setQ] = useState("Aadhaar privacy");
  const [court, setCourt] = useState("Supreme Court of India");
  const [lang, setLang] = useState("en");
  const [hits, setHits] = useState([]);
  const [resultsEmpty, setResultsEmpty] = useState(true);
  const [resultsMessage, setResultsMessage] = useState("Run a search to see results.");
  const [searching, setSearching] = useState(false);
  const [userName, setUserName] = useState("Account");

  // Quote rotation
  const [quoteIdx, setQuoteIdx] = useState(0);
  const quoteFade = useRef(new Animated.Value(1)).current;

  // State for show/hide pickers
  const [showCourtPicker, setShowCourtPicker] = useState(false);
  const [showLangPicker, setShowLangPicker] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const me = await apiGet("/api/innovation/auth/me");
        if (me?._authError) { navigation.replace("Login"); return; }
        const who = me?.user?.name || me?.user?.email;
        if (who) setUserName(who);
      } catch { /* ignore */ }
    })();
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      Animated.timing(quoteFade, { toValue: 0, duration: 500, useNativeDriver: true }).start(() => {
        setQuoteIdx((prev) => (prev + 1) % QUOTES.length);
        Animated.timing(quoteFade, { toValue: 1, duration: 500, useNativeDriver: true }).start();
      });
    }, 5000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (q && (hits.length > 0 || resultsEmpty)) { doSearch(); }
  }, [lang]);

  const doSearch = async () => {
    setSearching(true);
    try {
      const url = `/api/innovation/judicial/search?q=${encodeURIComponent(q)}&court=${encodeURIComponent(court)}&lang=${encodeURIComponent(lang)}&limit=20`;
      const d = await apiGet(url);
      if (d?._authError) { navigation.replace("Login"); return; }
      const list = d.results || [];
      setHits(list);
      setResultsEmpty(list.length === 0);
      setResultsMessage(d?.detail ? "Error: " + d.detail : "No results. Try different keywords.");
    } catch (err) {
      setHits([]); setResultsEmpty(true); setResultsMessage("Request failed: " + err.message);
    }
    setSearching(false);
  };

  const speakText = (text) => {
    Speech.stop();
    const locale = TTS_LOCALE_MAP[lang] || 'en-IN';
    Speech.speak(text || 'No text available.', { language: locale, rate: 0.9 });
  };

  const handleLogout = () => {
    Alert.alert("Logged in as", userName, [
      { text: "Cancel", style: "cancel" },
      { text: "Logout", style: "destructive", onPress: async () => { await removeToken(); navigation.replace("Login"); }},
    ]);
  };

  const courtLabel = COURTS.find((c) => c.value === court)?.label || "All courts";
  const langLabel = LANGUAGES.find((l) => l.value === lang)?.label || "English";

  const renderCaseItem = (d) => {
    const preview = String(d.summary || d.full_summary || '').replace(/\s+/g, ' ').trim();
    const shortPreview = preview ? `${preview.slice(0, 140)}${preview.length > 140 ? '…' : ''}` : 'Tap Open to view details.';
    return (
      <TranslatableCard
        key={d.id}
        item={d}
        preview={shortPreview}
        lang={lang}
        onOpen={() => navigation.navigate('CaseDetail', { caseId: d.id || d.doc_id, lang, caseItem: d })}
        onSpeak={() => speakText(d.full_summary || d.summary || d.title || '')}
      />
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg} />

      {/* ─── Premium Header Section ─── */}
      <View style={styles.header}>
        <View style={{ alignItems: "center", width: "100%" }}>
          <Text style={styles.headerTitle}>Bharat Judicial Court Connect</Text>
          <Text style={styles.headerSub}>MULTILINGUAL LEGAL ACCESS VIA ASR / TRANSLATION / TTS</Text>
          
          <View style={styles.topChipsRow}>
            <TouchableOpacity onPress={handleLogout} style={styles.navPill}>
              <Text style={styles.navPillText}>{userName.toUpperCase()}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate("Payment")} style={styles.navPill}>
              <Text style={styles.navPillText}>Offline Micropayment</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView style={styles.scrollView} keyboardShouldPersistTaps="handled">
        {/* ─── Hero Section ─── */}
        <View style={styles.heroSection}>
          <Image source={require("../assets/ashoka-emblem.png")} style={styles.heroEmblem} resizeMode="contain" />
          <Text style={styles.heroQuote}>NYAYA SABKE LIYE, BINA BHEDBHAAV KE.</Text>
        </View>

        {/* ─── Main Actions ─── */}
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.actionPill}><Text style={styles.actionPillText}>Browse Laws</Text></TouchableOpacity>
          <TouchableOpacity style={styles.actionPill}><Text style={styles.actionPillText}>Browse Judgments</Text></TouchableOpacity>
          <TouchableOpacity style={styles.actionPill} onPress={doSearch}><Text style={styles.actionPillText}>Refresh Feed</Text></TouchableOpacity>
        </View>

        <Animated.View style={[styles.quoteStrip, { opacity: quoteFade }]}>
          <Text style={styles.quoteText}>{QUOTES[quoteIdx]}</Text>
        </Animated.View>

        <View style={styles.mainContent}>
          {/* Search Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{UI_STRINGS[lang]?.search || "Judicial Search"}</Text>
            <Text style={styles.label}>Search query</Text>
            <TextInput style={styles.input} value={q} onChangeText={setQ} placeholder="e.g. RTI answer sheets" placeholderTextColor={Colors.textMuted} />

            <Text style={styles.label}>Court filter</Text>
            <TouchableOpacity style={styles.picker} onPress={() => setShowCourtPicker(!showCourtPicker)}>
              <Text style={styles.pickerText}>{courtLabel}</Text><Text style={styles.pickerArrow}>▾</Text>
            </TouchableOpacity>
            {showCourtPicker && (
              <View style={styles.pickerDropdown}>
                {COURTS.map((c) => (
                  <TouchableOpacity key={c.value} style={[styles.pickerOption, court === c.value && styles.pickerOptionActive]} onPress={() => { setCourt(c.value); setShowCourtPicker(false); }}>
                    <Text style={styles.pickerOptionText}>{c.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <Text style={styles.label}>Language</Text>
            <TouchableOpacity style={styles.picker} onPress={() => setShowLangPicker(!showLangPicker)}>
              <Text style={styles.pickerText}>{langLabel}</Text><Text style={styles.pickerArrow}>▾</Text>
            </TouchableOpacity>
            {showLangPicker && (
              <View style={styles.pickerDropdown}>
                {LANGUAGES.map((l) => (
                  <TouchableOpacity key={l.value} style={[styles.pickerOption, lang === l.value && styles.pickerOptionActive]} onPress={() => { setLang(l.value); setShowLangPicker(false); }}>
                    <Text style={styles.pickerOptionText}>{l.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <TouchableOpacity onPress={doSearch} activeOpacity={0.8} style={{ marginTop: 16 }}>
              <LinearGradient colors={[Colors.brandStart, Colors.brandMid]} style={styles.btnPrimary}>
                <Text style={styles.btnPrimaryText}>{searching ? "..." : (UI_STRINGS[lang]?.searchBtn || "Search")}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Results Area */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Results</Text>
            {resultsEmpty ? (
              <Text style={styles.cardSub}>{resultsMessage}</Text>
            ) : (
              hits.map((d) => renderCaseItem(d))
            )}
          </View>
        </View>
        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    paddingTop: 56, paddingBottom: 20,
    backgroundColor: "rgba(10, 25, 47, 0.95)",
    borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.05)",
  },
  headerTitle: {
    color: "#fff", fontSize: 24, fontWeight: "800",
    fontFamily: "serif", textAlign: "center",
  },
  headerSub: {
    color: Colors.brandStart, fontSize: 10, fontWeight: "700",
    marginTop: 6, textAlign: "center", letterSpacing: 0.5,
  },
  topChipsRow: {
    flexDirection: "row", gap: 8, marginTop: 16,
    flexWrap: "wrap", justifyContent: "center",
  },
  navPill: {
    backgroundColor: "rgba(61,159,217,0.12)",
    borderWidth: 1, borderColor: "rgba(61,159,217,0.3)",
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20,
  },
  navPillText: {
    color: "#bfe6ff", fontWeight: "800", fontSize: 10,
  },
  scrollView: { flex: 1 },
  heroSection: { alignItems: "center", paddingVertical: 40 },
  heroEmblem: { height: 80, width: 80, marginBottom: 20, tintColor: "#eaf4ff" },
  heroQuote: {
    color: "#fff", fontSize: 19, fontWeight: "900",
    textAlign: "center", letterSpacing: 1, paddingHorizontal: 30,
  },
  actionRow: {
    flexDirection: "row", justifyContent: "center", gap: 10,
    marginBottom: 20, flexWrap: "wrap", paddingHorizontal: 16,
  },
  actionPill: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: 16, paddingVertical: 12, borderRadius: 10,
  },
  actionPillText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  quoteStrip: { paddingVertical: 12, backgroundColor: "rgba(255,255,255,0.03)", marginBottom: 16 },
  quoteText: { color: Colors.brandStart, fontSize: 12, fontStyle: "italic", textAlign: "center" },
  mainContent: { paddingHorizontal: 16 },
  card: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.md,
    padding: 16, marginBottom: 16, borderWidth: 1, borderColor: Colors.bgCardBorder,
  },
  cardTitle: { color: Colors.text, fontSize: 18, fontWeight: "800", marginBottom: 12 },
  cardSub: { color: Colors.textMuted, fontSize: 14 },
  label: { color: Colors.textMuted, fontSize: 12, marginBottom: 6, marginTop: 12, textTransform: "uppercase" },
  input: {
    backgroundColor: Colors.bgInput, borderWidth: 1, borderColor: Colors.bgInputBorder,
    borderRadius: Radius.sm, color: Colors.text, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15,
  },
  picker: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    backgroundColor: Colors.bgInput, borderWidth: 1, borderColor: Colors.bgInputBorder,
    paddingHorizontal: 12, paddingVertical: 10, borderRadius: Radius.sm,
  },
  pickerText: { color: Colors.text, fontSize: 15 },
  pickerArrow: { color: Colors.textMuted, fontSize: 16 },
  pickerDropdown: {
    backgroundColor: "#1a2a44", marginTop: 4, borderRadius: Radius.sm,
    borderWidth: 1, borderColor: Colors.bgCardBorder, overflow: "hidden", zIndex: 10,
  },
  pickerOption: { padding: 12, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.05)" },
  pickerOptionActive: { backgroundColor: "rgba(61,159,217,0.2)" },
  pickerOptionText: { color: Colors.text, fontSize: 14 },
  btnPrimary: { borderRadius: Radius.sm, paddingVertical: 14, alignItems: "center" },
  btnPrimaryText: { color: "#fff", fontWeight: "900", fontSize: 16 },
  caseItem: { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.1)" },
  caseTitle: { color: Colors.text, fontSize: 16, fontWeight: "700", marginBottom: 4 },
  caseMeta: { color: Colors.textMuted, fontSize: 12, marginBottom: 8 },
  casePreview: { color: Colors.text, fontSize: 14, lineHeight: 20 },
  caseActions: { flexDirection: "row", gap: 10, marginTop: 12 },
  btnSmall: {
    backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.sm,
  },
  btnSmallText: { color: Colors.text, fontSize: 12, fontWeight: "600" },
});
