"""Industrial machine sensor simulator.
Generates realistic readings every 2 seconds for all registered machines
and persists them, raising alerts when thresholds are breached.
"""
import asyncio
import random
import math
from datetime import datetime, timezone
from typing import Dict, Any
from ai_diagnostic import BASELINES, analyze_reading

# Per-machine simulator state: phase angle, fault timer, etc.
_state: Dict[str, Dict[str, Any]] = {}


def _machine_state(machine_id: str) -> Dict[str, Any]:
    if machine_id not in _state:
        _state[machine_id] = {
            "phase": random.random() * 2 * math.pi,
            "fault_until": 0,
            "fault_type": None,
            "tick": 0,
        }
    return _state[machine_id]


def _gen_value(lo: float, hi: float, fault_bias: float = 0.0, noise_pct: float = 0.05) -> float:
    """Generate a value near the middle of the range with optional fault bias."""
    mid = (lo + hi) / 2
    span = (hi - lo)
    base = mid + math.sin(random.random() * 6.28) * span * 0.2
    noise = random.uniform(-1, 1) * span * noise_pct
    return round(base + noise + fault_bias * span, 2)


def generate_reading(machine_type: str, machine_id: str) -> Dict[str, Any]:
    """Generate one sensor reading. Occasionally inject faults."""
    baseline = BASELINES.get(machine_type, BASELINES["cnc_lathe"])
    s = _machine_state(machine_id)
    s["tick"] += 1

    # Randomly inject a fault every ~150 ticks (5 minutes at 2s interval)
    # unless a manual fault is already in progress.
    if s["fault_until"] < s["tick"] and random.random() < 0.012:
        s["fault_until"] = s["tick"] + random.randint(15, 40)  # 30s – 80s fault window
        s["fault_type"] = random.choice([
            "temperature", "vibration", "current", "oil_level",
            "pressure", "noise", "power_consumption"
        ])
        s["fault_intensity"] = random.uniform(0.55, 1.1)

    in_fault = s["fault_until"] >= s["tick"]
    fault_sensor = s["fault_type"] if in_fault else None
    intensity = s.get("fault_intensity", 0.8) if in_fault else 0.0

    reading: Dict[str, Any] = {}
    for sensor, (lo, hi) in baseline.items():
        if sensor == fault_sensor:
            # Push value out of spec (high or low)
            if sensor == "oil_level":
                bias = -intensity
            elif sensor == "voltage":
                bias = random.choice([-1, 1]) * intensity * 0.6
            else:
                bias = intensity
            reading[sensor] = max(0, _gen_value(lo, hi, fault_bias=bias, noise_pct=0.08))
        else:
            reading[sensor] = max(0, _gen_value(lo, hi))

    return reading


def inject_fault(machine_id: str, sensor: str, intensity: float = 0.9,
                 duration_ticks: int = 30) -> Dict[str, Any]:
    """Public API for manual fault injection (called by /api/admin/inject-fault).

    intensity: 0..1.5 (how far out of spec)
    duration_ticks: number of 2s ticks the fault will persist (~ duration/2 seconds)
    """
    s = _machine_state(machine_id)
    s["fault_type"] = sensor
    s["fault_until"] = s["tick"] + max(1, int(duration_ticks))
    s["fault_intensity"] = max(0.1, min(1.5, float(intensity)))
    return {
        "machine_id": machine_id,
        "sensor": sensor,
        "intensity": s["fault_intensity"],
        "duration_ticks": duration_ticks,
        "active_until_tick": s["fault_until"],
    }


def clear_fault(machine_id: str) -> Dict[str, Any]:
    """Cancel any active manual or random fault for a machine."""
    s = _machine_state(machine_id)
    s["fault_until"] = 0
    s["fault_type"] = None
    s["fault_intensity"] = 0.0
    return {"machine_id": machine_id, "cleared": True}


def get_fault_state(machine_id: str) -> Dict[str, Any]:
    s = _machine_state(machine_id)
    return {
        "machine_id": machine_id,
        "active": s["fault_until"] >= s["tick"],
        "sensor": s["fault_type"],
        "ticks_remaining": max(0, s["fault_until"] - s["tick"]),
        "intensity": s.get("fault_intensity", 0),
    }


async def simulator_loop(db, interval_seconds: int = 2):
    """Main loop. Runs forever in background. Updates sensor readings + alerts."""
    print(f"[simulator] starting loop @ {interval_seconds}s interval")
    while True:
        try:
            machines = await db.machines.find({}, {"_id": 0}).to_list(500)
            for m in machines:
                reading = generate_reading(m["machine_type"], m["id"])
                analysis = analyze_reading(m["machine_type"], reading)
                now = datetime.now(timezone.utc)
                doc = {
                    "id": f"r-{m['id']}-{int(now.timestamp() * 1000)}",
                    "machine_id": m["id"],
                    "organization_id": m["organization_id"],
                    "timestamp": now.isoformat(),
                    **reading,
                    "health_score": analysis["health_score"],
                    "status": analysis["status"],
                }
                await db.sensor_readings.insert_one(doc)

                # Update machine summary
                await db.machines.update_one(
                    {"id": m["id"]},
                    {"$set": {
                        "status": analysis["status"],
                        "health_score": analysis["health_score"],
                        "rul_days": analysis["rul_days"],
                    }},
                )

                # Generate alerts on warning/critical anomalies — debounce per category
                for a in analysis["anomalies"]:
                    if a["severity"] in ("warning", "critical"):
                        category = f"{a['sensor']}_{a['direction']}"
                        recent = await db.alerts.find_one({
                            "machine_id": m["id"],
                            "category": category,
                            "acknowledged": False,
                        }, {"_id": 0})
                        if recent:
                            continue
                        alert_doc = {
                            "id": f"alert-{m['id']}-{category}-{int(now.timestamp())}",
                            "machine_id": m["id"],
                            "machine_name": m["name"],
                            "organization_id": m["organization_id"],
                            "severity": a["severity"],
                            "category": category,
                            "title": f"{a['sensor'].replace('_', ' ').title()} {a['direction']}",
                            "message": (
                                f"{m['name']} reports {a['sensor'].replace('_', ' ')} "
                                f"at {a['value']}{a['unit']} (expected {a['expected_min']}–"
                                f"{a['expected_max']}{a['unit']}). Deviation {a['deviation_pct']}%."
                            ),
                            "triggered_by": [a["sensor"]],
                            "acknowledged": False,
                            "acknowledged_by": None,
                            "acknowledged_at": None,
                            "created_at": now.isoformat(),
                        }
                        await db.alerts.insert_one(alert_doc)

            # Trim sensor readings to last 500 per machine to keep MongoDB lean
            if random.random() < 0.05:
                await _trim_history(db)

        except Exception as e:
            print(f"[simulator] error: {e}")
        await asyncio.sleep(interval_seconds)


async def _trim_history(db):
    machines = await db.machines.find({}, {"_id": 0, "id": 1}).to_list(500)
    for m in machines:
        cursor = db.sensor_readings.find(
            {"machine_id": m["id"]}, {"_id": 0, "id": 1, "timestamp": 1}
        ).sort("timestamp", -1).skip(500)
        ids = [d["id"] async for d in cursor]
        if ids:
            await db.sensor_readings.delete_many({"id": {"$in": ids}})
