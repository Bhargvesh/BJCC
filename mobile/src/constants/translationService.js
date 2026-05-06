/**
 * TranslationService — Full-text translation for BJCC Mobile
 * ─────────────────────────────────────────────────────────────
 * Uses Google Translate's free endpoint (no API key required).
 * Results are cached in-memory so each text is only fetched once.
 *
 * Falls back to offline word-substitution (offlineTranslator) on error.
 */

import { translateOffline } from './offlineTranslator';

// ── Google Translate language code mapping ───────────────────
// Some BJCC language codes differ from Google's codes
const GT_LANG_MAP = {
  en:  'en',
  hi:  'hi',
  bn:  'bn',
  te:  'te',
  mr:  'mr',
  ta:  'ta',
  gu:  'gu',
  kn:  'kn',
  ml:  'ml',
  pa:  'pa',
  or:  'or',
  as:  'as',
  mai: 'mai',
  sa:  'sa',
  sd:  'sd',
  ne:  'ne',
  doi: 'doi',
  kok: 'gom',   // Konkani (Goan) — Google uses 'gom'
  bo:  'hi',    // Bodo — not supported by Google, fall back to Hindi
  mni: 'mni-Mtei', // Manipuri in Meitei script
  ur:  'ur',
  ks:  'ks',
};

// ── In-memory cache: key = `${lang}:${text}` ─────────────────
const cache = new Map();

/**
 * Translate a text string from English to the target language.
 * Returns the translated string. Uses cache if available.
 *
 * @param {string} text - Source text (English)
 * @param {string} lang - BJCC language code (e.g., 'ta', 'bn')
 * @returns {Promise<string>}
 */
export async function translateText(text, lang) {
  if (!text || !lang || lang === 'en') return text;

  const cacheKey = `${lang}:${text.slice(0, 200)}`; // key by first 200 chars
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  const gtLang = GT_LANG_MAP[lang];
  if (!gtLang) return translateOffline(text, lang); // offline fallback

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000); // 5 s timeout

    const url =
      `https://translate.googleapis.com/translate_a/single` +
      `?client=gtx&sl=en&tl=${encodeURIComponent(gtLang)}&dt=t` +
      `&q=${encodeURIComponent(text)}`;

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const json = await res.json();
    // Google returns: [ [[translated, original, ...], ...], ... ]
    const translated = (json[0] || [])
      .map(chunk => (chunk && chunk[0]) || '')
      .join('');

    if (translated) {
      cache.set(cacheKey, translated);
      return translated;
    }
    throw new Error('Empty response');
  } catch (_err) {
    // Gracefully fall back to offline word substitution
    const fallback = translateOffline(text, lang);
    return fallback;
  }
}

/**
 * Translate multiple texts in parallel.
 * @param {string[]} texts
 * @param {string} lang
 * @returns {Promise<string[]>}
 */
export async function translateBatch(texts, lang) {
  return Promise.all(texts.map(t => translateText(t, lang)));
}

/**
 * Clear all cached translations (call on language reset if needed).
 */
export function clearTranslationCache() {
  cache.clear();
}
