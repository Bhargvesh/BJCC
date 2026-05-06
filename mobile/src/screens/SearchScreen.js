/**
 * SearchScreen — Case law search + Bharat Judicial Court tabs.
 * Clean white theme.
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable,
  ActivityIndicator, Alert, Modal, TouchableOpacity,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useLanguage } from '../context/LanguageContext';
import { searchCases, getKanoonFeed } from '../api/judicial';
import ResultCard from '../components/ResultCard';
import LanguageBottomSheet from '../components/LanguageBottomSheet';

const BLUE = '#1850B4';
const COURTS = ['', 'Supreme Court of India', 'High Courts of India', 'Subordinate Courts'];
const EXAMPLE_QUERIES = [
  'Right to privacy Aadhaar',
  'Article 21 life liberty',
  'Jammu Kashmir special status',
  'Fundamental rights habeas corpus',
];

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const { lang, t, setLang } = useLanguage();

  const [tab, setTab] = useState('search');
  const [query, setQuery] = useState('Aadhaar privacy');
  const [court, setCourt] = useState('Supreme Court of India');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [kanoonResults, setKanoonResults] = useState([]);
  const [kanoonLoading, setKanoonLoading] = useState(false);
  const [courtSheetVisible, setCourtSheetVisible] = useState(false);
  const [langSheetVisible, setLangSheetVisible] = useState(false);

  const langRef    = useRef(lang);
  const queryRef   = useRef(query);
  const courtRef   = useRef(court);
  const tabRef     = useRef(tab);
  const resultsLenRef = useRef(0);

  useEffect(() => { langRef.current  = lang;           }, [lang]);
  useEffect(() => { queryRef.current = query;          }, [query]);
  useEffect(() => { courtRef.current = court;          }, [court]);
  useEffect(() => { tabRef.current   = tab;            }, [tab]);
  useEffect(() => { resultsLenRef.current = results.length; }, [results]);

  const doSearch = useCallback(async (q, c, langCode) => {
    const searchQ    = q        ?? queryRef.current;
    const searchC    = c        ?? courtRef.current;
    const searchLang = langCode ?? langRef.current;
    if (!searchQ.trim()) return;
    setLoading(true);
    try {
      const data = await searchCases({ q: searchQ, court: searchC, lang: searchLang, limit: 20 });
      setResults(data?.results || data || []);
    } catch (err) {
      Alert.alert('Search Error', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const doKanoonRefresh = useCallback(async (langCode) => {
    const searchLang = langCode ?? langRef.current;
    setKanoonLoading(true);
    try {
      const data = await getKanoonFeed(searchLang);
      setKanoonResults(data?.results || data || []);
    } catch (err) {
      Alert.alert('Refresh Error', err.message);
    } finally {
      setKanoonLoading(false);
    }
  }, []);

  useEffect(() => {
    doSearch('Aadhaar privacy', 'Supreme Court of India', 'en');
  }, []);

  useEffect(() => {
    if (tab === 'kanoon' && kanoonResults.length === 0) {
      doKanoonRefresh(langRef.current);
    }
  }, [tab]);

  useEffect(() => {
    if (tabRef.current === 'search' && resultsLenRef.current > 0) {
      doSearch(queryRef.current, courtRef.current, lang);
    } else if (tabRef.current === 'kanoon') {
      doKanoonRefresh(lang);
    }
  }, [lang]);

  const handleLoadExamples = () => {
    const q = EXAMPLE_QUERIES[Math.floor(Math.random() * EXAMPLE_QUERIES.length)];
    setQuery(q);
    doSearch(q, courtRef.current, langRef.current);
  };

  const handleOpenCase = (item) => {
    nav.navigate('CaseDetail', { caseId: item.doc_id || item.id, lang, caseItem: item });
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 12 }]}>

      {/* ── Header ── */}
      <View style={styles.topBar}>
        <View style={styles.logoRow}>
          <View style={styles.logoIcon}>
            <Feather name="shield" size={13} color="#FFF" />
          </View>
          <Text style={styles.logoText}>BJCC</Text>
        </View>
        <Pressable style={styles.langBtn} onPress={() => setLangSheetVisible(true)}>
          <Feather name="globe" size={13} color={BLUE} />
          <Text style={styles.langBtnText}>{lang.toUpperCase()}</Text>
          <Feather name="chevron-down" size={12} color={BLUE} />
        </Pressable>
      </View>

      {/* ── Tab switcher ── */}
      <View style={styles.tabRow}>
        {[
          { key: 'search',  label: '🔍  Search' },
          { key: 'kanoon',  label: '📰  Bharat Judicial' },
        ].map(tb => (
          <Pressable
            key={tb.key}
            style={[styles.tabBtn, tab === tb.key && styles.tabBtnActive]}
            onPress={() => setTab(tb.key)}
          >
            <Text style={[styles.tabBtnText, tab === tb.key && styles.tabBtnTextActive]}>
              {tb.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* ── SEARCH TAB ── */}
      {tab === 'search' && (
        <View style={styles.flex}>
          {/* Search input */}
          <View style={styles.inputRow}>
            <Feather name="search" size={16} color="#AABBD4" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={query}
              onChangeText={setQuery}
              placeholder={t.askPlaceholder || 'Search case law…'}
              placeholderTextColor="#C0CEDF"
              returnKeyType="search"
              onSubmitEditing={() => doSearch(query, courtRef.current, langRef.current)}
              autoCapitalize="none"
            />
            {query.length > 0 && (
              <Pressable onPress={() => setQuery('')}>
                <Feather name="x" size={15} color="#AABBD4" />
              </Pressable>
            )}
          </View>

          {/* Court filter */}
          <Pressable style={styles.courtPicker} onPress={() => setCourtSheetVisible(true)}>
            <Feather name="filter" size={14} color="#7283A4" />
            <Text style={styles.courtPickerText}>{court || 'All Courts'}</Text>
            <Feather name="chevron-down" size={13} color="#AABBD4" />
          </Pressable>

          {/* Action buttons */}
          <View style={styles.btnRow}>
            <Pressable
              style={styles.searchBtn}
              onPress={() => doSearch(queryRef.current, courtRef.current, langRef.current)}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#FFF" size="small" />
                : <Text style={styles.searchBtnText}>Search</Text>
              }
            </Pressable>
            <Pressable style={styles.examplesBtn} onPress={handleLoadExamples}>
              <Text style={styles.examplesBtnText}>Examples</Text>
            </Pressable>
          </View>

          {/* Results */}
          {loading ? (
            <ActivityIndicator color={BLUE} style={{ marginTop: 40 }} />
          ) : results.length > 0 ? (
            <FlatList
              data={results}
              keyExtractor={(item, i) => String(item.doc_id || item.id || i)}
              renderItem={({ item }) => (
                <ResultCard item={item} lang={lang} onOpen={handleOpenCase} t={t} />
              )}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 120 }}
            />
          ) : (
            <View style={styles.emptyState}>
              <Feather name="search" size={40} color="#D0DDEF" />
              <Text style={styles.emptyText}>{t.searchTitle || 'Search case law'}</Text>
              <Text style={styles.emptyMuted}>Enter a query above and tap Search</Text>
            </View>
          )}
        </View>
      )}

      {/* ── KANOON TAB ── */}
      {tab === 'kanoon' && (
        <View style={styles.flex}>
          <View style={styles.kanoonHeader}>
            <Text style={styles.kanoonTitle}>{t.kanoonTitle || 'Bharat Judicial Court'}</Text>
            <Pressable onPress={() => doKanoonRefresh(langRef.current)} style={styles.refreshBtn}>
              {kanoonLoading
                ? <ActivityIndicator size="small" color={BLUE} />
                : <>
                    <Feather name="refresh-cw" size={13} color={BLUE} />
                    <Text style={styles.refreshText}>{t.kanoonRefresh || 'Refresh'}</Text>
                  </>
              }
            </Pressable>
          </View>

          {kanoonResults.length === 0 ? (
            <View style={styles.emptyState}>
              <Feather name="file-text" size={40} color="#D0DDEF" />
              <Text style={styles.emptyText}>{t.kanoonEmpty || 'No cases loaded.'}</Text>
              <Pressable style={styles.examplesBtn} onPress={() => doKanoonRefresh(langRef.current)}>
                <Text style={styles.examplesBtnText}>{t.kanoonRefresh || 'Refresh'}</Text>
              </Pressable>
            </View>
          ) : (
            <FlatList
              data={kanoonResults}
              keyExtractor={(item, i) => String(item.doc_id || item.id || i)}
              renderItem={({ item }) => (
                <ResultCard item={item} lang={lang} onOpen={handleOpenCase} t={t} />
              )}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 120 }}
            />
          )}
        </View>
      )}

      {/* ── Court picker modal ── */}
      <Modal visible={courtSheetVisible} animationType="fade" transparent onRequestClose={() => setCourtSheetVisible(false)}>
        <View style={styles.courtOverlay}>
          <TouchableOpacity style={styles.courtBackdrop} onPress={() => setCourtSheetVisible(false)} />
          <View style={styles.courtSheet}>
            <Text style={styles.courtSheetTitle}>Select Court</Text>
            {COURTS.map((c, i) => (
              <Pressable
                key={i}
                style={styles.courtItem}
                onPress={() => {
                  setCourt(c);
                  setCourtSheetVisible(false);
                  doSearch(queryRef.current, c, langRef.current);
                }}
              >
                <Text style={[styles.courtItemText, court === c && styles.courtItemActive]}>
                  {c || 'All Courts'}
                </Text>
                {court === c && <Feather name="check" size={16} color={BLUE} />}
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>

      {/* ── Language bottom sheet ── */}
      <LanguageBottomSheet
        visible={langSheetVisible}
        onClose={() => setLangSheetVisible(false)}
        onSelect={(code) => { setLang(code); setLangSheetVisible(false); }}
        selectedLang={lang}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF', paddingHorizontal: 20 },
  flex: { flex: 1 },

  /* ── Header ── */
  topBar: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 16,
  },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  logoIcon: {
    width: 24, height: 24, borderRadius: 8,
    backgroundColor: BLUE, alignItems: 'center', justifyContent: 'center',
  },
  logoText: { color: BLUE, fontSize: 20, fontWeight: '800' },
  langBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderColor: '#C5D8F8', backgroundColor: '#EFF5FF',
    borderRadius: 999, paddingVertical: 6, paddingHorizontal: 10,
  },
  langBtnText: { color: BLUE, fontSize: 12, fontWeight: '600' },

  /* ── Tabs ── */
  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#F3F7FE',
    borderRadius: 12, padding: 4,
    marginBottom: 16, gap: 4,
  },
  tabBtn: {
    flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: 'center',
  },
  tabBtnActive: { backgroundColor: '#FFFFFF', shadowColor: BLUE, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  tabBtnText: { color: '#7283A4', fontSize: 13, fontWeight: '500' },
  tabBtnTextActive: { color: BLUE, fontWeight: '700' },

  /* ── Search input ── */
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.2, borderColor: '#D5E3F8',
    borderRadius: 32, paddingHorizontal: 16, paddingVertical: 11,
    marginBottom: 10, backgroundColor: '#FAFCFF',
  },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, fontSize: 14, color: '#1A2E6B' },

  /* ── Court picker ── */
  courtPicker: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: '#E0EAFC',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
    marginBottom: 10, backgroundColor: '#FAFCFF',
  },
  courtPickerText: { color: '#5B6A8A', fontSize: 13, flex: 1 },

  /* ── Buttons ── */
  btnRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  searchBtn: {
    flex: 2, backgroundColor: BLUE, borderRadius: 32,
    paddingVertical: 13, alignItems: 'center',
    shadowColor: BLUE, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  searchBtnText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  examplesBtn: {
    flex: 1, borderWidth: 1.5, borderColor: '#C5D8F8',
    borderRadius: 32, paddingVertical: 13, alignItems: 'center',
    backgroundColor: '#EFF5FF',
  },
  examplesBtnText: { color: BLUE, fontWeight: '600', fontSize: 13 },

  /* ── Empty state ── */
  emptyState: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 60,
  },
  emptyText: { color: '#7283A4', fontSize: 15, fontWeight: '600' },
  emptyMuted: { color: '#AABBD4', fontSize: 13, textAlign: 'center' },

  /* ── Kanoon header ── */
  kanoonHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 14,
  },
  kanoonTitle: { color: '#0D1B5E', fontSize: 15, fontWeight: '700' },
  refreshBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: '#C5D8F8', backgroundColor: '#EFF5FF',
    borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6,
  },
  refreshText: { color: BLUE, fontSize: 12, fontWeight: '600' },

  /* ── Court modal ── */
  courtOverlay: { flex: 1, justifyContent: 'center', paddingHorizontal: 32 },
  courtBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)' },
  courtSheet: {
    backgroundColor: '#FFFFFF', borderRadius: 18,
    padding: 20, elevation: 12,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 16,
  },
  courtSheetTitle: {
    color: '#7283A4', fontSize: 11, fontWeight: '700',
    letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 12,
  },
  courtItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#F0F4FF',
  },
  courtItemText: { color: '#1A2E6B', fontSize: 14 },
  courtItemActive: { color: BLUE, fontWeight: '700' },
});
