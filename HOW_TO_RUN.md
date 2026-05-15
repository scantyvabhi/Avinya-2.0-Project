# How to run Sentinel on your laptop

A step-by-step guide for **Windows**, **macOS** and **Linux**.

> 💡 Total time: ~5 minutes if you already have Python, Node, and MongoDB.

---

## 0. What you'll get

After following this guide, you will have:
- Backend running on **http://localhost:8001** (FastAPI + Gemini 2.5 Flash + simulator)
- Frontend running on **http://localhost:3000** (React app)
- A seeded demo user, factory and 5 simulated machines pushing live sensor data every 2 s
- The full UI: dashboard, machines, machine detail, digital twin, energy optimizer, fault test lab, alerts, maintenance, reports

---

## 1. Prerequisites

Install these once:

### Python 3.10 or higher
- **Windows**: [https://www.python.org/downloads/windows/](https://www.python.org/downloads/windows/) (check "Add to PATH" during install)
- **macOS**: `brew install python@3.12`
- **Linux**: `sudo apt install python3 python3-venv python3-pip`

Verify: `python --version` (or `python3 --version`)

### Node.js 18+ and Yarn
- **Windows / macOS**: [https://nodejs.org/](https://nodejs.org/) (download LTS)
- **Linux**: `sudo apt install nodejs npm`
- Then install Yarn globally: `npm install -g yarn`

Verify: `node --version` and `yarn --version`

### MongoDB Community Edition

Easiest path is **Docker**:
```bash
docker run -d -p 27017:27017 --name predmaint-mongo mongo:7
```

If you don't have Docker, install MongoDB directly:
- **Windows**: [https://www.mongodb.com/try/download/community](https://www.mongodb.com/try/download/community)
- **macOS**: `brew tap mongodb/brew && brew install mongodb-community && brew services start mongodb-community`
- **Linux (Ubuntu/Debian)**: follow [https://www.mongodb.com/docs/manual/tutorial/install-mongodb-on-ubuntu/](https://www.mongodb.com/docs/manual/tutorial/install-mongodb-on-ubuntu/)

Verify it's running:
```bash
mongosh --eval "db.runCommand({ping:1})"
```
You should see `{ ok: 1 }`.

---

## 2. Unzip the project

```bash
unzip sentinel-predictive-maintenance.zip -d sentinel
cd sentinel
```

You should now see:
```
sentinel/
├── backend/
├── frontend/
├── README.md
└── HOW_TO_RUN.md   (this file)
```

---

## 3. Run the backend

Open **Terminal #1** in the `sentinel` folder.

### macOS / Linux
```bash
cd backend

# Create a virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies (takes ~1-2 minutes)
pip install -r requirements.txt

# Start the server
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

### Windows (PowerShell)
```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

> If PowerShell blocks the activation script, run once:
> `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`

You should see:
```
INFO:predmaint:Seeding demo data…
[seed] demo data created. Login: demo@predmaint.io / Demo@1234
INFO:predmaint:Starting simulator loop…
[simulator] starting loop @ 2s interval
INFO:     Uvicorn running on http://0.0.0.0:8001
```

✅ Backend is ready. Leave this terminal running.

Quick smoke test in another terminal:
```bash
curl http://localhost:8001/api/health
# → {"status":"ok","time":"..."}
```

---

## 4. Run the frontend

Open **Terminal #2** in the `sentinel` folder.

```bash
cd frontend

# Tell the frontend where the backend is
# (edit .env — change REACT_APP_BACKEND_URL to http://localhost:8001)
```

**Edit `frontend/.env`** so it looks like:
```
REACT_APP_BACKEND_URL=http://localhost:8001
WDS_SOCKET_PORT=0
```

> Windows users: use Notepad or VS Code. Don't put quotes around the URL.

Then install & start:
```bash
yarn install     # takes ~2-3 minutes the first time
yarn start
```

After a moment, your browser opens **http://localhost:3000** automatically.

---

## 5. Log in and explore

The backend auto-seeded **two** demo accounts on first run:

| Role | Email | Password | What you see |
|------|-------|----------|--------------|
| **Factory Owner** | `demo@predmaint.io` | `Demo@1234` | Full control room — dashboard, machines, energy, reports, fault test lab |
| **Technician**    | `tech@predmaint.io` | `Tech@1234` | Technician workspace — my dashboard, my tasks, raise new request, all work orders |

> 💡 Open **two browser windows** side-by-side: sign in as **owner** in one and **technician** in the other. Create / assign / start / close a work order in either window — the other one syncs within 4 seconds.

### Try every feature

| Feature | Where to find it |
|---------|------------------|
| Live fleet dashboard | `/app/dashboard` — 5 machines, KPIs, alerts ticker |
| Machine detail with live charts | click any machine card → 6 sensor charts update every 2 s |
| AI diagnostic (Gemini 2.5 Flash) | machine detail → **Run AI Diagnostic** button |
| Digital twin simulation | sidebar → **Digital Twin** |
| **Fault Injection Test Lab** | sidebar → **Test Lab** — pick a sensor, intensity, duration → **Inject fault** |
| **Energy Optimization** | sidebar → **Energy** — peak/off-peak cost analysis + Gemini recommendations |
| Alerts | sidebar → **Alerts** — acknowledge anomalies |
| Maintenance work orders | sidebar → **Maintenance** |
| Reports + CSV export | sidebar → **Reports** |
| **Theme toggle** | sun/moon icon in the top bar (top right) |

---

## 6. Customize (optional)

All configuration lives in `backend/.env`:

```bash
# Database
MONGO_URL="mongodb://localhost:27017"
DB_NAME="test_database"

# Authentication
JWT_SECRET="change-me-in-prod-7d3a8b9c2e1f4a5b6c7d8e9f0a1b2c3d"
JWT_EXPIRES_HOURS="24"

# Google Gemini AI
GOOGLE_API_KEY="AIzaSy…"             # your Gemini API key (already filled in)
GEMINI_MODEL="gemini-2.5-flash"      # or gemini-2.5-pro / gemini-3-flash-preview
USE_LLM="true"                       # set "false" to run rule-based only

# Energy tariff (used by the Energy page)
PEAK_HOUR_START="6"                  # peak window starts at 06:00
PEAK_HOUR_END="22"                   # ends at 22:00
PEAK_RATE="8.0"                      # currency per kWh during peak
OFFPEAK_RATE="4.0"                   # currency per kWh during 22:00-06:00
CURRENCY="INR"
```

After editing, restart the backend (Ctrl+C in Terminal #1, then `uvicorn server:app --reload` again).

### Get your own Gemini API key

If you want to use a fresh key:
1. Go to [https://aistudio.google.com/](https://aistudio.google.com/)
2. Sign in with Google → **Get API key** → **Create API key**
3. Paste it into `backend/.env` as `GOOGLE_API_KEY`
4. Restart backend

---

## 7. Troubleshooting

| Problem | Fix |
|---------|-----|
| `MongoDB connection refused` | Confirm mongo is running: `docker ps` (if Docker) or `brew services list` (mac). Or change `MONGO_URL` in `backend/.env`. |
| `Port 8001 already in use` | Kill the other process or change port: `uvicorn server:app --port 8002` and update `frontend/.env` to match. |
| `yarn: command not found` | `npm install -g yarn` |
| Frontend stuck on "Synchronising telemetry…" | Backend isn't running, or `REACT_APP_BACKEND_URL` in `frontend/.env` is wrong. After editing `.env` you must restart `yarn start`. |
| Login fails | The backend seeds the demo user only on **first** start. If your DB had a previous run with a different user, drop the database: `mongosh test_database --eval "db.dropDatabase()"` then restart backend. |
| Gemini calls fail / "ai_powered: false" | Verify `GOOGLE_API_KEY` is valid at [aistudio.google.com](https://aistudio.google.com). Check backend logs for the exact error. The app still works — it just falls back to rule-based diagnostics. |
| Charts show no data | Wait 5–10 seconds. The simulator publishes its first reading after 2 seconds. |
| `python` not found on Windows | Try `py -3` or reinstall Python with "Add to PATH" enabled. |

---

## 8. Stopping

Press **Ctrl+C** in each terminal.
If you used Docker MongoDB: `docker stop predmaint-mongo` (and `docker start predmaint-mongo` next time).

---

## 9. Demo script (for your presentation)

A suggested 90-second walkthrough:

1. **Land on login** → click *Use demo account* → land on **Control Room** dashboard. Point out the 5 KPI tiles, the live chart updating every 2 s, the alerts ticker scrolling across the top, the color-coded machine cards.
2. Click any machine (say **Industrial Pump #1**) → show the **health gauge**, the **6 live sensor charts**, the **10-sensor snapshot grid**.
3. Click **Run AI Diagnostic** → Gemini 2.5 Flash root-cause analysis appears with recommendations + safety instructions.
4. Sidebar → **Test Lab** → pick *Vibration spike*, intensity *1.2*, duration *60 s*, machine *Industrial Pump #1* → **Inject fault**. Switch back to the machine's detail page → watch the vibration chart **spike in real time**, the status flip to **warning**, and an alert pop into the ticker.
5. Sidebar → **Energy** → highlight the off-peak savings card, the hourly bar chart with the off-peak window shaded green, and the **Gemini recommendation** for which machines to shift.
6. Toggle the sun/moon icon → switch theme → everything re-themes smoothly.
7. Sidebar → **Reports** → click **Export CSV**.

---

Have fun. If anything breaks, check the troubleshooting table or open `backend/` server logs.
