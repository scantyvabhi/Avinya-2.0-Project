import React, { useEffect, useState, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import api from "@/lib/api";
import { StatusBadge } from "@/components/Status";
import {
  ResponsiveContainer, LineChart, Line, AreaChart, Area, Tooltip, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { Sparkles, AlertTriangle, Wrench, ShieldCheck, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import TwinImagePanel from "@/components/TwinImagePanel";

const SENSORS = [
  { key: "temperature", label: "Temperature", unit: "°C", color: "#EF4444" },
  { key: "vibration",   label: "Vibration",   unit: "mm/s", color: "#F59E0B" },
  { key: "current",     label: "Current",     unit: "A",   color: "#00E5FF" },
  { key: "rpm",         label: "RPM",         unit: "rpm", color: "#10B981" },
  { key: "pressure",    label: "Pressure",    unit: "bar", color: "#F97316" },
  { key: "power_consumption", label: "Power", unit: "kW",  color: "#EAB308" },
];

const Gauge = ({ value, label, color = "#10B981" }) => {
  const v = Math.max(0, Math.min(100, value));
  const radius = 56;
  const c = 2 * Math.PI * radius;
  const offset = c - (v / 100) * c;
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 140 140" width="140" height="140">
        <circle cx="70" cy="70" r={radius} fill="none" stroke="hsl(var(--border))" strokeWidth="10" />
        <circle
          cx="70" cy="70" r={radius} fill="none"
          stroke={color} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={offset}
          transform="rotate(-90 70 70)"
          style={{ transition: "stroke-dashoffset 1s ease-out" }}
        />
        <text x="70" y="68" textAnchor="middle" fill="currentColor" fontSize="26" fontFamily="IBM Plex Mono" fontWeight="700">
          {v.toFixed(0)}
        </text>
        <text x="70" y="88" textAnchor="middle" fill="currentColor" opacity="0.55" fontSize="9" fontFamily="IBM Plex Mono" letterSpacing="1.5">
          {label.toUpperCase()}
        </text>
      </svg>
    </div>
  );
};

export default function MachineDetail() {
  const { id } = useParams();
  const [machine, setMachine] = useState(null);
  const [history, setHistory] = useState([]);
  const [diagnostic, setDiagnostic] = useState(null);
  const [diagLoading, setDiagLoading] = useState(false);
  const lastReading = useRef(null);

  useEffect(() => {
    let mounted = true;
    const tick = async () => {
      try {
        const m = await api.get(`/machines/${id}`);
        if (!mounted) return;
        setMachine(m.data);
        try {
          const h = await api.get(`/machines/${id}/sensors/history`, { params: { limit: 60 } });
          if (!mounted) return;
          setHistory(h.data.map((r) => ({
            ...r,
            t: new Date(r.timestamp).toLocaleTimeString([], { minute: "2-digit", second: "2-digit" }),
          })));
          lastReading.current = h.data[h.data.length - 1];
        } catch (e) {
          if (mounted) setHistory([]);
        }
      } catch (e) {}
    };
    tick();
    const interval = setInterval(tick, 2000);
    return () => { mounted = false; clearInterval(interval); };
  }, [id]);

  const runDiagnostic = async () => {
    setDiagLoading(true);
    try {
      const { data } = await api.get(`/machines/${id}/diagnostic`);
      setDiagnostic(data);
      toast.success(`Diagnostic generated · ${data.ai_powered ? "AI-powered" : "Rule-based"}`);
    } catch (e) {
      toast.error("Diagnostic failed");
    } finally {
      setDiagLoading(false);
    }
  };

  const scheduleMaintenance = async () => {
    if (!machine) return;
    try {
      await api.post("/maintenance", {
        machine_id: machine.id,
        title: `Inspection — ${machine.name}`,
        description: diagnostic?.root_cause || "Routine inspection",
        priority: machine.status === "critical" ? "high" : "medium",
      });
      toast.success("Maintenance task scheduled.");
    } catch {
      toast.error("Failed to schedule");
    }
  };

  if (!machine) return <div className="p-6 text-sm text-muted-foreground">Loading machine telemetry…</div>;

  const latest = history[history.length - 1] || {};
  const healthColor = {
    healthy: "#10B981", warning: "#F59E0B", critical: "#EF4444", offline: "#64748B"
  }[machine.status];

  return (
    <div className="p-4 sm:p-6 space-y-5" data-testid="machine-detail">
      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <Link to="/app/machines" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft size={12} /> Machines
          </Link>
          <div className="mt-1 flex items-center gap-3">
            <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight">{machine.name}</h1>
            <StatusBadge status={machine.status} />
          </div>
          <div className="text-xs font-mono text-muted-foreground mt-1">
            {machine.id} · type {machine.machine_type.replace(/_/g, " ")} · installed {machine.installation_date || "—"}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={runDiagnostic} disabled={diagLoading}
            data-testid="run-diagnostic"
            className="inline-flex items-center gap-2 bg-[#00E5FF] hover:brightness-110 text-black px-3.5 py-2 text-sm font-medium disabled:opacity-60"
          >
            <Sparkles size={14} />
            {diagLoading ? "Analyzing…" : "Run AI Diagnostic"}
          </button>
          <button
            onClick={scheduleMaintenance}
            data-testid="schedule-maintenance"
            className="inline-flex items-center gap-2 border border-border hover:border-[#F97316] text-foreground px-3.5 py-2 text-sm"
          >
            <Wrench size={14} /> Schedule maintenance
          </button>
        </div>
      </div>

      {/* Top row: Gauges */}
      <div className="grid lg:grid-cols-4 gap-4">
        <div className="panel">
          <div className="panel-body flex items-center justify-around">
            <Gauge value={machine.health_score} label="Health" color={healthColor} />
            <div>
              <div className="eyebrow">RUL</div>
              <div className="num text-2xl font-bold">{machine.rul_days}<span className="text-muted-foreground text-sm"> days</span></div>
              <div className="eyebrow mt-3">Failure prob.</div>
              <div className="num text-lg">
                {diagnostic ? `${(diagnostic.failure_probability * 100).toFixed(1)}%` : "—"}
              </div>
            </div>
          </div>
        </div>

        {/* Live sensor values */}
        <div className="panel lg:col-span-3">
          <div className="panel-header">
            <div className="eyebrow">Live Sensor Snapshot</div>
            <div className="text-[10px] font-mono text-muted-foreground">{latest.t || "--:--"}</div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-px bg-border">
            {[
              { k: "temperature", l: "TEMP", u: "°C" },
              { k: "vibration",   l: "VIB",  u: "mm/s" },
              { k: "current",     l: "CUR",  u: "A" },
              { k: "rpm",         l: "RPM",  u: "" },
              { k: "voltage",     l: "VOLT", u: "V" },
              { k: "humidity",    l: "HUM",  u: "%" },
              { k: "oil_level",   l: "OIL",  u: "%" },
              { k: "noise",       l: "NOISE",u: "dB" },
              { k: "pressure",    l: "PRES", u: "bar" },
              { k: "power_consumption", l: "PWR", u: "kW" },
            ].map((s) => (
              <div key={s.k} className="bg-card p-3">
                <div className="eyebrow">{s.l}</div>
                <div className="num text-xl font-semibold mt-1">
                  {latest[s.k]?.toFixed?.(1) ?? "—"}
                  <span className="text-xs text-muted-foreground ml-1 font-sans">{s.u}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sensor charts + Twin image setup */}
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {SENSORS.map((s) => (
          <SensorChart key={s.key} sensor={s} data={history} />
        ))}
        <TwinImagePanel machine={machine} onUpdated={() => {
          api.get(`/machines/${machine.id}`).then(({ data }) => setMachine(data)).catch(() => {});
        }} />
      </div>

      {/* Diagnostic */}
      {diagnostic && <DiagnosticPanel d={diagnostic} />}
    </div>
  );
}

const SensorChart = ({ sensor, data }) => (
  <div className="panel">
    <div className="panel-header">
      <div>
        <div className="eyebrow">{sensor.label}</div>
        <div className="text-xs font-mono">
          {data.length ? data[data.length - 1][sensor.key]?.toFixed?.(1) : "—"} <span className="text-muted-foreground">{sensor.unit}</span>
        </div>
      </div>
    </div>
    <div className="panel-body h-[160px] p-1">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id={`g-${sensor.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={sensor.color} stopOpacity={0.5} />
              <stop offset="95%" stopColor={sensor.color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
          <XAxis dataKey="t" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9, fontFamily: "IBM Plex Mono" }} stroke="hsl(var(--border))" />
          <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9, fontFamily: "IBM Plex Mono" }} stroke="hsl(var(--border))" />
          <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", color: "hsl(var(--foreground))", fontFamily: "IBM Plex Mono", fontSize: 11 }} />
          <Area type="monotone" dataKey={sensor.key} stroke={sensor.color} fill={`url(#g-${sensor.key})`} strokeWidth={1.5} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  </div>
);

const DiagnosticPanel = ({ d }) => (
  <div className="panel glow-cyan" data-testid="diagnostic-panel">
    <div className="panel-header">
      <div className="flex items-center gap-2">
        <Sparkles size={14} className="text-[#00E5FF]" />
        <div>
          <div className="eyebrow">AI Diagnostic Report</div>
          <div className="font-display font-semibold">
            {d.ai_powered ? "Claude-powered root cause analysis" : "Rule-based root cause analysis"}
          </div>
        </div>
      </div>
      <div className="text-xs font-mono text-muted-foreground">
        FAIL PROB · {(d.failure_probability * 100).toFixed(1)}%
      </div>
    </div>
    <div className="panel-body grid lg:grid-cols-3 gap-5">
      <div>
        <div className="eyebrow">Root cause</div>
        <p className="mt-1 text-sm leading-relaxed whitespace-pre-line">{d.root_cause}</p>
      </div>
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <Wrench size={14} className="text-[#F97316]" />
          <div className="eyebrow">Recommendations</div>
        </div>
        <ul className="space-y-2 text-sm">
          {d.recommendations.map((r, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-[#F97316] num">{String(i + 1).padStart(2, "0")}</span>
              <span>{r}</span>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <ShieldCheck size={14} className="text-emerald-400" />
          <div className="eyebrow">Safety</div>
        </div>
        <ul className="space-y-2 text-sm">
          {d.safety_instructions.map((s, i) => (
            <li key={i} className="text-muted-foreground">› {s}</li>
          ))}
        </ul>

        {d.anomalies?.length > 0 && (
          <>
            <div className="eyebrow mt-5 flex items-center gap-1.5">
              <AlertTriangle size={12} className="text-amber-400" /> Anomalies
            </div>
            <ul className="mt-2 space-y-1 text-xs font-mono">
              {d.anomalies.slice(0, 5).map((a, i) => (
                <li key={i}>
                  <span className="text-amber-400">{a.sensor}</span>
                  {" "}={a.value}{a.unit} ({a.direction}, +{a.deviation_pct}% off)
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  </div>
);
