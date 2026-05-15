import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import { KpiTile, StatusBadge, StatusDot, SeverityBadge } from "@/components/Status";
import { ResponsiveContainer, AreaChart, Area, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { Zap, AlertOctagon, Cpu, Heart } from "lucide-react";

export default function Dashboard() {
  const [overview, setOverview] = useState(null);
  const [healthTrend, setHealthTrend] = useState([]);

  useEffect(() => {
    let mounted = true;
    const fetch = async () => {
      try {
        const { data } = await api.get("/dashboard/overview");
        if (mounted) {
          setOverview(data);
          setHealthTrend((prev) => {
            const next = [
              ...prev,
              {
                t: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
                avg: data.avg_health,
                power: data.total_power_kw,
              },
            ];
            return next.slice(-30);
          });
        }
      } catch {}
    };
    fetch();
    const i = setInterval(fetch, 2000);
    return () => { mounted = false; clearInterval(i); };
  }, []);

  if (!overview) return <div className="p-6 text-sm text-muted-foreground">Synchronising telemetry…</div>;

  return (
    <div className="p-4 sm:p-6 space-y-6" data-testid="dashboard">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="eyebrow">Operations Overview</div>
          <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight">Control Room</h1>
        </div>
        <div className="text-xs font-mono text-muted-foreground">
          UPDATING EVERY 2s · {new Date().toLocaleTimeString()}
        </div>
      </div>

      {/* KPI Tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiTile testid="kpi-total"    label="Machines"        value={overview.total_machines} />
        <KpiTile testid="kpi-healthy"  label="Healthy"   accent="healthy" value={overview.healthy} />
        <KpiTile testid="kpi-warning"  label="Warning"   accent="warning" value={overview.warning} />
        <KpiTile testid="kpi-critical" label="Critical"  accent="critical" value={overview.critical} />
        <KpiTile testid="kpi-alerts"   label="Active alerts" accent="ai" value={overview.active_alerts} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Health & power chart */}
        <div className="panel lg:col-span-2">
          <div className="panel-header">
            <div>
              <div className="eyebrow">Live KPI Trend</div>
              <div className="font-display font-semibold text-sm">Fleet health & power draw</div>
            </div>
            <div className="flex items-center gap-4 text-xs font-mono">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-[#00E5FF]" /> Health</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-[#F97316]" /> Power (kW)</span>
            </div>
          </div>
          <div className="panel-body h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={healthTrend}>
                <defs>
                  <linearGradient id="hg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00E5FF" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="#00E5FF" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="pg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F97316" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#F97316" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
                <XAxis dataKey="t" tick={{ fill: "hsl(var(--muted-foreground))", fontFamily: "IBM Plex Mono", fontSize: 10 }} stroke="hsl(var(--border))" />
                <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontFamily: "IBM Plex Mono", fontSize: 10 }} stroke="hsl(var(--border))" />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", color: "hsl(var(--foreground))", fontFamily: "IBM Plex Mono", fontSize: 11 }} />
                <Area type="monotone" dataKey="avg" stroke="#00E5FF" fill="url(#hg)" strokeWidth={2} isAnimationActive={false} />
                <Area type="monotone" dataKey="power" stroke="#F97316" fill="url(#pg)" strokeWidth={2} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent alerts */}
        <div className="panel">
          <div className="panel-header">
            <div className="eyebrow">Active Alerts</div>
            <Link to="/app/alerts" className="text-xs text-[#F97316] hover:underline">View all</Link>
          </div>
          <div className="divide-y divide-border max-h-[260px] overflow-auto">
            {overview.recent_alerts.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">No alerts. Fleet nominal.</div>
            ) : overview.recent_alerts.slice(0, 6).map((a) => (
              <div key={a.id} className="p-3 hover:bg-secondary transition-colors">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium truncate">{a.machine_name}</div>
                  <SeverityBadge severity={a.severity} />
                </div>
                <div className="text-xs text-muted-foreground mt-0.5 truncate">{a.title}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Machine grid */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="eyebrow">Machine Health Grid</div>
            <div className="font-display font-semibold">All assets, color-coded</div>
          </div>
          <Link to="/app/machines" className="text-xs text-[#F97316] hover:underline">Detailed list →</Link>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {overview.machines.map((m) => (
            <MachineCard key={m.id} m={m} />
          ))}
        </div>
      </div>
    </div>
  );
}

const MachineCard = ({ m }) => {
  const ring = {
    healthy: "border-emerald-500/40 hover:border-emerald-400",
    warning: "border-amber-500/40 hover:border-amber-400",
    critical: "border-red-500/50 hover:border-red-400 animate-pulse-critical",
    offline: "border-slate-500/40",
  }[m.status] || "border-border";

  const healthColor = {
    healthy: "text-emerald-400",
    warning: "text-amber-400",
    critical: "text-red-400",
    offline: "text-slate-400",
  }[m.status];

  return (
    <Link
      to={`/app/machines/${m.id}`}
      data-testid={`machine-card-${m.id}`}
      className={`block panel ${ring} transition-colors`}
    >
      <div className="panel-body">
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
              {m.machine_type.replace(/_/g, " ")}
            </div>
            <div className="mt-1 font-display font-semibold truncate">{m.name}</div>
          </div>
          <StatusDot status={m.status} />
        </div>

        <div className="mt-5 flex items-end justify-between">
          <div>
            <div className="eyebrow">Health</div>
            <div className={`num text-3xl font-bold ${healthColor}`}>{m.health_score.toFixed(1)}</div>
          </div>
          <div className="text-right">
            <div className="eyebrow">RUL</div>
            <div className="num text-sm">{m.rul_days}d</div>
          </div>
        </div>

        <div className="mt-3 h-1 bg-secondary overflow-hidden">
          <div
            className={`h-full transition-all duration-700`}
            style={{
              width: `${Math.max(2, m.health_score)}%`,
              background: m.status === "critical" ? "#EF4444" : m.status === "warning" ? "#F59E0B" : "#10B981",
            }}
          />
        </div>
      </div>
    </Link>
  );
};
