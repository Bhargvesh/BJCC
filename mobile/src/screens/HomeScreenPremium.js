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
  { label: "English", value: "en" }, { label: "Hindi", value: "hi" },
  { label: "Dogri", value: "doi" }, { label: "Urdu", value: "ur" },
];

const UI_STRINGS = {
  en: { search: "Judicial Data Search", results: "Results", ask: "Ask a legal question…", searchBtn: "Search", assistant: "AI Assistant", quote: "Legal inspiration" },
  hi: { search: "न्यायिक डेटा खोज", results: "परिणाम", ask: "एक कानूनी प्रश्न पूछें…", searchBtn: "खोजें", assistant: "एआई सहायक", quote: "कानूनी प्रेरणा" },
  doi: { search: "न्यायिक डेटा खोज", results: "नतीजे", ask: "कानूनी सुआल पुच्छो…", searchBtn: "खोज्जो", assistant: "एआई सहायक", quote: "कानूनी प्रेरणा" },
  ur: { search: "عدالتی ڈیٹا تلاش", results: "نتائج", ask: "قانونی سوال پوچھیں…", searchBtn: "تلاش کریں", assistant: "اے آئی معاون", quote: "قانونی تحریک" },
  ks: { search: "तथ्य", results: "नतीजा", ask: "सुआल पुच्छो", searchBtn: "खोज्जो", assistant: "सहायक" }
};

