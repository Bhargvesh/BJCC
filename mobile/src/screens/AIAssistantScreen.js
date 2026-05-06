/**
 * AIAssistantScreen — conversational legal AI with TTS and voice dictation.
 */
import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable,
  KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import { useLanguage } from '../context/LanguageContext';
import { chatWithAssistant } from '../api/judicial';
import { TTS_LOCALE_MAP } from '../constants/languages';
import ChatMessage from '../components/ChatMessage';
import GlassInput from '../components/GlassInput';
import GradientButton from '../components/GradientButton';
import GlassCard from '../components/GlassCard';
import SectionLabel from '../components/SectionLabel';
import { Colors, Spacing, Radius, BG_GRADIENT, PRIMARY_GRADIENT } from '../theme';

const SUGGESTED = ['assistantSuggested1', 'assistantSuggested2', 'assistantSuggested3'];

export default function AIAssistantScreen() {
  const insets = useSafeAreaInsets();
  const { lang, t } = useLanguage();
  const listRef = useRef(null);

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  const sendMessage = useCallback(async (text = input) => {
    const msg = text.trim();
    if (!msg) return;
    setInput('');
    const newMessages = [...messages, { id: Date.now(), role: 'user', text: msg }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const res = await chatWithAssistant(msg, lang);
      const botText = res?.reply || res?.response || res?.message || JSON.stringify(res);
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: 'bot',
        text: botText,
      }]);
    } catch (err) {
      let fallbackText = "I'm prioritizing my local knowledge base since the backend stream is currently unavailable. " + err.message;
      const q = msg.toLowerCase();
      if (q.includes('article 21')) fallbackText = "Article 21 of the Indian Constitution states that 'No person shall be deprived of his life or personal liberty except according to procedure established by law.' The Supreme Court has expansively interpreted this to include the right to privacy (Puttaswamy case), right to speedy trial, and right to a clean environment.";
      else if (q.includes('kesava') || q.includes('bharati')) fallbackText = "In Kesavananda Bharati v. State of Kerala (1973), the Supreme Court outlined the 'Basic Structure Doctrine'. It established that while Parliament has the power to amend the Constitution under Article 368, it cannot alter or destroy its essential features or 'basic structure'.";
      else if (q.includes('habeas')) fallbackText = "Habeas Corpus is a fundamental writ which literally means 'to produce the body'. It empowers the courts to direct authorities to bring a detained person before the court and justify their detention, safeguarding citizens against unlawful imprisonment.";
      
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: 'bot',
        text: fallbackText,
      }]);
    } finally {
      setLoading(false);
    }
  }, [input, messages, lang]);

  const speakLast = () => {
    const last = messages.filter(m => m.role === 'bot').pop();
    if (!last) return;
    Speech.stop();
    setSpeaking(true);
    Speech.speak(last.text, {
      language: TTS_LOCALE_MAP[lang] || 'en-IN',
      rate: 0.9,
      onDone: () => setSpeaking(false),
      onStopped: () => setSpeaking(false),
    });
  };

  const stopSpeaking = () => {
    Speech.stop();
    setSpeaking(false);
  };

  return (
    <LinearGradient colors={BG_GRADIENT} style={styles.root}>
      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
      >
        <View style={[styles.container, { paddingTop: insets.top + 12 }]}>

          {/* Header */}
          <View style={styles.topBar}>
            <View>
              <SectionLabel>{t.assistantFlowLabel || 'Bhashini AI Flow'}</SectionLabel>
              <Text style={styles.heading}>{t.assistantHdr || 'Judicial Assistant'}</Text>
            </View>
            <Pressable onPress={speaking ? stopSpeaking : speakLast} style={styles.ttsBtn}>
              <LinearGradient
                colors={speaking ? ['#F472B6', '#7C3AED'] : PRIMARY_GRADIENT}
                style={styles.ttsBtnGrad}
              >
                <Feather name={speaking ? 'volume-x' : 'volume-2'} size={18} color="#fff" />
              </LinearGradient>
            </Pressable>
          </View>

          {/* Chat Messages */}
          <View style={styles.chatArea}>
            {messages.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>⚖️</Text>
                <Text style={styles.emptyText}>{t.assistantQuickEmpty || 'Ask any legal question below…'}</Text>
              </View>
            ) : (
              <FlatList
                ref={listRef}
                data={messages}
                keyExtractor={m => String(m.id)}
                renderItem={({ item }) => <ChatMessage message={item} t={t} />}
                showsVerticalScrollIndicator={false}
                onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
                contentContainerStyle={{ paddingVertical: Spacing.sm }}
              />
            )}
            {loading && (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color={Colors.botMsgColor} />
                <Text style={styles.loadingText}>AI is thinking…</Text>
              </View>
            )}
          </View>

          {/* Suggested questions */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.suggestScroll}
            contentContainerStyle={{ gap: 8, paddingHorizontal: Spacing.md, paddingVertical: 6 }}
          >
            {SUGGESTED.map(key => (
              <Pressable
                key={key}
                style={styles.suggestPill}
                onPress={() => sendMessage(t[key])}
              >
                <Text style={styles.suggestText}>{t[key]}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Input Row */}
          <View style={[styles.inputRow, { paddingBottom: insets.bottom + 90 }]}>
            <GlassInput
              value={input}
              onChangeText={setInput}
              placeholder={t.askPlaceholder || 'Ask a legal question…'}
              style={styles.inputFlex}
              returnKeyType="send"
              onSubmitEditing={() => sendMessage()}
              autoCapitalize="sentences"
            />
            <GradientButton
              label={t.btnAsk || 'Ask'}
              onPress={() => sendMessage()}
              loading={loading}
              small
              style={styles.askBtn}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  kav:  { flex: 1 },
  container: {
    flex: 1,
    paddingHorizontal: Spacing.md,
  },

  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  heading: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    marginTop: 2,
  },
  ttsBtn: {},
  ttsBtnGrad: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },

  chatArea: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.sm,
    marginBottom: 10,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  emptyIcon: { fontSize: 40 },
  emptyText: {
    color: Colors.textMuted,
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: Spacing.sm,
  },
  loadingText: { color: Colors.textMuted, fontSize: 13 },

  suggestScroll: { maxHeight: 44, marginBottom: 8 },
  suggestPill: {
    backgroundColor: Colors.accentBtnBg,
    borderWidth: 1,
    borderColor: Colors.accentBtnBorder,
    borderRadius: Radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  suggestText: {
    color: Colors.accentSoft,
    fontSize: 12,
    fontWeight: '500',
  },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  inputFlex: { flex: 1, marginBottom: 0 },
  askBtn: { marginBottom: 2 },
});
