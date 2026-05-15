import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { SeverityBadge } from "@/components/Status";
import { toast } from "sonner";

export default function Alerts() {
  const [alerts, setAlerts] = useState([]);
  const [filter, setFilter] = useState("active");

  const load = async () => {
    const params = filter === "active" ? { acknowledged: false } :
                   filter === "ack"    ? { acknowledged: true }  : {};
    const { data } = await api.get("/alerts", { params });
    setAlerts(data);
  };

  useEffect(() => {
    load();
    const i = setInterval(load, 3000);
    return () => clearInterval(i);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const ack = async (id) => {
    await api.post(`/alerts/${id}/acknowledge`);
    toast.success("Acknowledged.");
    load();
  };

  return (
    <div className="p-4 sm:p-6 space-y-4" data-testid="alerts-page">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="eyebrow">Operations</div>
          <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight">Alerts</h1>
        </div>
        <div className="flex gap-2">
          {["active", "ack", "all"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              data-testid={`alert-filter-${f}`}
              className={`px-3 py-1.5 text-xs font-mono uppercase tracking-widest border ${
                filter === f ? "bg-[#F97316] text-black border-[#F97316]" : "border-border text-muted-foreground hover:text-white"
              }`}
            >
              {f === "ack" ? "Acknowledged" : f}
            </button>
          ))}
        </div>
      </div>

      <div className="panel">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border">
              <th className="px-4 py-3">Severity</th>
              <th className="px-4 py-3">Machine</th>
              <th className="px-4 py-3">Issue</th>
              <th className="px-4 py-3">Time</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {alerts.map((a) => (
              <tr key={a.id} className="border-b border-border hover:bg-secondary">
                <td className="px-4 py-3"><SeverityBadge severity={a.severity} /></td>
                <td className="px-4 py-3 font-medium">{a.machine_name}</td>
                <td className="px-4 py-3">
                  <div className="font-medium text-sm">{a.title}</div>
                  <div className="text-xs text-muted-foreground">{a.message}</div>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                  {new Date(a.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right">
                  {!a.acknowledged ? (
                    <button
                      onClick={() => ack(a.id)}
                      data-testid={`ack-${a.id}`}
                      className="text-xs bg-[#F97316] hover:bg-[#EA580C] text-black px-3 py-1.5"
                    >
                      Acknowledge
                    </button>
                  ) : (
                    <span className="text-xs text-emerald-400 font-mono">ACK ✓</span>
                  )}
                </td>
              </tr>
            ))}
            {alerts.length === 0 && (
              <tr><td colSpan="5" className="px-4 py-8 text-center text-muted-foreground text-sm">No alerts in this view.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
