/**
 * CaseDetailsScreen — full case viewer with horizontal section pills,
 * section cards, colored left borders, TTS per section,
 * and translating overlay modal.
 * Theme: Judicial White/Blue (matches LandingScreen)
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator,
  Dimensions, Animated, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useLanguage } from '../context/LanguageContext';
import { getCaseDetail } from '../api/judicial';
import { BJCC_LANGUAGES } from '../constants/languages';
import { translateText } from '../constants/translationService';
import { speakText, stopSpeaking } from '../api/ttsService';
import LanguageBottomSheet from '../components/LanguageBottomSheet';
import { Spacing, Radius } from '../theme';

const { width: W } = Dimensions.get('window');

// ── Section configuration ──────────────────────────────────────────
const SECTION_LABELS = {
  case_study:            'Case Study',
  facts:                 'Facts',
  issues:                'Issues',
  petitioner_arguments:  'Petitioner Arguments',
  respondent_arguments:  'Respondent Arguments',
  analysis_of_law:       'Analysis of Law',
  precedent_analysis:    'Precedents',
  court_reasoning:       'Court Reasoning',
  conclusion:            'Conclusion',
};

// Light backgrounds + vivid left-border for each section
const SECTION_BG = {
  case_study:           '#EFF5FF',
  facts:                '#EFF6FF',
  issues:               '#F5F3FF',
  petitioner_arguments: '#FDF2F8',
  respondent_arguments: '#FFFBEB',
  analysis_of_law:      '#ECFDF5',
  precedent_analysis:   '#EEF2FF',
  court_reasoning:      '#F0F9FF',
  conclusion:           '#F0FDF4',
};

const SECTION_BORDER = {
  case_study:           '#1850B4',
  facts:                '#3B82F6',
  issues:               '#8B5CF6',
  petitioner_arguments: '#EC4899',
  respondent_arguments: '#F59E0B',
  analysis_of_law:      '#10B981',
  precedent_analysis:   '#6366F1',
  court_reasoning:      '#0EA5E9',
  conclusion:           '#22C55E',
};

// ── Section Card Component ─────────────────────────────────────────
function SectionCard({ sectionKey, content, lang }) {
  const borderColor   = SECTION_BORDER[sectionKey] || '#1850B4';
  const bgColor       = SECTION_BG[sectionKey]     || '#F7FAFF';
  const label         = SECTION_LABELS[sectionKey] || sectionKey;
  const langObj       = BJCC_LANGUAGES.find(l => l.code === lang);
  const isRtl         = langObj?.rtl || false;
  const [speaking,    setSpeaking]    = useState(false);
  const [displayText, setDisplayText] = useState(content || '');
  const [translating, setTranslating] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    setDisplayText(content || '');
    if (!lang || lang === 'en' || !content) return;
    let cancelled = false;
    setTranslating(true);
    translateText(content, lang)
      .then(translated => {
        if (cancelled || !mountedRef.current) return;
        setDisplayText(translated || content);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled && mountedRef.current) setTranslating(false);
      });
    return () => { cancelled = true; };
  }, [content, lang]);

  const handleSpeak = async () => {
    if (speaking) {
      await stopSpeaking();
      setSpeaking(false);
      return;
    }
    setSpeaking(true);
    await speakText(displayText, lang, {
      onDone:    () => setSpeaking(false),
      onStopped: () => setSpeaking(false),
    });
  };

  return (
    <View style={[styles.sectionCard, { borderLeftColor: borderColor, backgroundColor: bgColor }]}>
      <View style={styles.sectionHeader}>
        <View style={[styles.sectionDot, { backgroundColor: borderColor }]} />
        <Text style={[styles.sectionTitle, { color: borderColor }]}>{label}</Text>
        {translating && (
          <ActivityIndicator size={12} color={borderColor} style={{ marginRight: 6 }} />
        )}
        <Pressable onPress={handleSpeak} style={styles.speakBtn}>
          <View style={[
            styles.speakBtnInner,
            { borderColor: speaking ? borderColor : '#DDE8FA' },
            speaking && { backgroundColor: `${borderColor}18` },
          ]}>
            <Feather
              name={speaking ? 'volume-x' : 'volume-2'}
              size={14}
              color={speaking ? borderColor : '#7283A4'}
            />
          </View>
        </Pressable>
      </View>
      <Text 
        style={[
          styles.sectionBody, 
          translating && { opacity: 0.5 },
          isRtl ? { writingDirection: 'rtl' } : { writingDirection: 'ltr' }
        ]}
        textBreakStrategy="highQuality"
      >
        {displayText}
      </Text>
    </View>
  );
}

// ── Helper Functions ───────────────────────────────────────────────
function normalizePlainText(value) {
  return String(value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function summarizeCleanText(text, maxSentences = 8) {
  const sentences = normalizePlainText(text).split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean);
  const seen = new Set();
  const uniq = [];
  for (const s of sentences) {
    const k = s.toLowerCase();
    if (k.length < 25 || seen.has(k)) continue;
    seen.add(k);
    uniq.push(s);
    if (uniq.length >= maxSentences) break;
  }
  return uniq.join(' ');
}

function inferKeyPoints(text) {
  const lines = summarizeCleanText(text, 10).split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(s => s.length > 30);
  return lines.slice(0, 6);
}

function buildFallbackJudgmentSections(docLike) {
  const summary   = normalizePlainText(docLike?.full_summary || docLike?.summary || '');
  const points    = Array.isArray(docLike?.key_points) ? docLike.key_points.map(p => normalizePlainText(p)).filter(Boolean) : [];
  const acts      = Array.isArray(docLike?.acts)       ? docLike.acts.filter(Boolean)      : [];
  const sections  = Array.isArray(docLike?.sections)   ? docLike.sections.filter(Boolean)  : [];
  const citations = Array.isArray(docLike?.citations)  ? docLike.citations.filter(Boolean) : [];
  const sentences = summary.split(/(?<=[.!?])\s+/).filter(Boolean);
  const part = (start, end) =>
    sentences.slice(Math.floor(sentences.length * start), Math.floor(sentences.length * end)).join(' ');

  return {
    case_study:            summary || 'Case study not available.',
    facts:                 part(0, 0.25) || points[0] || summary || 'Facts extraction in progress.',
    issues:                part(0.25, 0.4) || points[1] || 'Core legal issues inferred from text.',
    petitioner_arguments:  points[2] || 'Petitioner arguments discussed in judgment text.',
    respondent_arguments:  points[3] || 'Respondent arguments discussed in judgment text.',
    analysis_of_law:       acts.length || sections.length
      ? `Relevant Acts: ${acts.join(', ') || 'N/A'}. Sections: ${sections.join(', ') || 'N/A'}`
      : part(0.4, 0.7) || 'Legal analysis summarized from content.',
    precedent_analysis:    citations.length > 0
      ? `Citations: ${citations.join(' · ')}`
      : points[4] || 'Precedent discussion available in full text.',
    court_reasoning:       part(0.7, 0.9) || points.slice(1, 4).join(' ') || summary,
    conclusion:            sentences.slice(-3).join(' ') || points[points.length - 1] || summary,
  };
}

function normalizeDocForView(rawDoc, fallbackId) {
  const doc = rawDoc || {};
  const normalizedSummary     = normalizePlainText(doc?.summary || '');
  const normalizedFullSummary = normalizePlainText(doc?.full_summary || doc?.summary || '');
  const mergedText            = `${normalizedFullSummary} ${normalizedSummary}`.trim();
  const improvedSummary       = summarizeCleanText(mergedText, 25) || normalizedSummary || normalizedFullSummary;
  const inferredKeyPoints     = inferKeyPoints(mergedText);
  const existingSections      = doc?.judgment_sections && Object.keys(doc.judgment_sections).length > 0
    ? doc.judgment_sections
    : buildFallbackJudgmentSections({ ...doc, summary: improvedSummary, full_summary: normalizedFullSummary });

  return {
    id:               doc?.id || fallbackId || 'UNKNOWN-DOC',
    title:            doc?.title || 'Judicial document',
    parties:          doc?.parties || '',
    court:            doc?.court || 'Unknown Court',
    date:             doc?.date || 'N/A',
    summary:          improvedSummary,
    full_summary:     normalizedFullSummary || improvedSummary,
    key_points:       Array.isArray(doc?.key_points) && doc.key_points.length
      ? doc.key_points.map(x => normalizePlainText(x)).filter(Boolean)
      : inferredKeyPoints,
    acts:             Array.isArray(doc?.acts)      ? doc.acts      : [],
    sections:         Array.isArray(doc?.sections)  ? doc.sections  : [],
    citations:        Array.isArray(doc?.citations) ? doc.citations : [],
    publication_url:  doc?.publication_url  || '',
    official_source:  doc?.official_source  || '',
    judgment_sections: existingSections || {},
  };
}

// ── Main Screen ────────────────────────────────────────────────────
export default function CaseDetailsScreen() {
  const insets = useSafeAreaInsets();
  const route  = useRoute();
  const nav    = useNavigation();
  const { lang: globalLang, t, setLang } = useLanguage();

  const { caseId, caseItem } = route.params || {};
  const [caseData,  setCaseData]  = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [lang,      setLocalLang] = useState(globalLang);
  const [translating, setTranslating] = useState(false);
  const [activePill,  setActivePill]  = useState('case_study');
  const [langSheetVisible, setLangSheetVisible] = useState(false);

  const translateOverlayOpacity = useRef(new Animated.Value(0)).current;

  const loadCase = async (langCode) => {
    setLoading(true);
    try {
      const data = await getCaseDetail(caseId, langCode);
      if (data && data.detail) throw new Error(data.detail);
      setCaseData(normalizeDocForView(data, caseId));
    } catch (err) {
      if (caseItem) {
        setCaseData(normalizeDocForView(caseItem, caseId));
      } else {
        setCaseData({ title: 'Case not found', error: err.message, judgment_sections: {} });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (caseId) loadCase(lang);
  }, [caseId]);

  const handleChangeLang = async (code) => {
    setLocalLang(code);
    setTranslating(true);
    Animated.timing(translateOverlayOpacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    await loadCase(code);
    Animated.timing(translateOverlayOpacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
      setTranslating(false);
    });
  };

  const getSections = () => {
    if (!caseData) return ['case_study'];
    const sections = ['case_study'];
    if (caseData.judgment_sections) {
      sections.push(...Object.keys(SECTION_LABELS).filter(k => k !== 'case_study' && caseData.judgment_sections[k]));
    }
    return sections;
  };

  const getSectionContent = (k) => {
    if (k === 'case_study') return caseData?.summary || caseData?.full_summary || 'Case study content not available.';
    if (!caseData?.judgment_sections) return '';
    return typeof caseData.judgment_sections[k] === 'string'
      ? caseData.judgment_sections[k]
      : JSON.stringify(caseData.judgment_sections[k]);
  };

  const filteredSections = () => {
    const secs = getSections();
    if (activePill === 'all') return secs;
    return secs.filter(k => k === activePill);
  };

  const pillOptions = ['all', ...getSections()];
  const langLabel   = BJCC_LANGUAGES.find(l => l.code === lang)?.native || lang;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Pressable onPress={() => nav.goBack()} style={styles.backBtn}>
            <Feather name="arrow-left" size={20} color="#1850B4" />
            <Text style={styles.backText}>{t.backBtn || 'Back'}</Text>
          </Pressable>
        </View>

        <View style={styles.logoRow}>
          <Image 
            source={require('../../assets/ashoka-emblem.png')} 
            style={styles.logoImageSmall} 
            resizeMode="contain" 
          />
        </View>

        <View style={styles.headerRight}>
          <Pressable style={styles.langBtn} onPress={() => setLangSheetVisible(true)}>
            <Feather name="globe" size={13} color="#1850B4" />
            <Text style={styles.langBtnText}>{langLabel}</Text>
            <Feather name="chevron-down" size={12} color="#1850B4" />
          </Pressable>
        </View>
      </View>

      {/* ── Loading ── */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1850B4" />
          <Text style={styles.loadingText}>Loading case…</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
          stickyHeaderIndices={[1]}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Case Title Card ── */}
          <View style={styles.caseHeader}>
            <View style={styles.courtBadge}>
              <Feather name="briefcase" size={11} color="#1850B4" />
              <Text style={styles.courtBadgeText}>{caseData?.court}</Text>
            </View>
            <Text style={styles.caseTitleText} selectable>
              {caseData?.title || `Case #${caseId}`}
            </Text>
            {caseData?.parties ? (
              <Text style={styles.caseParties} selectable>{caseData.parties}</Text>
            ) : null}
            <View style={styles.caseMetaRow}>
              <Feather name="calendar" size={12} color="#7283A4" />
              <Text style={styles.caseMeta}>{caseData?.date}</Text>
              <Text style={styles.caseMetaSep}>·</Text>
              <Text style={styles.caseMeta}>{caseData?.id || caseId}</Text>
            </View>
          </View>

          {/* ── Sticky Section Pills ── */}
          <View style={styles.pillsContainer}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.pillsScroll}
            >
              <Pressable
                style={[styles.pill, activePill === 'all' && styles.pillActive]}
                onPress={() => setActivePill('all')}
              >
                <Text style={[styles.pillText, activePill === 'all' && styles.pillTextActive]}>
                  All
                </Text>
              </Pressable>
              {getSections().map(k => (
                <Pressable
                  key={k}
                  style={[
                    styles.pill,
                    activePill === k && styles.pillActive,
                    activePill === k && { borderColor: SECTION_BORDER[k], backgroundColor: `${SECTION_BORDER[k]}14` },
                  ]}
                  onPress={() => setActivePill(k)}
                >
                  <Text style={[
                    styles.pillText,
                    activePill === k && { color: SECTION_BORDER[k], fontWeight: '700' },
                  ]}>
                    {SECTION_LABELS[k]}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          {/* ── Section Cards ── */}
          {filteredSections().length === 0 ? (
            <View style={styles.emptyState}>
              <Feather name="file-text" size={40} color="#C5D8F8" />
              <Text style={styles.emptyText}>{t.noSections || 'No sections available.'}</Text>
            </View>
          ) : (
            filteredSections().map(k => (
              <SectionCard
                key={k}
                sectionKey={k}
                content={getSectionContent(k)}
                lang={lang}
              />
            ))
          )}
        </ScrollView>
      )}

      {/* ── Translating Overlay ── */}
      {translating && (
        <Animated.View style={[styles.transOverlay, { opacity: translateOverlayOpacity }]}>
          <Text style={styles.transGlobe}>🌐</Text>
          <Text style={styles.transText}>
            {t.translatingTo || 'Translating to'} {langLabel}…
          </Text>
          <ActivityIndicator color="#1850B4" style={{ marginTop: 12 }} />
        </Animated.View>
      )}

      <LanguageBottomSheet
        visible={langSheetVisible}
        onClose={() => setLangSheetVisible(false)}
        onSelect={handleChangeLang}
        selectedLang={lang}
      />
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F4F6FB' },

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2EAF8',
    backgroundColor: '#FFFFFF',
    zIndex: 10,
  },
  headerLeft: { flex: 1, alignItems: 'flex-start' },
  headerRight: { flex: 1, alignItems: 'flex-end' },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  backText: { color: '#1850B4', fontSize: 14, fontWeight: '600' },
  logoRow: { alignItems: 'center', justifyContent: 'center' },
  logoImageSmall: { width: 34, height: 34 },
  langBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#EFF5FF',
    borderWidth: 1, borderColor: '#C5D8F8',
    borderRadius: 999,
    paddingVertical: 6, paddingHorizontal: 10,
  },
  langBtnText: { color: '#1850B4', fontSize: 11, fontWeight: '600' },

  /* Loading */
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: '#5B6A8A', fontSize: 14 },

  /* Scroll */
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 4 },

  /* Case Header */
  caseHeader: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginTop: 14,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#DDE8FA',
    shadowColor: '#1850B4',
    shadowOpacity: 0.07,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  courtBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    alignSelf: 'flex-start',
    backgroundColor: '#EFF5FF',
    borderWidth: 1, borderColor: '#C5D8F8',
    borderRadius: 999,
    paddingVertical: 4, paddingHorizontal: 10,
    marginBottom: 10,
  },
  courtBadgeText: { color: '#1850B4', fontSize: 10, fontWeight: '700', letterSpacing: 0.4 },
  caseTitleText: {
    color: '#0D1B5E',
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 26,
    marginBottom: 8,
  },
  caseParties: {
    color: '#5B6A8A',
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 8,
  },
  caseMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  caseMeta: { color: '#7283A4', fontSize: 12 },
  caseMetaSep: { color: '#C5D8F8', fontSize: 12 },

  /* Pills */
  pillsContainer: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2EAF8',
    marginTop: 10,
  },
  pillsScroll: { paddingHorizontal: 16, gap: 8 },
  pill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#DDE8FA',
    backgroundColor: '#F4F6FB',
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  pillActive: {
    backgroundColor: '#EFF5FF',
    borderColor: '#1850B4',
  },
  pillText: { color: '#7283A4', fontSize: 12, fontWeight: '500' },
  pillTextActive: { color: '#1850B4', fontWeight: '700' },

  /* Section Cards */
  sectionCard: {
    borderLeftWidth: 4,
    borderRadius: 14,
    padding: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#E8EFFC',
    shadowColor: '#1850B4',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center',
    gap: 8, marginBottom: 10,
  },
  sectionDot: { width: 7, height: 7, borderRadius: 4 },
  sectionTitle: {
    fontSize: 11, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 1,
    flex: 1,
  },
  speakBtn: {},
  speakBtnInner: {
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#DDE8FA',
    backgroundColor: '#FFFFFF',
  },
  sectionBody: {
    color: '#374151',
    fontSize: 14,
    lineHeight: 24,
    textAlign: 'justify',
    flex: 1,
    width: '100%',
  },

  /* Empty */
  emptyState: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  emptyText: { color: '#7283A4', fontSize: 14 },

  /* Translate overlay */
  transOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(244,246,251,0.95)',
    alignItems: 'center', justifyContent: 'center',
    gap: 12, zIndex: 99,
  },
  transGlobe: { fontSize: 48 },
  transText: { color: '#1850B4', fontSize: 16, textAlign: 'center', fontWeight: '600' },
});
