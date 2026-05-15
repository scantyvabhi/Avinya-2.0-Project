import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import { toast } from "sonner";
import { StatusBadge, SeverityBadge } from "@/components/Status";
import {
  Wrench, ClipboardList, AlertOctagon, CheckCircle2, Play, ListPlus, Hand,
} from "lucide-react";

const KpiTile = ({ label, value, icon: Icon, accent = "text-foreground", testid }) => (
  <div className="panel" data-testid={testid}>
    <div className="panel-body">
      <div className="flex items-center justify-between">
        <div className="eyebrow">{label}</div>
        <Icon size={14} className={accent} />
      </div>
      <div className={`mt-2 num text-3xl font-bold ${accent}`}>{value}</div>
    </div>
  </div>
);

const PriorityBadge = ({ p }) => {
  const map = {
    high:   "bg-red-950 text-red-400 border-red-500/40",
    medium: "bg-amber-950 text-amber-400 border-amber-500/40",
    low:    "bg-emerald-950 text-emerald-400 border-emerald-500/40",
  };
  return (
    <span className={`px-2 py-0.5 text-[10px] font-mono uppercase tracking-widest border ${map[p] || map.medium}`}>
      {p}
    </span>
  );
};

const TaskStatusBadge = ({ s }) => {
  const map = {
    scheduled:   "bg-cyan-950 text-cyan-300 border-cyan-500/40",
    in_progress: "bg-amber-950 text-amber-400 border-amber-500/40",
    completed:   "bg-emerald-950 text-emerald-400 border-emerald-500/40",
    cancelled:   "bg-slate-900 text-slate-400 border-slate-500/40",
  };
  return (
    <span className={`px-2 py-0.5 text-[10px] font-mono uppercase tracking-widest border ${map[s] || map.scheduled}`}>
      {s.replace("_", " ")}
    </span>
  );
};

