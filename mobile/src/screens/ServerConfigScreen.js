/**
 * ServerConfigScreen — lets the user change the backend server IP at runtime.
 * This solves the "only works on home network" problem.
 */
import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { getBaseUrl, setBaseUrl, resetBaseUrl } from '../api/client';

const DEFAULT_PORT = '8010';

export default function ServerConfigScreen({ navigation }) {
  const [host, setHost]       = useState('');
  const [port, setPort]       = useState(DEFAULT_PORT);
  const [testing, setTesting] = useState(false);
  const [status, setStatus]   = useState(null); // null | 'ok' | 'error'
  const [statusMsg, setStatusMsg] = useState('');

  useEffect(() => {
    // Load current config on mount
    const current = getBaseUrl(); // e.g. http://10.253.8.99:8010
    try {
      const match = current.match(/http:\/\/([^:]+):(\d+)/);
      if (match) {
        setHost(match[1]);
        setPort(match[2]);
      }
    } catch (_) {}
  }, []);

  const handleTest = async () => {
    if (!host.trim()) {
      Alert.alert('Enter IP', 'Please enter your laptop/server IP address first.');
      return;
    }
    setTesting(true);
    setStatus(null);
    setStatusMsg('');
    const testUrl = `http://${host.trim()}:${port.trim()}/api/innovation/health`;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(testUrl, { signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok || res.status < 500) {
        setStatus('ok');
        setStatusMsg('✓ Connected! Server is reachable.');
      } else {
        setStatus('error');
        setStatusMsg(`Server responded with status ${res.status}`);
      }
    } catch (e) {
      setStatus('error');
      if (e.name === 'AbortError') {
        setStatusMsg('✗ Timeout — server not reachable. Check IP and WiFi network.');
      } else {
        setStatusMsg(`✗ ${e.message}`);
      }
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!host.trim()) {
      Alert.alert('Enter IP', 'Please enter your laptop/server IP address.');
      return;
    }
    const newUrl = `http://${host.trim()}:${port.trim()}`;
    await setBaseUrl(newUrl);
    Alert.alert(
      'Saved!',
      `Backend set to:\n${newUrl}\n\nThe app will now use this address.`,
      [{ text: 'OK', onPress: () => navigation.goBack() }]
    );
  };

  const handleReset = async () => {
    Alert.alert(
      'Reset to Default',
      'This will reset to the original IP. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset', style: 'destructive',
          onPress: async () => {
            await resetBaseUrl();
            const current = getBaseUrl();
            const match = current.match(/http:\/\/([^:]+):(\d+)/);
            if (match) { setHost(match[1]); setPort(match[2]); }
            setStatus(null);
            Alert.alert('Reset', 'Server URL reset to default.');
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
          {/* Header */}
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color="#a78bfa" />
            <Text style={s.backTxt}>Back</Text>
          </TouchableOpacity>

          <View style={s.iconWrap}>
            <Ionicons name="server-outline" size={48} color="#a78bfa" />
          </View>
          <Text style={s.title}>Server Configuration</Text>
          <Text style={s.subtitle}>
            Change this whenever you switch networks (home → college, etc.)
          </Text>

          {/* How to find IP */}
          <View style={s.infoBox}>
            <Ionicons name="information-circle-outline" size={18} color="#7dd3fc" />
            <Text style={s.infoText}>
              <Text style={{ fontWeight: '700' }}>How to find your IP: </Text>
              On Windows, open Command Prompt and type{' '}
              <Text style={s.code}>ipconfig</Text>. Look for{' '}
              <Text style={s.code}>IPv4 Address</Text> under your current WiFi adapter.
            </Text>
          </View>

          {/* IP Input */}
          <Text style={s.label}>Laptop / Server IP Address</Text>
          <TextInput
            style={s.input}
            value={host}
            onChangeText={setHost}
            placeholder="e.g.  192.168.1.10"
            placeholderTextColor="#4b5563"
            keyboardType="decimal-pad"
            autoCapitalize="none"
            autoCorrect={false}
          />

          {/* Port Input */}
          <Text style={s.label}>Port</Text>
          <TextInput
            style={[s.input, { width: 120 }]}
            value={port}
            onChangeText={setPort}
            placeholder="8010"
            placeholderTextColor="#4b5563"
            keyboardType="number-pad"
          />

          {/* Status */}
          {status && (
            <View style={[s.statusBox, status === 'ok' ? s.statusOk : s.statusErr]}>
              <Text style={s.statusTxt}>{statusMsg}</Text>
            </View>
          )}

          {/* Buttons */}
          <TouchableOpacity style={s.testBtn} onPress={handleTest} disabled={testing}>
            {testing
              ? <ActivityIndicator color="#fff" />
              : <>
                  <Ionicons name="wifi-outline" size={18} color="#fff" />
                  <Text style={s.testBtnTxt}>Test Connection</Text>
                </>
            }
          </TouchableOpacity>

          <TouchableOpacity style={s.saveBtn} onPress={handleSave}>
            <Ionicons name="save-outline" size={18} color="#fff" />
            <Text style={s.saveBtnTxt}>Save &amp; Apply</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.resetBtn} onPress={handleReset}>
            <Text style={s.resetBtnTxt}>Reset to Default</Text>
          </TouchableOpacity>

          <Text style={s.currentUrl}>
            Current: {`http://${host || '?'}:${port}`}
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: '#0a0520' },
  container:  { padding: 24, paddingBottom: 48 },
  backBtn:    { flexDirection: 'row', alignItems: 'center', marginBottom: 24, gap: 6 },
  backTxt:    { color: '#a78bfa', fontSize: 16 },
  iconWrap:   { alignItems: 'center', marginBottom: 12 },
  title:      { fontSize: 24, fontWeight: '700', color: '#fff', textAlign: 'center', marginBottom: 8 },
  subtitle:   { fontSize: 14, color: '#9ca3af', textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  infoBox:    {
    flexDirection: 'row', gap: 10, backgroundColor: '#0f172a',
    borderRadius: 12, padding: 14, marginBottom: 28,
    borderWidth: 1, borderColor: '#1e3a5f',
  },
  infoText:   { flex: 1, color: '#94a3b8', fontSize: 13, lineHeight: 20 },
  code:       { fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace', color: '#7dd3fc' },
  label:      { color: '#d1d5db', fontSize: 13, fontWeight: '600', marginBottom: 8, marginTop: 4 },
  input:      {
    backgroundColor: '#1e1b4b', borderRadius: 12, padding: 14,
    color: '#fff', fontSize: 16, marginBottom: 16,
    borderWidth: 1, borderColor: '#312e81',
  },
  statusBox:  { borderRadius: 10, padding: 12, marginBottom: 16 },
  statusOk:   { backgroundColor: '#052e16', borderColor: '#16a34a', borderWidth: 1 },
  statusErr:  { backgroundColor: '#2d0a0a', borderColor: '#dc2626', borderWidth: 1 },
  statusTxt:  { color: '#e2e8f0', fontSize: 13 },
  testBtn:    {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: '#4f46e5', borderRadius: 14,
    padding: 15, marginBottom: 12,
  },
  testBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 16 },
  saveBtn:    {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: '#7c3aed', borderRadius: 14,
    padding: 15, marginBottom: 12,
  },
  saveBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 16 },
  resetBtn:   { alignItems: 'center', padding: 12, marginBottom: 16 },
  resetBtnTxt:{ color: '#6b7280', fontSize: 14 },
  currentUrl: { textAlign: 'center', color: '#4b5563', fontSize: 12, fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace' },
});
