import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Dimensions,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useLanguage } from '../context/LanguageContext';
import { BJCC_LANGUAGES } from '../constants/languages';
import LanguageBottomSheet from '../components/LanguageBottomSheet';

const { width } = Dimensions.get('window');
const CARD_GAP = 12;
const CARD_WIDTH = (width - 48 - CARD_GAP) / 2;

export default function LandingScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { lang, setLang, t } = useLanguage();
  const [langSheetVisible, setLangSheetVisible] = useState(false);

  const langObj = BJCC_LANGUAGES.find(item => item.code === lang) || BJCC_LANGUAGES[0];
  const langName = langObj.native || langObj.label;

  // Feature cards using translated strings from context
  const FEATURE_CARDS = [
    {
      key: t.featureTitle1 || 'Multilingual Justice',
      desc: t.featureDesc1 || 'Access judgments in English, Hindi and across 22 languages.',
      icon: 'globe',
    },
    {
      key: t.featureTitle2 || 'Judicial Search',
      desc: t.featureDesc2 || 'Search Supreme Court, High Court and subordinate court cases.',
      icon: 'shield',
    },
    {
      key: t.featureTitle4 || 'Voice First UX',
      desc: t.featureDesc4 || 'Speak your query in your preferred Indian language.',
      icon: 'mic',
    },
    {
      key: t.featureTitle3 || 'Legal Assistant',
      desc: t.featureDesc3 || 'Get plain-language legal help and quick summaries.',
      icon: 'message-circle',
    },
  ];


  return (
    <>
      <ScrollView
        style={styles.root}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 12, paddingBottom: 100 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={styles.logoRow}>
            <View style={styles.logoIcon}>
              <Image 
                source={require('../../assets/ashoka-emblem.png')} 
                style={styles.logoImageSmall} 
                resizeMode="contain" 
              />
            </View>
            <Text style={styles.logoText}>BJCC</Text>
          </View>
          <Pressable style={styles.langButton} onPress={() => setLangSheetVisible(true)}>
            <Feather name="globe" size={12} color="#1850B4" />
            <Text style={styles.langText}>{langName}</Text>
            <Feather name="chevron-down" size={12} color="#1850B4" />
          </Pressable>
        </View>

        {/* ── Hero Box ── */}
        <View style={styles.heroBox}>
          {/* Red notification dot top-right */}
          <View style={styles.notifDot} />

          {/* Powered badge */}
          <View style={styles.poweredBadge}>
            <View style={styles.powerDot} />
            <Text style={styles.poweredText} numberOfLines={1}>
              {t.badgePoweredBy || 'POWERED BY BHASHINI · GOVT OF INDIA'}
            </Text>
          </View>

          {/* Title — single straight line */}
          <Text style={styles.heroTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65}>
            {t.hdrTitle || 'Bharat Judicial Court Connect'}
          </Text>

          {/* Subtitle */}
          <Text style={styles.heroSubtitle}>
            {t.whySub || 'A multilingual legal platform bridging citizens and the Indian judiciary through ASR, translation and voice synthesis.'}
          </Text>

          {/* Balance scale icon (now Ashoka emblem) */}
          <View style={styles.scaleWrap}>
            <Image 
              source={require('../../assets/ashoka-emblem.png')} 
              style={styles.logoImageLarge} 
              resizeMode="contain" 
            />
          </View>

          {/* Search Case Law — full-width CTA button */}
          <Pressable
            style={({ pressed }) => [styles.ctaButton, pressed && styles.ctaButtonPressed]}
            onPress={() => navigation.navigate('SearchTab')}
          >
            <LinearGradient
              colors={['#1850B4', '#2563EB']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.ctaButtonGrad}
            >
              <Text style={styles.ctaButtonText}>
                ⚖  {t.heroCtaSearch || 'Search Case Law'}
              </Text>
              <Feather name="arrow-right" size={16} color="#FFF" />
            </LinearGradient>
          </Pressable>
        </View>

        {/* ── Quote Strip ── */}
        <View style={styles.quoteStrip}>
          <Text style={styles.quoteText}>
            {t.quote4 || 'Law protects dignity, equality, and constitutional rights.'}
          </Text>
        </View>

        {/* ── Why BJCC ── */}
        <Text style={styles.whyLabel}>
          {t.whyLabel || 'WHY BJCC'}
        </Text>
        <Text style={styles.whyTitle}>
          {t.whyTitle || 'Justice, in every Indian language.'}
        </Text>

        {/* ── Feature Cards 2×2 ── */}
        <View style={styles.featureGrid}>
          {FEATURE_CARDS.map(card => (
            <View key={card.key} style={styles.featureCard}>
              <View style={styles.featureIconWrap}>
                <Feather name={card.icon} size={16} color="#1850B4" />
              </View>
              <Text style={styles.featureTitle}>{card.key}</Text>
              <Text style={styles.featureDesc}>{card.desc}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Language bottom sheet */}
      <LanguageBottomSheet
        visible={langSheetVisible}
        onClose={() => setLangSheetVisible(false)}
        onSelect={setLang}
        selectedLang={lang}
      />
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F4F6FB' },
  content: { paddingHorizontal: 20 },

  /* ── Header ── */
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  logoImageSmall: { width: 30, height: 30 },
  logoText: { color: '#1850B4', fontSize: 22, fontWeight: '800', letterSpacing: 0.5 },
  langButton: {
    borderWidth: 1,
    borderColor: '#C5D8F8',
    backgroundColor: '#EFF5FF',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  langText: { color: '#1850B4', fontSize: 12, fontWeight: '600' },

  /* ── Hero Box ── */
  heroBox: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#DDE8FA',
    backgroundColor: '#FFFFFF',
    shadowColor: '#1850B4',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
    position: 'relative',
    overflow: 'hidden',
  },
  notifDot: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E53E3E',
  },
  poweredBadge: {
    alignSelf: 'flex-start',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#C5D8F8',
    backgroundColor: '#F5F9FF',
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '90%',
  },
  powerDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#22C55E' },
  poweredText: { color: '#1850B4', fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },

  heroTitle: {
    color: '#0D1B5E',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 10,
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    color: '#5B6A8A',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 14,
  },

  scaleWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  logoImageLarge: { width: 60, height: 60 },

  /* Search bar inside hero */
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F4F6FB',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#DDE8FA',
    paddingLeft: 14,
    overflow: 'hidden',
    height: 48,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#1A2E6B',
    paddingVertical: 0,
  },
  searchBtn: {
    height: 48,
    width: 48,
    overflow: 'hidden',
  },
  searchBtnGrad: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* ── CTA Button ── */
  ctaButton: {
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 12,
  },
  ctaButtonPressed: {
    opacity: 0.85,
  },
  ctaButtonGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    gap: 8,
    borderRadius: 14,
    shadowColor: '#1850B4',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  ctaButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  /* ── Quote Strip ── */
  quoteStrip: {
    borderLeftWidth: 3,
    borderLeftColor: '#2D7DD2',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 20,
    shadowColor: '#1850B4',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  quoteText: {
    color: '#5B6A8A',
    fontSize: 13,
    fontStyle: 'italic',
    lineHeight: 20,
  },

  /* ── Why BJCC ── */
  whyLabel: {
    color: '#1850B4',
    fontSize: 11,
    letterSpacing: 1.5,
    marginBottom: 6,
    fontWeight: '700',
  },
  whyTitle: {
    color: '#0D1B5E',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 16,
    lineHeight: 28,
  },
  featureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CARD_GAP,
  },
  featureCard: {
    width: CARD_WIDTH,
    borderWidth: 1,
    borderColor: '#E8EFFC',
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    padding: 14,
    shadowColor: '#1850B4',
    shadowOpacity: 0.07,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  featureIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#EFF5FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  featureTitle: {
    color: '#1A2E6B',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 5,
  },
  featureDesc: {
    color: '#7283A4',
    fontSize: 11,
    lineHeight: 16,
  },
});
