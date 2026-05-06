# J&K Governance Prototype — Simple guide

This document explains **what technology this project uses**, **how AI is used**, **what you could add later**, and **what is *not* included** (both in this demo and in comparison with the national **SAMADHAN** labour portal).

---

## 1. Technology (in simple words)

| Piece | What it is | Role here |
|--------|------------|-----------|
| **Python** | Programming language | Runs all server logic |
| **FastAPI** | Web framework | Exposes REST APIs (`/api/...`) for complaints, news, AI, auth, chat |
| **Uvicorn** | App server | Serves the FastAPI app (e.g. port 8000) |
| **HTML + CSS + JavaScript** | Browser pages | Citizen portal (`index.html`), admin portal (`index2.html`) — no React required for the main flow |
| **OpenAI API** (optional) | Cloud AI service | Powers live LLM features when `OPENAI_API_KEY` is set in `backend/.env` |
| **httpx** | HTTP client | Fetches public RSS news for Jammu / Kashmir / development headlines |
| **RSS feeds** | News format | Headlines aggregated for the portal sections (not official government feeds unless you plug those in later) |
| **In-memory storage** | Data kept in RAM | Complaints live in a Python list — **data is lost when the server stops** (prototype only) |
| **scikit-learn** (optional) | Machine learning library | **Isolation Forest** for unusual complaint patterns when enough data exists |
| **bcrypt / JWT / google-auth** | Security libraries | Password hashing, tokens, optional Google sign-in (when configured) |

**Summary:** A small **Python backend** talks to the **browser** over HTTP. **AI** is optional and runs **on the server** via OpenAI; citizens never paste API keys in the webpage.

---

## 2. What we are doing with AI in *this* project

| Feature | What AI does |
|---------|----------------|
| **Complaint analysis (on submit)** | Suggests **category**, **priority** (red / yellow / green), short **officer summary**, merged with **keyword rules**. If the API key is missing or fails, **rules only** still run so complaints can register. |
| **“Run AI analysis” (preview)** | Same kind of analysis **without saving** the complaint — for citizens to preview before submit. |
| **Floating chatbot** | Answers **how to register**, **track tickets**, **priority levels**, in **Hindi / Urdu / English** when the LLM is available; otherwise a **fixed offline help** text. |
| **District admin — AI brief** | Optional **short narrative** for officers from complaint stats (needs a valid key for real generated text). |
| **Anomalies** | Mostly **statistics** (spikes per district) + optional **Isolation Forest** — not “generative AI,” but **data-driven alerts**. |
| **Duplicate awareness** | **Similarity search** over past complaints in the same district to flag possible duplicates (algorithmic, not necessarily LLM). |

**Important:** AI here **assists** routing and communication. It does **not** replace legal processes, official orders, or verified government data.

---

## 3. What you could do in the future with AI

These are **ideas**, not implemented promises:

- **Stronger multilingual models** tuned for Kashmiri / Dogri / regional phrasing, with human review.
- **Automatic translation** of citizen text for officers and **summaries** for dashboards.
- **Sentiment / urgency triage** to help desks (always with audit and override by humans).
- **Document understanding** if citizens upload PDFs or long descriptions (with privacy review).
- **Predictive workload** — forecast complaint volume per district or season.
- **Voice / speech** — speech-to-text for kiosks or helplines, integrated with the same APIs.
- **Integration with official data** — weather, outage maps, hospital load — for smarter **context** (requires government data partnerships).
- **Fraud / spam detection** on repeated abusive filings (ethical + legal safeguards needed).

Anything that affects **rights, penalties, or binding decisions** should stay under **human authority** and **clear rules**.

---

## 4. What this prototype is **not** doing (limits of *this* demo)

This is **not** a full government production system. In particular:

- **No permanent database** in the default prototype — complaints can **disappear on restart**.
- **No legal standing** — tickets are **demo IDs**, not linked to real departments or courts.
- **No end-to-end identity verification** of citizens at national scale (unless you extend auth and integrate official ID systems).
- **No guaranteed SLA enforcement** — red/yellow/green labels are **design aids**, not statutory commitments.
- **News** comes from **public RSS search** for demonstration; it is **not** verified as official government releases unless you replace feeds with **PIB / jk.gov.in** sources.
- **No mobile app store deployment**, **no SMS gateway**, **no payment**, **no digital signatures** in the core demo unless you add them.

---

## 5. SAMADHAN (Labour) — what it is, and what it typically does **not** include

**SAMADHAN** ([samadhan.labour.gov.in](https://samadhan.labour.gov.in/)) is a **Ministry of Labour & Employment, Government of India** initiative: **Software Application for Monitoring And Disposal, Handling of Apprehended/Existing Industrial Dispute**. It focuses on **industrial disputes**, **conciliation**, and related **labour** processes — a different domain from a **general J&K civic grievance** prototype.

**What SAMADHAN is aimed at (high level):** online workflows for **workmen, management, unions**, **documentation**, **monitoring**, and **disposal** of industrial disputes — aligned with labour laws and institutional roles (e.g. conciliation officers).

**What SAMADHAN is generally *not* (in public-facing terms):**

- **Not** a general **municipal** complaint system for roads, water, or city services (that belongs to other schemes / ULBs / state portals).
- **Not** automatically the same as a **generative-AI citizen assistant** — national portals often emphasise **forms, tracking, and transparency** rather than **LLM chat** on the homepage (AI may exist in back-office tools elsewhere; this varies by deployment and policy).
- **Not** a substitute for **legal orders** of labour courts or tribunals — it supports **process**, not automatic judgments.

**This J&K prototype** is **inspired** by the *idea* of a full-width, citizen-friendly portal but is **separate software**, **different scope** (UT grievance demo + AI experiments), and **not** affiliated with SAMADHAN or NIC unless you officially integrate it.

---

## 6. One-line recap

- **Tech:** Python + FastAPI + browser HTML/JS + optional OpenAI + RSS + simple ML helpers.  
- **AI today:** classification help, chat guidance, officer brief, fallbacks when the key is off.  
- **AI tomorrow:** richer language, prediction, and integrations — with governance and privacy.  
- **Gaps:** no real persistence by default, no legal force, news is demo-level; **SAMADHAN** is **labour/industrial dispute** focused, not this civic-AI sandbox.

For **how to run** the project, see `README.md`.
