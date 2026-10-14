import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, Copy, Download, Play, Save, Trash2, Upload } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { SERVICES, cop, useStore } from "@/lib/store";
import { buildBaseline } from "@/lib/simulation/historical";
import {
  CLIMATE_PRESETS, DEFAULT_DELTAS, SENS_LABEL, applyDelta, cumulative, scenarioDrivers, sensitivity, sensitivityCurve, simulate,
} from "@/lib/simulation/simulationService";
import { download, flatten, toCSV } from "@/lib/simulation/exportService";
import type { ClimatePreset, Freq, ScenarioDelta, SensitivityVariable, SimulationParameters, SimulationResults, SimulationScenario } from "@/lib/simulation/types";

export const Route = createFileRoute("/simulator")({
  head: () => ({
    meta: [
      { title: "Simulador de escenarios – MotoClean" },
      { name: "description", content: "Simula demanda, ingresos, costos, utilidad y ROI del negocio MotoClean." },
      { property: "og:title", content: "Simulador de escenarios – MotoClean" },
      { property: "og:description", content: "Compara escenarios pesimista, base y optimista del negocio de lavado a domicilio." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <AppShell title="Simulador de escenarios"><Simulator /></AppShell>,
});

const SIMS_KEY = "motoclean-sims-v1";
const todayISO = () => new Date().toISOString().slice(0, 10);
const uid = () => Math.random().toString(36).slice(2, 10);
const pctTxt = (v: number | null, na = "No aplica") => (v === null ? na : `${v.toFixed(1)} %`);
const C = { primary: "var(--color-primary)", accent: "var(--color-accent)", danger: "var(--color-destructive)", success: "var(--color-success)", muted: "var(--color-muted-foreground)", border: "var(--color-border)" };

function defaults(): SimulationParameters {
  return {
    horizon: "30", startDate: todayISO(), endDate: todayISO(), demandSource: "manual",
    washesPerDay: 12, operatingDaysPerWeek: 6, washers: 2, capacityPerWasher: 6, cancellationPct: 8, growthPct: 0,
    avgPrice: 40000, discountPct: 0, useMix: false,
    mix: SERVICES.map((s, i) => ({ serviceId: s.id, name: s.name, price: s.price, pct: [50, 35, 15][i] ?? 0 })),
    variableCosts: { supplies: 5000, transport: 4000, utilities: 1500, labor: 8000, other: 500 },
    fixedCosts: [
      { key: "salaries", label: "Sueldos fijos", amount: 1500000, freq: "month" },
      { key: "rent", label: "Arriendo o almacenamiento", amount: 300000, freq: "month" },
      { key: "ads", label: "Publicidad", amount: 50000, freq: "week" },
      { key: "software", label: "Telefonía y software", amount: 120000, freq: "month" },
      { key: "maintenance", label: "Mantenimiento de equipos", amount: 80000, freq: "month" },
      { key: "other", label: "Otros costos fijos", amount: 0, freq: "month" },
    ],
    investment: { initial: 0, equipment: 2500000, tools: 600000, workingCapital: 1000000, other: 0 },
    climate: { preset: "normal", ...CLIMATE_PRESETS.normal, adjSunnyPct: 0, adjCloudyPct: 0, adjRainyPct: 0 },
  };
}

// ---------- pequeños componentes ----------
function Num({ label, value, onChange, min = 0, max, step = 1, suffix }: { label: string; value: number; onChange: (n: number) => void; min?: number; max?: number; step?: number; suffix?: string }) {
  return (
    <label className="block">
      <span className="label">{label}{suffix && <span className="text-muted-foreground"> ({suffix})</span>}</span>
      <input type="number" className="input" value={Number.isFinite(value) ? value : 0} min={min} max={max} step={step}
        onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))} />
    </label>
  );
}
function Section({ title, children, open = false, tag }: { title: string; children: ReactNode; open?: boolean; tag?: ReactNode }) {
  return (
    <details open={open} className="card group">
      <summary className="flex cursor-pointer list-none items-center justify-between font-semibold">{title}{tag}</summary>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">{children}</div>
    </details>
  );
}
const Tag = ({ kind }: { kind: "manual" | "hist" | "sim" }) => (
  <span className={`chip ${kind === "hist" ? "bg-accent/20 text-accent" : kind === "sim" ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground"}`}>
    {kind === "hist" ? "Dato histórico" : kind === "sim" ? "Resultado simulado" : "Parámetro manual"}
  </span>
);
function Kpi({ label, value, hint, tone }: { label: string; value: string; hint?: string | undefined; tone?: "good" | "bad" | undefined }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-xl font-bold ${tone === "good" ? "text-success" : tone === "bad" ? "text-destructive" : ""}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
function Warn({ items, tone = "warn" }: { items: string[]; tone?: "warn" | "err" }) {
  if (!items.length) return null;
  return (
    <div className={`rounded-xl border p-3 text-sm ${tone === "err" ? "border-destructive/50 bg-destructive/10 text-destructive" : "border-warning/50 bg-warning/10 text-warning"}`}>
      {items.map((w) => <p key={w} className="flex gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{w}</p>)}
    </div>
  );
}
const money = (n: number) => cop(Math.round(n));
const tooltipStyle = { background: "var(--color-popover)", border: `1px solid ${C.border}`, borderRadius: 12 };

// ---------- página ----------
function Simulator() {
  const { db } = useStore();
  const baseline = useMemo(() => buildBaseline(db.bookings, SERVICES), [db.bookings]);
  const [p, setP] = useState<SimulationParameters>(defaults);
  const [deltas, setDeltas] = useState(DEFAULT_DELTAS);
  const [auto, setAuto] = useState(true);
  const [ran, setRan] = useState<{ p: SimulationParameters; d: typeof DEFAULT_DELTAS }>(() => ({ p: defaults(), d: DEFAULT_DELTAS }));
  const [sims, setSims] = useState<SimulationScenario[]>([]);
  const [name, setName] = useState("");
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [whatIf, setWhatIf] = useState<{ v: SensitivityVariable; pct: number }>({ v: "demand", pct: 20 });

  useEffect(() => { try { setSims(JSON.parse(localStorage.getItem(SIMS_KEY) ?? "[]")); } catch { setSims([]); } }, []);
  const persist = (list: SimulationScenario[]) => { setSims(list); localStorage.setItem(SIMS_KEY, JSON.stringify(list)); };
  useEffect(() => { if (auto) setRan({ p, d: deltas }); }, [auto, p, deltas]);

  const ap = ran.p, ad = ran.d;
  const res = useMemo(() => simulate(ap, baseline), [ap, baseline]);
  const scen = useMemo(() => ({
    Pesimista: simulate(applyDelta(ap, ad.pessimistic), baseline), Base: res, Optimista: simulate(applyDelta(ap, ad.optimistic), baseline),
  }), [ap, ad, res, baseline]);
  const drivers = useMemo(() => scenarioDrivers(ap, ad, baseline), [ap, ad, baseline]);
  const sens = useMemo(() => sensitivity(ap, whatIf.v, whatIf.pct, baseline), [ap, whatIf, baseline]);
  const curve = useMemo(() => sensitivityCurve(ap, baseline), [ap, baseline]);
  const cum = useMemo(() => cumulative(ap, baseline), [ap, baseline]);
  const climateCmp = useMemo(() => (["normal", "sunny", "rainy"] as const).map((k) => ({
    clima: k === "normal" ? "Normal" : k === "sunny" ? "Soleado" : "Lluvioso",
    lavados: simulate({ ...ap, climate: { ...ap.climate, ...CLIMATE_PRESETS[k] } }, baseline).served,
  })), [ap, baseline]);

  const set = <K extends keyof SimulationParameters>(k: K, v: SimulationParameters[K]) => setP((x) => ({ ...x, [k]: v }));
  const setClimatePreset = (preset: ClimatePreset) => setP((x) => ({ ...x, climate: { ...x.climate, preset, ...(preset !== "manual" ? CLIMATE_PRESETS[preset] : {}) } }));
  const useHistoricalPrices = () => setP((x) => ({
    ...x, avgPrice: Math.round(baseline.avgPrice) || x.avgPrice,
    mix: x.mix.map((m) => { const h = baseline.priceByService.find((s) => s.serviceId === m.serviceId); return h ? { ...m, price: Math.round(h.avg) } : m; }),
  }));

  const scenarioRows = Object.entries(scen).map(([escenario, r]) => ({
    escenario, lavados_atendidos: r.served, demanda_no_atendida: r.unmet, ingresos: Math.round(r.revenue), costos_variables: Math.round(r.variableCosts),
    costos_fijos: Math.round(r.fixedCosts), utilidad_operativa: Math.round(r.operatingProfit), margen_pct: r.marginPct === null ? null : +r.marginPct.toFixed(2),
    punto_equilibrio_lavados: r.breakEvenWashes, roi_pct: r.roiPct === null ? null : +r.roiPct.toFixed(2), recuperacion_meses: r.paybackMonths === null ? null : +r.paybackMonths.toFixed(2),
  }));

  const save = () => {
    const s: SimulationScenario = { id: uid(), name: name.trim() || `Simulación ${sims.length + 1}`, createdAt: new Date().toISOString(), horizonDays: res.calendarDays, params: ap, deltas: ad, results: res, historicalVersion: baseline.version };
    persist([s, ...sims]); setName("");
  };
  const load = (s: SimulationScenario) => { setP(s.params); setDeltas(s.deltas); setRan({ p: s.params, d: s.deltas }); window.scrollTo({ top: 0, behavior: "smooth" }); };

  const exportAll = (fmt: "csv" | "json") => {
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
    if (fmt === "json") {
      download(`motoclean_simulacion_${stamp}.json`, JSON.stringify({ tipo: "simulacion_matematica", generado: new Date().toISOString(), version_historico: baseline.version, parametros: ap, deltas_escenarios: ad, resultados: { ...res, daily: undefined }, demanda_diaria: res.daily, escenarios: scenarioRows, sensibilidad: sens }, null, 2), "application/json");
    } else {
      download(`motoclean_parametros_${stamp}.csv`, toCSV([flatten(ap)]), "text/csv");
      const { daily: _d, errors: _e, warnings: _w, ...flat } = res;
      download(`motoclean_resultados_${stamp}.csv`, toCSV([flat as Record<string, number | boolean | null>]), "text/csv");
      download(`motoclean_escenarios_${stamp}.csv`, toCSV(scenarioRows), "text/csv");
      download(`motoclean_sensibilidad_${stamp}.csv`, toCSV(sens.map((s) => ({ ...s }))), "text/csv");
    }
  };

  const compared = sims.filter((s) => compareIds.includes(s.id));
  const mixSum = p.mix.reduce((a, m) => a + m.pct, 0);
  const climSum = p.climate.sunnyPct + p.climate.cloudyPct + p.climate.rainyPct;

  return (
    <div className="space-y-6">
      <p className="-mt-3 text-sm text-muted-foreground">
        Simulación matemática con fórmulas explícitas. No es una predicción de inteligencia artificial: los resultados dependen de los supuestos que ingreses.
      </p>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        {/* ---------- CONTROLES ---------- */}
        <div className="space-y-3">
          <Section title="Periodo" open tag={<Tag kind="manual" />}>
            <label className="block sm:col-span-2"><span className="label">Horizonte</span>
              <select className="input" value={p.horizon} onChange={(e) => set("horizon", e.target.value as SimulationParameters["horizon"])}>
                <option value="7">Próximos 7 días</option><option value="30">Próximos 30 días</option><option value="90">Próximos 90 días</option><option value="custom">Periodo personalizado</option>
              </select></label>
            <label className="block"><span className="label">Fecha inicial</span><input type="date" className="input" value={p.startDate} onChange={(e) => set("startDate", e.target.value)} /></label>
            {p.horizon === "custom" && <label className="block"><span className="label">Fecha final</span><input type="date" className="input" value={p.endDate} onChange={(e) => set("endDate", e.target.value)} /></label>}
          </Section>

          <Section title="Demanda" open>
            <label className="block sm:col-span-2"><span className="label">Fuente de la demanda</span>
              <select className="input" value={p.demandSource} onChange={(e) => set("demandSource", e.target.value as SimulationParameters["demandSource"])}>
                <option value="manual">Parámetros manuales</option>
                <option value="historical">Promedio histórico ({baseline.avgPerDay.toFixed(2)}/día)</option>
                <option value="trend" disabled={!baseline.trend}>Tendencia lineal simple{baseline.trend ? "" : " (datos insuficientes)"}</option>
              </select></label>
            {p.demandSource === "manual" && <Num label="Lavados esperados por día" value={p.washesPerDay} onChange={(v) => set("washesPerDay", Math.round(v))} />}
            <Num label="Días de operación por semana" value={p.operatingDaysPerWeek} max={7} onChange={(v) => set("operatingDaysPerWeek", Math.round(v))} />
            <Num label="Lavadores disponibles" value={p.washers} onChange={(v) => set("washers", Math.round(v))} />
            <Num label="Capacidad por lavador al día" value={p.capacityPerWasher} onChange={(v) => set("capacityPerWasher", Math.round(v))} />
            <Num label="Cancelaciones" suffix="%" value={p.cancellationPct} max={100} step={0.5} onChange={(v) => set("cancellationPct", v)} />
            <Num label="Crecimiento de la demanda" suffix="%" value={p.growthPct} min={-100} step={0.5} onChange={(v) => set("growthPct", v)} />
          </Section>

          <Section title="Precio y ventas">
            <Num label="Precio promedio por lavado" suffix="COP" value={p.avgPrice} step={1000} onChange={(v) => set("avgPrice", v)} />
            <Num label="Descuento promedio" suffix="%" value={p.discountPct} max={100} onChange={(v) => set("discountPct", v)} />
            <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={p.useMix} onChange={(e) => set("useMix", e.target.checked)} />Usar mezcla de servicios (en vez del precio promedio)</label>
            {p.useMix && p.mix.map((m, i) => (
              <div key={m.serviceId} className="grid grid-cols-2 gap-2 sm:col-span-2">
                <Num label={`${m.name} – precio`} value={m.price} step={1000} onChange={(v) => set("mix", p.mix.map((x, j) => (j === i ? { ...x, price: v } : x)))} />
                <Num label="Participación" suffix="%" value={m.pct} max={100} onChange={(v) => set("mix", p.mix.map((x, j) => (j === i ? { ...x, pct: v } : x)))} />
              </div>
            ))}
            {p.useMix && <p className={`text-xs sm:col-span-2 ${mixSum === 100 ? "text-muted-foreground" : "text-destructive"}`}>La mezcla suma {mixSum} % (debe sumar 100 %).</p>}
            <button type="button" className="btn-ghost text-sm sm:col-span-2" onClick={useHistoricalPrices} disabled={!baseline.records}>Usar precios del historial como referencia</button>
          </Section>

          <Section title="Costos variables por lavado">
            {([["supplies", "Insumos"], ["transport", "Transporte"], ["utilities", "Agua y energía"], ["labor", "Mano de obra variable"], ["other", "Otros variables"]] as const).map(([k, l]) => (
              <Num key={k} label={l} suffix="COP" step={500} value={p.variableCosts[k]} onChange={(v) => set("variableCosts", { ...p.variableCosts, [k]: v })} />
            ))}
            <p className="text-sm text-muted-foreground sm:col-span-2">Total por lavado: <b className="text-foreground">{money(Object.values(p.variableCosts).reduce((a, b) => a + b, 0))}</b></p>
          </Section>

          <Section title="Costos fijos">
            {p.fixedCosts.map((f, i) => (
              <div key={f.key} className="grid grid-cols-[1fr_auto] items-end gap-2 sm:col-span-2">
                <Num label={f.label} suffix="COP" step={10000} value={f.amount} onChange={(v) => set("fixedCosts", p.fixedCosts.map((x, j) => (j === i ? { ...x, amount: v } : x)))} />
                <select aria-label={`Frecuencia de ${f.label}`} className="input w-28" value={f.freq} onChange={(e) => set("fixedCosts", p.fixedCosts.map((x, j) => (j === i ? { ...x, freq: e.target.value as Freq } : x)))}>
                  <option value="day">Diario</option><option value="week">Semanal</option><option value="month">Mensual</option>
                </select>
              </div>
            ))}
            <p className="text-xs text-muted-foreground sm:col-span-2">Se convierten al periodo: semanal × días/7, mensual × días/30.</p>
          </Section>

          <Section title="Inversión (no es costo operativo)">
            {([["initial", "Inversión inicial (otros conceptos)"], ["equipment", "Equipos"], ["tools", "Herramientas"], ["workingCapital", "Capital de trabajo"], ["other", "Otros desembolsos"]] as const).map(([k, l]) => (
              <Num key={k} label={l} suffix="COP" step={50000} value={p.investment[k]} onChange={(v) => set("investment", { ...p.investment, [k]: v })} />
            ))}
            <p className="text-sm text-muted-foreground sm:col-span-2">Inversión total: <b className="text-foreground">{money(Object.values(p.investment).reduce((a, b) => a + b, 0))}</b> (cada concepto se suma una sola vez).</p>
          </Section>

          <Section title="Clima">
            <label className="block sm:col-span-2"><span className="label">Escenario climático</span>
              <select className="input" value={p.climate.preset} onChange={(e) => setClimatePreset(e.target.value as ClimatePreset)}>
                <option value="normal">Normal</option><option value="sunny">Predominio de días soleados</option><option value="cloudy">Predominio de días nublados</option><option value="rainy">Predominio de lluvias</option><option value="manual">Configuración manual</option>
              </select></label>
            {(["sunny", "cloudy", "rainy"] as const).map((k) => (
              <Num key={k} label={`Días ${k === "sunny" ? "soleados" : k === "cloudy" ? "nublados" : "lluviosos"}`} suffix="%" max={100}
                value={p.climate[`${k}Pct`]} onChange={(v) => setP((x) => ({ ...x, climate: { ...x.climate, preset: "manual", [`${k}Pct`]: v } }))} />
            ))}
            <p className={`self-end text-xs ${climSum === 100 ? "text-muted-foreground" : "text-destructive"}`}>Suma: {climSum} %</p>
            <p className="text-xs text-warning sm:col-span-2">Supuesto de simulación: variación de la demanda por condición. No es un efecto climático demostrado.</p>
            {(["Sunny", "Cloudy", "Rainy"] as const).map((k) => (
              <Num key={k} label={`Variación con ${k === "Sunny" ? "sol" : k === "Cloudy" ? "nubes" : "lluvia"}`} suffix="%" min={-100}
                value={p.climate[`adj${k}Pct`]} onChange={(v) => setP((x) => ({ ...x, climate: { ...x.climate, [`adj${k}Pct`]: v } }))} />
            ))}
          </Section>

          <Section title="Diferencias entre escenarios" tag={<Tag kind="manual" />}>
            {(["pessimistic", "optimistic"] as const).map((sc) => (
              <div key={sc} className="space-y-2">
                <p className="text-sm font-semibold">{sc === "pessimistic" ? "Pesimista" : "Optimista"}</p>
                {([["demandPct", "Demanda %"], ["pricePct", "Precio %"], ["costPct", "Costos %"], ["cancellationPts", "Cancelación (pts)"], ["climatePts", "Clima (pts)"]] as [keyof ScenarioDelta, string][]).map(([k, l]) => (
                  <Num key={k} label={l} min={-100} value={deltas[sc][k]} onChange={(v) => setDeltas((d) => ({ ...d, [sc]: { ...d[sc], [k]: v } }))} />
                ))}
              </div>
            ))}
          </Section>

          <div className="card sticky bottom-20 z-10 flex flex-wrap items-center gap-3 md:bottom-4">
            <button className="btn-primary flex-1" onClick={() => setRan({ p, d: deltas })}><Play className="h-4 w-4" />Ejecutar simulación</button>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />Actualizar en vivo</label>
          </div>
        </div>

        {/* ---------- RESULTADOS ---------- */}
        <div className="min-w-0 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-bold">Resultados estimados</h2><Tag kind="sim" />
          </div>
          <Warn items={res.errors} tone="err" />
          <Warn items={res.warnings} />
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Kpi label="Lavados proyectados" value={`${res.served}`} hint={`${res.operatingDays} días operativos de ${res.calendarDays}`} />
            <Kpi label="Ingresos proyectados" value={money(res.revenue)} hint={`Precio efectivo ${money(res.effectivePrice)}`} />
            <Kpi label="Costos operativos" value={money(res.operatingCosts)} hint={`Var. ${money(res.variableCosts)} · Fijos ${money(res.fixedCosts)}`} />
            <Kpi label="Utilidad operativa" value={money(res.operatingProfit)} tone={res.operatingProfit >= 0 ? "good" : "bad"} hint="No equivale a flujo de caja" />
            <Kpi label="Margen operativo" value={pctTxt(res.marginPct)} />
            <Kpi label="ROI estimado del periodo" value={pctTxt(res.roiPct, "No disponible")} hint={res.roiPct === null ? "Sin inversión registrada" : "Simplificado, no contable"} />
            <Kpi label="Punto de equilibrio" value={res.breakEvenWashes === null ? "No se alcanza" : `${res.breakEvenWashes} lavados`} hint={res.breakEvenWashes === null ? "Margen por lavado ≤ 0" : `Margen por lavado ${money(res.contributionPerWash)}`} />
            <Kpi label="Demanda no atendida" value={`${res.unmet}`} tone={res.unmet > 0 ? "bad" : undefined} hint={`Capacidad ${res.capacity}`} />
          </div>
          <div className="card text-sm">
            <p><b>Recuperación de la inversión:</b> {res.paybackMonths === null ? (res.investment > 0 ? "No se recupera con utilidad mensual negativa o nula." : "No disponible (sin inversión).") : `≈ ${res.paybackMonths.toFixed(1)} meses`}</p>
            <p className="mt-1 text-xs text-muted-foreground">Aproximación simplificada: no considera impuestos, financiación, depreciación ni cambios futuros en la demanda. El ROI no es una rentabilidad garantizada.</p>
          </div>

          <ChartCard title="Demanda proyectada por día">
            <LineChart data={res.daily}>
              <CartesianGrid stroke={C.border} strokeDasharray="3 3" /><XAxis dataKey="date" stroke={C.muted} fontSize={11} tickFormatter={(d: string) => d.slice(5)} /><YAxis stroke={C.muted} fontSize={11} />
              <Tooltip contentStyle={tooltipStyle} /><Legend />
              <Line type="monotone" dataKey="demand" name="Demanda efectiva" stroke={C.primary} dot={false} strokeWidth={2} />
              <Line type="stepAfter" dataKey="capacity" name="Capacidad" stroke={C.accent} dot={false} strokeDasharray="4 4" />
            </LineChart>
          </ChartCard>

          <ChartCard title="Utilidad acumulada por horizonte (misma configuración)">
            <BarChart data={cum}>
              <CartesianGrid stroke={C.border} strokeDasharray="3 3" /><XAxis dataKey="horizonte" stroke={C.muted} fontSize={11} /><YAxis stroke={C.muted} fontSize={11} tickFormatter={(v: number) => `${Math.round(v / 1e6)}M`} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => money(v)} /><Legend />
              <Bar dataKey="utilidad" name="Utilidad operativa" fill={C.primary} /><Bar dataKey="neto" name="Utilidad − inversión (una vez)" fill={C.accent} />
            </BarChart>
          </ChartCard>

          {/* Escenarios */}
          <div className="card space-y-4">
            <h2 className="text-lg font-bold">Comparación de escenarios</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="text-left text-muted-foreground"><tr><th className="py-2">Indicador</th>{Object.keys(scen).map((k) => <th key={k}>{k}</th>)}</tr></thead>
                <tbody>
                  {([
                    ["Lavados atendidos", (r: SimulationResults) => `${r.served}`], ["Demanda no atendida", (r) => `${r.unmet}`], ["Ingresos", (r) => money(r.revenue)],
                    ["Costos variables", (r) => money(r.variableCosts)], ["Costos fijos", (r) => money(r.fixedCosts)], ["Utilidad operativa", (r) => money(r.operatingProfit)],
                    ["Margen operativo", (r) => pctTxt(r.marginPct)], ["Punto de equilibrio", (r) => (r.breakEvenWashes === null ? "No se alcanza" : `${r.breakEvenWashes}`)],
                    ["ROI estimado", (r) => pctTxt(r.roiPct, "No disponible")], ["Recuperación (meses)", (r) => (r.paybackMonths === null ? "—" : r.paybackMonths.toFixed(1))],
                  ] as [string, (r: SimulationResults) => string][]).map(([l, f]) => (
                    <tr key={l} className="border-t border-border"><td className="py-2 text-muted-foreground">{l}</td>{Object.values(scen).map((r, i) => <td key={i}>{f(r)}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={Object.entries(scen).map(([k, r]) => ({ escenario: k, ingresos: r.revenue, costos: r.operatingCosts, utilidad: r.operatingProfit }))}>
                  <CartesianGrid stroke={C.border} strokeDasharray="3 3" /><XAxis dataKey="escenario" stroke={C.muted} fontSize={11} /><YAxis stroke={C.muted} fontSize={11} tickFormatter={(v: number) => `${(v / 1e6).toFixed(1)}M`} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => money(v)} /><Legend />
                  <Bar dataKey="ingresos" name="Ingresos" fill={C.primary} /><Bar dataKey="costos" name="Costos operativos" fill={C.danger} /><Bar dataKey="utilidad" name="Utilidad" fill={C.success} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold">Variables que más cambian la utilidad (pesimista → optimista, aisladas)</p>
              {drivers.map((d) => (
                <div key={d.key} className="flex justify-between border-t border-border py-1.5 text-sm"><span>{d.label}</span><span className="font-mono">{money(d.spread)}</span></div>
              ))}
            </div>
          </div>

          {/* Sensibilidad */}
          <div className="card space-y-4">
            <h2 className="text-lg font-bold">¿Qué pasa si…?</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block"><span className="label">Variable</span>
                <select className="input" value={whatIf.v} onChange={(e) => setWhatIf({ ...whatIf, v: e.target.value as SensitivityVariable })}>
                  {Object.entries(SENS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select></label>
              <Num label="Cambio" suffix={whatIf.v === "cancellation" || whatIf.v === "climate" ? "puntos" : "%"} min={-100} value={whatIf.pct} onChange={(v) => setWhatIf({ ...whatIf, pct: v })} />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead className="text-left text-muted-foreground"><tr><th className="py-2">Indicador</th><th>Base</th><th>Modificado</th><th>Diferencia</th><th>Dif. %</th></tr></thead>
                <tbody>
                  {sens.map((s) => {
                    const isMoney = ["ingresos", "costos_operativos", "utilidad_operativa"].includes(s.metric);
                    const fmt = (v: number | null) => (v === null ? "No aplica" : isMoney ? money(v) : s.metric.endsWith("pct") ? `${v.toFixed(1)} %` : `${Math.round(v)}`);
                    return (
                      <tr key={s.metric} className="border-t border-border">
                        <td className="py-2 text-muted-foreground">{s.metric.replace(/_/g, " ")}</td><td>{fmt(s.base)}</td><td>{fmt(s.modified)}</td>
                        <td className={s.absDiff !== null && s.absDiff < 0 ? "text-destructive" : "text-success"}>{fmt(s.absDiff)}</td>
                        <td>{s.pctDiff === null ? "—" : `${s.pctDiff.toFixed(1)} %`}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="h-64">
              <ResponsiveContainer>
                <LineChart data={curve}>
                  <CartesianGrid stroke={C.border} strokeDasharray="3 3" /><XAxis dataKey="cambio" stroke={C.muted} fontSize={11} /><YAxis stroke={C.muted} fontSize={11} tickFormatter={(v: number) => `${(v / 1e6).toFixed(1)}M`} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => money(v)} /><Legend />
                  <Line dataKey="precio" name="Utilidad vs precio" stroke={C.primary} strokeWidth={2} />
                  <Line dataKey="demanda" name="Utilidad vs demanda" stroke={C.success} strokeWidth={2} />
                  <Line dataKey="costos" name="Utilidad vs costos" stroke={C.danger} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Histórico y clima */}
          <div className="card space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-bold">Referencia histórica</h2><Tag kind="hist" /></div>
            <Warn items={baseline.warnings} />
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <Kpi label="Registros usados" value={`${baseline.records}`} hint={`${baseline.cancelled} cancelados (${baseline.cancellationPct.toFixed(0)} %)`} />
              <Kpi label="Periodo analizado" value={baseline.firstDate ? `${baseline.spanDays} días` : "Sin datos"} hint={baseline.firstDate ? `${baseline.firstDate} → ${baseline.lastDate}` : undefined} />
              <Kpi label="Lavados por día" value={baseline.avgPerDay.toFixed(2)} />
              <Kpi label="Ingreso diario promedio" value={money(baseline.avgDailyRevenue)} />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="text-sm">
                <p className="mb-1 font-semibold">Promedio por día de la semana</p>
                {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d, i) => <div key={d} className="flex justify-between border-t border-border py-1"><span>{d}</span><span>{baseline.byWeekday[i]!.toFixed(2)}</span></div>)}
              </div>
              <div className="space-y-3 text-sm">
                <div><p className="mb-1 font-semibold">Precio promedio por servicio</p>
                  {baseline.priceByService.length === 0 && <p className="text-muted-foreground">Sin datos</p>}
                  {baseline.priceByService.map((s) => <div key={s.serviceId} className="flex justify-between border-t border-border py-1"><span>{s.name} ({s.count})</span><span>{money(s.avg)}</span></div>)}
                </div>
                <div><p className="mb-1 font-semibold">Demanda por hora</p>
                  {baseline.byHour.map((h) => <div key={h.hour} className="flex justify-between border-t border-border py-1"><span>{h.hour}</span><span>{h.count}</span></div>)}
                </div>
                <p className="text-muted-foreground">Costo y utilidad histórica: no registrados. Registros con clima: {baseline.weatherRecords}.</p>
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold">Lavados atendidos según clima <span className="chip bg-warning/20 text-warning">Preliminar · supuesto de simulación</span></p>
              <div className="grid grid-cols-3 gap-3">{climateCmp.map((c) => <Kpi key={c.clima} label={c.clima} value={`${c.lavados}`} />)}</div>
              <p className="mt-2 text-xs text-muted-foreground">Las diferencias provienen solo de tus supuestos de variación por clima. Una correlación no implica causalidad.</p>
            </div>
          </div>

          {/* Guardar / historial */}
          <div className="card space-y-4">
            <h2 className="text-lg font-bold">Guardar y exportar</h2>
            <div className="flex flex-wrap gap-2">
              <input className="input min-w-0 flex-1" placeholder="Nombre de la simulación" value={name} onChange={(e) => setName(e.target.value)} />
              <button className="btn-primary" onClick={save} disabled={res.errors.length > 0}><Save className="h-4 w-4" />Guardar</button>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="btn-ghost" onClick={() => exportAll("csv")}><Download className="h-4 w-4" />Exportar CSV</button>
              <button className="btn-ghost" onClick={() => exportAll("json")}><Download className="h-4 w-4" />Exportar JSON</button>
            </div>
            <h3 className="font-semibold">Historial de simulaciones</h3>
            {sims.length === 0 && <p className="text-sm text-muted-foreground">Aún no has guardado simulaciones.</p>}
            {sims.map((s) => (
              <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border p-3 text-sm">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={compareIds.includes(s.id)} onChange={(e) => setCompareIds(e.target.checked ? [...compareIds, s.id] : compareIds.filter((x) => x !== s.id))} />
                  <span><b>{s.name}</b><br /><span className="text-xs text-muted-foreground">{new Date(s.createdAt).toLocaleString("es-CO")} · {s.horizonDays} días · utilidad {money(s.results.operatingProfit)}{s.historicalVersion !== baseline.version && " · histórico cambió desde que se guardó"}</span></span>
                </label>
                <div className="flex gap-1">
                  <button className="btn-ghost px-2.5" aria-label="Cargar" title="Cargar" onClick={() => load(s)}><Upload className="h-4 w-4" /></button>
                  <button className="btn-ghost px-2.5" aria-label="Duplicar" title="Duplicar" onClick={() => persist([{ ...s, id: uid(), name: `${s.name} (copia)`, createdAt: new Date().toISOString() }, ...sims])}><Copy className="h-4 w-4" /></button>
                  <button className="btn-ghost px-2.5 text-destructive" aria-label="Eliminar" title="Eliminar" onClick={() => { persist(sims.filter((x) => x.id !== s.id)); setCompareIds(compareIds.filter((x) => x !== s.id)); }}><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            ))}
            {compared.length >= 2 && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <thead className="text-left text-muted-foreground"><tr><th className="py-2">Indicador</th>{compared.map((s) => <th key={s.id}>{s.name}</th>)}</tr></thead>
                  <tbody>
                    {([["Días", (r: SimulationResults) => `${r.calendarDays}`], ["Lavados", (r) => `${r.served}`], ["Ingresos", (r) => money(r.revenue)], ["Costos", (r) => money(r.operatingCosts)], ["Utilidad", (r) => money(r.operatingProfit)], ["Margen", (r) => pctTxt(r.marginPct)], ["ROI", (r) => pctTxt(r.roiPct, "No disponible")]] as [string, (r: SimulationResults) => string][]).map(([l, f]) => (
                      <tr key={l} className="border-t border-border"><td className="py-2 text-muted-foreground">{l}</td>{compared.map((s) => <td key={s.id}>{f(s.results)}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {compared.length === 1 && <p className="text-xs text-muted-foreground">Selecciona al menos dos simulaciones para compararlas.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactElement }) {
  return (
    <div className="card">
      <p className="mb-3 font-semibold">{title}</p>
      <div className="h-64"><ResponsiveContainer>{children}</ResponsiveContainer></div>
    </div>
  );
}
