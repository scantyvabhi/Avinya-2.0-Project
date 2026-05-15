"""Energy monitoring & off-peak scheduling recommendations.

Analyzes power consumption per machine, classifies machines by energy
intensity, and produces recommendations on which to shift to off-peak
(cheap-tariff) windows. Optionally enriches the output with a Gemini
2.5 Flash narrative.
"""
import os
from datetime import datetime, timezone
from typing import List, Dict, Any
from collections import defaultdict

# Default tariff bands — editable via env or future settings table
PEAK_START = int(os.environ.get("PEAK_HOUR_START", "6"))    # 06:00
PEAK_END   = int(os.environ.get("PEAK_HOUR_END", "22"))     # 22:00
PEAK_RATE  = float(os.environ.get("PEAK_RATE", "8.0"))      # ₹/kWh
OFFPEAK_RATE = float(os.environ.get("OFFPEAK_RATE", "4.0")) # ₹/kWh
CURRENCY = os.environ.get("CURRENCY", "INR")


def is_offpeak(hour: int) -> bool:
    """Return True if `hour` (0-23) falls in the off-peak window."""
    if PEAK_START < PEAK_END:
        return hour < PEAK_START or hour >= PEAK_END
    return PEAK_END <= hour < PEAK_START


def compute_hourly_profile(readings: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Aggregate raw readings into 24 hourly buckets (avg power)."""
    buckets = defaultdict(list)
    for r in readings:
        ts = r.get("timestamp")
        if isinstance(ts, str):
            try:
                ts = datetime.fromisoformat(ts)
            except Exception:
                continue
        if not ts:
            continue
        h = ts.hour
        buckets[h].append(float(r.get("power_consumption", 0)))

    out = []
    for h in range(24):
        vals = buckets.get(h, [])
        avg = round(sum(vals) / len(vals), 2) if vals else 0.0
        out.append({
            "hour": h,
            "avg_power_kw": avg,
            "is_offpeak": is_offpeak(h),
            "rate": OFFPEAK_RATE if is_offpeak(h) else PEAK_RATE,
        })
    return out


def classify_machines_for_shifting(machines: List[Dict[str, Any]],
                                   latest_by_machine: Dict[str, Dict[str, Any]]
                                   ) -> List[Dict[str, Any]]:
    """Score each machine for off-peak shifting.

    A machine is a good candidate when:
      - usage_type is batch / discretionary (not continuous)
      - average power draw is high
      - it's currently healthy (don't shift broken assets)
    """
    scored = []
    for m in machines:
        latest = latest_by_machine.get(m["id"], {})
        power = float(latest.get("power_consumption", 0))
        usage_type = m.get("usage_type", "continuous")
        status = m.get("status", "healthy")

        # Shiftability heuristic
        if usage_type == "continuous":
            shiftability = 0.2  # mostly cannot shift
        elif usage_type == "batch":
            shiftability = 0.9
        else:
            shiftability = 0.6

        if status == "critical":
            shiftability *= 0.3
        elif status == "warning":
            shiftability *= 0.6

        # Cost savings if moved fully to off-peak (per day)
        savings_per_day = round(power * 8 * (PEAK_RATE - OFFPEAK_RATE), 2)
        scored.append({
            "machine_id": m["id"],
            "name": m["name"],
            "machine_type": m["machine_type"],
            "usage_type": usage_type,
            "status": status,
            "current_power_kw": round(power, 2),
            "shiftability": round(shiftability, 2),
            "potential_daily_savings": savings_per_day,
            "recommendation": _build_machine_recommendation(usage_type, status, savings_per_day),
        })
    scored.sort(key=lambda x: x["shiftability"] * (x["current_power_kw"] + 1), reverse=True)
    return scored


def _build_machine_recommendation(usage_type: str, status: str, savings: float) -> str:
    if status == "critical":
        return "Hold — resolve critical alerts first."
    if usage_type == "continuous":
        return "Continuous duty — schedule cannot be shifted; focus on efficiency tuning."
    if savings > 50:
        return f"Strong candidate — schedule to 22:00–06:00 window. ~{savings:.0f} {CURRENCY}/day savings."
    if savings > 10:
        return f"Good candidate — shift batches to off-peak. ~{savings:.0f} {CURRENCY}/day savings."
    return "Marginal benefit from shifting; monitor."


def summarize_costs(hourly: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Compute today's spend split by tariff window."""
    peak_kwh = sum(h["avg_power_kw"] for h in hourly if not h["is_offpeak"])
    off_kwh  = sum(h["avg_power_kw"] for h in hourly if h["is_offpeak"])
    return {
        "peak_kwh": round(peak_kwh, 2),
        "offpeak_kwh": round(off_kwh, 2),
        "peak_cost": round(peak_kwh * PEAK_RATE, 2),
        "offpeak_cost": round(off_kwh * OFFPEAK_RATE, 2),
        "total_cost": round(peak_kwh * PEAK_RATE + off_kwh * OFFPEAK_RATE, 2),
        "peak_rate": PEAK_RATE,
        "offpeak_rate": OFFPEAK_RATE,
        "peak_window": f"{PEAK_START:02d}:00-{PEAK_END:02d}:00",
        "offpeak_window": f"{PEAK_END:02d}:00-{PEAK_START:02d}:00",
        "currency": CURRENCY,
    }


async def llm_energy_narrative(hourly: List[Dict[str, Any]],
                               machines_scored: List[Dict[str, Any]],
                               costs: Dict[str, Any]) -> str:
    """Optional Gemini narrative summary."""
    if os.environ.get("USE_LLM", "false").lower() != "true":
        return ""
    api_key = os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        return ""
    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=api_key)
        # Compress hourly into a compact representation
        hourly_str = ", ".join(f"{h['hour']:02d}h={h['avg_power_kw']}kW" for h in hourly if h['avg_power_kw'] > 0)
        top_movers = ", ".join(
            f"{m['name']}({m['usage_type']},{m['current_power_kw']}kW)"
            for m in machines_scored[:5]
        )
        prompt = (
            f"Tariff: peak {costs['peak_window']} @ {costs['peak_rate']} {costs['currency']}/kWh, "
            f"off-peak {costs['offpeak_window']} @ {costs['offpeak_rate']} {costs['currency']}/kWh.\n"
            f"Hourly load (kW): {hourly_str or 'no data yet'}\n"
            f"Today: peak {costs['peak_kwh']} kWh ({costs['peak_cost']} {costs['currency']}), "
            f"off-peak {costs['offpeak_kwh']} kWh ({costs['offpeak_cost']} {costs['currency']}).\n"
            f"Top shift candidates: {top_movers}\n\n"
            "Write 3-4 sentences advising the plant manager which machines to shift to off-peak "
            "and approximate savings. Be concrete and concise."
        )
        response = client.models.generate_content(
            model=os.environ.get("GEMINI_MODEL", "gemini-2.5-flash"),
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.3,
                max_output_tokens=320,
                system_instruction=(
                    "You are an industrial energy optimization specialist. "
                    "Provide concrete, quantitative recommendations."
                ),
            ),
        )
        return (response.text or "").strip()
    except Exception as e:
        print(f"Energy LLM skipped: {e}")
        return ""
