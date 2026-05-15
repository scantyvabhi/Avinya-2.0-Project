import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { Plus, CheckCircle2, Play, UserCheck } from "lucide-react";
import { useAuth } from "@/lib/auth";

export default function Maintenance() {
  const { user } = useAuth();
  const isOwner = user?.role === "factory_owner";

  const [tasks, setTasks] = useState([]);
  const [machines, setMachines] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [filter, setFilter] = useState("all"); // all|scheduled|in_progress|completed
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    machine_id: "",
    title: "",
    description: "",
    priority: "medium",
    scheduled_for: "",
    assigned_to: "",
  });

  const load = async () => {
    const params = filter !== "all" ? { status: filter } : {};
    const [{ data: t }, { data: m }] = await Promise.all([
      api.get("/maintenance", { params }),
      api.get("/machines"),
    ]);
    setTasks(t);
    setMachines(m);
    if (!form.machine_id && m[0]) setForm((f) => ({ ...f, machine_id: m[0].id }));
    if (isOwner) {
      api.get("/users", { params: { role: "technician" } })
        .then(({ data }) => setTechnicians(data))
        .catch(() => {});
    }
  };

  useEffect(() => {
    load();
    const i = setInterval(load, 4000);
    return () => clearInterval(i);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const add = async (e) => {
    e.preventDefault();
    const payload = { ...form };
    if (!payload.scheduled_for) delete payload.scheduled_for;
    if (!payload.assigned_to) delete payload.assigned_to;
    await api.post("/maintenance", payload);
    toast.success("Task created.");
    setShowAdd(false);
    setForm({ ...form, title: "", description: "" });
    load();
  };

  const start = async (id) => { await api.post(`/maintenance/${id}/start`); toast.success("Started"); load(); };
  const complete = async (id) => {
    const notes = window.prompt("Completion notes (optional):", "Completed.") || "";
    await api.post(`/maintenance/${id}/complete`, { notes });
    toast.success("Closed."); load();
  };
  const reassign = async (id, email) => {
    await api.post(`/maintenance/${id}/assign`, { assigned_to: email || null });
    toast.success(email ? "Reassigned" : "Unassigned");
    load();
  };

  const priorityMap = {
    high: "text-red-400 border-red-500/40 bg-red-950",
    medium: "text-amber-400 border-amber-500/40 bg-amber-950",
    low: "text-emerald-400 border-emerald-500/40 bg-emerald-950",
  };
  const statusMap = {
    scheduled: "text-cyan-300 border-cyan-500/40 bg-cyan-950",
    in_progress: "text-amber-400 border-amber-500/40 bg-amber-950",
    completed: "text-emerald-400 border-emerald-500/40 bg-emerald-950",
    cancelled: "text-slate-400 border-slate-500/40 bg-slate-900",
  };

  return (
    <div className="p-4 sm:p-6 space-y-4" data-testid="maintenance-page">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="eyebrow">Workshop</div>
          <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight">Maintenance</h1>
          <p className="text-sm text-muted-foreground mt-1">
            All work orders across the fleet — synced live between owners and technicians.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            data-testid="maint-filter"
            className="input-themed px-3 py-2 text-sm font-mono uppercase tracking-wider"
          >
            <option value="all">All</option>
            <option value="scheduled">Scheduled</option>
            <option value="in_progress">In progress</option>
            <option value="completed">Completed</option>
          </select>
          <button
            onClick={() => setShowAdd(!showAdd)}
            data-testid="new-task-button"
            className="inline-flex items-center gap-2 bg-[#F97316] hover:bg-[#EA580C] text-black px-3.5 py-2 text-sm font-medium"
          >
            <Plus size={14} /> New work order
          </button>
        </div>
      </div>

      {showAdd && (
        <form onSubmit={add} className="panel" data-testid="new-task-form">
          <div className="panel-body grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="eyebrow">Machine</label>
              <select
                value={form.machine_id}
                onChange={(e) => setForm({ ...form, machine_id: e.target.value })}
                className="mt-1 w-full input-themed px-3 py-2 text-sm"
              >
                {machines.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div className="lg:col-span-2">
              <label className="eyebrow">Title</label>
              <input
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="mt-1 w-full input-themed px-3 py-2 text-sm"
                data-testid="task-title"
              />
            </div>
            <div>
              <label className="eyebrow">Priority</label>
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
                className="mt-1 w-full input-themed px-3 py-2 text-sm"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div className="lg:col-span-2">
              <label className="eyebrow">Description</label>
              <input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="mt-1 w-full input-themed px-3 py-2 text-sm"
              />
            </div>
            {isOwner && (
              <div>
                <label className="eyebrow">Assign to</label>
                <select
                  value={form.assigned_to}
                  onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}
                  className="mt-1 w-full input-themed px-3 py-2 text-sm"
                >
                  <option value="">— Unassigned —</option>
                  {technicians.map((t) => (
                    <option key={t.id} value={t.email}>{t.full_name}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex items-end">
              <button className="bg-[#F97316] text-black px-4 py-2 text-sm font-medium w-full" data-testid="task-submit">
                Schedule
              </button>
            </div>
          </div>
        </form>
      )}

      <div className="panel">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border">
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Machine</th>
              <th className="px-4 py-3">Assigned</th>
              <th className="px-4 py-3">Priority</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((t) => (
              <tr key={t.id} className="border-b border-border hover:bg-secondary">
                <td className="px-4 py-3">
                  <div className="font-medium">{t.title}</div>
                  {t.description && <div className="text-xs text-muted-foreground truncate max-w-md">{t.description}</div>}
                  {t.completion_notes && (
                    <div className="text-xs text-emerald-500 mt-0.5">› {t.completion_notes}</div>
                  )}
                </td>
                <td className="px-4 py-3 font-mono text-xs">{t.machine_name}</td>
                <td className="px-4 py-3 text-xs">
                  {isOwner ? (
                    <select
                      value={t.assigned_to || ""}
                      onChange={(e) => reassign(t.id, e.target.value)}
                      className="input-themed text-xs px-2 py-1 max-w-[180px]"
                      data-testid={`assign-${t.id}`}
                    >
                      <option value="">— Pool —</option>
                      {technicians.map((tech) => (
                        <option key={tech.id} value={tech.email}>{tech.full_name}</option>
                      ))}
                    </select>
                  ) : (
                    <span className="font-mono text-xs">{t.assigned_to || "— pool —"}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 text-[10px] font-mono uppercase tracking-widest border ${priorityMap[t.priority]}`}>
                    {t.priority}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 text-[10px] font-mono uppercase tracking-widest border ${statusMap[t.status]}`}>
                    {t.status.replace("_", " ")}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                  {new Date(t.created_at).toLocaleDateString()}
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
                      data-testid={`complete-${t.id}`}
                      className="inline-flex items-center gap-1 text-xs text-emerald-500 hover:text-emerald-400"
                    >
                      <CheckCircle2 size={11} /> Close
                    </button>
                  )}
                  {t.status === "completed" && <span className="text-xs text-muted-foreground">—</span>}
                </td>
              </tr>
            ))}
            {tasks.length === 0 && (
              <tr><td colSpan="7" className="px-4 py-8 text-center text-muted-foreground text-sm">No work orders.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
