import os
import json

try:
    from openai import OpenAI
except Exception:  # pragma: no cover - optional dependency for demo mode
    OpenAI = None

class LLMService:
    def __init__(self):
        self.api_key = os.getenv("OPENAI_API_KEY")
        self.client = OpenAI(api_key=self.api_key) if (OpenAI and self.api_key) else None
        self.system_prompt = """
        You are SAMAADHAN-JK, an AI assistant for the Jammu & Kashmir Governance Monitoring System.
        You help citizens register complaints about government services including:
        - Roads and infrastructure
        - Water supply
        - Electricity
        - Sanitation and waste management
        - Hospitals and healthcare
        - Traffic and signals
        - Education
        - Public transport
        
        You support Hindi, Urdu, and English languages.
        
        When a citizen describes a problem:
        1. Understand their issue empathetically
        2. Ask for necessary details (location, specific problem)
        3. Categorize the complaint
        4. Collect their contact information
        5. Confirm the complaint details before submission
        
        Always be polite, helpful, and professional.
        """
    
    async def process_complaint_conversation(
        self, 
        user_message: str, 
        conversation_history: list
    ) -> dict:
        """Process user message and extract complaint details"""
        
        messages = [{"role": "system", "content": self.system_prompt}]
        messages.extend(conversation_history)
        messages.append({"role": "user", "content": user_message})
        
        if not self.client:
            return {
                "reply": (
                    "I can help register your complaint. Please share: name, phone, district, "
                    "complaint title and details. For demo, use the complaint form to submit directly."
                ),
                "complaint_data": None,
                "is_complete": False,
            }

        response = self.client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
        )
        
        assistant_message = response.choices[0].message
        
        result = {
            "reply": assistant_message.content,
            "complaint_data": None,
            "is_complete": False
        }
        
        # For prototype, complaint final submission is handled by /api/complaints.
        
        return result

    def _offline_citizen_chat_reply(self, user_message: str) -> str:
        """Rule-based answers when no LLM API key (still useful for demos)."""
        t = (user_message or "").lower()
        lines = [
            "— **SAMAADHAN-JK** (offline mode): add **OPENAI_API_KEY** on the server for full AI replies.",
            "",
        ]
        if any(x in t for x in ("complaint", "file", "register", "how", "kaise")):
            lines += [
                "**How to complain:** Use the **Register complaint** form — name, phone, district, title, description.",
                "Optional: GPS and photos. Click **Run AI analysis** to preview category and duplicates before submit.",
                "You get a ticket like **JK-YYYYMMDD-XXXXXX** — use **Track complaint** to see status.",
            ]
        elif any(x in t for x in ("track", "ticket", "status")):
            lines += [
                "**Track:** Enter your **Ticket ID** in the Track section. Status updates appear in the admin console too.",
            ]
        elif any(x in t for x in ("priority", "red", "yellow", "green", "sla")):
            lines += [
                "**Priority:** **Red** = fastest response · **Yellow** = within about 1 day · **Green** = within about 2 days.",
                "AI merges keyword + repeat patterns with model suggestions when enabled.",
            ]
        else:
            lines += [
                "Ask me how to **register a complaint**, **track a ticket**, or about **priority (red/yellow/green)**.",
                "I work best with **OPENAI_API_KEY** set for Hindi, Urdu, and English answers.",
            ]
        return "\n".join(lines)

    async def citizen_chat_reply(self, user_message: str, conversation_history: list) -> dict:
        """
        Floating widget chat: conversational Q&A for citizens.
        conversation_history: list of {"role":"user"|"assistant","content":"..."} (prior turns only).
        """
        sys = """You are SAMAADHAN-JK, the friendly AI assistant for the Jammu & Kashmir AI-Based Governance Monitoring System.

Help citizens with:
- How to register grievances (form, district, category, optional GPS/photos)
- How to track ticket IDs (JK-...)
- Priority levels: red (urgent), yellow (medium), green (routine) and approximate SLA
- Departments: roads, water, electricity, sanitation, hospital, traffic, education, public transport

Reply in the same language as the user when they write in Hindi, Urdu, or English. Be concise (2–6 short paragraphs or bullet points). Do not invent government guarantees; say actions are routed through the demo portal."""

        messages = [{"role": "system", "content": sys}]
        for m in conversation_history[-20:]:
            if isinstance(m, dict) and m.get("role") in ("user", "assistant") and m.get("content"):
                messages.append({"role": m["role"], "content": str(m["content"])[:8000]})
        messages.append({"role": "user", "content": (user_message or "")[:8000]})

        if not self.client:
            return {
                "reply": self._offline_citizen_chat_reply(user_message),
                "complaint_data": None,
                "is_complete": False,
            }

        try:
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=messages,
                max_tokens=800,
                temperature=0.7,
            )
            choice = response.choices[0].message
            text = (choice.content or "").strip()
            if not text and getattr(choice, "refusal", None):
                text = str(choice.refusal)
            if not text:
                text = "I could not generate a reply. Please try again or rephrase your question."
            return {"reply": text, "complaint_data": None, "is_complete": False}
        except Exception as e:
            # Invalid/expired key, quota, network: still return useful offline text
            note = f"\n\n(LLM offline: {type(e).__name__} — fix OPENAI_API_KEY for live AI.)"
            return {
                "reply": self._offline_citizen_chat_reply(user_message) + note,
                "complaint_data": None,
                "is_complete": False,
            }
    
    async def classify_complaint(self, text: str) -> dict:
        """Classify complaint category and extract details using LLM"""
        
        if not self.client:
            return {"category": "other", "severity": "medium", "language": "en"}

        try:
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "Return JSON with category,severity,language."},
                    {"role": "user", "content": text},
                ],
                response_format={"type": "json_object"},
            )
            return json.loads(response.choices[0].message.content)
        except Exception:
            return {"category": "other", "severity": "medium", "language": "en"}

    async def analyze_complaint_text(self, text: str) -> dict:
        """Full structured analysis for registration (multilingual)."""
        from app.services.ai_engine import (
            VALID_CATEGORIES,
            rule_classify,
            severity_to_priority,
        )

        rules = rule_classify(text)
        if not self.client:
            return {
                "category": rules["category"],
                "severity_hint": rules["severity_hint"],
                "language": rules["language_guess"],
                "summary": (text or "")[:200],
                "method": "rules_only",
                "suggested_priority": severity_to_priority(rules["severity_hint"]),
            }

        cat_list = ", ".join(VALID_CATEGORIES)
        sys = (
            f"You classify citizen grievances for Jammu & Kashmir government services. "
            f"Return ONLY valid JSON with keys: category (one of: {cat_list}), "
            f"severity_hint (low|medium|high|critical), language (en|hi|ur), "
            f"summary (one short English line for officers)."
        )
        try:
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": sys},
                    {"role": "user", "content": text[:4000]},
                ],
                response_format={"type": "json_object"},
            )
            data = json.loads(response.choices[0].message.content)
            cat = data.get("category", rules["category"])
            if cat not in VALID_CATEGORIES:
                cat = rules["category"]
            sev = data.get("severity_hint", rules["severity_hint"])
            if sev not in ("low", "medium", "high", "critical"):
                sev = rules["severity_hint"]
            lang = data.get("language", rules["language_guess"])
            summary = data.get("summary", "") or (text or "")[:200]

            return {
                "category": cat,
                "severity_hint": sev,
                "language": lang,
                "summary": summary[:500],
                "method": "llm+rules",
                "suggested_priority": severity_to_priority(sev),
            }
        except Exception:
            # Bad key, quota, network, or malformed JSON — still register complaints
            return {
                "category": rules["category"],
                "severity_hint": rules["severity_hint"],
                "language": rules["language_guess"],
                "summary": (text or "")[:200],
                "method": "rules_only",
                "suggested_priority": severity_to_priority(rules["severity_hint"]),
            }

    async def officer_brief(self, stats_json: str) -> str:
        """Short narrative for admin dashboard."""
        if not self.client:
            return (
                "AI brief: Connect OPENAI_API_KEY for generated summaries. "
                "Use the anomalies panel for spike and duplicate alerts."
            )
        r = self.client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": "You are a governance analyst. Write 3-5 bullet lines for district officers. Be concise.",
                },
                {"role": "user", "content": stats_json[:6000]},
            ],
        )
        return (r.choices[0].message.content or "").strip()

llm_service = LLMService()
