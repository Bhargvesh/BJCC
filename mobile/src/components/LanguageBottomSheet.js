/**
 * LanguageBottomSheet — language picker modal.
 * White theme. Calls onSelect(code) which triggers applyLang() in LanguageContext,
 * updating lang state globally across all screens.
 */
import React, { useCallback } from 'react';
import {
  Modal, View, Text, FlatList, Pressable, StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { BJCC_LANGUAGES } from '../constants/languages';

const BLUE = '#1850B4';

export default function LanguageBottomSheet({ visible, onClose, onSelect, selectedLang }) {
  const renderItem = useCallback(({ item }) => {
    const isActive = item.code === selectedLang;
    return (
      <TouchableOpacity
        style={[styles.item, isActive && styles.itemActive]}
        onPress={() => {
          onSelect(item.code);   // ← calls applyLang(code) in LanguageContext
          onClose();             // ← closes the sheet
        }}
        activeOpacity={0.7}
      >
        <Text style={[styles.native, isActive && styles.nativeActive]}>{item.native}</Text>
        <Text style={[styles.label, isActive && styles.labelActive]}>{item.label}</Text>
        {isActive && <Feather name="check" size={16} color={BLUE} style={styles.check} />}
      </TouchableOpacity>
    );
  }, [selectedLang, onSelect, onClose]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          {/* Handle bar */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Select Language</Text>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Feather name="x" size={20} color="#7283A4" />
            </Pressable>
          </View>

          {/* Language list */}
          <FlatList
            data={BJCC_LANGUAGES}
            keyExtractor={i => i.code}
            renderItem={renderItem}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 32 }}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '78%',
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#E0EAFC',
    shadowColor: '#1850B4',
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -4 },
    elevation: 12,
  },
  handle: {
    width: 40, height: 4,
    borderRadius: 999,
    backgroundColor: '#E0EAFC',
    alignSelf: 'center',
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F4FF',
  },
  headerTitle: {
    color: '#0D1B5E',
    fontSize: 16,
    fontWeight: '700',
  },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#F3F7FE',
    alignItems: 'center', justifyContent: 'center',
  },

  /* ── Each language row ── */
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F4FF',
    gap: 10,
  },
  itemActive: {
    backgroundColor: '#EFF5FF',
    borderBottomColor: '#C5D8F8',
  },
  native: {
    color: '#0D1B5E',
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  nativeActive: { color: BLUE },
  label: {
    color: '#7283A4',
    fontSize: 13,
    minWidth: 72,
  },
  labelActive: { color: BLUE, fontWeight: '600' },
  check: { marginLeft: 4 },
});
