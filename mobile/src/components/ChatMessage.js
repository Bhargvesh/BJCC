/**
 * ChatMessage — user/bot message bubble with speaker label.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Radius, Spacing } from '../theme';

export default function ChatMessage({ message, t = {} }) {
  const isUser = message.role === 'user';
  const label = isUser
    ? (t.whoYou || 'You')
    : (t.whoAssistant || 'AI Assistant');
  const labelColor = isUser ? Colors.userMsgColor : Colors.botMsgColor;
  const bgColor = isUser
    ? 'rgba(124,58,237,0.12)'
    : 'rgba(6,182,212,0.08)';
  const borderColor = isUser
    ? 'rgba(124,58,237,0.25)'
    : 'rgba(6,182,212,0.15)';

  return (
    <View style={[
      styles.bubble,
      { backgroundColor: bgColor, borderColor },
      isUser ? styles.userBubble : styles.botBubble,
    ]}>
      <Text style={[styles.whoLabel, { color: labelColor }]}>{label}</Text>
      <Text style={styles.text}>{message.text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing.sm + 4,
    marginBottom: Spacing.sm,
    maxWidth: '85%',
  },
  userBubble: { alignSelf: 'flex-end' },
  botBubble:  { alignSelf: 'flex-start' },
  whoLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  text: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
});
