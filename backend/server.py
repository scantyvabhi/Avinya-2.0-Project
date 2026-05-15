"""Predictive Maintenance SaaS — FastAPI backend."""
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Query, UploadFile, File
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import asyncio
import logging
from pathlib import Path
from datetime import datetime, timezone
from typing import List, Optional

from models import (
    UserRegister, UserLogin, UserPublic,
    FactoryCreate, Factory,
    BuildingCreate, FloorCreate, ZoneCreate,
    MachineCreate, Machine,
    SensorIngest, SensorReading,
    Alert, MaintenanceCreate, MaintenanceTask,
    DiagnosticResponse,
)
from auth import (
    hash_password, verify_password, create_token, get_current_user,
)
from ai_diagnostic import (
    analyze_reading, build_recommendations, build_safety_instructions,
    rule_based_root_cause, llm_root_cause,
)
from simulator import simulator_loop, inject_fault as sim_inject_fault, clear_fault as sim_clear_fault, get_fault_state
from seed import seed_demo_data
from energy_optimizer import (
    compute_hourly_profile, classify_machines_for_shifting,
    summarize_costs, llm_energy_narrative,
)

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

app = FastAPI(title="Predictive Maintenance SaaS API")
api = APIRouter(prefix="/api")


# ---------- Helpers ----------
def _strip(d):
    if isinstance(d, dict):
        d.pop("_id", None)
    return d


def _iso(dt: datetime) -> str:
    return dt.isoformat()


def _parse_dt(value):
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value)
        except Exception:
            return None
    return None


# ---------- ROOT / HEALTH ----------
@api.get("/")
async def root():
    return {"message": "Predictive Maintenance API", "version": "1.0.0"}


@api.get("/health")
async def health():
    return {"status": "ok", "time": _iso(datetime.now(timezone.utc))}


