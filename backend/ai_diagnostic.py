"""Rule-based + LLM diagnostics for predictive maintenance."""
import os
from typing import List, Dict, Any, Tuple

# Baseline operating ranges per machine type. (min_ok, max_ok)
BASELINES: Dict[str, Dict[str, Tuple[float, float]]] = {
    "cnc_lathe": {
        "temperature": (40, 75),
        "vibration": (0.5, 3.5),
        "current": (8, 22),
        "rpm": (1500, 3500),
        "voltage": (215, 240),
        "humidity": (30, 65),
        "oil_level": (60, 100),
        "noise": (60, 85),
        "pressure": (3, 8),
        "power_consumption": (3, 9),
    },
    "pump": {
        "temperature": (35, 70),
        "vibration": (0.8, 4.0),
        "current": (5, 18),
        "rpm": (1200, 2800),
        "voltage": (215, 240),
        "humidity": (35, 70),
        "oil_level": (50, 100),
        "noise": (55, 80),
        "pressure": (4, 10),
        "power_consumption": (2, 7),
    },
    "compressor": {
        "temperature": (45, 85),
        "vibration": (1.0, 4.5),
        "current": (10, 25),
        "rpm": (1000, 2500),
        "voltage": (215, 240),
        "humidity": (30, 65),
        "oil_level": (55, 100),
        "noise": (70, 92),
        "pressure": (5, 12),
        "power_consumption": (4, 10),
    },
    "conveyor": {
        "temperature": (25, 60),
        "vibration": (0.3, 2.5),
        "current": (3, 12),
        "rpm": (50, 250),
        "voltage": (215, 240),
        "humidity": (35, 70),
        "oil_level": (50, 100),
        "noise": (50, 78),
        "pressure": (1, 5),
        "power_consumption": (1, 5),
    },
    "hvac_chiller": {
        "temperature": (5, 35),
        "vibration": (0.4, 3.0),
        "current": (12, 28),
        "rpm": (800, 2200),
        "voltage": (215, 240),
        "humidity": (40, 75),
        "oil_level": (55, 100),
        "noise": (55, 80),
        "pressure": (6, 14),
        "power_consumption": (5, 12),
    },
}


SENSOR_UNITS = {
    "temperature": "°C",
    "vibration": "mm/s",
    "current": "A",
    "rpm": "RPM",
    "voltage": "V",
    "humidity": "%",
    "oil_level": "%",
    "noise": "dB",
    "pressure": "bar",
    "power_consumption": "kW",
}


# Map anomalous sensor → maintenance recommendation
RECOMMENDATION_MAP = {
    "temperature_high": [
        "Inspect cooling system and verify coolant levels.",
        "Clean heat exchangers and verify ventilation paths.",
        "Schedule lubricant replacement if running over spec for >30 min.",
    ],
    "vibration_high": [
        "Run dynamic balancing check on rotating shaft.",
        "Inspect bearings for wear; replace if play exceeds 0.05 mm.",
        "Re-torque mounting bolts to manufacturer spec.",
    ],
    "current_high": [
        "Check motor load and verify no mechanical jam downstream.",
        "Inspect winding insulation resistance.",
        "Replenish lubricant — friction loss may be drawing extra current.",
    ],
    "rpm_low": [
        "Inspect drive belts/coupling for slip.",
        "Verify VFD parameters and feedback signal integrity.",
    ],
    "rpm_high": [
        "Verify load conditions and speed controller setpoints.",
        "Inspect tachometer feedback for drift.",
    ],
    "voltage_low": [
        "Inspect supply lines and verify transformer tap.",
        "Check for loose terminals or oxidized contacts.",
    ],
    "voltage_high": [
        "Verify upstream regulation; engage surge protection.",
    ],
    "oil_level_low": [
        "Top-up lubricant immediately — risk of bearing seizure.",
        "Inspect seals for leakage.",
    ],
    "noise_high": [
        "Inspect for loose components, gear mesh issues, cavitation.",
        "Schedule acoustic signature analysis.",
    ],
    "pressure_high": [
        "Inspect pressure relief valve and discharge line.",
        "Check for downstream blockage.",
    ],
    "pressure_low": [
        "Inspect seals, intake filter, suction line for leaks.",
    ],
    "humidity_high": [
        "Improve enclosure ventilation; verify desiccant cartridges.",
    ],
    "power_consumption_high": [
        "Run efficiency audit — abnormal draw indicates mechanical loss.",
        "Inspect drivetrain and review duty cycle.",
    ],
}


def _deviation_pct(value: float, lo: float, hi: float) -> float:
    """Returns 0 if inside range, positive % deviation otherwise."""
    if lo <= value <= hi:
        return 0.0
    if value < lo:
        return ((lo - value) / max(abs(lo), 1)) * 100
    return ((value - hi) / max(abs(hi), 1)) * 100


