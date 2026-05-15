import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceArea, Cell,
} from "recharts";
import { Zap, Moon, Sun, Sparkles, TrendingDown, Lightbulb } from "lucide-react";

export default function Energy() {
  const [data, setData] = useState(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const { data } = await api.get("/energy/profile", { params: { ai: true } });
        if (mounted) setData(data);
      } catch {}
    };
    load();
    const i = setInterval(load, 8000);
    return () => { mounted = false; clearInterval(i); };
  }, []);

  if (!data) return <div className="p-6 text-sm text-muted-foreground">Computing energy profile…</div>;

  const { hourly, costs, machines, narrative, ai_powered } = data;
  const peakStart = parseInt(costs.peak_window.split("-")[0]);
  const peakEnd   = parseInt(costs.peak_window.split("-")[1]);

  const totalShiftable = machines
    .filter((m) => m.usage_type !== "continuous" && m.status !== "critical")
    .reduce((s, m) => s + m.potential_daily_savings, 0);

  return (
    <div className="p-4 sm:p-6 space-y-5" data-testid="energy-page">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="eyebrow">Energy</div>
          <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Zap size={24} className="text-[#F97316]" />
            Energy Optimization
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Hourly load profile · peak vs off-peak cost breakdown · AI-driven shift recommendations
          </p>
        </div>
        <div className="text-xs font-mono text-muted-foreground text-right">
          <div>PEAK · <span className="text-amber-500">{costs.peak_window}</span> · {costs.peak_rate} {costs.currency}/kWh</div>
          <div>OFF-PEAK · <span className="text-emerald-500">{costs.offpeak_window}</span> · {costs.offpeak_rate} {costs.currency}/kWh</div>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Total today" value={`${costs.total_cost.toFixed(0)} ${costs.currency}`} icon={Zap} accent="text-[#F97316]" />
        <Kpi label="Peak spend"  value={`${costs.peak_cost.toFixed(0)} ${costs.currency}`}  icon={Sun}  accent="text-amber-500" sub={`${costs.peak_kwh.toFixed(1)} kWh`} />
        <Kpi label="Off-peak"    value={`${costs.offpeak_cost.toFixed(0)} ${costs.currency}`} icon={Moon} accent="text-emerald-500" sub={`${costs.offpeak_kwh.toFixed(1)} kWh`} />
        <Kpi label="Potential savings / day" value={`${totalShiftable.toFixed(0)} ${costs.currency}`} icon={TrendingDown} accent="text-[#00E5FF]" sub="If shiftable assets move off-peak" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Hourly chart */}
        <div className="panel lg:col-span-2">
          <div className="panel-header">
            <div>
              <div className="eyebrow">Hourly load (24h)</div>
              <div className="font-display font-semibold text-sm">
                Avg power per hour — shaded area = off-peak window
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs font-mono">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-amber-500" /> peak</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-emerald-500" /> off-peak</span>
            </div>
          </div>
          <div className="panel-body h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourly}>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
                <XAxis
                  dataKey="hour"
                  tickFormatter={(h) => `${String(h).padStart(2, "0")}h`}
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10, fontFamily: "IBM Plex Mono" }}
                  stroke="hsl(var(--border))"
                />
                <YAxis
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10, fontFamily: "IBM Plex Mono" }}
                  stroke="hsl(var(--border))"
                  label={{ value: "kW", angle: -90, position: "insideLeft", style: { fill: "hsl(var(--muted-foreground))", fontSize: 10 } }}
                />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontFamily: "IBM Plex Mono", fontSize: 11 }}
                  formatter={(v) => [`${v} kW`, "Avg power"]}
                  labelFormatter={(h) => `Hour ${String(h).padStart(2, "0")}:00`}
                />
                {peakEnd > peakStart ? (
                  <>
                    <ReferenceArea x1={-0.5} x2={peakStart - 0.5} fill="#10B981" fillOpacity={0.06} />
                    <ReferenceArea x1={peakEnd - 0.5} x2={23.5} fill="#10B981" fillOpacity={0.06} />
                  </>
                ) : (
                  <ReferenceArea x1={peakEnd - 0.5} x2={peakStart - 0.5} fill="#10B981" fillOpacity={0.06} />
                )}
                <Bar dataKey="avg_power_kw">
                  {hourly.map((h, i) => (
                    <Cell key={i} fill={h.is_offpeak ? "#10B981" : "#F59E0B"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* AI narrative */}
        <div className="panel glow-cyan">
          <div className="panel-header">
            <div className="flex items-center gap-2">
              <Sparkles size={14} className="text-[#00E5FF]" />
              <div>
                <div className="eyebrow">AI recommendation</div>
                <div className="font-display font-semibold text-sm">
                  {ai_powered ? "Gemini 2.5 Flash" : "Rule-based"}
                </div>
              </div>
            </div>
          </div>
          <div className="panel-body">
            {narrative ? (
              <p className="text-sm leading-relaxed whitespace-pre-line">{narrative}</p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Recommendations will appear once enough load data has been collected.
              </p>
            )}
            <div className="mt-4 pt-4 border-t border-border">
              <div className="eyebrow flex items-center gap-1.5">
                <Lightbulb size={12} /> Quick wins
              </div>
              <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
                <li>› Shift batch jobs to {costs.offpeak_window} window.</li>
                <li>› Pre-cool storage areas during off-peak.</li>
                <li>› Stagger continuous loads to avoid peak overlap.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Per-machine shift recommendations */}
      <div className="panel">
        <div className="panel-header">
          <div className="eyebrow">Machine shift recommendations</div>
          <span className="text-xs text-muted-foreground">sorted by shiftability × power draw</span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border">
              <th className="px-4 py-3">Machine</th>
              <th className="px-4 py-3">Usage</th>
              <th className="px-4 py-3">Current draw</th>
              <th className="px-4 py-3">Shiftability</th>
              <th className="px-4 py-3">Savings / day</th>
              <th className="px-4 py-3">Recommendation</th>
            </tr>
          </thead>
          <tbody>
            {machines.map((m) => (
              <tr key={m.machine_id} className="border-b border-border hover:bg-secondary/50 transition-colors">
                <td className="px-4 py-3">
                  <div className="font-medium">{m.name}</div>
                  <div className="text-xs text-muted-foreground font-mono">{m.machine_type.replace(/_/g, " ")}</div>
                </td>
                <td className="px-4 py-3 text-xs font-mono uppercase">{m.usage_type}</td>
                <td className="px-4 py-3 num">{m.current_power_kw} kW</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-1.5 bg-secondary">
                      <div
                        className="h-full"
                        style={{
                          width: `${m.shiftability * 100}%`,
                          background: m.shiftability > 0.7 ? "#10B981" : m.shiftability > 0.4 ? "#F59E0B" : "#64748B",
                        }}
                      />
                    </div>
                    <span className="num text-xs">{(m.shiftability * 100).toFixed(0)}%</span>
                  </div>
                </td>
                <td className="px-4 py-3 num font-semibold text-emerald-500">
                  {m.potential_daily_savings} {costs.currency}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground max-w-md">{m.recommendation}</td>
              </tr>
            ))}
            {machines.length === 0 && (
              <tr><td colSpan="6" className="px-4 py-8 text-center text-muted-foreground text-sm">No machines.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const Kpi = ({ label, value, icon: Icon, accent, sub }) => (
  <div className="panel">
    <div className="panel-body">
      <div className="flex items-center justify-between">
        <div className="eyebrow">{label}</div>
        <Icon size={14} className={accent} />
      </div>
      <div className={`mt-2 num text-2xl font-bold ${accent}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </div>
  </div>
);
