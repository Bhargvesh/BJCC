# 🏛️ Bhashini-Integrated Real-Time Judicial Assistant
### JK Governance System — India Innovation Prototype

A prototype governance system featuring two India-specific innovations:
1. **Bhashini-integrated Real-Time Judicial Assistant** — multilingual legal access via ASR, translation, and legal summarization
2. **Offline UPI Micropayment via Sound Waves** — token-based offline payment demo using audio encoding/decoding

---

## 📁 Project Structure

```
jk-governance-system/
│
├── backend/                        # Python FastAPI backend
│   ├── app/
│   │   ├── main.py                 # FastAPI app entry point, routes & static file serving
│   │   ├── auth_store.py           # In-memory user store (demo auth)
│   │   ├── routes/
│   │   │   └── innovation.py       # All API routes: auth, judicial search, assistant, payments
│   │   ├── services/
│   │   │   ├── ai_engine.py        # AI logic engine
│   │   │   ├── llm_service.py      # OpenAI / LLM service integration
│   │   │   ├── speech_to_text.py   # Whisper-based ASR (voice → text)
│   │   │   ├── nlp_classifier.py   # NLP classifier
│   │   │   └── severity_scorer.py  # Severity scoring for complaints
│   │   └── static/                 # Served HTML/CSS/JS pages (served by FastAPI)
│   │       ├── login.html          # Login page
│   │       ├── signup.html         # Sign up page
│   │       ├── india_innovation.html  # Main demo page (judicial + payment)
│   │       ├── india_innovation.js    # All frontend JS logic
│   │       ├── india_innovation.css   # Styling for demo page
│   │       └── auth.css            # Styling for login/signup pages
│   ├── .env                        # Environment variables (OpenAI API key)
│   ├── requirements.txt            # Python dependencies
│   └── Dockerfile                  # Docker config for backend
│
├── frontend/                       # React + Vite frontend (Governance Portal)
│   ├── src/
│   │   ├── App.jsx                 # React router + page layout
│   │   ├── pages/
│   │   │   ├── LandingPage.jsx     # Home/landing page
│   │   │   ├── CitizenPortal.jsx   # Citizen-facing portal
│   │   │   ├── ComplaintForm.jsx   # Complaint registration form
│   │   │   ├── TrackComplaint.jsx  # Track complaint by ticket ID
│   │   │   ├── AdminLogin.jsx      # Admin login (prototype, skipped)
│   │   │   ├── AdminDashboard.jsx  # Admin dashboard
│   │   │   └── DistrictAdmin.jsx   # District-level admin view
│   │   ├── components/             # Reusable UI components
│   │   ├── styles/
│   │   │   └── global.css          # Global CSS styles
│   │   ├── services/               # API service calls
│   │   ├── context/                # React context (state management)
│   │   ├── hooks/                  # Custom React hooks
│   │   └── utils/                  # Utility functions
│   ├── package.json                # Node dependencies
│   └── vite.config.js              # Vite build config
│
├── run-backend.bat                 # ▶ One-click backend start (Windows)
├── run-frontend.bat                # ▶ One-click frontend start (Windows)
├── docker-compose.yml              # Docker Compose for full stack
└── index.html                      # Root redirect HTML
```

---

## 🚀 How to Run

### ▶ Start Backend (Main App)

Double-click or run in terminal:
```bat
run-backend.bat
```

This will:
- Create a Python virtual environment (`.venv`) if not present
- Install all dependencies from `requirements.txt`
- Start the FastAPI server at **http://127.0.0.1:8000**

> **Main app pages (served by backend):**
> - http://127.0.0.1:8000 → Login page
> - http://127.0.0.1:8000/signup → Sign up
> - http://127.0.0.1:8000/india-innovation → Main demo (judicial + payment)
> - http://127.0.0.1:8000/docs → Swagger API docs

### ▶ Start Frontend (Governance Portal — optional)

Double-click or run:
```bat
run-frontend.bat
```

This starts the React governance portal (complaint system) at **http://localhost:5173**

---

## 🔑 Login Credentials

| Type | Email | Password |
|------|-------|----------|
| Demo (always works) | `demo@judicial.in` | `demo1234` |
| Your own account | Register at `/signup` | Password you set |

> ⚠️ **Important:** This is an **in-memory** demo system. Any accounts you sign up with are **lost when the backend restarts**. The demo account (`demo@judicial.in`) is always pre-seeded and will always work.