# ---------- AUTH ----------
@api.post("/auth/register")
async def register(payload: UserRegister):
    existing = await db.users.find_one({"email": payload.email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    org = None
    if payload.organization_name:
        org = await db.organizations.find_one(
            {"name": payload.organization_name}, {"_id": 0}
        )
        if not org:
            from uuid import uuid4
            org = {
                "id": str(uuid4()),
                "name": payload.organization_name,
                "created_at": _iso(datetime.now(timezone.utc)),
            }
            await db.organizations.insert_one(org)
            _strip(org)

    from uuid import uuid4
    user_doc = {
        "id": str(uuid4()),
        "email": payload.email,
        "password_hash": hash_password(payload.password),
        "full_name": payload.full_name,
        "role": payload.role if payload.role in ("factory_owner", "technician") else "factory_owner",
        "organization_id": org["id"] if org else None,
        "created_at": _iso(datetime.now(timezone.utc)),
    }
    await db.users.insert_one(user_doc)
    _strip(user_doc)
    token = create_token(user_doc["id"], user_doc["email"], user_doc["role"])
    return {
        "token": token,
        "user": {
            "id": user_doc["id"],
            "email": user_doc["email"],
            "full_name": user_doc["full_name"],
            "role": user_doc["role"],
            "organization_id": user_doc["organization_id"],
        },
    }


@api.post("/auth/login")
async def login(payload: UserLogin):
    user = await db.users.find_one({"email": payload.email}, {"_id": 0})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_token(user["id"], user["email"], user["role"])
    return {
        "token": token,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "full_name": user["full_name"],
            "role": user["role"],
            "organization_id": user.get("organization_id"),
        },
    }


@api.get("/auth/me")
async def me(user=Depends(get_current_user)):
    record = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password_hash": 0})
    if not record:
        raise HTTPException(status_code=404, detail="User not found")
    return record


# ---------- ORG / FACTORIES / HIERARCHY ----------
@api.get("/factories")
async def list_factories(user=Depends(get_current_user)):
    me_doc = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    org_id = me_doc.get("organization_id") if me_doc else None
    if not org_id:
        return []
    items = await db.factories.find({"organization_id": org_id}, {"_id": 0}).to_list(200)
    return items


@api.post("/factories")
async def create_factory(payload: FactoryCreate, user=Depends(get_current_user)):
    me_doc = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    if not me_doc or not me_doc.get("organization_id"):
        raise HTTPException(status_code=400, detail="User has no organization")
    factory = Factory(
        name=payload.name,
        location=payload.location,
        description=payload.description,
        organization_id=me_doc["organization_id"],
    )
    doc = factory.model_dump()
    doc["created_at"] = _iso(doc["created_at"])
    await db.factories.insert_one(doc)
    return _strip(doc)


@api.post("/buildings")
async def create_building(payload: BuildingCreate, user=Depends(get_current_user)):
    me_doc = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    from uuid import uuid4
    doc = {
        "id": str(uuid4()),
        "name": payload.name,
        "factory_id": payload.factory_id,
        "organization_id": me_doc.get("organization_id"),
        "created_at": _iso(datetime.now(timezone.utc)),
    }
    await db.buildings.insert_one(doc)
    return _strip(doc)


@api.post("/floors")
async def create_floor(payload: FloorCreate, user=Depends(get_current_user)):
    me_doc = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    from uuid import uuid4
    doc = {
        "id": str(uuid4()),
        "name": payload.name,
        "building_id": payload.building_id,
        "organization_id": me_doc.get("organization_id"),
        "created_at": _iso(datetime.now(timezone.utc)),
    }
    await db.floors.insert_one(doc)
    return _strip(doc)


@api.post("/zones")
async def create_zone(payload: ZoneCreate, user=Depends(get_current_user)):
    me_doc = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    from uuid import uuid4
    doc = {
        "id": str(uuid4()),
        "name": payload.name,
        "floor_id": payload.floor_id,
        "organization_id": me_doc.get("organization_id"),
        "created_at": _iso(datetime.now(timezone.utc)),
    }
    await db.zones.insert_one(doc)
    return _strip(doc)


# ---------- MACHINES ----------
@api.get("/machines")
async def list_machines(
    factory_id: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    user=Depends(get_current_user),
):
    me_doc = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    org_id = me_doc.get("organization_id") if me_doc else None
    query = {"organization_id": org_id} if org_id else {}
    if factory_id:
        query["factory_id"] = factory_id
    if status_filter:
        query["status"] = status_filter
    items = await db.machines.find(query, {"_id": 0}).to_list(500)
    return items


@api.post("/machines")
async def create_machine(payload: MachineCreate, user=Depends(get_current_user)):
    me_doc = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    if not me_doc or not me_doc.get("organization_id"):
        raise HTTPException(status_code=400, detail="User has no organization")
    machine = Machine(
        name=payload.name,
        machine_type=payload.machine_type,
        category=payload.category or "production",
        usage_type=payload.usage_type or "continuous",
        factory_id=payload.factory_id,
        zone_id=payload.zone_id,
        organization_id=me_doc["organization_id"],
        installation_date=payload.installation_date,
        maintenance_interval_days=payload.maintenance_interval_days,
    )
    doc = machine.model_dump()
    doc["created_at"] = _iso(doc["created_at"])
    if doc.get("last_maintenance"):
        doc["last_maintenance"] = _iso(doc["last_maintenance"])
    await db.machines.insert_one(doc)
    return _strip(doc)


@api.get("/machines/{machine_id}")
async def get_machine(machine_id: str, user=Depends(get_current_user)):
    machine = await db.machines.find_one({"id": machine_id}, {"_id": 0})
    if not machine:
        raise HTTPException(status_code=404, detail="Machine not found")
    return machine


@api.delete("/machines/{machine_id}")
async def delete_machine(machine_id: str, user=Depends(get_current_user)):
    res = await db.machines.delete_one({"id": machine_id})
    await db.sensor_readings.delete_many({"machine_id": machine_id})
    await db.alerts.delete_many({"machine_id": machine_id})
    return {"deleted": res.deleted_count}


@api.put("/machines/{machine_id}")
async def update_machine(machine_id: str, payload: dict, user=Depends(get_current_user)):
    allowed = {"name", "category", "usage_type", "maintenance_interval_days", "installation_date", "twin_image_url"}
    update = {k: v for k, v in payload.items() if k in allowed}
    if not update:
        raise HTTPException(status_code=400, detail="No valid fields")
    await db.machines.update_one({"id": machine_id}, {"$set": update})
    machine = await db.machines.find_one({"id": machine_id}, {"_id": 0})
    return machine


@api.post("/machines/{machine_id}/twin-image")
async def upload_twin_image(
    machine_id: str,
    file: UploadFile = File(...),
    user=Depends(get_current_user),
):
    """Upload a custom digital-twin background image for a machine."""
    machine = await db.machines.find_one({"id": machine_id}, {"_id": 0})
    if not machine:
        raise HTTPException(status_code=404, detail="Machine not found")

    allowed_ct = {"image/png", "image/jpeg", "image/webp", "image/gif"}
    if file.content_type not in allowed_ct:
        raise HTTPException(status_code=400, detail=f"Unsupported type. Use {sorted(allowed_ct)}")

    data = await file.read()
    if len(data) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 5 MB)")

    ext = {"image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif"}[file.content_type]
    upload_dir = ROOT_DIR / "uploads" / "twins"
    upload_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{machine_id}-{int(datetime.now(timezone.utc).timestamp())}.{ext}"
    path = upload_dir / filename
    path.write_bytes(data)

    url = f"/api/uploads/twins/{filename}"
    await db.machines.update_one({"id": machine_id}, {"$set": {"twin_image_url": url}})
    return {"ok": True, "twin_image_url": url}


