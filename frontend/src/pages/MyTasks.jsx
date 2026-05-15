import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "@/lib/api";
import { toast } from "sonner";
import { Play, CheckCircle2 } from "lucide-react";

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

export default function MyTasks() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") || "active";
  const [tasks, setTasks] = useState([]);

  const load = async () => {
    const query = { assigned_to: "me" };
    if (tab === "history") query.status = "completed";
    const { data } = await api.get("/maintenance", { params: query });
    if (tab === "active") {
      setTasks(data.filter((t) => t.status !== "completed" && t.status !== "cancelled"));
    } else {
      setTasks(data);
    }
  };

  useEffect(() => {
    load();
    const i = setInterval(load, 4000);
    return () => clearInterval(i);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const start = async (id) => { await api.post(`/maintenance/${id}/start`); toast.success("Started"); load(); };
  const complete = async (id) => {
    const notes = window.prompt("Completion notes (optional):", "Completed.") || "";
    await api.post(`/maintenance/${id}/complete`, { notes });
    toast.success("Task closed."); load();
  };

  return (
    <div className="p-4 sm:p-6 space-y-4" data-testid="my-tasks-page">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="eyebrow">Workspace</div>
          <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight">My Tasks</h1>
        </div>
        <div className="flex gap-2">
          {["active", "history"].map((t) => (
            <button
              key={t}
              onClick={() => setParams({ tab: t })}
              data-testid={`tab-${t}`}
              className={`px-3 py-1.5 text-xs font-mono uppercase tracking-widest border ${
                tab === t ? "bg-[#F97316] text-black border-[#F97316]" : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="panel">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border">
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Machine</th>
              <th className="px-4 py-3">Priority</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">{tab === "history" ? "Completed" : "Created"}</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((t) => (
              <tr key={t.id} className="border-b border-border hover:bg-secondary">
                <td className="px-4 py-3">
                  <div className="font-medium">{t.title}</div>
                  {t.description && <div className="text-xs text-muted-foreground truncate max-w-md">{t.description}</div>}
                  {tab === "history" && t.completion_notes && (
                    <div className="text-xs text-emerald-500 mt-1">› {t.completion_notes}</div>
                  )}
                </td>
                <td className="px-4 py-3 font-mono text-xs">{t.machine_name}</td>
                <td className="px-4 py-3"><PriorityBadge p={t.priority} /></td>
                <td className="px-4 py-3"><TaskStatusBadge s={t.status} /></td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                  {(tab === "history" ? t.completed_at : t.created_at)
                    ? new Date(tab === "history" ? t.completed_at : t.created_at).toLocaleString()
                    : "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  {t.status === "scheduled" && (
                    <button
                      onClick={() => start(t.id)}
                      data-testid={`start-${t.id}`}
                      className="inline-flex items-center gap-1 text-xs text-amber-500 hover:text-amber-400 mr-3"
                    >
                      <Play size={11} /> Start
                    </button>
                  )}
                  {t.status !== "completed" && t.status !== "cancelled" && (
                    <button
                      onClick={() => complete(t.id)}
                      data-testid={`done-${t.id}`}
                      className="inline-flex items-center gap-1 text-xs text-emerald-500 hover:text-emerald-400"
                    >
                      <CheckCircle2 size={11} /> Close
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {tasks.length === 0 && (
              <tr><td colSpan="6" className="px-4 py-8 text-center text-muted-foreground text-sm">No tasks here.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
