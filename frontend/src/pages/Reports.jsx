import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";

export default function Reports() {
  const [report, setReport] = useState(null);

  useEffect(() => {
    const load = async () => {
      const { data } = await api.get("/reports/summary");
      setReport(data);
    };
    load();
    const i = setInterval(load, 5000);
    return () => clearInterval(i);
  }, []);

  if (!report) return <div className="p-6 text-sm text-muted-foreground">Compiling reports…</div>;

  const totalKwh = report.energy_by_machine.reduce((s, m) => s + (m.kwh_estimate_24h || 0), 0);

  const exportCsv = () => {
    const rows = [
      ["Machine", "Status", "kWh estimate 24h"],
      ...report.energy_by_machine.map((m) => [m.name, m.status, m.kwh_estimate_24h]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `sentinel-energy-report-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 sm:p-6 space-y-5" data-testid="reports-page">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="eyebrow">Analytics</div>
          <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight">Reports</h1>
          <p className="text-sm text-muted-foreground mt-1">Failure trends, energy consumption and downtime.</p>
        </div>
        <button
          onClick={exportCsv}
          data-testid="export-csv"
          className="bg-[#F97316] hover:bg-[#EA580C] text-black px-3.5 py-2 text-sm font-medium"
        >
          Export CSV
        </button>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="panel">
          <div className="panel-body">
            <div className="eyebrow">Total energy / 24h</div>
            <div className="num text-3xl font-bold text-[#F97316] mt-1">{totalKwh.toFixed(1)} kWh</div>
          </div>
        </div>
        <div className="panel">
          <div className="panel-body">
            <div className="eyebrow">Estimated downtime</div>
            <div className="num text-3xl font-bold text-amber-400 mt-1">{report.downtime_estimate_hr} h</div>
          </div>
        </div>
        <div className="panel">
          <div className="panel-body">
            <div className="eyebrow">Alert categories (14d)</div>
            <div className="num text-3xl font-bold text-[#00E5FF] mt-1">{report.alerts_by_day.length}</div>
            <div className="text-xs text-muted-foreground mt-1">days with activity</div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="panel">
          <div className="panel-header">
            <div className="eyebrow">Alerts by day (severity)</div>
          </div>
          <div className="panel-body h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={report.alerts_by_day}>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontFamily: "IBM Plex Mono", fontSize: 10 }} stroke="hsl(var(--border))" />
                <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontFamily: "IBM Plex Mono", fontSize: 10 }} stroke="hsl(var(--border))" />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", color: "hsl(var(--foreground))", fontFamily: "IBM Plex Mono", fontSize: 11 }} />
                <Legend wrapperStyle={{ fontFamily: "IBM Plex Mono", fontSize: 11 }} />
                <Bar dataKey="critical" stackId="a" fill="#EF4444" />
                <Bar dataKey="warning" stackId="a" fill="#F59E0B" />
                <Bar dataKey="info" stackId="a" fill="#00E5FF" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div className="eyebrow">Energy by machine (kWh / 24h)</div>
          </div>
          <div className="panel-body h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={report.energy_by_machine} layout="vertical">
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
                <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))", fontFamily: "IBM Plex Mono", fontSize: 10 }} stroke="hsl(var(--border))" />
                <YAxis dataKey="name" type="category" tick={{ fill: "hsl(var(--muted-foreground))", fontFamily: "IBM Plex Mono", fontSize: 10 }} stroke="hsl(var(--border))" width={140} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", color: "hsl(var(--foreground))", fontFamily: "IBM Plex Mono", fontSize: 11 }} />
                <Bar dataKey="kwh_estimate_24h" fill="#F97316" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