@api.delete("/machines/{machine_id}/twin-image")
async def clear_twin_image(machine_id: str, user=Depends(get_current_user)):
    """Reset the machine's twin image back to the type-based default."""
    res = await db.machines.update_one(
        {"id": machine_id}, {"$set": {"twin_image_url": None}}
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Machine not found")
    return {"ok": True}


# ---------- SENSORS ----------
@api.get("/machines/{machine_id}/sensors/latest")
async def latest_sensor(machine_id: str, user=Depends(get_current_user)):
    reading = await db.sensor_readings.find_one(
        {"machine_id": machine_id}, {"_id": 0}, sort=[("timestamp", -1)]
    )
    if not reading:
        raise HTTPException(status_code=404, detail="No readings yet")
    return reading


@api.get("/machines/{machine_id}/sensors/history")
async def sensor_history(
    machine_id: str, limit: int = 60, user=Depends(get_current_user)
):
    readings = await db.sensor_readings.find(
        {"machine_id": machine_id}, {"_id": 0}
    ).sort("timestamp", -1).to_list(min(limit, 500))
    readings.reverse()
    return readings


@api.post("/sensors/ingest")
async def ingest_sensor(payload: SensorIngest, user=Depends(get_current_user)):
    """External API to ingest sensor data (machines/IoT devices)."""
    machine = await db.machines.find_one({"id": payload.machine_id}, {"_id": 0})
    if not machine:
        raise HTTPException(status_code=404, detail="Machine not found")
    reading = payload.model_dump()
    reading.pop("machine_id")
    analysis = analyze_reading(machine["machine_type"], reading)
    now = datetime.now(timezone.utc)
    doc = {
        "id": f"r-{payload.machine_id}-{int(now.timestamp() * 1000)}",
        "machine_id": payload.machine_id,
        "organization_id": machine["organization_id"],
        "timestamp": _iso(now),
        **reading,
        "health_score": analysis["health_score"],
        "status": analysis["status"],
    }
    await db.sensor_readings.insert_one(doc)
    await db.machines.update_one(
        {"id": payload.machine_id},
        {"$set": {
            "status": analysis["status"],
            "health_score": analysis["health_score"],
            "rul_days": analysis["rul_days"],
        }},
    )
    return _strip(doc)


# ---------- DIAGNOSTIC ----------
@api.get("/machines/{machine_id}/diagnostic", response_model=DiagnosticResponse)
async def diagnostic(machine_id: str, ai: bool = True, user=Depends(get_current_user)):
    machine = await db.machines.find_one({"id": machine_id}, {"_id": 0})
    if not machine:
        raise HTTPException(status_code=404, detail="Machine not found")
    reading = await db.sensor_readings.find_one(
        {"machine_id": machine_id}, {"_id": 0}, sort=[("timestamp", -1)]
    )
    if not reading:
        raise HTTPException(status_code=404, detail="No sensor data yet")

    analysis = analyze_reading(machine["machine_type"], reading)
    recs = build_recommendations(analysis["anomalies"])
    safety = build_safety_instructions(analysis["anomalies"], analysis["status"])
    rule_rc = rule_based_root_cause(machine["machine_type"], analysis["anomalies"])

    llm_rc = ""
    ai_powered = False
    if ai and analysis["anomalies"]:
        llm_rc = await llm_root_cause(
            machine["name"], machine["machine_type"], analysis["anomalies"], reading
        )
        ai_powered = bool(llm_rc)

    root_cause = (llm_rc + "\n\n" + rule_rc).strip() if llm_rc else rule_rc

    return DiagnosticResponse(
        machine_id=machine_id,
        health_score=analysis["health_score"],
        status=analysis["status"],
        rul_days=analysis["rul_days"],
        anomalies=analysis["anomalies"],
        root_cause=root_cause,
        recommendations=recs,
        safety_instructions=safety,
        failure_probability=analysis["failure_probability"],
        generated_at=datetime.now(timezone.utc),
        ai_powered=ai_powered,
    )


# ---------- ALERTS ----------
@api.get("/alerts")
async def list_alerts(
    acknowledged: Optional[bool] = None,
    limit: int = 100,
    user=Depends(get_current_user),
):
    me_doc = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    org_id = me_doc.get("organization_id") if me_doc else None
    query = {"organization_id": org_id} if org_id else {}
    if acknowledged is not None:
        query["acknowledged"] = acknowledged
    items = await db.alerts.find(query, {"_id": 0}).sort("created_at", -1).to_list(min(limit, 500))
    return items


@api.post("/alerts/{alert_id}/acknowledge")
async def ack_alert(alert_id: str, user=Depends(get_current_user)):
    res = await db.alerts.update_one(
        {"id": alert_id},
        {"$set": {
            "acknowledged": True,
            "acknowledged_by": user["email"],
            "acknowledged_at": _iso(datetime.now(timezone.utc)),
        }},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Alert not found")
    return {"ok": True}


# ---------- USERS / TEAM ----------
@api.get("/users")
async def list_users(role: Optional[str] = None, user=Depends(get_current_user)):
    """List users in the current organization (for assigning maintenance tasks)."""
    me_doc = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    org_id = me_doc.get("organization_id") if me_doc else None
    if not org_id:
        return []
    query = {"organization_id": org_id}
    if role:
        query["role"] = role
    items = await db.users.find(
        query, {"_id": 0, "password_hash": 0}
    ).sort("created_at", -1).to_list(200)
    return items


# ---------- MAINTENANCE ----------
@api.get("/maintenance")
async def list_maintenance(
    assigned_to: Optional[str] = None,
    status: Optional[str] = None,
    user=Depends(get_current_user),
):
    """List maintenance tasks.

    Query params:
      assigned_to=me         -> only tasks assigned to current user
      assigned_to=unassigned -> only tasks with no assignee
      status=scheduled|in_progress|completed|cancelled
    """
    me_doc = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    org_id = me_doc.get("organization_id") if me_doc else None
    query = {"organization_id": org_id} if org_id else {}

    if assigned_to == "me":
        query["assigned_to"] = user["email"]
    elif assigned_to == "unassigned":
        query["$or"] = [{"assigned_to": None}, {"assigned_to": ""}]
    elif assigned_to:
        query["assigned_to"] = assigned_to

    if status:
        query["status"] = status

    items = await db.maintenance.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return items


@api.post("/maintenance")
async def create_maintenance(payload: MaintenanceCreate, user=Depends(get_current_user)):
    machine = await db.machines.find_one({"id": payload.machine_id}, {"_id": 0})
    if not machine:
        raise HTTPException(status_code=404, detail="Machine not found")
    task = MaintenanceTask(
        machine_id=payload.machine_id,
        machine_name=machine["name"],
        organization_id=machine["organization_id"],
        title=payload.title,
        description=payload.description,
        priority=payload.priority,
        scheduled_for=payload.scheduled_for,
        assigned_to=payload.assigned_to,
        created_by=user["email"],
    )
    doc = task.model_dump()
    doc["created_at"] = _iso(doc["created_at"])
    if doc.get("completed_at"):
        doc["completed_at"] = _iso(doc["completed_at"])
    await db.maintenance.insert_one(doc)
    return _strip(doc)


@api.post("/maintenance/{task_id}/claim")
async def claim_maintenance(task_id: str, user=Depends(get_current_user)):
    """A technician picks up an unassigned task."""
    task = await db.maintenance.find_one({"id": task_id}, {"_id": 0})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    await db.maintenance.update_one(
        {"id": task_id},
        {"$set": {"assigned_to": user["email"]}},
    )
    return {"ok": True, "assigned_to": user["email"]}


@api.post("/maintenance/{task_id}/start")
async def start_maintenance(task_id: str, user=Depends(get_current_user)):
    """Mark a task as in-progress and auto-assign if unassigned."""
    task = await db.maintenance.find_one({"id": task_id}, {"_id": 0})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    update = {
        "status": "in_progress",
        "started_at": _iso(datetime.now(timezone.utc)),
    }
    if not task.get("assigned_to"):
        update["assigned_to"] = user["email"]
    await db.maintenance.update_one({"id": task_id}, {"$set": update})
    return {"ok": True}


@api.post("/maintenance/{task_id}/assign")
async def assign_maintenance(task_id: str, payload: dict, user=Depends(get_current_user)):
    """Owner assigns/reassigns a task to a technician (by email)."""
    target = payload.get("assigned_to")
    res = await db.maintenance.update_one(
        {"id": task_id}, {"$set": {"assigned_to": target}}
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"ok": True, "assigned_to": target}


@api.post("/maintenance/{task_id}/complete")
async def complete_maintenance(
    task_id: str, payload: dict, user=Depends(get_current_user)
):
    res = await db.maintenance.update_one(
        {"id": task_id},
        {"$set": {
            "status": "completed",
            "completion_notes": payload.get("notes", ""),
            "completed_at": _iso(datetime.now(timezone.utc)),
            "completed_by": user["email"],
        }},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"ok": True}


# ---------- TECHNICIAN DASHBOARD ----------
@api.get("/technician/dashboard")
async def technician_dashboard(user=Depends(get_current_user)):
    """Aggregated KPIs + lists for the technician's home screen."""
    me_doc = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    org_id = me_doc.get("organization_id") if me_doc else None
    email = user["email"]

    base = {"organization_id": org_id} if org_id else {}

    assigned = await db.maintenance.count_documents({**base, "assigned_to": email, "status": {"$ne": "completed"}})
    in_progress = await db.maintenance.count_documents({**base, "assigned_to": email, "status": "in_progress"})

    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    completed_today = await db.maintenance.count_documents({
        **base, "completed_by": email,
        "completed_at": {"$gte": _iso(today_start)},
    })

    unassigned = await db.maintenance.count_documents({
        **base, "$or": [{"assigned_to": None}, {"assigned_to": ""}],
        "status": {"$ne": "completed"},
    })

    urgent_alerts = await db.alerts.count_documents({
        **base, "severity": "critical", "acknowledged": False,
    })

    my_tasks = await db.maintenance.find(
        {**base, "assigned_to": email, "status": {"$ne": "completed"}},
        {"_id": 0},
    ).sort("created_at", -1).to_list(20)

    unassigned_tasks = await db.maintenance.find(
        {**base, "$or": [{"assigned_to": None}, {"assigned_to": ""}], "status": {"$ne": "completed"}},
        {"_id": 0},
    ).sort("created_at", -1).to_list(20)

    history = await db.maintenance.find(
        {**base, "completed_by": email}, {"_id": 0},
    ).sort("completed_at", -1).to_list(20)

    recent_alerts = await db.alerts.find(
        {**base, "acknowledged": False}, {"_id": 0},
    ).sort("created_at", -1).to_list(10)

    return {
        "kpis": {
            "assigned_open": assigned,
            "in_progress": in_progress,
            "completed_today": completed_today,
            "unassigned_open": unassigned,
            "urgent_alerts": urgent_alerts,
        },
        "my_tasks": my_tasks,
        "unassigned_tasks": unassigned_tasks,
        "history": history,
        "recent_alerts": recent_alerts,
    }


# ---------- DASHBOARD / REPORTS ----------
@api.get("/dashboard/overview")
async def dashboard_overview(user=Depends(get_current_user)):
    me_doc = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    org_id = me_doc.get("organization_id") if me_doc else None
    if not org_id:
        return {
            "total_machines": 0, "healthy": 0, "warning": 0, "critical": 0,
            "active_alerts": 0, "avg_health": 0, "total_power_kw": 0,
            "machines": [], "recent_alerts": [],
        }

    machines = await db.machines.find({"organization_id": org_id}, {"_id": 0}).to_list(500)
    total = len(machines)
    healthy = sum(1 for m in machines if m["status"] == "healthy")
    warning = sum(1 for m in machines if m["status"] == "warning")
    critical = sum(1 for m in machines if m["status"] == "critical")
    avg_health = round(sum(m["health_score"] for m in machines) / total, 1) if total else 0

    active_alerts = await db.alerts.count_documents({
        "organization_id": org_id, "acknowledged": False,
    })
    recent_alerts = await db.alerts.find(
        {"organization_id": org_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(8)

    # Aggregate latest power consumption per machine
    total_power = 0.0
    for m in machines:
        latest = await db.sensor_readings.find_one(
            {"machine_id": m["id"]}, {"_id": 0, "power_consumption": 1},
            sort=[("timestamp", -1)],
        )
        if latest:
            total_power += float(latest.get("power_consumption", 0))

    return {
        "total_machines": total,
        "healthy": healthy,
        "warning": warning,
        "critical": critical,
        "avg_health": avg_health,
        "active_alerts": active_alerts,
        "total_power_kw": round(total_power, 2),
        "machines": machines,
        "recent_alerts": recent_alerts,
    }


@api.get("/reports/summary")
async def report_summary(user=Depends(get_current_user)):
    me_doc = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    org_id = me_doc.get("organization_id") if me_doc else None
    if not org_id:
        return {"alerts_by_day": [], "energy_by_machine": [], "downtime_estimate_hr": 0}

    # Alerts per day (last 7 days)
    alerts = await db.alerts.find(
        {"organization_id": org_id}, {"_id": 0, "created_at": 1, "severity": 1}
    ).to_list(2000)
    from collections import defaultdict
    bucket = defaultdict(lambda: {"date": "", "critical": 0, "warning": 0, "info": 0})
    for a in alerts:
        dt = _parse_dt(a["created_at"])
        if not dt:
            continue
        key = dt.strftime("%Y-%m-%d")
        bucket[key]["date"] = key
        bucket[key][a["severity"]] = bucket[key].get(a["severity"], 0) + 1
    alerts_by_day = sorted(bucket.values(), key=lambda x: x["date"])[-14:]

    # Energy per machine (last reading * 24)
    machines = await db.machines.find({"organization_id": org_id}, {"_id": 0}).to_list(500)
    energy_by_machine = []
    for m in machines:
        latest = await db.sensor_readings.find_one(
            {"machine_id": m["id"]}, {"_id": 0, "power_consumption": 1},
            sort=[("timestamp", -1)],
        )
        kwh = round(float(latest.get("power_consumption", 0)) * 24, 2) if latest else 0
        energy_by_machine.append({
            "machine_id": m["id"], "name": m["name"], "kwh_estimate_24h": kwh,
            "status": m["status"],
        })

    # Downtime estimate — sum 0.5h per critical alert (rough)
    crit = await db.alerts.count_documents({
        "organization_id": org_id, "severity": "critical",
    })
    downtime_hr = round(crit * 0.5, 1)

    return {
        "alerts_by_day": alerts_by_day,
        "energy_by_machine": energy_by_machine,
        "downtime_estimate_hr": downtime_hr,
    }


# ---------- FAULT INJECTION (TESTING LAB) ----------
@api.post("/admin/fault/inject")
async def fault_inject(payload: dict, user=Depends(get_current_user)):
    """Inject a manual fault into a machine's simulator state.

    body: { machine_id, sensor, intensity (0..1.5), duration_seconds }
    """
    machine_id = payload.get("machine_id")
    sensor = payload.get("sensor")
    intensity = float(payload.get("intensity", 0.9))
    duration_seconds = int(payload.get("duration_seconds", 60))

    if not machine_id or not sensor:
        raise HTTPException(status_code=400, detail="machine_id and sensor required")

    machine = await db.machines.find_one({"id": machine_id}, {"_id": 0})
    if not machine:
        raise HTTPException(status_code=404, detail="Machine not found")

    # Validate sensor
    valid = {"temperature", "vibration", "current", "rpm", "voltage", "humidity",
             "oil_level", "noise", "pressure", "power_consumption"}
    if sensor not in valid:
        raise HTTPException(status_code=400, detail=f"sensor must be one of {sorted(valid)}")

    ticks = max(1, duration_seconds // 2)
    state = sim_inject_fault(machine_id, sensor, intensity, ticks)
    return {"ok": True, "state": state}


@api.post("/admin/fault/clear")
async def fault_clear(payload: dict, user=Depends(get_current_user)):
    machine_id = payload.get("machine_id")
    if not machine_id:
        raise HTTPException(status_code=400, detail="machine_id required")
    return {"ok": True, "state": sim_clear_fault(machine_id)}


@api.get("/admin/fault/state/{machine_id}")
async def fault_state(machine_id: str, user=Depends(get_current_user)):
    return get_fault_state(machine_id)


# ---------- ENERGY OPTIMIZATION ----------
@api.get("/energy/profile")
async def energy_profile(ai: bool = True, user=Depends(get_current_user)):
    """Compute hourly load profile, tariff costs, machine shift recommendations."""
    me_doc = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    org_id = me_doc.get("organization_id") if me_doc else None
    if not org_id:
        raise HTTPException(status_code=400, detail="No organization")

    # Pull last 24h of readings
    machines = await db.machines.find({"organization_id": org_id}, {"_id": 0}).to_list(500)
    machine_ids = [m["id"] for m in machines]
    readings = await db.sensor_readings.find(
        {"machine_id": {"$in": machine_ids}},
        {"_id": 0, "timestamp": 1, "power_consumption": 1, "machine_id": 1},
    ).sort("timestamp", -1).to_list(3000)

    hourly = compute_hourly_profile(readings)
    costs = summarize_costs(hourly)

    # Latest reading per machine
    latest_by_machine = {}
    for m in machines:
        latest = await db.sensor_readings.find_one(
            {"machine_id": m["id"]}, {"_id": 0}, sort=[("timestamp", -1)],
        )
        if latest:
            latest_by_machine[m["id"]] = latest

    machines_scored = classify_machines_for_shifting(machines, latest_by_machine)

    narrative = ""
    ai_powered = False
    if ai:
        narrative = await llm_energy_narrative(hourly, machines_scored, costs)
        ai_powered = bool(narrative)

    return {
        "hourly": hourly,
        "costs": costs,
        "machines": machines_scored,
        "narrative": narrative,
        "ai_powered": ai_powered,
        "generated_at": _iso(datetime.now(timezone.utc)),
    }


# ---------- MOUNT ----------
app.include_router(api)

# Serve uploaded twin images
UPLOADS_DIR = ROOT_DIR / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)
app.mount("/api/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("predmaint")


@app.on_event("startup")
async def startup():
    logger.info("Seeding demo data…")
    await seed_demo_data(db)
    logger.info("Starting simulator loop…")
    asyncio.create_task(simulator_loop(db, interval_seconds=2))


@app.on_event("shutdown")
async def shutdown():
    client.close()
