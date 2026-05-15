import React from "react";

export const StatusDot = ({ status, size = "default" }) => {
  const s = (status || "offline").toLowerCase();
  const cls = ["healthy", "warning", "critical", "offline"].includes(s) ? s : "offline";
  return <span className={`status-dot ${cls}`} data-testid={`status-dot-${cls}`} />;
};

export const StatusBadge = ({ status }) => {
  const s = (status || "offline").toLowerCase();
  const map = {
    healthy: "bg-emerald-950 text-emerald-400 border-emerald-500/40",
    warning: "bg-amber-950 text-amber-400 border-amber-500/40",
    critical: "bg-red-950 text-red-400 border-red-500/40",
    offline: "bg-slate-900 text-slate-400 border-slate-500/40",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-mono uppercase tracking-widest border ${map[s] || map.offline}`}
      data-testid={`status-badge-${s}`}
    >
      <StatusDot status={s} />
      {s}
    </span>
  );
};

export const SeverityBadge = ({ severity }) => {
  const s = (severity || "info").toLowerCase();
  const map = {
    critical: "bg-red-950 text-red-400 border-red-500/50",
    warning: "bg-amber-950 text-amber-400 border-amber-500/40",
    info: "bg-cyan-950 text-cyan-300 border-cyan-500/40",
  };
  return (
    <span className={`px-2 py-0.5 text-[10px] font-mono uppercase tracking-widest border ${map[s] || map.info}`}>
      {s}
    </span>
  );
};

export const KpiTile = ({ label, value, sublabel, accent = "default", testid }) => {
  const accentColor = {
    default: "text-foreground",
    brand: "text-[#F97316]",
    ai: "text-[#00E5FF]",
    healthy: "text-emerald-400",
    warning: "text-amber-400",
    critical: "text-red-400",
  }[accent];

  return (
    <div className="panel" data-testid={testid}>
      <div className="panel-body">
        <div className="eyebrow">{label}</div>
        <div className={`mt-2 num text-3xl font-bold ${accentColor}`}>{value}</div>
        {sublabel && <div className="mt-1 text-xs text-muted-foreground">{sublabel}</div>}
      </div>
    </div>
  );
};

export const SectionHeader = ({ title, action, eyebrow }) => (
  <div className="panel-header">
    <div>
      {eyebrow && <div className="eyebrow">{eyebrow}</div>}
      <h3 className="font-display text-sm font-semibold tracking-tight">{title}</h3>
    </div>
    {action}
  </div>
);
