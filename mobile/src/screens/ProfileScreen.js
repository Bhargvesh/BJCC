/**
 * ProfileScreen — user info, language selector, logout, app info.
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Alert, TouchableOpacity, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { useNavigation } from '@react-navigation/native';
import { useLanguage } from '../context/LanguageContext';
import LanguageBottomSheet from '../components/LanguageBottomSheet';
import { BJCC_LANGUAGES } from '../constants/languages';

const BLUE = '#1850B4';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const { lang, t, setLang } = useLanguage();
  const [langSheetVisible, setLangSheetVisible] = useState(false);

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await SecureStore.deleteItemAsync('bjcc_token');
            nav.reset({ index: 0, routes: [{ name: 'Login' }] });
          },
        },
      ]
    );
  };

  const currentLangObj = BJCC_LANGUAGES.find(l => l.code === lang) || BJCC_LANGUAGES[0];

  const menuItems = [
    {
      icon: 'globe',
      label: t.profileLanguage || 'Language',
      value: currentLangObj.native + ' — ' + currentLangObj.label,
      onPress: () => setLangSheetVisible(true),
    },
    {
      icon: 'book-open',
      label: 'Browse Judgments',
      value: 'Search case law',
      onPress: () => nav.navigate('SearchTab'),
    },
    {
      icon: 'server',
      label: 'Server Config',
      value: 'Change when switching networks',
      onPress: () => nav.navigate('ServerConfig'),
    },
  ];

  return (
    <>
      <ScrollView
        style={styles.root}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 20, paddingBottom: 120 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Profile Hero ── */}
        <View style={styles.heroSection}>
          <View style={styles.avatarRing}>
            <View style={styles.avatar}>
              <Image 
                source={require('../../assets/ashoka-emblem.png')} 
                style={styles.avatarImage} 
                resizeMode="contain" 
              />
            </View>
          </View>
          <Text style={styles.name}>{t.profileGuest || 'Guest User'}</Text>
          <Text style={styles.sub}>BJCC — Bharat Judicial Court Connect</Text>
        </View>

        {/* ── Language Card ── */}
        <View style={styles.sectionLabel}>
          <Text style={styles.sectionLabelText}>LANGUAGE</Text>
        </View>
        <TouchableOpacity style={styles.langCard} onPress={() => setLangSheetVisible(true)} activeOpacity={0.8}>
          <View style={styles.langIconWrap}>
            <Feather name="globe" size={18} color={BLUE} />
          </View>
          <View style={styles.langTextWrap}>
            <Text style={styles.langNative}>{currentLangObj.native}</Text>
            <Text style={styles.langLabel}>{currentLangObj.label}</Text>
          </View>
          <Feather name="chevron-right" size={18} color="#AABBD4" />
        </TouchableOpacity>

        {/* ── Menu ── */}
        <View style={styles.sectionLabel}>
          <Text style={styles.sectionLabelText}>MENU</Text>
        </View>
        <View style={styles.menuCard}>
          {menuItems.map((item, i) => (
            <React.Fragment key={i}>
              <TouchableOpacity style={styles.menuItem} onPress={item.onPress} activeOpacity={0.7}>
                <View style={styles.menuIconWrap}>
                  <Feather name={item.icon} size={18} color={BLUE} />
                </View>
                <View style={styles.menuTextWrap}>
                  <Text style={styles.menuLabel}>{item.label}</Text>
                  {item.value ? <Text style={styles.menuValue}>{item.value}</Text> : null}
                </View>
                <Feather name="chevron-right" size={16} color="#AABBD4" />
              </TouchableOpacity>
              {i < menuItems.length - 1 && <View style={styles.divider} />}
            </React.Fragment>
          ))}
        </View>

        {/* ── Sign Out ── */}
        <View style={styles.sectionLabel}>
          <Text style={styles.sectionLabelText}>ACCOUNT</Text>
        </View>
        <TouchableOpacity style={[styles.menuCard, { paddingVertical: 4 }]} onPress={handleLogout} activeOpacity={0.7}>
          <View style={styles.menuItem}>
            <View style={[styles.menuIconWrap, { backgroundColor: '#FFF0F3' }]}>
              <Feather name="log-out" size={18} color="#E53E3E" />
            </View>
            <Text style={[styles.menuLabel, { color: '#E53E3E', flex: 1 }]}>
              {t.profileLogout || 'Sign Out'}
            </Text>
          </View>
        </TouchableOpacity>

        {/* ── Version ── */}
        <Text style={styles.version}>BJCC v1.0 — Powered by Bhashini · Govt of India</Text>
      </ScrollView>

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
  root: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { paddingHorizontal: 20 },

  /* ── Hero ── */
  heroSection: {
    alignItems: 'center',
    paddingVertical: 24,
    marginBottom: 8,
  },
  avatarRing: {
    width: 90, height: 90, borderRadius: 45,
    borderWidth: 3, borderColor: '#D0E3FF',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
    backgroundColor: '#EFF5FF',
  },
  avatar: {
    width: 74, height: 74, borderRadius: 37,
    backgroundColor: 'transparent',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarImage: { width: 50, height: 50 },
  name: { color: '#0D1B5E', fontSize: 20, fontWeight: '700', marginBottom: 4 },
  sub: { color: '#7283A4', fontSize: 12, textAlign: 'center' },

  /* ── Section label ── */
  sectionLabel: { marginBottom: 8, marginTop: 16 },
  sectionLabelText: {
    color: '#7283A4', fontSize: 11, fontWeight: '700', letterSpacing: 0.8,
  },

  /* ── Language card ── */
  langCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1, borderColor: '#E0EAFC', borderRadius: 16,
    paddingHorizontal: 16, paddingVertical: 14,
    marginBottom: 4,
    shadowColor: BLUE, shadowOpacity: 0.05, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  langIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#EFF5FF', alignItems: 'center', justifyContent: 'center',
    marginRight: 12,
  },
  langTextWrap: { flex: 1 },
  langNative: { color: '#0D1B5E', fontSize: 15, fontWeight: '600' },
  langLabel: { color: '#7283A4', fontSize: 12, marginTop: 1 },

  /* ── Menu card ── */
  menuCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1, borderColor: '#E0EAFC', borderRadius: 16,
    paddingHorizontal: 16,
    shadowColor: BLUE, shadowOpacity: 0.05, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
    marginBottom: 4,
  },
  menuItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, gap: 12,
  },
  menuIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#EFF5FF', alignItems: 'center', justifyContent: 'center',
  },
  menuTextWrap: { flex: 1 },
  menuLabel: { color: '#1A2E6B', fontSize: 14, fontWeight: '500' },
  menuValue: { color: '#7283A4', fontSize: 12, marginTop: 2 },
  divider: { height: 1, backgroundColor: '#F0F4FF', marginLeft: 48 },

  version: {
    color: '#AABBD4', fontSize: 11, textAlign: 'center', marginTop: 24,
  },
});