export default function HomeScreen({ navigation }) {
  const [q, setQ] = useState("Aadhaar privacy");
  const [court, setCourt] = useState("Supreme Court of India");
  const [lang, setLang] = useState("en");
  const [hits, setHits] = useState([]);
  const [resultsEmpty, setResultsEmpty] = useState(true);
  const [resultsMessage, setResultsMessage] = useState("Run a search to see results.");
  const [searching, setSearching] = useState(false);
  const [userName, setUserName] = useState("Account");

  const [quoteIdx, setQuoteIdx] = useState(0);
  const quoteFade = useRef(new Animated.Value(1)).current;

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
      setResultsMessage(d?.detail ? "Error: " + d.detail : "No results.");
    } catch (err) {
      setHits([]); setResultsEmpty(true); setResultsMessage("Error: " + err.message);
    }
    setSearching(false);
  };

  const speakText = (text) => {
    Speech.stop();
    const langMap = { 
      en: "en-IN", 
      hi: "hi-IN", 
      doi: "hi-IN", 
      ur: "ur-IN", 
      ks: "hi-IN" 
    };
    Speech.speak(text || "No text available.", { language: langMap[lang] || "en-IN", rate: 0.95 });
  };

  const handleLogout = () => {
    Alert.alert("Logged in as", userName, [
      { text: "Cancel", style: "cancel" },
      { text: "Logout", style: "destructive", onPress: async () => { await removeToken(); navigation.replace("Login"); }},
    ]);
  };

  const courtLabel = COURTS.find((c) => c.value === court)?.label || "All courts";
  const langLabel = LANGUAGES.find((l) => l.value === lang)?.label || "English";

  const renderCaseItem = (d) => (
    <View key={d.id} style={styles.caseItem}>
      <Text style={styles.caseTitle}>{d.title}</Text>
      <Text style={styles.caseMeta}>{d.court} · {d.date}</Text>
      <View style={styles.caseActions}>
        <TouchableOpacity style={styles.btnSmall} onPress={() => navigation.navigate("CaseDetails", { caseId: d.id })}>
          <Text style={styles.btnSmallText}>Open</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnSmall} onPress={() => speakText(d.full_summary || d.summary || "")}>
          <Text style={styles.btnSmallText}>🔊 Speak</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg} />

      {/* ─── Premium Header ─── */}
      <View style={styles.header}>
        <View style={{ alignItems: "center" }}>
          <Text style={styles.headerTitle}>Bharat Judicial Court Connect</Text>
          <Text style={styles.headerSub}>MULTILINGUAL LEGAL ACCESS VIA ASR / TRANSLATION / TTS</Text>
          
          <View style={styles.topChipsRow}>
            <TouchableOpacity onPress={handleLogout} style={styles.navPill}><Text style={styles.navPillText}>{userName.toUpperCase()}</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate("Payment")} style={styles.navPill}><Text style={styles.navPillText}>Offline Micropayment</Text></TouchableOpacity>
            <TouchableOpacity style={styles.navPill}><Text style={styles.navPillText}>API docs</Text></TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
        {/* ─── Hero ─── */}
        <View style={styles.heroSection}>
          <Image source={require("../../assets/ashoka-emblem.png")} style={styles.heroEmblem} resizeMode="contain" />
          <Text style={styles.heroQuote}>NYAYA SABKE LIYE, BINA BHEDBHAAV KE.</Text>
        </View>


        <Animated.View style={[styles.quoteStrip, { opacity: quoteFade }]}><Text style={styles.quoteText}>{QUOTES[quoteIdx]}</Text></Animated.View>

        <View style={{ padding: 16 }}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{UI_STRINGS[lang]?.search || "Judicial Search"}</Text>
            <TextInput style={styles.input} value={q} onChangeText={setQ} placeholder="Search..." placeholderTextColor={Colors.textMuted} />
            
            <TouchableOpacity style={styles.picker} onPress={() => setShowCourtPicker(!showCourtPicker)}><Text style={styles.pickerText}>{courtLabel}</Text></TouchableOpacity>
            {showCourtPicker && (
              <View style={styles.pickerDropdown}>
                {COURTS.map(c => (
                  <TouchableOpacity key={c.value} style={styles.pickerOption} onPress={() => { setCourt(c.value); setShowCourtPicker(false); }}><Text style={styles.pickerOptionText}>{c.label}</Text></TouchableOpacity>
                ))}
              </View>
            )}

            <TouchableOpacity style={styles.picker} onPress={() => setShowLangPicker(!showLangPicker)}><Text style={styles.pickerText}>{langLabel}</Text></TouchableOpacity>
            {showLangPicker && (
              <View style={styles.pickerDropdown}>
                {LANGUAGES.map(l => (
                  <TouchableOpacity key={l.value} style={styles.pickerOption} onPress={() => { setLang(l.value); setShowLangPicker(false); }}><Text style={styles.pickerOptionText}>{l.label}</Text></TouchableOpacity>
                ))}
              </View>
            )}

            <TouchableOpacity onPress={doSearch} style={{ marginTop: 16 }}>
              <LinearGradient colors={[Colors.brandStart, Colors.brandMid]} style={styles.btnPrimary}><Text style={styles.btnPrimaryText}>Search</Text></LinearGradient>
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Results</Text>
            {resultsEmpty ? <Text style={styles.cardSub}>{resultsMessage}</Text> : hits.map(d => renderCaseItem(d))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { paddingTop: 60, paddingBottom: 24, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.05)" },
  headerTitle: { color: "#fff", fontSize: 24, fontWeight: "900", textAlign: "center", fontFamily: "serif" },
  headerSub: { color: Colors.brandStart, fontSize: 10, fontWeight: "700", marginTop: 8, textAlign: "center" },
  topChipsRow: { flexDirection: "row", gap: 8, marginTop: 16, justifyContent: "center" },
  navPill: { backgroundColor: "rgba(61,159,217,0.12)", borderWidth: 1, borderColor: "rgba(61,159,217,0.3)", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  navPillText: { color: "#bfe6ff", fontWeight: "800", fontSize: 10 },
  heroSection: { alignItems: "center", paddingVertical: 40 },
  heroEmblem: { height: 110, width: 110, marginBottom: 20 },
  heroQuote: { color: "#fff", fontSize: 20, fontWeight: "900", textAlign: "center", paddingHorizontal: 30 },
  actionRow: { flexDirection: "row", justifyContent: "center", gap: 10, marginBottom: 20 },
  actionPill: { backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", paddingHorizontal: 16, paddingVertical: 12, borderRadius: 10 },
  actionPillText: { color: "#fff", fontWeight: "700" },
  quoteStrip: { paddingVertical: 12, backgroundColor: "rgba(255,255,255,0.03)", marginBottom: 16 },
  quoteText: { color: Colors.brandStart, textAlign: "center" },
  card: { backgroundColor: Colors.bgCard, borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: Colors.bgCardBorder },
  cardTitle: { color: "#fff", fontSize: 18, fontWeight: "800", marginBottom: 12 },
  cardSub: { color: Colors.textMuted },
  input: { backgroundColor: Colors.bgInput, borderWidth: 1, borderColor: Colors.bgInputBorder, borderRadius: 8, color: "#fff", padding: 12 },
  picker: { backgroundColor: Colors.bgInput, borderWidth: 1, borderColor: Colors.bgInputBorder, padding: 12, borderRadius: 8, marginTop: 10 },
  pickerText: { color: "#fff" },
  pickerDropdown: { backgroundColor: "#1a2a44", marginTop: 4, borderRadius: 8, overflow: "hidden" },
  pickerOption: { padding: 12, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.05)" },
  pickerOptionText: { color: "#fff" },
  btnPrimary: { borderRadius: 8, paddingVertical: 14, alignItems: "center" },
  btnPrimaryText: { color: "#fff", fontWeight: "900" },
  caseItem: { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.1)" },
  caseTitle: { color: "#fff", fontSize: 16, fontWeight: "700" },
  caseMeta: { color: Colors.textMuted, fontSize: 12 },
  caseActions: { flexDirection: "row", gap: 10, marginTop: 10 },
  btnSmall: { backgroundColor: "rgba(255,255,255,0.05)", padding: 8, borderRadius: 8 },
  btnSmallText: { color: "#fff" }
});
