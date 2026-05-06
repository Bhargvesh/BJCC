/**
 * GlassInput — styled TextInput, white theme.
 */
import React, { useRef } from 'react';
import { TextInput, View, StyleSheet, Animated, Text } from 'react-native';

const BLUE = '#1850B4';

export default function GlassInput({
  value, onChangeText, placeholder, style,
  label, multiline = false, numberOfLines,
  onFocus: onFocusProp, onBlur: onBlurProp,
  returnKeyType, onSubmitEditing, autoCapitalize = 'sentences',
  keyboardType = 'default', secureTextEntry = false,
  editable = true,
}) {
  const borderColorAnim = useRef(new Animated.Value(0)).current;

  const onFocus = () => {
    Animated.timing(borderColorAnim, {
      toValue: 1, duration: 200, useNativeDriver: false,
    }).start();
    onFocusProp?.();
  };

  const onBlur = () => {
    Animated.timing(borderColorAnim, {
      toValue: 0, duration: 200, useNativeDriver: false,
    }).start();
    onBlurProp?.();
  };

  const borderColor = borderColorAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#D5E3F8', BLUE],
  });

  return (
    <View style={[styles.wrapper, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Animated.View style={[styles.container, { borderColor }]}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#C0CEDF"
          style={[styles.input, multiline && { minHeight: numberOfLines ? numberOfLines * 22 : 80 }]}
          onFocus={onFocus}
          onBlur={onBlur}
          multiline={multiline}
          numberOfLines={numberOfLines}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          autoCapitalize={autoCapitalize}
          keyboardType={keyboardType}
          secureTextEntry={secureTextEntry}
          editable={editable}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: 8 },
  label: {
    color: '#7283A4',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  container: {
    backgroundColor: '#FAFCFF',
    borderWidth: 1.2,
    borderRadius: 32,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  input: {
    color: '#1A2E6B',      // ← dark blue text visible on white
    fontSize: 14,
    fontWeight: '400',
  },
});