---

## 🔍 How to Use the Judicial Search Filters

The main demo page (`/india-innovation`) has a **Judicial Data** section with 4 filters:

### Search Box
Type any keyword — case name, parties, topic, act name, or section.

| Example | Finds |
|---------|-------|
| `RTI answer sheets` | CBSE v. Aditya Bandopadhyay |
| `Aadhaar privacy` | K.S. Puttaswamy v. Union of India |
| `arbitration stamp` | N.N. Global Mercantile arbitration case |

### Court Filter
Filter by court name. All current cases are from **Supreme Court of India**.

| Type | Result |
|------|--------|
| `Supreme Court` | All 3 cases |
| *(leave blank)* | No court filter |

### Act Filter
Filter by Act name. Available acts in dataset:

| Type | Finds |
|------|-------|
| `RTI Act` | CBSE answer sheets case |
| `Aadhaar` | Puttaswamy (Aadhaar) case |
| `Constitution` | Puttaswamy case |
| `Arbitration` | N.N. Global arbitration case |
| `Stamp Act` | Arbitration case |

### Language
Select output language: **English**, **Hindi**, or **Dogri**. All 3 sample cases support all 3 languages.

### Buttons
- **Search** → runs the query with filters applied
- **Load examples** → auto-fills a demo search query

---

## 🧠 Features

### 1. Bhashini Judicial Assistant
- **Speech-to-Text (ASR)**: Click "Dictate" button → speak → text appears in the query box (uses Whisper if installed, else demo mode)
- **Legal Q&A**: Type a question in the assistant box → click "Ask" → get a structured answer from the local legal dataset
- **Multilingual**: Responses can be delivered in Hindi/Dogri (mock Bhashini translation in demo)

### 2. Offline UPI Sound Wave Payment
- **Create Token**: Enter payee VPA, amount (₹), and note → click "Create token"
- **Play Sound**: Token encoded as audio → plays through speaker
- **Listen (Mic)**: Receiver's device listens and decodes the token
- **Confirm**: Verifies and confirms the payment server-side

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend API | **FastAPI** (Python) |
| Auth | Custom JWT (HMAC-SHA256, in-memory demo) |
| Password Hashing | **bcrypt** |
| Voice/ASR | **Whisper** (OpenAI) via `speech_to_text.py` |
| LLM Integration | **OpenAI API** (`llm_service.py`) |
| ML/NLP | **scikit-learn**, **numpy** |
| Frontend (Portal) | **React 18** + **Vite** + **React Router v6** |
| Styling | Vanilla CSS (DM Sans + Fraunces fonts from Google Fonts) |
| Serving Static Pages | FastAPI `StaticFiles` + `FileResponse` |

---

## 📦 Python Dependencies (`requirements.txt`)

```
fastapi              # Web framework
uvicorn[standard]    # ASGI server
python-dotenv        # Load .env file
httpx                # HTTP client
python-multipart     # File upload support (audio)
openai               # OpenAI API (Whisper + GPT)
bcrypt               # Password hashing
PyJWT                # JWT utilities
google-auth          # Google OAuth (optional)
email-validator      # Email validation
numpy                # Numerical operations
scikit-learn         # ML / NLP classifier
```

---

## ⚙️ Environment Variables

Create/edit `backend/.env`:

```env
OPENAI_API_KEY=your-openai-api-key-here
```

Get your key at: https://platform.openai.com/api-keys

> Without an OpenAI key, voice-to-text runs in **demo mode** and LLM features use fallback responses.

---

## 🐳 Docker (Optional)

Run full stack with Docker:
```bash
docker-compose up --build
```

---

## 📋 API Endpoints

All routes are under `/api/innovation/`:

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/auth/signup` | Register new user |
| `POST` | `/auth/login` | Login, returns JWT token |
| `GET` | `/auth/me` | Get current user info |
| `GET` | `/judicial/search` | Search judicial docs (q, court, act, lang) |
| `GET` | `/judicial/{doc_id}` | Get single judicial document |
| `POST` | `/assistant/chat` | Ask the judicial AI assistant |
| `POST` | `/voice-to-text` | Upload audio → get transcribed text |
| `POST` | `/payments/create` | Create UPI sound token |
| `POST` | `/payments/confirm` | Confirm/verify decoded token |
| `GET` | `/payments/{payment_id}` | Get payment status |

Full interactive docs: **http://127.0.0.1:8000/docs**
