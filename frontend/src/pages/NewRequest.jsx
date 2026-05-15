import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { ListPlus } from "lucide-react";

export default function NewRequest() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isTech = user?.role === "technician";

  const [machines, setMachines] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [form, setForm] = useState({
    machine_id: "",
    title: "",
    description: "",
    priority: "medium",
    scheduled_for: "",
    assigned_to: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get("/machines").then(({ data }) => {
      setMachines(data);
      if (data[0]) setForm((f) => ({ ...f, machine_id: data[0].id }));
    });
    if (!isTech) {
      api.get("/users", { params: { role: "technician" } })
        .then(({ data }) => setTechnicians(data))
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      // Technicians: auto-assign to themselves
      const payload = { ...form };
      if (isTech) payload.assigned_to = user.email;
      if (!payload.scheduled_for) delete payload.scheduled_for;
      if (!payload.assigned_to) delete payload.assigned_to;

      await api.post("/maintenance", payload);
      toast.success("Work order raised.");
      navigate(isTech ? "/app/my-tasks" : "/app/maintenance");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to create");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-5" data-testid="new-request-page">
      <div>
        <div className="eyebrow">Workshop</div>
        <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
          <ListPlus size={22} className="text-[#F97316]" />
          Raise new work order
        </h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          {isTech
            ? "Open a new maintenance request — it'll be added to your task queue immediately and visible to the owner."
            : "Schedule a new maintenance task and (optionally) assign it to a technician."}
        </p>
      </div>

      <form onSubmit={submit} className="panel max-w-3xl">
        <div className="panel-body grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="eyebrow">Title</label>
            <input
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Inspect bearing on Pump #1"
              data-testid="req-title"
              className="mt-1 w-full input-themed px-3 py-2.5 text-sm"
            />
          </div>

          <div>
            <label className="eyebrow">Machine</label>
            <select
              required
              value={form.machine_id}
              onChange={(e) => setForm({ ...form, machine_id: e.target.value })}
              data-testid="req-machine"
              className="mt-1 w-full input-themed px-3 py-2.5 text-sm"
            >
              {machines.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>

          <div>
            <label className="eyebrow">Priority</label>
            <select
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
              data-testid="req-priority"
              className="mt-1 w-full input-themed px-3 py-2.5 text-sm"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          {!isTech && (
            <div>
              <label className="eyebrow">Assign to technician</label>
              <select
                value={form.assigned_to}
                onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}
                data-testid="req-assign"
                className="mt-1 w-full input-themed px-3 py-2.5 text-sm"
              >
                <option value="">— Unassigned (pool) —</option>
                {technicians.map((t) => (
                  <option key={t.id} value={t.email}>{t.full_name} — {t.email}</option>
                ))}
              </select>
            </div>
          )}

          <div className={isTech ? "" : ""}>
            <label className="eyebrow">Scheduled for (optional)</label>
            <input
              type="date"
              value={form.scheduled_for}
              onChange={(e) => setForm({ ...form, scheduled_for: e.target.value })}
              data-testid="req-date"
              className="mt-1 w-full input-themed px-3 py-2.5 text-sm"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="eyebrow">Description / notes</label>
            <textarea
              rows={4}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="What's the issue, what's been tried, any safety concerns…"
              data-testid="req-description"
              className="mt-1 w-full input-themed px-3 py-2.5 text-sm"
            />
          </div>

          <div className="sm:col-span-2 flex justify-end gap-3 pt-2 border-t border-border">
            <button
              type="button"
              onClick={() => navigate(isTech ? "/app/my-dashboard" : "/app/maintenance")}
              className="text-sm text-muted-foreground hover:text-foreground px-4 py-2"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              data-testid="req-submit"
              className="bg-[#F97316] hover:bg-[#EA580C] disabled:opacity-60 text-black font-medium px-5 py-2 transition-colors"
            >
              {saving ? "Saving…" : "Submit work order"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
