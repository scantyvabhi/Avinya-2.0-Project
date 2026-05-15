## What is this project?

**Sentinel** is a full-stack AI-powered Predictive Maintenance SaaS platform. It monitors industrial machinery in real time, detects multi-factor anomalies, and surfaces AI-generated diagnostics with corrective recommendations.

## Quick start

1. Read **[HOW_TO_RUN.md](./HOW_TO_RUN.md)** — step-by-step setup for Windows / macOS / Linux.
2. Read **[README.md](./README.md)** — full feature list, architecture, API reference, Gemini guide.

## File / folder purpose

| Path | Purpose |
|------|---------|
| `backend/server.py` | FastAPI app — all `/api/*` routes (auth, machines, sensors, diagnostic, energy, fault injection, alerts, maintenance, reports). |
| `backend/auth.py` | JWT + bcrypt helpers. |
| `backend/models.py` | Pydantic request/response models. |
| `backend/ai_diagnostic.py` | Rule-based anomaly engine + **Google Gemini 2.5 Flash** root-cause analysis. |
| `backend/energy_optimizer.py` | Hourly tariff analysis, shiftability scoring, Gemini-powered narrative. |
| `backend/simulator.py` | asyncio background task that emits sensor readings every 2 s. Supports **manual fault injection**. |
| `backend/seed.py` | Idempotent demo seed (creates `demo@predmaint.io` / `Demo@1234`, factory, 5 machines). |
| `backend/.env` | Configuration: `MONGO_URL`, `JWT_SECRET`, `GOOGLE_API_KEY`, `GEMINI_MODEL`, tariff rates. |
| `backend/requirements.txt` | Python dependencies (`fastapi`, `motor`, `google-genai`, `bcrypt`, `pyjwt`). |
| `frontend/src/App.js` | React router & top-level providers. |
| `frontend/src/lib/auth.jsx` | Auth context (JWT in localStorage). |
| `frontend/src/lib/theme.jsx` | Dark / light theme context. |
| `frontend/src/lib/api.js` | Axios instance with bearer-token interceptor. |
| `frontend/src/components/AppLayout.jsx` | Sidebar + topbar with alerts ticker + theme toggle. |
| `frontend/src/components/Status.jsx` | Status dots, badges, KPI tile. |
| `frontend/src/pages/Landing.jsx` | Public landing page. |
| `frontend/src/pages/Login.jsx` / `Register.jsx` | Auth pages. |
| `frontend/src/pages/Dashboard.jsx` | Control-room overview: KPIs, live chart, machine grid, alerts. |
| `frontend/src/pages/Machines.jsx` | Machine inventory list + create/delete. |
| `frontend/src/pages/MachineDetail.jsx` | Live machine view: gauge, 10-sensor snapshot, 6 charts, AI diagnostic. |
| `frontend/src/pages/Simulation.jsx` | Digital twin schematics with floating live telemetry. |
| `frontend/src/pages/Energy.jsx` | **Energy optimization**: hourly load chart, peak/off-peak cost split, Gemini narrative, per-machine shift recommendations. |
| `frontend/src/pages/TestLab.jsx` | **Fault Injection Test Lab**: force anomalies for testing. |
| `frontend/src/pages/Alerts.jsx` | Alerts list + acknowledge. |
| `frontend/src/pages/Maintenance.jsx` | Work-orders list / create / complete. |
| `frontend/src/pages/Reports.jsx` | Bar charts + CSV export. |
| `frontend/src/components/ui/` | shadcn/ui primitives. |
| `frontend/tailwind.config.js` | Tailwind theme — fonts, colors, animations. |
| `frontend/src/index.css` | Global styles + dark/light CSS variables. |
| `frontend/.env` | Configuration: `REACT_APP_BACKEND_URL`. |
| `frontend/package.json` | Node dependencies. |
