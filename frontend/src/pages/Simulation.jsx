import React, { useEffect, useState, useRef } from "react";
import api from "@/lib/api";
import { StatusDot } from "@/components/Status";

const TWIN_IMG = {
  cnc_lathe: "https://static.prod-images.emergentagent.com/jobs/f2321c26-3739-45f8-bf28-5e67a17f2916/images/6bc067f85d8c17cbeae198d2ebc4b0c8f4fdc319a4dab020b5563139ff1662cf.png",
  pump: "https://static.prod-images.emergentagent.com/jobs/f2321c26-3739-45f8-bf28-5e67a17f2916/images/216c529acf95e754b51485833a3ab4360da87b97fad1dbfc798c58a6adbd9037.png",
  compressor: "https://static.prod-images.emergentagent.com/jobs/f2321c26-3739-45f8-bf28-5e67a17f2916/images/6bc067f85d8c17cbeae198d2ebc4b0c8f4fdc319a4dab020b5563139ff1662cf.png",
  conveyor: "https://static.prod-images.emergentagent.com/jobs/f2321c26-3739-45f8-bf28-5e67a17f2916/images/216c529acf95e754b51485833a3ab4360da87b97fad1dbfc798c58a6adbd9037.png",
  hvac_chiller: "https://static.prod-images.emergentagent.com/jobs/f2321c26-3739-45f8-bf28-5e67a17f2916/images/6bc067f85d8c17cbeae198d2ebc4b0c8f4fdc319a4dab020b5563139ff1662cf.png",
};

const STATUS_COLOR = {
  healthy: "#10B981",
  warning: "#F59E0B",
  critical: "#EF4444",
  offline: "#64748B",
};

const BACKEND = process.env.REACT_APP_BACKEND_URL;
const resolveTwinImage = (machine) => {
  const custom = machine?.twin_image_url;
  if (custom) {
    return /^https?:\/\//i.test(custom) ? custom : `${BACKEND}${custom}`;
  }
  return TWIN_IMG[machine?.machine_type] || TWIN_IMG.pump;
};

export default function Simulation() {
  const [machines, setMachines] = useState([]);
  const [readings, setReadings] = useState({}); // machine_id -> latest reading
  const [selected, setSelected] = useState(null);
  const selectedRef = useRef(null);

  // Keep ref in sync with state so the polling closure always reads the latest value
  useEffect(() => { selectedRef.current = selected; }, [selected]);

  useEffect(() => {
    let mounted = true;
    const tick = async () => {
      try {
        const { data } = await api.get("/machines");
        if (!mounted) return;
        setMachines(data);
        // Only auto-pick on first load when nothing is selected yet
        if (!selectedRef.current && data[0]) {
          selectedRef.current = data[0].id;
          setSelected(data[0].id);
        }
        const all = await Promise.all(
          data.map((m) =>
            api.get(`/machines/${m.id}/sensors/latest`).then((r) => [m.id, r.data]).catch(() => [m.id, null])
          )
        );
        if (!mounted) return;
        setReadings(Object.fromEntries(all));
      } catch {}
    };
    tick();
    const i = setInterval(tick, 2000);
    return () => { mounted = false; clearInterval(i); };
  }, []);

  const selectedMachine = machines.find((m) => m.id === selected);
  const selectedReading = readings[selected];

  return (
    <div className="p-4 sm:p-6 space-y-5" data-testid="simulation-page">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="eyebrow">Digital Twin</div>
          <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight">Live Plant Simulation</h1>
          <p className="text-sm text-muted-foreground mt-1">Schematic view with live telemetry overlays — 2s tick.</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-4 gap-4">
        {/* Side list */}
        <div className="panel">
          <div className="panel-header"><div className="eyebrow">Assets</div></div>
          <div className="divide-y divide-border">
            {machines.map((m) => (
              <button
                key={m.id}
                onClick={() => { selectedRef.current = m.id; setSelected(m.id); }}
                data-testid={`sim-asset-${m.id}`}
                className={`w-full text-left px-4 py-3 hover:bg-secondary transition-colors ${
                  selected === m.id ? "bg-secondary border-l-2 border-[#F97316]" : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">{m.name}</div>
                    <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                      {m.machine_type.replace(/_/g, " ")}
                    </div>
                  </div>
                  <StatusDot status={m.status} />
                </div>
                <div className="num text-xs mt-1.5" style={{ color: STATUS_COLOR[m.status] }}>
                  {m.health_score.toFixed(1)}% · {m.rul_days}d RUL
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Main schematic */}
        <div className="lg:col-span-3 panel relative overflow-hidden">
          <div className="panel-header">
            <div className="eyebrow">
              {selectedMachine ? `${selectedMachine.name} — Schematic Overlay` : "—"}
            </div>
            {selectedMachine && (
              <div className="num text-xs" style={{ color: STATUS_COLOR[selectedMachine.status] }}>
                ● {selectedMachine.status.toUpperCase()}
              </div>
            )}
          </div>

          <div className="relative" style={{ minHeight: 460 }}>
            {selectedMachine && (
              <img
                src={resolveTwinImage(selectedMachine)}
                alt={selectedMachine.name}
                className="w-full h-[460px] object-cover opacity-60"
                onError={(e) => { e.currentTarget.src = TWIN_IMG[selectedMachine.machine_type] || TWIN_IMG.pump; }}
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#090E14]" />

            {/* Floating data nodes */}
            {selectedReading && (
              <>
                <DataNode top="14%" left="18%" label="TEMP" value={selectedReading.temperature} unit="°C" color="#EF4444" />
                <DataNode top="26%" left="62%" label="VIB" value={selectedReading.vibration} unit="mm/s" color="#F59E0B" />
                <DataNode top="48%" left="12%" label="CUR" value={selectedReading.current} unit="A" color="#00E5FF" />
                <DataNode top="58%" left="74%" label="RPM" value={selectedReading.rpm} unit="" color="#10B981" />
                <DataNode top="74%" left="34%" label="PRES" value={selectedReading.pressure} unit="bar" color="#F97316" />
                <DataNode top="80%" left="68%" label="PWR" value={selectedReading.power_consumption} unit="kW" color="#EAB308" />
              </>
            )}

            {/* Bottom strip */}
            {selectedMachine && (
              <div className="absolute bottom-0 left-0 right-0 grid grid-cols-5 gap-px bg-border">
                {["temperature", "vibration", "current", "pressure", "power_consumption"].map((k) => (
                  <div key={k} className="bg-card/90 backdrop-blur p-2 text-center">
                    <div className="eyebrow text-[9px]">{k.replace("_consumption", "").toUpperCase()}</div>
                    <div className="num text-sm font-semibold">
                      {selectedReading?.[k]?.toFixed?.(1) ?? "—"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const DataNode = ({ top, left, label, value, unit, color }) => (
  <div
    className="absolute -translate-x-1/2 -translate-y-1/2"
    style={{ top, left }}
  >
    <div className="relative">
      <div className="absolute -inset-3 rounded-full opacity-30" style={{ background: color, filter: "blur(8px)" }} />
      <div className="relative px-2.5 py-1 border bg-card/95" style={{ borderColor: color }}>
        <div className="text-[9px] font-mono uppercase tracking-widest" style={{ color }}>{label}</div>
        <div className="num text-sm font-semibold">{value?.toFixed?.(1) ?? "—"}{unit && <span className="text-xs text-muted-foreground ml-1">{unit}</span>}</div>
      </div>
    </div>
  </div>
);
