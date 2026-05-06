/**
 * ResultCard — full-text translation + correct TTS for all 22 Indian languages.
 * White theme version.
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Pressable, Linking, ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import { TTS_LOCALE_MAP, BJCC_LANGUAGES } from '../constants/languages';
import { translateText } from '../constants/translationService';

const BLUE = '#1850B4';

export default function ResultCard({ item, lang = 'en', onOpen, t = {} }) {
  const truncate = (str, max = 240) =>
    str && str.length > max ? str.slice(0, max) + '…' : (str || '');

  const [titleTx,   setTitleTx]   = useState(item.title   || '');
  const [summaryTx, setSummaryTx] = useState(item.summary || '');
  const [courtTx,   setCourtTx]   = useState(item.court   || '');
  const [translating, setTranslating] = useState(false);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    setTitleTx(item.title   || '');
    setSummaryTx(item.summary || '');
    setCourtTx(item.court   || '');
    if (lang === 'en') return;

    let cancelled = false;
    setTranslating(true);

    const run = async () => {
      try {
        const [txTitle, txSummary, txCourt] = await Promise.all([
          translateText(item.title   || '', lang),
          translateText(item.summary || '', lang),
          translateText(item.court   || '', lang),
        ]);
        if (cancelled || !mountedRef.current) return;
        setTitleTx(txTitle);
        setSummaryTx(txSummary);
        setCourtTx(txCourt);
      } catch (_) {
        // silently keep original text
      } finally {
        if (!cancelled && mountedRef.current) setTranslating(false);
      }
    };

    run();
    return () => { cancelled = true; };
  }, [item.title, item.summary, item.court, lang]);

  const handleSpeak = () => {
    Speech.stop();
    const text = `${titleTx}. ${summaryTx}`;
    const locale = TTS_LOCALE_MAP[lang] || 'en-IN';
    Speech.speak(text, { language: locale, rate: 0.85 });
  };

  const handleOriginal = () => {
    if (item.url) Linking.openURL(item.url);
  };

  const isNonEnglish = lang && lang !== 'en';
  const langNative   = BJCC_LANGUAGES.find(l => l.code === lang)?.native || lang;

  return (
    <View style={styles.card}>

      {/* Language + translating badge */}
      {isNonEnglish && (
        <View style={styles.topRow}>
          <View style={styles.langBadge}>
            <Feather name="globe" size={10} color="#2D7DD2" />
            <Text style={styles.langBadgeText}>{langNative}</Text>
          </View>
          {translating && (
            <View style={styles.translatingRow}>
              <ActivityIndicator size={10} color="#AABBD4" />
              <Text style={styles.translatingText}>translating…</Text>
            </View>
          )}
        </View>
      )}

      {/* Title */}
      <Text style={[styles.title, translating && styles.dimText]} numberOfLines={3}>
        {titleTx}
      </Text>

      {/* Meta row */}
      <View style={styles.metaRow}>
        {courtTx ? (
          <View style={styles.metaPill}>
            <Text style={styles.metaText}>{courtTx}</Text>
          </View>
        ) : null}
        {item.date ? (
          <View style={styles.metaPill}>
            <Text style={styles.metaText}>{item.date}</Text>
          </View>
        ) : null}
        {item.doc_id ? (
          <Text style={styles.idText}>#{item.doc_id}</Text>
        ) : null}
      </View>

      {/* Summary */}
      {summaryTx ? (
        <Text style={[styles.summary, translating && styles.dimText]}>
          {truncate(summaryTx)}
        </Text>
      ) : null}

      {/* Actions */}
      <View style={styles.actions}>
        <Pressable style={[styles.actionBtn, styles.actionBtnPrimary]} onPress={() => onOpen && onOpen(item)}>
          <Feather name="external-link" size={14} color="#FFFFFF" />
          <Text style={[styles.actionText, { color: '#FFFFFF' }]}>{t.btnOpen || 'Open'}</Text>
        </Pressable>
        {item.url ? (
          <Pressable style={styles.actionBtn} onPress={handleOriginal}>
            <Feather name="link" size={14} color="#7283A4" />
            <Text style={[styles.actionText, { color: '#7283A4' }]}>{t.btnOriginal || 'Original'}</Text>
          </Pressable>
        ) : null}
        <Pressable style={styles.actionBtn} onPress={handleSpeak}>
          <Feather name="volume-2" size={14} color="#7283A4" />
          <Text style={[styles.actionText, { color: '#7283A4' }]}>{t.btnSpeak || 'Speak'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0EAFC',
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#1850B4',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  langBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF5FF',
    borderWidth: 1,
    borderColor: '#C5D8F8',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  langBadgeText: { color: '#2D7DD2', fontSize: 10, fontWeight: '700' },
  translatingRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  translatingText: { color: '#AABBD4', fontSize: 10, fontStyle: 'italic' },

  title: {
    color: '#0D1B5E',           // ← dark blue, visible on white
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
    marginBottom: 8,
  },
  dimText: { opacity: 0.55 },

  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
    alignItems: 'center',
  },
  metaPill: {
    backgroundColor: '#F3F7FE',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#E0EAFC',
  },
  metaText: { color: '#5B6A8A', fontSize: 11, fontWeight: '500' },
  idText:   { color: '#AABBD4', fontSize: 11 },

  summary: {
    color: '#5B6A8A',           // ← readable grey on white
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 10,
  },

  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E0EAFC',
    backgroundColor: '#F7FAFF',
  },
  actionBtnPrimary: {
    backgroundColor: BLUE,
    borderColor: BLUE,
  },
  actionText: { fontSize: 12, fontWeight: '600' },
});
