/**
 * API client — attaches JWT, handles 401.
 *
 * ✅ NETWORK-INDEPENDENT SETUP:
 * We use ngrok to create a permanent public HTTPS tunnel to the local backend.
 * This means the app works on ANY WiFi — home, college, mobile data — forever.
 *
 * HOW IT WORKS:
 * 1. Start the backend: run-backend-8010.bat
 * 2. Start the tunnel: run-tunnel.bat  (keeps running in background)
 * 3. The app connects to the ngrok HTTPS URL below — works everywhere!
 *
 * TO UPDATE THE URL:
 * Replace the value of NGROK_URL below with your ngrok static domain.
 * Get your free static domain at: https://dashboard.ngrok.com/domains
 */
import * as SecureStore from 'expo-secure-store';

// ─── PASTE YOUR NGROK STATIC DOMAIN HERE ────────────────────────────────────
// Example: 'https://caring-panda-cleanly.ngrok-free.app'
// Get it FREE at: https://dashboard.ngrok.com/domains
// Once set, the app works on ANY network — no more IP changes!
const NGROK_URL = 'https://marxism-sulfite-remedial.ngrok-free.dev';

// Fallback for local dev when ngrok is not running
const LOCAL_URL = 'http://10.253.8.99:8010';

const DEFAULT_BASE_URL = NGROK_URL.includes('YOUR-STATIC-DOMAIN') ? LOCAL_URL : NGROK_URL;

const STORE_KEY = 'bjcc_server_url';

// In-memory cache so we don't hit SecureStore on every request
let _cachedBaseUrl = null;

/** Load the saved URL from SecureStore (call once at app start) */
export async function initBaseUrl() {
  try {
    const saved = await SecureStore.getItemAsync(STORE_KEY);
    _cachedBaseUrl = saved || DEFAULT_BASE_URL;
  } catch {
    _cachedBaseUrl = DEFAULT_BASE_URL;
  }
}

/** Get the current base URL (sync, uses in-memory cache) */
export function getBaseUrl() {
  return _cachedBaseUrl || DEFAULT_BASE_URL;
}

/** Exported alias used across the app */
export const BASE_URL = DEFAULT_BASE_URL; // kept for legacy imports — runtime value overrides

/** Persist a new base URL and update in-memory cache */
export async function setBaseUrl(newUrl) {
  const trimmed = newUrl.replace(/\/$/, ''); // strip trailing slash
  _cachedBaseUrl = trimmed;
  try {
    await SecureStore.setItemAsync(STORE_KEY, trimmed);
  } catch (e) {
    console.warn('Could not persist server URL:', e);
  }
}

/** Reset to the default hardcoded URL */
export async function resetBaseUrl() {
  _cachedBaseUrl = DEFAULT_BASE_URL;
  try {
    await SecureStore.deleteItemAsync(STORE_KEY);
  } catch {}
}

// ─── Auth helpers ────────────────────────────────────────────────────────────
let _authRedirect = null;

export function setAuthRedirect(fn) {
  _authRedirect = fn;
}

export async function getToken() {
  try {
    return await SecureStore.getItemAsync('bjcc_token');
  } catch {
    return null;
  }
}

export async function setToken(token) {
  try {
    if (token) await SecureStore.setItemAsync('bjcc_token', token);
    else        await SecureStore.deleteItemAsync('bjcc_token');
  } catch {}
}

export async function setUser(user) {
  try {
    if (user) await SecureStore.setItemAsync('bjcc_user', JSON.stringify(user));
    else       await SecureStore.deleteItemAsync('bjcc_user');
  } catch {}
}

export async function getUser() {
  try {
    const raw = await SecureStore.getItemAsync('bjcc_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// ─── Core fetch wrapper ───────────────────────────────────────────────────────
export async function apiFetch(path, options = {}) {
  const token = await getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    // Bypass the ngrok browser-warning interstitial page for API calls
    'ngrok-skip-browser-warning': 'true',
    ...(options.headers || {}),
  };

  // Always read from in-memory cache so runtime changes take effect immediately
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}${path}`;

  const res = await fetch(url, { ...options, headers });

  if (res.status === 401) {
    await SecureStore.deleteItemAsync('bjcc_token');
    if (_authRedirect) _authRedirect();
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return res.json();
  }
  return res.text();
}

/** Convenience wrappers */
export const apiGet  = (path, opts)  => apiFetch(path, { method: 'GET', ...opts });
export const apiPost = (path, body, opts) =>
  apiFetch(path, { method: 'POST', body: JSON.stringify(body), ...opts });
export const apiPut  = (path, body, opts) =>
  apiFetch(path, { method: 'PUT',  body: JSON.stringify(body), ...opts });
export const apiDel  = (path, opts)  => apiFetch(path, { method: 'DELETE', ...opts });
