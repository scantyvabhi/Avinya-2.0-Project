# Sentinel — AI-Powered Predictive Maintenance SaaS Platform

> **A full-stack predictive maintenance control room.**
> Continuously monitors industrial machinery, detects multi-factor anomalies in real time, and surfaces AI-generated diagnostics with corrective recommendations.

---

## ✨ Features

- **Real-time multi-sensor monitoring** — temperature, vibration, current, RPM, voltage, humidity, oil level, noise, pressure & power consumption.
- **Live machine simulator** — generates realistic readings every 2 seconds for 5 sample assets (CNC Lathe, Industrial Pump, Air Compressor, Conveyor Belt, HVAC Chiller). Injects faults randomly to demonstrate alerts & diagnostics.
- **Fault Injection Test Lab** — manually push any sensor on any machine out of spec (8 fault types, configurable intensity & duration) to verify the entire alert → diagnostic → recommendation pipeline.
- **Color-coded health dashboard** — green/yellow/red status, health score (0–100) and remaining-useful-life (RUL) per machine.
- **AI diagnostic engine** — rule-based anomaly correlation + **Google Gemini 2.5 Flash** narrative root cause analysis.
- **Energy Optimization** — Gemini-powered analysis of hourly load profile, peak vs off-peak tariff cost breakdown, per-machine shift recommendations (which assets to run during cheap 22:00–06:00 window).
- **Recommendations & safety playbooks** — corrective steps per failure type (e.g. high vibration → check bearings/balance).
- **Digital twin simulation** — schematic view of each machine with floating live-telemetry nodes.
- **Alerts management** — severity badges, acknowledgement workflow, debounced auto-generation from simulator.
- **Maintenance work orders** — schedule, assign, complete with notes.
- **Reports & analytics** — alerts-by-day stacked bar, energy-per-machine, downtime estimate, CSV export.
- **Multi-factory hierarchy** — organization → factory → building → floor → zone → machine.
- **JWT auth with roles** — Factory Owner / Technician.
- **Light & Dark theme toggle** — persists in localStorage.

---

## 🧱 Stack

| Layer    | Technology                                                       |
|----------|------------------------------------------------------------------|
| Frontend | React 19 + React Router + Tailwind + shadcn/ui + Recharts + Sonner |
| Backend  | FastAPI + Motor (async MongoDB) + PyJWT + bcrypt                  |
| Database | MongoDB                                                          |
| AI       | **Google Gemini 2.5 Flash** via `google-genai` SDK (rule-based fallback when no key) |
| Realtime | asyncio background simulator (2 s tick), polling on the frontend |

---

## 📂 Project Structure

```
.
├── backend/                    # FastAPI service
│   ├── server.py               # Main app + all /api routes
│   ├── auth.py                 # JWT + bcrypt helpers
│   ├── models.py               # Pydantic models
│   ├── ai_diagnostic.py        # Rule-based + Claude diagnostic engine
│   ├── simulator.py            # 2-second sensor simulator (asyncio)
│   ├── seed.py                 # Demo data seeding (idempotent)
│   ├── requirements.txt        # Python deps
│   └── .env                    # Environment vars (MONGO_URL, JWT_SECRET, GOOGLE_API_KEY, GEMINI_MODEL, …)
│
├── frontend/                   # React app
│   ├── package.json
│   ├── tailwind.config.js
│   ├── craco.config.js
│   ├── .env                    # REACT_APP_BACKEND_URL
│   ├── public/index.html
│   └── src/
│       ├── App.js              # Router
│       ├── index.js, index.css
│       ├── lib/
│       │   ├── api.js          # Axios client w/ JWT interceptor
│       │   └── auth.jsx        # Auth context
│       ├── components/
│       │   ├── AppLayout.jsx   # Sidebar + topbar with live alerts ticker
│       │   ├── Status.jsx      # Status dots, badges, KPI tile
│       │   └── ui/             # shadcn/ui primitives
│       └── pages/
│           ├── Landing.jsx
│           ├── Login.jsx        Register.jsx
│           ├── Dashboard.jsx    Machines.jsx     MachineDetail.jsx
│           ├── Simulation.jsx   Alerts.jsx
│           ├── Maintenance.jsx  Reports.jsx
│
└── README.md
```

### Key files explained

| File | Purpose |
|------|---------|
| `backend/server.py` | All FastAPI routes (`/api/auth/*`, `/api/machines/*`, `/api/dashboard/overview`, …). Starts the simulator + seed task on boot. |
| `backend/simulator.py` | Background asyncio loop. Generates per-sensor values within each machine's spec range, randomly injects faults, computes health score, persists readings and creates alerts. |
| `backend/ai_diagnostic.py` | Baseline ranges per machine type, deviation analysis, recommendation/safety lookup tables, optional Claude narrative root cause. |
| `backend/seed.py` | Idempotent demo seed (one organization, factory, hierarchy, 5 sample machines, plus demo user). |
| `frontend/src/lib/auth.jsx` | React auth context. Persists JWT + user in `localStorage`. |
| `frontend/src/components/AppLayout.jsx` | App shell with left sidebar nav and top bar containing live alert ticker (auto-refreshed every 4 s). |
| `frontend/src/pages/MachineDetail.jsx` | Live machine view — gauge, real-time sensor charts (poll every 2 s), AI diagnostic panel. |
| `frontend/src/pages/Simulation.jsx` | Digital-twin schematic with overlaid floating telemetry nodes. |

