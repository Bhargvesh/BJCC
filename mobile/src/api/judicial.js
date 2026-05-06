/**
 * Judicial API — all BJCC endpoints.
 */
import { apiFetch } from './client';

export async function searchCases({ q = '', court = '', lang = 'en', limit = 20 } = {}) {
  const params = new URLSearchParams({ q, court, lang, limit: String(limit) });
  return apiFetch(`/api/innovation/judicial/search?${params.toString()}`);
}

export async function getCaseDetail(id, lang = 'en') {
  return apiFetch(`/api/innovation/judicial/${id}?lang=${lang}`);
}

export async function chatWithAssistant(message, lang = 'en') {
  return apiFetch('/api/innovation/assistant/chat', {
    method: 'POST',
    body: JSON.stringify({ message, lang }),
  });
}

export async function getKanoonFeed(lang = 'en') {
  return apiFetch(`/api/innovation/judicial/search?q=constitutional+rights&lang=${lang}&limit=20`);
}

export async function getMe() {
  return apiFetch('/api/innovation/auth/me');
}
