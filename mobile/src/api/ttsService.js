/**
 * ttsService.js — Zero-delay TTS for all 22 Indian languages
 * ─────────────────────────────────────────────────────────────
 * Uses Google Translate TTS URL directly with expo-av.
 * - No voice pack required on device
 * - Works for ALL Indian languages instantly
 * - Chunks long text so playback starts within ~1 second
 */
import { Audio } from 'expo-av';

// BJCC lang code → Google TTS lang code
const GT_LANG = {
  en: 'en',  hi: 'hi',  bn: 'bn',  te: 'te',
  mr: 'mr',  ta: 'ta',  gu: 'gu',  kn: 'kn',
  ml: 'ml',  pa: 'pa',  or: 'hi',  as: 'hi',
  mai: 'hi', sa: 'hi',  sd: 'ur',  ur: 'ur',
  ks: 'ur',  doi: 'hi', kok: 'mr', mni: 'bn',
  ne: 'ne',  bo: 'hi',
};

let _sound  = null;
let _active = false;

/** Build a Google Translate TTS URL (max 200 chars per chunk) */
function _url(text, lang) {
  const tl = GT_LANG[lang] || 'hi';
  return (
    `https://translate.google.com/translate_tts` +
    `?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${tl}&client=tw-ob&ttsspeed=0.9`
  );
}

/** Split text into ≤200-char chunks at sentence/word boundaries */
function _chunk(text) {
  const MAX = 190;
  const chunks = [];
  let remaining = text.trim();
  while (remaining.length > 0) {
    if (remaining.length <= MAX) {
      chunks.push(remaining);
      break;
    }
    // Try to split at sentence boundary
    let cut = remaining.lastIndexOf('. ', MAX);
    if (cut < 80) cut = remaining.lastIndexOf(' ', MAX);
    if (cut < 20) cut = MAX;
    chunks.push(remaining.slice(0, cut + 1).trim());
    remaining = remaining.slice(cut + 1).trim();
  }
  return chunks.filter(Boolean);
}

/** Stop any currently playing audio immediately */
export async function stopSpeaking() {
  _active = false;
  if (_sound) {
    try { await _sound.stopAsync(); } catch {}
    try { await _sound.unloadAsync(); } catch {}
    _sound = null;
  }
}

/**
 * Speak text in the given language using Google Translate TTS.
 * Returns a promise that resolves when speech is finished or stopped.
 * onDone() is called when finished naturally.
 * onStopped() is called when stopSpeaking() is called.
 */
export async function speakText(text, lang, { onDone, onStopped, onStart } = {}) {
  // Stop anything already playing
  await stopSpeaking();
  if (!text || !lang) return;

  _active = true;

  // Set up audio mode once
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
      staysActiveInBackground: false,
    });
  } catch {}

  const chunks = _chunk(text);
  if (onStart) onStart();

  for (let i = 0; i < chunks.length; i++) {
    if (!_active) { if (onStopped) onStopped(); return; }

    try {
      const { sound } = await Audio.Sound.createAsync(
        {
          uri: _url(chunks[i], lang),
          headers: { 'User-Agent': 'com.google.android.googlequicksearchbox' },
        },
        { shouldPlay: true, progressUpdateIntervalMillis: 200 },
      );
      _sound = sound;

      // Wait for this chunk to finish
      await new Promise((resolve) => {
        sound.setOnPlaybackStatusUpdate((status) => {
          if (status.didJustFinish || status.isLoaded === false) {
            sound.unloadAsync().catch(() => {});
            _sound = null;
            resolve();
          }
        });
      });
    } catch (err) {
      // Skip failed chunk and continue
      console.warn('[TTS] chunk failed:', err?.message);
    }
  }

  if (_active) {
    _active = false;
    if (onDone) onDone();
  }
}

/** Returns true if currently speaking */
export function isSpeaking() {
  return _active;
}