def analyze_reading(machine_type: str, reading: Dict[str, Any]) -> Dict[str, Any]:
    """Return health score, status, anomalies, failure probability."""
    baseline = BASELINES.get(machine_type, BASELINES["cnc_lathe"])
    anomalies: List[Dict[str, Any]] = []
    total_dev = 0.0

    for sensor, (lo, hi) in baseline.items():
        value = float(reading.get(sensor, 0))
        dev = _deviation_pct(value, lo, hi)
        if dev > 0:
            direction = "high" if value > hi else "low"
            severity = "critical" if dev > 25 else ("warning" if dev > 10 else "info")
            anomalies.append({
                "sensor": sensor,
                "value": round(value, 2),
                "unit": SENSOR_UNITS.get(sensor, ""),
                "expected_min": lo,
                "expected_max": hi,
                "direction": direction,
                "deviation_pct": round(dev, 1),
                "severity": severity,
            })
            total_dev += dev

    # Health score: 100 - cumulative deviation (capped)
    health = max(0.0, min(100.0, 100.0 - total_dev * 0.6))

    if health >= 80:
        status = "healthy"
    elif health >= 55:
        status = "warning"
    else:
        status = "critical"

    # Failure probability — rough heuristic
    failure_prob = round(min(0.99, (100 - health) / 100 * 0.85), 3)
    # RUL: simple model — full life 365, degrades with health
    rul_days = max(7, int((health / 100) * 365))

    return {
        "health_score": round(health, 1),
        "status": status,
        "anomalies": anomalies,
        "failure_probability": failure_prob,
        "rul_days": rul_days,
    }


def build_recommendations(anomalies: List[Dict[str, Any]]) -> List[str]:
    recs: List[str] = []
    for a in anomalies:
        key = f"{a['sensor']}_{a['direction']}"
        for r in RECOMMENDATION_MAP.get(key, []):
            if r not in recs:
                recs.append(r)
    if not recs:
        recs.append("All sensor readings within nominal range. Continue routine monitoring.")
    return recs


def build_safety_instructions(anomalies: List[Dict[str, Any]], status: str) -> List[str]:
    instr: List[str] = []
    if status == "critical":
        instr.append("Notify shift supervisor immediately and prepare for controlled shutdown.")
        instr.append("Lock out / tag out (LOTO) before any inspection.")
    if any(a["sensor"] == "temperature" and a["direction"] == "high" for a in anomalies):
        instr.append("Allow machine to cool for 30 min before touching enclosure.")
    if any(a["sensor"] == "voltage" for a in anomalies):
        instr.append("De-energize circuit and verify with a meter prior to electrical inspection.")
    if not instr:
        instr.append("Standard PPE sufficient for routine inspection.")
    return instr


def rule_based_root_cause(machine_type: str, anomalies: List[Dict[str, Any]]) -> str:
    if not anomalies:
        return "No anomalous behavior detected. Machine is operating within designed envelope."
    top = sorted(anomalies, key=lambda a: a["deviation_pct"], reverse=True)[:3]
    parts = [
        f"{a['sensor'].replace('_', ' ').title()} is {a['direction']} ({a['value']}{a['unit']}, +{a['deviation_pct']}% off spec)"
        for a in top
    ]
    return (
        f"Primary deviations on {machine_type.replace('_', ' ')}: "
        + "; ".join(parts)
        + ". Combined pattern suggests mechanical/thermal stress on the drivetrain or load."
    )


async def llm_root_cause(
    machine_name: str, machine_type: str, anomalies: List[Dict[str, Any]], reading: Dict[str, Any]
) -> str:
    """Gemini 2.5 Flash narrative root-cause analysis."""
    if os.environ.get("USE_LLM", "false").lower() != "true":
        return ""
    api_key = os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        return ""
    try:
        from google import genai
        from google.genai import types
        client = genai.Client(api_key=api_key)
        anomaly_str = ", ".join(
            f"{a['sensor']}={a['value']}{a['unit']} ({a['direction']}, +{a['deviation_pct']}% off)"
            for a in anomalies
        ) or "no anomalies"
        prompt = (
            f"Machine: {machine_name} (type: {machine_type})\n"
            f"Anomalies: {anomaly_str}\n"
            f"Full reading: {reading}\n"
            "Provide root cause analysis in 2-3 concise technical sentences."
        )
        response = client.models.generate_content(
            model=os.environ.get("GEMINI_MODEL", "gemini-2.5-flash"),
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.3,
                max_output_tokens=220,
                system_instruction=(
                    "You are an expert industrial reliability engineer. "
                    "Analyze sensor anomalies and produce a concise root-cause hypothesis "
                    "(2-3 sentences). Be specific and technical."
                ),
            ),
        )
        return (response.text or "").strip()
    except Exception as e:
        print(f"LLM diagnostic skipped: {e}")
        return ""
