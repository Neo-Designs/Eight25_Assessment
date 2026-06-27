# Website Audit Tool — Setup Guide

AI-powered single-page website audit for EIGHT25MEDIA. Scrapes factual metrics with Playwright, analyzes with Groq LLM, and displays results in a Next.js dashboard.

---

## Architecture

| Layer | Stack | Host |
|-------|-------|------|
| Frontend | Next.js 16, React 19, Tailwind 4 | [Vercel](https://vercel.com) |
| Backend | FastAPI, Playwright, Groq (OpenAI SDK) | [Render](https://render.com) |
| Database | SQLite (local) or PostgreSQL/Supabase (prod) | Supabase |

---

## Prerequisites

- **Python 3.11+**
- **Node.js 20+**
- **Groq API key** — [console.groq.com](https://console.groq.com)
- **PostgreSQL** (production only — Supabase works)

---

## Local Development

### 1. Clone and configure environment

```bash
git clone <your-repo-url>
cd Eight25_Assessment
cp template.env .env
```

Edit `.env` in the **repo root**:

```env
GROQ_API_KEY=gsk_your_key_here
GROQ_MODEL_NAME=llama-3.3-70b-versatile
DATABASE_URL=sqlite:///./audit_tool.db
JWT_SECRET_KEY=your_random_secret_here
CORS_ORIGINS=
NEXT_PUBLIC_API_URL=http://localhost:8000
```

> **Note:** `llama3-70b-8192` was retired by Groq. Use `llama-3.3-70b-versatile`.

### 2. Backend setup

```bash
cd backend
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS/Linux
source .venv/bin/activate

pip install -r requirements.txt
python -m playwright install chromium
```

Start the API (from `backend/`):

```bash
python run.py
```

Health check: [http://localhost:8000/api/health](http://localhost:8000/api/health)

Optional hot reload:

```bash
set UVICORN_RELOAD=true   # Windows
export UVICORN_RELOAD=true  # macOS/Linux
python run.py
```

### 3. Frontend setup

In a **second terminal**:

```bash
cd frontend
npm install
```

Create `frontend/.env.local` (or rely on root `.env` via Vercel):

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Start the dashboard:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), enter a URL, and run an audit.

### 4. Run tests

```bash
cd backend
pytest -q
```

---

## Production Deployment

### Backend on Render

1. Push repo to GitHub.
2. In Render: **New → Blueprint** (uses `render.yaml`) or **New Web Service → Docker**.
3. Set **Root Directory** to `backend` if not using Blueprint.
4. Add environment variables:

| Variable | Value |
|----------|-------|
| `GROQ_API_KEY` | Your Groq key |
| `GROQ_MODEL_NAME` | `llama-3.3-70b-versatile` |
| `DATABASE_URL` | Supabase PostgreSQL connection string |
| `JWT_SECRET_KEY` | Long random string |
| `CORS_ORIGINS` | Your Vercel URL, e.g. `https://eight25-assessment.vercel.app` |

5. Deploy. Note your Render URL (e.g. `https://eight25-audit-api.onrender.com`).

**Supabase tip:** Use the **Transaction pooler** URL (port 6543). SSL is handled automatically by the backend.

### Frontend on Vercel

1. Import the GitHub repo in Vercel.
2. Set **Root Directory** to `frontend`.
3. Add environment variable:

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_API_URL` | Your Render backend URL (no trailing slash) |

4. Deploy. Add the Vercel URL to Render's `CORS_ORIGINS`.

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/audit/start` | Scrape + AI analyze a URL |
| `GET` | `/api/audit/{id}/results` | Fetch audit results |
| `GET` | `/api/audit/{id}/logs` | Prompt trace (debug) |
| `POST` | `/api/chat` | Follow-up Q&A on an audit |
| `GET` | `/api/history` | Past audits |
| `GET` | `/api/health` | Health + AI status |

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `500` on `/api/audit/start` | Check `GROQ_API_KEY`, Groq model name, and Render logs for Playwright errors |
| `503 Audit pipeline unavailable` | `GROQ_API_KEY` missing or invalid at startup |
| `GROQ_QUOTA_EXCEEDED` | Update key via the in-app modal or Groq console |
| Frontend can't reach API | Set `NEXT_PUBLIC_API_URL` and add Vercel origin to `CORS_ORIGINS` |
| Database errors on Render | Verify Supabase `DATABASE_URL`; tables auto-create on first boot |
| Playwright fails in Docker | Rebuild image — Chromium is installed in `backend/Dockerfile` |

---

## Project Structure

```
Eight25_Assessment/
├── backend/           # FastAPI API
│   ├── app/
│   │   ├── scraper.py      # Playwright extraction
│   │   ├── analyzer.py     # AI orchestration
│   │   ├── ai_engine.py    # Groq client
│   │   ├── pipeline.py     # Scrape → Analyze → Persist
│   │   └── audit.py        # HTTP routes
│   └── prompts/            # Bundled for Docker deploy
├── frontend/          # Next.js dashboard
├── prompts/           # Source prompt templates
├── shared/api.ts      # Frontend API client
├── template.env       # Env template
└── render.yaml        # Render Blueprint
```

---

## Security Notes

- Never commit `.env` — it is gitignored.
- Rotate `JWT_SECRET_KEY` and API keys if exposed.
- The `/api/admin/update-groq-key` endpoint should be restricted in production.
