import React, { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Cpu, Activity, BellRing, Wrench, BarChart3, LogOut, Building2, Factory,
  Zap, FlaskConical, Sun, Moon, ClipboardList, ListPlus, HardHat,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import api from "@/lib/api";

const ownerNav = [
  { to: "/app/dashboard",   icon: LayoutDashboard, label: "Overview" },
  { to: "/app/machines",    icon: Cpu,            label: "Machines" },
  { to: "/app/simulation",  icon: Activity,       label: "Digital Twin" },
  { to: "/app/energy",      icon: Zap,            label: "Energy" },
  { to: "/app/alerts",      icon: BellRing,       label: "Alerts" },
  { to: "/app/maintenance", icon: Wrench,         label: "Maintenance" },
  { to: "/app/reports",     icon: BarChart3,      label: "Reports" },
  { to: "/app/test-lab",    icon: FlaskConical,   label: "Test Lab" },
];

const technicianNav = [
  { to: "/app/my-dashboard", icon: LayoutDashboard, label: "My Dashboard" },
  { to: "/app/my-tasks",     icon: ClipboardList,   label: "My Tasks" },
  { to: "/app/new-request",  icon: ListPlus,        label: "New Request" },
  { to: "/app/maintenance",  icon: Wrench,          label: "All Work Orders" },
  { to: "/app/alerts",       icon: BellRing,        label: "Alerts" },
  { to: "/app/machines",     icon: Cpu,             label: "Machines" },
  { to: "/app/simulation",   icon: Activity,        label: "Digital Twin" },
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState([]);

  const isTech = user?.role === "technician";
  const navItems = isTech ? technicianNav : ownerNav;

  useEffect(() => {
    let mounted = true;
    const fetchAlerts = async () => {
      try {
        const { data } = await api.get("/alerts", { params: { acknowledged: false, limit: 15 } });
        if (mounted) setAlerts(data);
      } catch {}
    };
    fetchAlerts();
    const t = setInterval(fetchAlerts, 4000);
    return () => { mounted = false; clearInterval(t); };
  }, []);

  const sidebarStyle = { background: "var(--sidebar-bg)" };

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      {/* Sidebar */}
      <aside
        className="w-60 shrink-0 border-r border-border flex flex-col"
        style={sidebarStyle}
        data-testid="app-sidebar"
      >
        <div className="px-5 py-5 border-b border-border flex items-center gap-2.5">
          <div className="w-7 h-7 bg-[#F97316] flex items-center justify-center font-display font-black text-black">S</div>
          <div>
            <div className="font-display font-bold tracking-tight leading-none">SENTINEL</div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mt-0.5">
              {isTech ? "Technician Console" : "Predictive Ops"}
            </div>
          </div>
        </div>

        <nav className="flex-1 py-3 overflow-y-auto">
          {navItems.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              data-testid={`nav-${n.label.toLowerCase().replace(/\s+/g, "-")}`}
              className={({ isActive }) =>
                `flex items-center gap-3 px-5 py-2.5 text-sm border-l-2 transition-colors duration-150 ${
                  isActive
                    ? "border-[#F97316] bg-secondary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                }`
              }
            >
              <n.icon size={16} strokeWidth={1.75} />
              <span>{n.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-border p-4 text-xs">
          <div className="flex items-center gap-2 text-muted-foreground">
            {isTech ? <HardHat size={14} /> : <Building2 size={14} />}
            <span className="truncate">{user?.full_name || "Operator"}</span>
          </div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mt-1">
            {(user?.role || "user").replace("_", " ")}
          </div>
          <button
            onClick={() => { logout(); navigate("/login"); }}
            data-testid="logout-button"
            className="mt-3 flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header
          className="h-12 border-b border-border flex items-center px-4 gap-4"
          style={sidebarStyle}
        >
          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            <Factory size={14} />
            <span className="font-mono uppercase tracking-widest">Plant A — Mumbai</span>
          </div>
          <div className="flex-1 overflow-hidden hidden md:block min-w-0">
            <div className="ticker-wrap">
              <div className="ticker-content text-xs font-mono">
                {alerts.length === 0 ? (
                  <span className="text-muted-foreground">No active alerts — all systems nominal.</span>
                ) : (
                  [...alerts, ...alerts].map((a, i) => (
                    <span key={`${a.id}-${i}`} className="inline-flex items-center gap-2">
                      <span className={`status-dot ${a.severity === "critical" ? "critical" : "warning"}`} />
                      <span className={a.severity === "critical" ? "text-red-500" : "text-amber-500"}>
                        {a.machine_name}
                      </span>
                      <span className="text-muted-foreground">— {a.title}</span>
                    </span>
                  ))
                )}
              </div>
            </div>
          </div>

          <button
            onClick={toggle}
            data-testid="theme-toggle"
            aria-label="Toggle theme"
            className="flex items-center justify-center w-8 h-8 border border-border hover:border-[#F97316] text-muted-foreground hover:text-foreground transition-colors"
            title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          >
            {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
          </button>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <BellRing size={14} className={alerts.length > 0 ? "text-amber-500" : ""} />
            <span className="num">{alerts.length}</span>
          </div>
        </header>

        <main className="flex-1 overflow-auto bg-grid">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
