import React from "react";
import { Link } from "react-router-dom";
import { Activity, Cpu, Gauge, ShieldCheck, ArrowRight } from "lucide-react";

const Stat = ({ value, label }) => (
  <div>
    <div className="num text-3xl md:text-4xl font-display font-bold text-[#F97316]">{value}</div>
    <div className="eyebrow mt-1">{label}</div>
  </div>
);

export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="border-b border-border">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-[#F97316] flex items-center justify-center font-display font-black text-black">S</div>
            <div className="font-display font-bold tracking-tight">SENTINEL</div>
            <div className="hidden md:block ml-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">/ Predictive Ops Platform</div>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login" data-testid="nav-login" className="text-sm text-muted-foreground hover:text-white">Sign in</Link>
            <Link
              to="/register"
              data-testid="nav-register"
              className="text-sm font-medium bg-[#F97316] hover:bg-[#EA580C] text-black px-3.5 py-1.5 transition-colors"
            >
              Create account
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-grid relative">
        <div className="max-w-7xl mx-auto px-6 py-20 md:py-28 grid lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 border border-border bg-[#121822] text-[10px] uppercase tracking-[0.2em] font-mono text-muted-foreground">
              <span className="status-dot healthy" /> AI-Powered Industrial Control Room
            </div>
            <h1 className="mt-5 font-display text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.05]">
              Predict failures before <br />
              <span className="text-[#F97316]">they cost you a shift.</span>
            </h1>
            <p className="mt-6 text-base md:text-lg text-muted-foreground max-w-xl leading-relaxed">
              Continuously ingest vibration, current, temperature and 7 more sensor streams.
              Detect anomalies in real time, get AI-generated root cause and corrective steps —
              all from a single industrial-grade control room.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/register"
                data-testid="hero-cta-register"
                className="inline-flex items-center gap-2 bg-[#F97316] hover:bg-[#EA580C] text-black font-medium px-5 py-2.5 transition-colors"
              >
                Start monitoring <ArrowRight size={16} />
              </Link>
              <Link
                to="/login"
                data-testid="hero-cta-demo"
                className="inline-flex items-center gap-2 border border-border hover:border-[#F97316] text-foreground px-5 py-2.5 transition-colors"
              >
                Use demo account
              </Link>
            </div>

            <div className="mt-10 grid grid-cols-3 gap-6 max-w-md">
              <Stat value="2s" label="Live tick" />
              <Stat value="10+" label="Sensor types" />
              <Stat value="<60s" label="Anomaly to alert" />
            </div>
          </div>

          {/* Schematic preview */}
          <div className="lg:col-span-5">
            <div className="panel glow-orange">
              <div className="panel-header">
                <div className="eyebrow">Live Telemetry — CNC Lathe #1</div>
                <span className="status-dot healthy" />
              </div>
              <div className="panel-body space-y-4">
                {[
                  { l: "Temperature", v: "58.4 °C", c: "text-emerald-400" },
                  { l: "Vibration",   v: "2.1 mm/s", c: "text-emerald-400" },
                  { l: "Current",     v: "21.7 A",   c: "text-amber-400" },
                  { l: "RPM",         v: "2,460",    c: "text-emerald-400" },
                  { l: "Health",      v: "87.3 %",   c: "text-[#00E5FF]" },
                ].map((r) => (
                  <div key={r.l} className="flex items-baseline justify-between text-sm">
                    <div className="text-muted-foreground">{r.l}</div>
                    <div className={`num font-semibold ${r.c}`}>{r.v}</div>
                  </div>
                ))}
                <div className="pt-2 mt-2 border-t border-border text-xs text-muted-foreground font-mono">
                  ANOMALY: current draw +12% over baseline → check lubrication.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Capabilities */}
      <section className="border-t border-border">
        <div className="max-w-7xl mx-auto px-6 py-16 grid md:grid-cols-3 gap-px bg-border">
          {[
            {
              icon: Activity,
              title: "Real-time anomaly detection",
              desc: "Multi-sensor correlation pinpoints degradation patterns before failure.",
            },
            {
              icon: Cpu,
              title: "AI diagnostic engine",
              desc: "Claude-powered root cause analysis with corrective action playbooks.",
            },
            {
              icon: Gauge,
              title: "Digital twin simulation",
              desc: "Visualize each asset with live telemetry overlays on schematic views.",
            },
            {
              icon: ShieldCheck,
              title: "Energy optimization",
              desc: "Track kWh per machine, surface efficiency drift and shut down waste.",
            },
            {
              icon: Cpu,
              title: "Health scoring & RUL",
              desc: "Quantitative health 0–100 and remaining useful life estimates.",
            },
            {
              icon: Activity,
              title: "Multi-factory rollouts",
              desc: "Org → factory → building → floor → zone hierarchy, role-based access.",
            },
          ].map((f) => (
            <div key={f.title} className="bg-card p-6">
              <f.icon className="text-[#F97316]" size={20} />
              <h3 className="mt-3 font-display font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between text-xs text-muted-foreground">
          <div>© 2026 Sentinel Predictive Ops</div>
          <div className="font-mono uppercase tracking-widest">v1.0.0 — control room build</div>
        </div>
      </footer>
    </div>
  );
}