export default function TechnicianDashboard() {
  const [data, setData] = useState(null);

  const load = async () => {
    try {
      const { data } = await api.get("/technician/dashboard");
      setData(data);
    } catch {}
  };

  useEffect(() => {
    load();
    const i = setInterval(load, 4000);
    return () => clearInterval(i);
  }, []);

  const start = async (id) => {
    await api.post(`/maintenance/${id}/start`);
    toast.success("Task started.");
    load();
  };

  const claim = async (id) => {
    await api.post(`/maintenance/${id}/claim`);
    toast.success("Task claimed.");
    load();
  };

  const complete = async (id) => {
    const notes = window.prompt("Completion notes (optional):", "Completed.") || "";
    await api.post(`/maintenance/${id}/complete`, { notes });
    toast.success("Task closed.");
    load();
  };

  if (!data) return <div className="p-6 text-sm text-muted-foreground">Loading your workspace…</div>;

  const { kpis, my_tasks, unassigned_tasks, history, recent_alerts } = data;

  return (
    <div className="p-4 sm:p-6 space-y-5" data-testid="tech-dashboard">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="eyebrow">Technician Workspace</div>
          <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight">My Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Your active work orders, urgent alerts, and quick actions.
          </p>
        </div>
        <Link
          to="/app/new-request"
          data-testid="cta-new-request"
          className="inline-flex items-center gap-2 bg-[#F97316] hover:bg-[#EA580C] text-black font-medium px-4 py-2 transition-colors"
        >
          <ListPlus size={14} /> Raise new work order
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiTile testid="kpi-assigned"  label="Assigned"        value={kpis.assigned_open}   icon={ClipboardList} accent="text-[#F97316]" />
        <KpiTile testid="kpi-progress"  label="In progress"     value={kpis.in_progress}     icon={Play}          accent="text-amber-500" />
        <KpiTile testid="kpi-today"     label="Completed today" value={kpis.completed_today} icon={CheckCircle2}  accent="text-emerald-500" />
        <KpiTile testid="kpi-pool"      label="Unassigned pool" value={kpis.unassigned_open} icon={Hand}          accent="text-[#00E5FF]" />
        <KpiTile testid="kpi-urgent"    label="Urgent alerts"   value={kpis.urgent_alerts}   icon={AlertOctagon}  accent="text-red-500" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* My Tasks */}
        <div className="panel lg:col-span-2">
          <div className="panel-header">
            <div>
              <div className="eyebrow">My open tasks</div>
              <div className="font-display font-semibold text-sm">Assigned to you, not completed</div>
            </div>
            <Link to="/app/my-tasks" className="text-xs text-[#F97316] hover:underline">All my tasks →</Link>
          </div>
          <div className="divide-y divide-border max-h-[420px] overflow-auto">
            {my_tasks.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground text-center">
                Nothing assigned right now. Claim one from the unassigned pool ↓
              </div>
            ) : my_tasks.map((t) => (
              <div key={t.id} className="px-4 py-3" data-testid={`mytask-${t.id}`}>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="font-medium text-sm truncate">{t.title}</div>
                      <PriorityBadge p={t.priority} />
                      <TaskStatusBadge s={t.status} />
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      <span className="font-mono">{t.machine_name}</span>
                      {t.description ? <> · {t.description}</> : null}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {t.status === "scheduled" && (
                      <button
                        onClick={() => start(t.id)}
                        data-testid={`start-${t.id}`}
                        className="inline-flex items-center gap-1 text-xs bg-amber-500/10 border border-amber-500/40 text-amber-400 hover:bg-amber-500/20 px-2.5 py-1.5"
                      >
                        <Play size={11} /> Start
                      </button>
                    )}
                    <button
                      onClick={() => complete(t.id)}
                      data-testid={`done-${t.id}`}
                      className="inline-flex items-center gap-1 text-xs bg-emerald-500/10 border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/20 px-2.5 py-1.5"
                    >
                      <CheckCircle2 size={11} /> Close
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Urgent alerts feed */}
        <div className="panel">
          <div className="panel-header">
            <div className="flex items-center gap-2">
              <AlertOctagon size={14} className="text-red-500" />
              <div className="eyebrow">Active alerts</div>
            </div>
            <Link to="/app/alerts" className="text-xs text-[#F97316] hover:underline">All</Link>
          </div>
          <div className="divide-y divide-border max-h-[420px] overflow-auto">
            {recent_alerts.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">Fleet nominal.</div>
            ) : recent_alerts.slice(0, 8).map((a) => (
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

      {/* Unassigned pool */}
      <div className="panel">
        <div className="panel-header">
          <div className="flex items-center gap-2">
            <Hand size={14} className="text-[#00E5FF]" />
            <div>
              <div className="eyebrow">Unassigned task pool</div>
              <div className="font-display font-semibold text-sm">Pick up an open job</div>
            </div>
          </div>
          <span className="text-xs text-muted-foreground">{unassigned_tasks.length} available</span>
        </div>
        <div className="divide-y divide-border max-h-[260px] overflow-auto">
          {unassigned_tasks.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">No unassigned tasks.</div>
          ) : unassigned_tasks.map((t) => (
            <div key={t.id} className="px-4 py-3 flex items-center justify-between gap-3" data-testid={`unassigned-${t.id}`}>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="font-medium text-sm truncate">{t.title}</div>
                  <PriorityBadge p={t.priority} />
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  <span className="font-mono">{t.machine_name}</span>
                  {t.description ? <> · {t.description}</> : null}
                </div>
              </div>
              <button
                onClick={() => claim(t.id)}
                data-testid={`claim-${t.id}`}
                className="text-xs bg-[#F97316] hover:bg-[#EA580C] text-black font-medium px-3 py-1.5"
              >
                Claim
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* History */}
      <div className="panel">
        <div className="panel-header">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={14} className="text-emerald-500" />
            <div className="eyebrow">My recent completions</div>
          </div>
          <Link to="/app/my-tasks?tab=history" className="text-xs text-[#F97316] hover:underline">Full history →</Link>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border">
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Machine</th>
              <th className="px-4 py-3">Notes</th>
              <th className="px-4 py-3">Completed</th>
            </tr>
          </thead>
          <tbody>
            {history.length === 0 ? (
              <tr><td colSpan="4" className="px-4 py-6 text-center text-muted-foreground text-sm">No completed work yet.</td></tr>
            ) : history.map((t) => (
              <tr key={t.id} className="border-b border-border hover:bg-secondary">
                <td className="px-4 py-3 font-medium">{t.title}</td>
                <td className="px-4 py-3 font-mono text-xs">{t.machine_name}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground max-w-md truncate">{t.completion_notes || "—"}</td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                  {t.completed_at ? new Date(t.completed_at).toLocaleString() : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