---

## 🚀 Running locally

### Prerequisites
- **Python 3.10+**
- **Node.js 18+** & **Yarn** (`npm install -g yarn`)
- **MongoDB** running locally (default `mongodb://localhost:27017`) — install via [https://www.mongodb.com/docs/manual/installation/](https://www.mongodb.com/docs/manual/installation/) or use Docker:
  ```bash
  docker run -d -p 27017:27017 --name predmaint-mongo mongo:7
  ```

### 1. Backend

```bash
cd backend

# Create a virtualenv (recommended)
python3 -m venv .venv
source .venv/bin/activate     # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# The .env is preconfigured. Update if you want a different DB or to use
# a different Gemini key:
#   MONGO_URL="mongodb://localhost:27017"
#   DB_NAME="predmaint"
#   JWT_SECRET="change-me"
#   GOOGLE_API_KEY="AIza..."          # Google Gemini API key (https://aistudio.google.com → Get API Key)
#   GEMINI_MODEL="gemini-2.5-flash"   # or gemini-2.5-pro / gemini-3-flash-preview
#   USE_LLM="true"                    # set "false" to disable Gemini calls (rule-based only)
#   PEAK_HOUR_START="6"               # tariff peak window start (24h)
#   PEAK_HOUR_END="22"                # tariff peak window end
#   PEAK_RATE="8.0"                   # ₹ per kWh during peak
#   OFFPEAK_RATE="4.0"                # ₹ per kWh off-peak
#   CURRENCY="INR"

# Run the server (port 8001, /api prefix)
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

On startup you should see:
```
[seed] demo data created. Login: demo@predmaint.io / Demo@1234
[simulator] starting loop @ 2s interval
```

### 2. Frontend

```bash
cd frontend
yarn install        # not npm — the project uses yarn
```

Edit `frontend/.env` and set `REACT_APP_BACKEND_URL` to your backend URL:
```
REACT_APP_BACKEND_URL=http://localhost:8001
```

Then:
```bash
yarn start
```

Open `http://localhost:3000`.

### 3. Sign in

The demo account is seeded automatically:

| Email                  | Password   |
|------------------------|------------|
| `demo@predmaint.io`    | `Demo@1234`|

---

## 🔌 IoT / external sensor ingestion

External devices can push readings to `/api/sensors/ingest` (bearer token required).

```http
POST /api/sensors/ingest
Authorization: Bearer <JWT>
Content-Type: application/json

{
  "machine_id": "machine-demo-001",
  "temperature": 78.3,
  "vibration": 4.1,
  "current": 23.5,
  "rpm": 2200,
  "voltage": 230,
  "humidity": 55,
  "oil_level": 70,
  "noise": 78,
  "pressure": 6.5,
  "power_consumption": 7.8
}
```

The server analyses the reading, updates the machine summary, and raises alerts automatically.

---

## 🛠️ Key API endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Create user (creates org if `organization_name` provided) |
| POST | `/api/auth/login` | Returns JWT + user payload |
| GET | `/api/auth/me` | Current user |
| GET | `/api/dashboard/overview` | KPIs + machine grid + recent alerts |
| GET | `/api/machines` | List (filter `status`, `factory_id`) |
| POST | `/api/machines` | Register a machine |
| GET | `/api/machines/{id}` | Machine details |
| DELETE | `/api/machines/{id}` | Remove machine (cascades sensors & alerts) |
| GET | `/api/machines/{id}/sensors/latest` | Latest live reading |
| GET | `/api/machines/{id}/sensors/history?limit=60` | Historical readings |
| GET | `/api/machines/{id}/diagnostic?ai=true` | AI/rule-based diagnostic report (Gemini 2.5 Flash) |
| GET | `/api/energy/profile?ai=true` | Hourly load profile, tariff cost, shift recommendations + Gemini narrative |
| POST | `/api/admin/fault/inject` | Inject a fault on a machine (testing). body: `{machine_id, sensor, intensity, duration_seconds}` |
| POST | `/api/admin/fault/clear` | Clear a manual fault |
| GET | `/api/admin/fault/state/{machine_id}` | Current fault state |
| POST | `/api/sensors/ingest` | External IoT ingest |
| GET | `/api/alerts` | List alerts (filter `acknowledged`) |
| POST | `/api/alerts/{id}/acknowledge` | Ack an alert |
| GET, POST | `/api/maintenance` | List / create work orders |
| POST | `/api/maintenance/{id}/complete` | Mark completed |
| GET | `/api/reports/summary` | Alerts by day + energy by machine |

Full schema available at `http://localhost:8001/docs` (auto-generated Swagger UI).

---

## 🧪 Demonstration tips

- Open `/app/simulation` — pick different machines to see live schematic overlays.
- Open `/app/machines/machine-demo-002` (Industrial Pump) and wait — random faults will spawn alerts and the diagnostic panel will provide AI-generated explanations.
- Click **Run AI Diagnostic** on any machine to get a Claude-generated root-cause narrative (falls back to rule-based if no LLM key).
- Use **Export CSV** on Reports for offline analysis.

---

## 🤖 Google Gemini Integration Guide

This project uses the official **`google-genai`** SDK (v1.8.0) with model **`gemini-2.5-flash`** for two purposes:

1. **Predictive maintenance root-cause analysis** — `backend/ai_diagnostic.py::llm_root_cause()`
2. **Energy optimization narrative** — `backend/energy_optimizer.py::llm_energy_narrative()`

### How to get your own Gemini API key

1. Go to **[https://aistudio.google.com/](https://aistudio.google.com/)** and sign in with your Google account.
2. Click **"Get API key" → "Create API key"**.
3. Pick (or create) a Google Cloud project — Firebase projects work too.
4. Copy the generated key (looks like `AIzaSy…`).

### Configure it in this project

Edit `backend/.env`:

```bash
GOOGLE_API_KEY="AIzaSy…your-key…"
GEMINI_MODEL="gemini-2.5-flash"     # or gemini-2.5-pro for deeper reasoning
USE_LLM="true"
```

Restart the backend (`sudo supervisorctl restart backend` or rerun uvicorn).
That's it — both endpoints will now use your Gemini account.

### Switching to a different Gemini model

The model identifier is fully configurable through the `GEMINI_MODEL` env var. The official identifiers we support:

| Model | Identifier | Best for |
|-------|-----------|----------|
| Gemini 2.5 Flash | `gemini-2.5-flash` | Default — fast & cost-effective |
| Gemini 2.5 Pro   | `gemini-2.5-pro`   | Deeper analytical reasoning |
| Gemini 3 Flash   | `gemini-3-flash-preview` | Latest preview |

No code changes needed — just update `.env` and restart.

### How it's wired in code

```python
# backend/ai_diagnostic.py
from google import genai
from google.genai import types

client = genai.Client(api_key=os.environ["GOOGLE_API_KEY"])
response = client.models.generate_content(
    model=os.environ.get("GEMINI_MODEL", "gemini-2.5-flash"),
    contents=prompt,
    config=types.GenerateContentConfig(
        temperature=0.3,
        max_output_tokens=220,
        system_instruction="You are an expert industrial reliability engineer..."
    ),
)
print(response.text)
```

### Costs & quotas

Gemini 2.5 Flash is heavily subsidized for development use. For production
workloads consult [Google's pricing page](https://ai.google.dev/pricing).
A typical diagnostic call here uses ~250 input tokens + 200 output tokens.

---

## 🧪 Fault Injection Test Lab

Navigate to **/app/test-lab** in the UI (or `POST /api/admin/fault/inject`).
Select a machine, a fault type (temperature, vibration, current, oil level,
voltage, pressure, noise, power), set intensity (0.3–1.5) and duration
(seconds). The simulator immediately pushes that sensor out of spec —
generating alerts, dropping the health score, and giving the diagnostic
engine real data to chew on.

```http
POST /api/admin/fault/inject
Authorization: Bearer <JWT>

{
  "machine_id": "machine-demo-001",
  "sensor": "temperature",
  "intensity": 1.0,
  "duration_seconds": 60
}
```

Use this to **demo** the full predictive pipeline end-to-end without waiting
for the random fault injector. The Active Faults board shows live state
across the fleet.

---

## ⚡ Energy Optimization

Navigate to **/app/energy** in the UI. The page shows:

- Today's total spend split into peak vs off-peak windows.
- 24-hour bar chart (orange = peak hours, green = off-peak).
- **Gemini narrative** with concrete shift recommendations.
- Per-machine table with shiftability score, current draw, potential daily
  savings (₹), and a tailored recommendation.

Tariff bands are configurable via env vars in `backend/.env`
(`PEAK_HOUR_START`, `PEAK_HOUR_END`, `PEAK_RATE`, `OFFPEAK_RATE`,
`CURRENCY`).

---

## 🎨 Theme Toggle

Click the sun/moon icon in the top bar to switch between **dark** (default,
industrial control-room aesthetic) and **light** (clean studio look). The
choice is persisted in `localStorage` (`pm_theme`).

- The included `GOOGLE_API_KEY` is the user's personal Gemini key — keep it private. Rotate via [aistudio.google.com](https://aistudio.google.com) → API keys.
- MongoDB collection sizes are trimmed automatically (latest 500 readings per machine kept).
- The frontend polls every 2 seconds; for very large fleets, replace polling with WebSocket / MQTT.

---

© 2026 Sentinel Predictive Ops · Built end-to-end with Emergent.
