from __future__ import annotations

import base64
import os
from typing import Any, Dict, List, Optional

import httpx


class BhashiniService:
    """
    Config-driven Bhashini integration helper.
    This keeps the app usable in demo mode when credentials are missing.
    """

    def __init__(self) -> None:
        self.pipeline_url = (os.getenv("BHASHINI_PIPELINE_URL") or "").strip()
        self.api_key = (os.getenv("BHASHINI_API_KEY") or "").strip()
        self.user_id = (os.getenv("BHASHINI_USER_ID") or "").strip()
        self.search_url = (os.getenv("GOV_LEGAL_SEARCH_URL") or "").strip()
        self.search_auth_header = (os.getenv("GOV_LEGAL_SEARCH_AUTH_HEADER") or "Authorization").strip()
        self.search_auth_token = (os.getenv("GOV_LEGAL_SEARCH_AUTH_TOKEN") or "").strip()
        self.google_scholar_api_key = (os.getenv("GOOGLE_SCHOLAR_API_KEY") or "").strip()
        self.google_scholar_api_url = (os.getenv("GOOGLE_SCHOLAR_API_URL") or "https://serpapi.com/search.json").strip()
        self.nvidia_api_key = (os.getenv("NVIDIA_API_KEY") or "").strip()
        self.nvidia_tts_url = (os.getenv("NVIDIA_TTS_URL") or "https://integrate.api.nvidia.com/v1/audio/speech").strip()
        self.nvidia_tts_model = (os.getenv("NVIDIA_TTS_MODEL") or "nvidia/tts-1").strip()
        self.nvidia_tts_voice = (os.getenv("NVIDIA_TTS_VOICE") or "alloy").strip()
        self.nvidia_chat_model = (os.getenv("NVIDIA_CHAT_MODEL") or "meta/llama-3.1-8b-instruct").strip()
        self.nvidia_chat_url = (os.getenv("NVIDIA_CHAT_URL") or "https://integrate.api.nvidia.com/v1/chat/completions").strip()

    def is_enabled(self) -> bool:
        return bool(self.pipeline_url and self.api_key and self.user_id)

    def _pipeline_headers(self) -> Dict[str, str]:
        return {
            "Content-Type": "application/json",
            "userID": self.user_id,
            "ulcaApiKey": self.api_key,
        }

    async def translate_text(self, text: str, source_lang: str, target_lang: str) -> Dict[str, Any]:
        if not text.strip():
            return {"ok": False, "reason": "empty_text"}
        
        # 1. ⚡ Fast Deep Translation Path (Free & Instant)
        # This reduces translation times from ~10s to ~1-2s for a quick demo
        try:
            import asyncio
            from deep_translator import GoogleTranslator
            
            tt_target = target_lang.split("-")[0].lower()
            if tt_target == "brx": tt_target = "hi"
            elif tt_target == "doi": tt_target = "hi"
            elif tt_target == "ks": tt_target = "ur"
            elif tt_target == "mni": tt_target = "hi"
            
            def _fast_translate():
                # GoogleTranslator limit is 5000 chars, so we truncate string
                return GoogleTranslator(source='auto', target=tt_target).translate(text[:4500])
                
            translated_text = await asyncio.to_thread(_fast_translate)
            if translated_text:
                return {"ok": True, "text": translated_text, "provider": "deep-translator"}
        except Exception as e:
            print(f"Deep translator fast path failed: {e}")

        # 2. Try Bhashini if enabled
        if self.is_enabled():
            payload = {
                "pipelineTasks": [
                    {
                        "taskType": "translation",
                        "config": {
                            "language": {
                                "sourceLanguage": source_lang,
                                "targetLanguage": target_lang,
                            }
                        },
                    }
                ],
                "inputData": {"input": [{"source": text}]},
            }
            try:
                async with httpx.AsyncClient(timeout=20) as client:
                    r = await client.post(self.pipeline_url, headers=self._pipeline_headers(), json=payload)
                    r.raise_for_status()
                    data = r.json()
                translated = (
                    data.get("pipelineResponse", [{}])[0]
                    .get("output", [{}])[0]
                    .get("target", "")
                )
                if translated:
                    return {"ok": True, "text": translated, "provider": "bhashini"}
            except Exception as e:
                print(f"Bhashini translation error: {e}")

        # 3. Try NVIDIA NIM fallback if enabled
        if self.nvidia_api_key:
            return await self.nvidia_translate(text, source_lang, target_lang)

        return {"ok": False, "reason": "no_translation_provider_available"}

    async def text_to_speech(self, text: str, lang: str, gender: str = "female") -> Dict[str, Any]:
        if not self.is_enabled() or not text.strip():
            return {"ok": False, "reason": "bhashini_not_configured"}

        payload = {
            "pipelineTasks": [
                {
                    "taskType": "tts",
                    "config": {"language": {"sourceLanguage": lang}, "gender": gender},
                }
            ],
            "inputData": {"input": [{"source": text}]},
        }
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                r = await client.post(self.pipeline_url, headers=self._pipeline_headers(), json=payload)
                r.raise_for_status()
                data = r.json()
            audio = (
                data.get("pipelineResponse", [{}])[0]
                .get("audio", [{}])[0]
                .get("audioContent", "")
            )
            return {"ok": bool(audio), "audio_base64": audio, "raw": data}
        except Exception as e:
            return {"ok": False, "reason": type(e).__name__}

    async def nvidia_text_to_speech(self, text: str, lang: str) -> Dict[str, Any]:
        """
        NVIDIA-first TTS path (OpenAI-compatible style endpoint).
        If the endpoint or model differs in your account, configure via env.
        """
        if not self.nvidia_api_key or not text.strip():
            return {"ok": False, "reason": "nvidia_not_configured"}

        payload = {
            "model": self.nvidia_tts_model,
            "input": text[:3500],
            "voice": self.nvidia_tts_voice,
            "response_format": "wav",
            "language": lang,
        }
        headers = {
            "Authorization": f"Bearer {self.nvidia_api_key}",
            "Content-Type": "application/json",
            "Accept": "audio/wav, application/json",
        }

        try:
            async with httpx.AsyncClient(timeout=40) as client:
                r = await client.post(self.nvidia_tts_url, headers=headers, json=payload)
                r.raise_for_status()
                content_type = (r.headers.get("content-type") or "").lower()
                if "application/json" in content_type:
                    data = r.json()
                    audio_b64 = data.get("audio") or data.get("audio_base64") or data.get("audioContent") or ""
                    if audio_b64:
                        return {"ok": True, "audio_base64": audio_b64, "provider": "nvidia"}
                    return {"ok": False, "reason": "nvidia_no_audio"}
                audio_b64 = base64.b64encode(r.content).decode("ascii")
                return {"ok": True, "audio_base64": audio_b64, "provider": "nvidia"}
        except Exception as e:
            return {"ok": False, "reason": type(e).__name__}

    async def nvidia_translate(self, text: str, source_lang: str, target_lang: str) -> Dict[str, Any]:
        """
        Translates text using NVIDIA NIM LLM.
        """
        if not self.nvidia_api_key or not text.strip():
            return {"ok": False, "reason": "nvidia_not_configured"}

        lang_names = {"hi": "Hindi", "ur": "Urdu", "doi": "Dogri", "ks": "Kashmiri", "en": "English"}
        target_name = lang_names.get(target_lang, target_lang)
        source_name = lang_names.get(source_lang, source_lang)

        prompt = (
            f"You are a professional legal translator. "
            f"Translate the following text from {source_name} to {target_name}. "
            f"Preserve all specific legal identifiers, acts, section numbers, and citations exactly as they are. "
            f"Return ONLY the translated text without any preamble or explanation.\n\n"
            f"Text: {text}"
        )

        headers = {
            "Authorization": f"Bearer {self.nvidia_api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": self.nvidia_chat_model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.1,
            "max_tokens": 4096,
        }

        try:
            async with httpx.AsyncClient(timeout=60) as client:
                r = await client.post(self.nvidia_chat_url, headers=headers, json=payload)
                r.raise_for_status()
                data = r.json()
            translated = data["choices"][0]["message"]["content"].strip()
            return {"ok": True, "text": translated, "provider": "nvidia_nim"}
        except Exception as e:
            return {"ok": False, "reason": f"NVIDIA Translation Error: {type(e).__name__}"}

    async def government_legal_search(self, query: str, lang: str = "en", limit: int = 10) -> List[Dict[str, Any]]:
        """
        Optional connector for government legal records.
        Expects a configurable endpoint that returns JSON list-like results.
        """
        if not self.search_url or not query.strip():
            return []

        headers: Dict[str, str] = {"Content-Type": "application/json"}
        if self.search_auth_token:
            headers[self.search_auth_header] = self.search_auth_token

        payload = {"query": query, "lang": lang, "limit": limit}
        try:
            async with httpx.AsyncClient(timeout=4.0) as client:
                # Indian Kanoon API works with GET query params + Authorization token.
                if "indiankanoon.org/search" in self.search_url:
                    kanoon_headers = dict(headers)
                    kanoon_headers["Content-Type"] = "application/x-www-form-urlencoded"
                    form_data = {"formInput": query.strip(), "pagenum": "0"}
                    r = await client.post(self.search_url, headers=kanoon_headers, data=form_data)
                else:
                    r = await client.post(self.search_url, headers=headers, json=payload)
                r.raise_for_status()
                data = r.json()
        except Exception:
            return []

        raw_items: Optional[List[Dict[str, Any]]] = None
        if isinstance(data, list):
            raw_items = [x for x in data if isinstance(x, dict)]
        elif isinstance(data, dict):
            # Indian Kanoon commonly returns docs[].
            maybe = data.get("docs") or data.get("results") or data.get("items") or data.get("data")
            if isinstance(maybe, list):
                raw_items = [x for x in maybe if isinstance(x, dict)]
        if not raw_items:
            return []

        out: List[Dict[str, Any]] = []
        for idx, it in enumerate(raw_items[:limit]):
            # Indian Kanoon normalized fields
            doc_id = str(it.get("id") or it.get("tid") or it.get("docid") or it.get("doc_id") or f"GOV-{idx+1}")
            title = str(it.get("title") or it.get("case_title") or it.get("headline") or "Government legal record")
            snippet = str(it.get("summary") or it.get("snippet") or it.get("headline") or "")
            court_name = str(it.get("court") or it.get("docsource") or it.get("authority") or "Indian Kanoon")
            pub_date = str(it.get("date") or it.get("publishdate") or it.get("published_date") or "")
            pub_url = str(it.get("publication_url") or it.get("source_url") or "")
            if not pub_url and doc_id.isdigit():
                pub_url = f"https://indiankanoon.org/doc/{doc_id}/"

            out.append(
                {
                    "id": doc_id,
                    "court": court_name,
                    "date": pub_date,
                    "title": title,
                    "parties": str(it.get("parties") or it.get("stakeholders") or "N/A"),
                    "acts": it.get("acts") or [],
                    "sections": it.get("sections") or [],
                    "summary": snippet,
                    "full_summary": str(it.get("full_summary") or snippet or title),
                    "key_points": it.get("key_points") or [],
                    "citations": it.get("citations") or [],
                    "publication_url": pub_url,
                    "official_source": str(it.get("official_source") or it.get("source") or "Indian Kanoon"),
                    "languages": it.get("languages") or [lang or "en"],
                }
            )
        return out

    async def kanoon_web_search(self, query: str, limit: int = 15) -> List[Dict[str, Any]]:
        """
        Scrapes the public Indian Kanoon search page (no API token required).
        Returns structured results extracted from HTML.
        """
        import re as _re
        url = f"https://indiankanoon.org/search/?formInput={httpx.URL('').copy_with(params={'formInput': query}).query.decode()}"
        # Use simple encoded URL
        search_url = "https://indiankanoon.org/search/"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml",
            "Accept-Language": "en-IN,en;q=0.9",
        }
        try:
            async with httpx.AsyncClient(timeout=12.0, follow_redirects=True) as client:
                r = await client.get(search_url, params={"formInput": query, "pagenum": "0"}, headers=headers)
                if r.status_code != 200:
                    return []
                html = r.text
        except Exception as e:
            print(f"[kanoon_scraper] request failed: {e}")
            return []

        out: List[Dict[str, Any]] = []
        # Parse result blocks: <div class="result">
        result_blocks = _re.findall(r'<div class="result".*?</div>\s*</div>', html, _re.DOTALL)
        if not result_blocks:
            # Try alternative structure
            result_blocks = _re.findall(r'<div[^>]+class="[^"]*result[^"]*"[^>]*>(.*?)</div>\s*</div>', html, _re.DOTALL)

        for idx, block in enumerate(result_blocks[:limit]):
            # Extract title and URL
            title_match = _re.search(r'<a[^>]+href="(/doc/(\d+)/[^"]*)"[^>]*>(.*?)</a>', block, _re.DOTALL)
            if not title_match:
                title_match = _re.search(r'<a[^>]+href="([^"]+)"[^>]*class="[^"]*result_title[^"]*"[^>]*>(.*?)</a>', block, _re.DOTALL)

            if title_match:
                href = title_match.group(1)
                doc_id_match = _re.search(r'/doc/(\d+)/', href)
                doc_id = doc_id_match.group(1) if doc_id_match else f"IK-{idx+1}"
                raw_title = _re.sub(r'<[^>]+>', '', title_match.group(len(title_match.groups()))).strip()
                pub_url = f"https://indiankanoon.org{href}" if href.startswith('/') else href
            else:
                doc_id = f"IK-{idx+1}"
                raw_title = f"Indian Kanoon Result {idx+1}"
                pub_url = ""

            # Extract court / date metadata
            meta_match = _re.search(r'<div class="[^"]*docsource[^"]*"[^>]*>(.*?)</div>', block, _re.DOTALL)
            court_raw = _re.sub(r'<[^>]+>', '', meta_match.group(1)).strip() if meta_match else ""
            date_match = _re.search(r'\b(\d{1,2}\s+\w+\s+\d{4}|\d{4}-\d{2}-\d{2}|\w+\s+\d{4})\b', court_raw)
            date_str = date_match.group(1) if date_match else ""
            court_name = _re.sub(r'\b\d{1,2}\s+\w+\s+\d{4}\b', '', court_raw).strip(' ,|') or "Supreme Court of India"

            # Extract snippet
            snippet_match = _re.search(r'<div class="[^"]*snippet[^"]*"[^>]*>(.*?)</div>', block, _re.DOTALL)
            if not snippet_match:
                snippet_match = _re.search(r'<p[^>]*>(.*?)</p>', block, _re.DOTALL)
            snippet = _re.sub(r'<[^>]+>', ' ', snippet_match.group(1)).strip() if snippet_match else raw_title

            out.append({
                "id": doc_id,
                "court": court_name or "Indian Court",
                "date": date_str,
                "title": raw_title,
                "parties": "N/A",
                "acts": [],
                "sections": [],
                "summary": snippet[:800],
                "full_summary": snippet[:800],
                "key_points": [],
                "citations": [],
                "publication_url": pub_url,
                "official_source": "Indian Kanoon",
                "languages": ["en"],
            })

        return out

    async def nvidia_legal_search(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Uses NVIDIA NIM LLM to generate structured judicial search results for any query.
        This is the final fallback when all other sources fail.
        """
        if not self.nvidia_api_key or not query.strip():
            return []

        import json as _json
        prompt = f"""You are a legal database assistant for Indian courts.
For the search query: "{query}"

Generate {min(limit, 8)} realistic Indian judicial case results.
Return a JSON array (no markdown, no explanation, only raw JSON) where each object has:
- "id": unique case ID like "SC-2023-001"
- "title": full case title
- "court": court name (Supreme Court of India, High Court, etc.)
- "date": date like "2023-04-15"
- "parties": "Petitioner v. Respondent"
- "summary": 3-4 sentence case summary directly about "{query}"
- "facts": 2-3 sentences about the background facts
- "issues": key legal issues
- "court_reasoning": court's analysis
- "conclusion": final decision/order
- "acts": list of relevant Indian acts/laws
- "publication_url": "https://indiankanoon.org/search/?formInput={query.replace(' ','%20')}"

Return ONLY the JSON array, nothing else."""

        headers = {
            "Authorization": f"Bearer {self.nvidia_api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": self.nvidia_chat_model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.3,
            "max_tokens": 3000,
        }

        try:
            async with httpx.AsyncClient(timeout=45) as client:
                r = await client.post(self.nvidia_chat_url, headers=headers, json=payload)
                r.raise_for_status()
                data = r.json()
            raw_text = data["choices"][0]["message"]["content"].strip()
            # Clean any markdown fences
            raw_text = raw_text.replace("```json", "").replace("```", "").strip()
            # Find the JSON array
            start = raw_text.find("[")
            end = raw_text.rfind("]") + 1
            if start == -1 or end == 0:
                return []
            items = _json.loads(raw_text[start:end])
            out = []
            for idx, it in enumerate(items[:limit]):
                if not isinstance(it, dict):
                    continue
                # Build judgment_sections from individual fields
                jdoc_id = str(it.get("id") or f"AI-{idx+1}")
                out.append({
                    "id": jdoc_id,
                    "court": str(it.get("court") or "Supreme Court of India"),
                    "date": str(it.get("date") or ""),
                    "title": str(it.get("title") or f"Case on {query}"),
                    "parties": str(it.get("parties") or "N/A"),
                    "acts": it.get("acts") or [],
                    "sections": it.get("sections") or [],
                    "summary": str(it.get("summary") or ""),
                    "full_summary": str(it.get("summary") or ""),
                    "key_points": it.get("key_points") or [],
                    "citations": it.get("citations") or [],
                    "publication_url": str(it.get("publication_url") or f"https://indiankanoon.org/search/?formInput={query.replace(' ','%20')}"),
                    "official_source": "AI Legal Research (NVIDIA NIM)",
                    "languages": ["en"],
                    "judgment_sections": {
                        "facts": str(it.get("facts") or ""),
                        "issues": str(it.get("issues") or ""),
                        "court_reasoning": str(it.get("court_reasoning") or ""),
                        "conclusion": str(it.get("conclusion") or ""),
                    },
                })
            return out
        except Exception as e:
            print(f"[nvidia_legal_search] Error: {e}")
            return []


bhashini_service = BhashiniService()
