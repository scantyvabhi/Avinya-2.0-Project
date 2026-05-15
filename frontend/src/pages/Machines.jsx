import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import { StatusBadge } from "@/components/Status";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function Machines() {
  const [machines, setMachines] = useState([]);
  const [filter, setFilter] = useState("all");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    name: "", machine_type: "cnc_lathe", factory_id: "factory-demo-001"
  });
  const [factories, setFactories] = useState([]);

  const load = async () => {
    const params = filter === "all" ? {} : { status: filter };
    const { data } = await api.get("/machines", { params });
    setMachines(data);
  };

  useEffect(() => {
    load();
    api.get("/factories").then(({ data }) => setFactories(data)).catch(() => {});
    const i = setInterval(load, 3000);
    return () => clearInterval(i);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const add = async (e) => {
    e.preventDefault();
    try {
      await api.post("/machines", form);
      toast.success("Machine registered.");
      setShowAdd(false);
      setForm({ name: "", machine_type: "cnc_lathe", factory_id: form.factory_id });
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed");
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Remove this machine and all its history?")) return;
    await api.delete(`/machines/${id}`);
    toast.success("Removed.");
    load();
  };

  return (
    <div className="p-4 sm:p-6 space-y-4" data-testid="machines-page">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="eyebrow">Inventory</div>
          <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight">Machines</h1>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            data-testid="machine-filter"
            className="input-themed px-3 py-2 text-sm font-mono uppercase tracking-wider"
          >
            <option value="all">All</option>
            <option value="healthy">Healthy</option>
            <option value="warning">Warning</option>
            <option value="critical">Critical</option>
          </select>
          <button
            onClick={() => setShowAdd((s) => !s)}
            data-testid="machine-add-button"
            className="inline-flex items-center gap-2 bg-[#F97316] hover:bg-[#EA580C] text-black px-3.5 py-2 text-sm font-medium"
          >
            <Plus size={14} /> Add machine
          </button>
        </div>
      </div>

      {showAdd && (
        <form onSubmit={add} className="panel" data-testid="add-machine-form">
          <div className="panel-body grid sm:grid-cols-4 gap-3">
            <div>
              <label className="eyebrow">Name</label>
              <input
                required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="mt-1 w-full input-themed px-3 py-2 text-sm"
                data-testid="add-machine-name"
              />
            </div>
            <div>
              <label className="eyebrow">Type</label>
              <select
                value={form.machine_type}
                onChange={(e) => setForm({ ...form, machine_type: e.target.value })}
                className="mt-1 w-full input-themed px-3 py-2 text-sm"
                data-testid="add-machine-type"
              >
                <option value="cnc_lathe">CNC Lathe</option>
                <option value="pump">Pump</option>
                <option value="compressor">Compressor</option>
                <option value="conveyor">Conveyor</option>
                <option value="hvac_chiller">HVAC Chiller</option>
              </select>
            </div>
            <div>
              <label className="eyebrow">Factory</label>
              <select
                value={form.factory_id}
                onChange={(e) => setForm({ ...form, factory_id: e.target.value })}
                className="mt-1 w-full input-themed px-3 py-2 text-sm"
              >
                {factories.length === 0
                  ? <option value="factory-demo-001">Plant A — Mumbai</option>
                  : factories.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
            <div className="flex items-end">
              <button className="bg-[#F97316] text-black px-4 py-2 text-sm font-medium w-full" data-testid="add-machine-submit">
                Register
              </button>
            </div>
          </div>
        </form>
      )}

      <div className="panel">
        <table className="w-full text-sm" data-testid="machines-table">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border">
              <th className="px-4 py-3">Machine</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Health</th>
              <th className="px-4 py-3">RUL</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {machines.map((m) => (
              <tr key={m.id} className="border-b border-border hover:bg-secondary transition-colors">
                <td className="px-4 py-3">
                  <Link to={`/app/machines/${m.id}`} className="font-medium hover:text-[#F97316]">
                    {m.name}
                  </Link>
                  <div className="text-xs text-muted-foreground font-mono">{m.id}</div>
                </td>
                <td className="px-4 py-3 font-mono text-xs uppercase">{m.machine_type.replace(/_/g, " ")}</td>
                <td className="px-4 py-3 num font-semibold">{m.health_score.toFixed(1)}</td>
                <td className="px-4 py-3 num text-muted-foreground">{m.rul_days}d</td>
                <td className="px-4 py-3"><StatusBadge status={m.status} /></td>
                <td className="px-4 py-3 text-right">
                  <Link to={`/app/machines/${m.id}`} className="text-xs text-[#F97316] hover:underline mr-3">
                    Diagnostics
                  </Link>
                  <button onClick={() => remove(m.id)} className="text-muted-foreground hover:text-red-400 inline-flex">
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
            {machines.length === 0 && (
              <tr><td colSpan="6" className="px-4 py-6 text-center text-muted-foreground text-sm">No machines.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
