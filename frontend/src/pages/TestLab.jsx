import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { FlaskConical, Zap, Thermometer, Activity, Droplet, Volume2, Gauge, AlertTriangle, X } from "lucide-react";
import { StatusBadge } from "@/components/Status";

const SENSOR_OPTIONS = [
  { key: "temperature",       label: "Temperature spike",  icon: Thermometer,     hint: "+spec deviation, simulates overheating" },
  { key: "vibration",         label: "Vibration spike",    icon: Activity,        hint: "Bearing wear / imbalance" },
  { key: "current",           label: "Current overdraw",   icon: Zap,             hint: "Motor overload" },
  { key: "oil_level",         label: "Oil level drop",     icon: Droplet,         hint: "Lubricant leak / depletion" },
  { key: "voltage",           label: "Voltage anomaly",    icon: Zap,             hint: "Supply instability" },
  { key: "pressure",          label: "Pressure spike",     icon: Gauge,           hint: "Valve / discharge issue" },
  { key: "noise",             label: "Noise spike",        icon: Volume2,         hint: "Mechanical degradation" },
  { key: "power_consumption", label: "Power consumption",  icon: Zap,             hint: "Efficiency drift" },
];

export default function TestLab() {
  const [machines, setMachines] = useState([]);
  const [machineId, setMachineId] = useState("");
  const [sensor, setSensor] = useState("temperature");
  const [intensity, setIntensity] = useState(1.0);
  const [duration, setDuration] = useState(60);
  const [activeFaults, setActiveFaults] = useState({}); // machineId -> state

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await api.get("/machines");
        setMachines(data);
        if (!machineId && data[0]) setMachineId(data[0].id);
      } catch {}
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Poll fault state for all machines every 2s
    const tick = async () => {
      if (machines.length === 0) return;
      const results = await Promise.all(
        machines.map((m) =>
          api.get(`/admin/fault/state/${m.id}`).then((r) => [m.id, r.data]).catch(() => [m.id, null])
        )
      );
      setActiveFaults(Object.fromEntries(results));
    };
    tick();
    const i = setInterval(tick, 2000);
    return () => clearInterval(i);
  }, [machines]);

  const inject = async () => {
    if (!machineId) return;
    try {
      await api.post("/admin/fault/inject", {
        machine_id: machineId,
        sensor,
        intensity: Number(intensity),
        duration_seconds: Number(duration),
      });
      const m = machines.find((x) => x.id === machineId);
      toast.success(`Injected ${sensor.replace(/_/g, " ")} fault on ${m?.name || machineId}`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Inject failed");
    }
  };

  const clear = async (id) => {
    try {
      await api.post("/admin/fault/clear", { machine_id: id });
      toast.success("Fault cleared");
    } catch {
      toast.error("Failed to clear");
    }
  };

  const SensorIcon = SENSOR_OPTIONS.find((s) => s.key === sensor)?.icon || FlaskConical;

  return (
    <div className="p-4 sm:p-6 space-y-5" data-testid="test-lab-page">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="eyebrow">Engineering</div>
          <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <FlaskConical size={24} className="text-[#F97316]" />
            Fault Injection Test Lab
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Force anomalies on any machine to verify the alerting, scoring, and AI diagnostic pipeline end-to-end.
            The simulator will push the selected sensor out of spec for the chosen duration.
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Inject control panel */}
        <div className="panel lg:col-span-1">
          <div className="panel-header">
            <div className="flex items-center gap-2">
              <SensorIcon size={14} className="text-[#F97316]" />
              <div className="eyebrow">Inject Fault</div>
            </div>
          </div>
          <div className="panel-body space-y-4">
            <div>
              <label className="eyebrow">Machine</label>
              <select
                value={machineId}
                onChange={(e) => setMachineId(e.target.value)}
                data-testid="lab-machine-select"
                className="mt-1 w-full input-themed px-3 py-2.5 text-sm"
              >
                {machines.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="eyebrow">Fault type</label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {SENSOR_OPTIONS.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setSensor(s.key)}
                    data-testid={`fault-${s.key}`}
                    className={`flex items-center gap-2 px-3 py-2 text-xs border transition-colors ${
                      sensor === s.key
                        ? "border-[#F97316] bg-[#F97316]/10 text-foreground"
                        : "border-border text-muted-foreground hover:text-foreground hover:border-[#F97316]/50"
                    }`}
                  >
                    <s.icon size={12} />
                    <span className="truncate">{s.label}</span>
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {SENSOR_OPTIONS.find((s) => s.key === sensor)?.hint}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="eyebrow">Intensity</label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="range" min="0.3" max="1.5" step="0.05"
                    value={intensity}
                    onChange={(e) => setIntensity(e.target.value)}
                    data-testid="lab-intensity"
                    className="flex-1"
                  />
                  <span className="num text-sm w-10 text-right">{Number(intensity).toFixed(2)}</span>
                </div>
              </div>
              <div>
                <label className="eyebrow">Duration</label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="number" min="10" max="600" step="10"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    data-testid="lab-duration"
                    className="flex-1 input-themed px-2 py-1.5 text-sm"
                  />
                  <span className="text-xs text-muted-foreground">sec</span>
                </div>
              </div>
            </div>

            <button
              onClick={inject}
              data-testid="lab-inject-button"
              className="w-full bg-[#F97316] hover:bg-[#EA580C] text-black font-medium py-2.5 transition-colors flex items-center justify-center gap-2"
            >
              <AlertTriangle size={14} /> Inject fault
            </button>

            <p className="text-xs text-muted-foreground border-t border-border pt-3">
              Tip: after injection, open the affected machine and watch the live chart spike, alerts populate, and
              click "Run AI Diagnostic" to see Gemini's root-cause analysis.
            </p>
          </div>
        </div>

        {/* Active faults board */}
        <div className="panel lg:col-span-2">
          <div className="panel-header">
            <div className="eyebrow">Active Faults</div>
            <span className="num text-xs text-muted-foreground">
              {Object.values(activeFaults).filter((s) => s?.active).length} / {machines.length} machines
            </span>
          </div>
          <div className="divide-y divide-border">
            {machines.map((m) => {
              const f = activeFaults[m.id];
              const active = f?.active;
              return (
                <div key={m.id} className="px-4 py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-medium truncate">{m.name}</div>
                      <StatusBadge status={m.status} />
                    </div>
                    <div className="text-xs text-muted-foreground font-mono mt-0.5">
                      {active ? (
                        <>
                          <span className="text-[#F97316]">{f.sensor?.replace(/_/g, " ")}</span>
                          {" · intensity "}{Number(f.intensity).toFixed(2)}
                          {" · "}{f.ticks_remaining * 2}s remaining
                        </>
                      ) : (
                        <span>No active fault — running clean</span>
                      )}
                    </div>
                  </div>

                  <div className="num text-xs text-muted-foreground hidden md:block">
                    health {m.health_score.toFixed(1)}
                  </div>

                  {active ? (
                    <button
                      onClick={() => clear(m.id)}
                      data-testid={`lab-clear-${m.id}`}
                      className="inline-flex items-center gap-1 text-xs border border-border hover:border-red-500 text-muted-foreground hover:text-red-500 px-2.5 py-1.5"
                    >
                      <X size={12} /> Clear
                    </button>
                  ) : (
                    <button
                      onClick={() => { setMachineId(m.id); inject(); }}
                      data-testid={`lab-quick-${m.id}`}
                      className="text-xs text-muted-foreground hover:text-[#F97316]"
                    >
                      Quick inject ›
                    </button>
                  )}
                </div>
              );
            })}
            {machines.length === 0 && (
              <div className="p-6 text-sm text-muted-foreground text-center">No machines available.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
