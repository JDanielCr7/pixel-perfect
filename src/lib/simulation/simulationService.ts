// Motor de cálculo del simulador. Independiente de la interfaz: puede sustituirse por una API remota
// manteniendo la misma firma (ver docs/SIMULADOR.md).
import type { HistoricalBaseline, ScenarioDelta, SensitivityResult, SensitivityVariable, SimulationParameters, SimulationResults } from "./types";

export const CLIMATE_PRESETS = {
  normal: { sunnyPct: 40, cloudyPct: 40, rainyPct: 20 },
  sunny: { sunnyPct: 70, cloudyPct: 20, rainyPct: 10 },
  cloudy: { sunnyPct: 20, cloudyPct: 60, rainyPct: 20 },
  rainy: { sunnyPct: 15, cloudyPct: 25, rainyPct: 60 },
} as const;

const DAY = 864e5;
const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, Number.isFinite(n) ? n : 0));
const nn = (n: number) => Math.max(0, Number.isFinite(n) ? n : 0);
const parse = (d: string) => new Date(d + "T00:00:00Z");
const iso = (d: Date) => d.toISOString().slice(0, 10);

export function horizonDays(p: SimulationParameters): number {
  if (p.horizon !== "custom") return Number(p.horizon);
  const diff = Math.round((parse(p.endDate).getTime() - parse(p.startDate).getTime()) / DAY) + 1;
  return Number.isFinite(diff) ? Math.max(0, diff) : 0;
}

export function validate(p: SimulationParameters): string[] {
  const e: string[] = [];
  const pct = (v: number, name: string, min = 0, max = 100) => { if (!(v >= min && v <= max)) e.push(`${name} debe estar entre ${min} % y ${max} %.`); };
  if (!Number.isInteger(p.washesPerDay) || p.washesPerDay < 0) e.push("Los lavados por día deben ser un entero no negativo.");
  if (!(p.operatingDaysPerWeek >= 0 && p.operatingDaysPerWeek <= 7) || !Number.isInteger(p.operatingDaysPerWeek)) e.push("Los días de operación deben ser un entero entre 0 y 7.");
  if (!Number.isInteger(p.washers) || p.washers < 0) e.push("El número de lavadores debe ser un entero no negativo.");
  if (!Number.isInteger(p.capacityPerWasher) || p.capacityPerWasher < 0) e.push("La capacidad por lavador debe ser un entero no negativo.");
  pct(p.cancellationPct, "Las cancelaciones");
  pct(p.growthPct, "El crecimiento", -100, 1000);
  pct(p.discountPct, "El descuento");
  if (p.avgPrice < 0) e.push("El precio no puede ser negativo.");
  if (p.useMix) {
    const s = p.mix.reduce((a, m) => a + m.pct, 0);
    if (Math.abs(s - 100) > 0.01) e.push(`La mezcla de servicios suma ${s} %; debe sumar 100 %.`);
    if (p.mix.some((m) => m.price < 0 || m.pct < 0)) e.push("La mezcla no admite precios ni porcentajes negativos.");
  }
  if (Object.values(p.variableCosts).some((v) => v < 0)) e.push("Los costos variables no pueden ser negativos.");
  if (p.fixedCosts.some((f) => f.amount < 0)) e.push("Los costos fijos no pueden ser negativos.");
  if (Object.values(p.investment).some((v) => v < 0)) e.push("La inversión no puede ser negativa.");
  const c = p.climate;
  if (Math.abs(c.sunnyPct + c.cloudyPct + c.rainyPct - 100) > 0.01) e.push("Los porcentajes de clima deben sumar 100 %.");
  [c.adjSunnyPct, c.adjCloudyPct, c.adjRainyPct].forEach((v) => pct(v, "El ajuste climático", -100, 200));
  if (p.horizon === "custom" && horizonDays(p) <= 0) e.push("La fecha final debe ser igual o posterior a la inicial.");
  if (horizonDays(p) > 1095) e.push("El periodo máximo es de 3 años.");
  return e;
}

export const totalInvestment = (p: SimulationParameters) => Object.values(p.investment).reduce((a, v) => a + nn(v), 0);
export const variableCostPerWash = (p: SimulationParameters) => Object.values(p.variableCosts).reduce((a, v) => a + nn(v), 0);
export function effectivePrice(p: SimulationParameters) {
  const base = p.useMix ? p.mix.reduce((a, m) => a + nn(m.price) * nn(m.pct) / 100, 0) : nn(p.avgPrice);
  return base * (1 - clamp(p.discountPct, 0, 100) / 100);
}
export function fixedCostsForDays(p: SimulationParameters, days: number) {
  return p.fixedCosts.reduce((a, f) => a + nn(f.amount) * (f.freq === "day" ? days : f.freq === "week" ? days / 7 : days / 30), 0);
}
export function climateAdjustment(p: SimulationParameters) {
  const c = p.climate;
  return (c.sunnyPct * c.adjSunnyPct + c.cloudyPct * c.adjCloudyPct + c.rainyPct * c.adjRainyPct) / 100;
}

/** Demanda por día operativo según la fuente elegida. */
function perDayDemand(p: SimulationParameters, date: Date, h: HistoricalBaseline | null): number {
  if (p.demandSource === "historical" && h && h.records > 0) return h.avgPerDay;
  if (p.demandSource === "trend" && h?.trend && h.firstDate) {
    const t = (date.getTime() - parse(h.firstDate).getTime()) / DAY;
    return Math.max(0, h.trend.intercept + h.trend.slope * t);
  }
  return nn(p.washesPerDay);
}

export function simulate(p: SimulationParameters, h: HistoricalBaseline | null = null): SimulationResults {
  const errors = validate(p);
  const warnings: string[] = [];
  const days = Math.min(horizonDays(p), 1095);
  const start = parse(p.startDate);
  const opDays = clamp(Math.round(p.operatingDaysPerWeek), 0, 7);
  const daily = [] as SimulationResults["daily"];
  let baseDemandRaw = 0;
  let operatingDays = 0;
  for (let i = 0; i < days; i++) {
    const d = new Date(start.getTime() + i * DAY);
    const weekdayMon0 = (d.getUTCDay() + 6) % 7; // lun=0 ... dom=6; se opera los primeros N días de la semana
    const operating = weekdayMon0 < opDays;
    const dem = operating ? perDayDemand(p, d, h) : 0;
    if (operating) operatingDays++;
    baseDemandRaw += dem;
    daily.push({ date: iso(d), operating, demand: dem, capacity: operating ? nn(p.washers) * nn(p.capacityPerWasher) : 0 });
  }
  if (p.demandSource !== "manual" && (!h || h.records === 0)) warnings.push("No hay registros históricos: se usaron 0 lavados por día.");
  if (p.demandSource === "trend" && !h?.trend) warnings.push("No hay suficientes datos para una tendencia; la demanda quedó en 0. Usa otra fuente.");

  const growth = clamp(p.growthPct, -100, 1000) / 100;
  const climateAdjPct = climateAdjustment(p);
  const cancel = clamp(p.cancellationPct, 0, 100) / 100;
  const factor = (1 + growth) * (1 + clamp(climateAdjPct, -100, 200) / 100);
  const baseDemand = Math.round(baseDemandRaw);
  const adjustedDemand = Math.round(baseDemandRaw * factor);
  const effectiveDemand = Math.round(adjustedDemand * (1 - cancel));
  const capacity = nn(p.washers) * nn(p.capacityPerWasher) * operatingDays;
  const served = Math.min(effectiveDemand, capacity);
  const unmet = effectiveDemand - served;
  for (const d of daily) d.demand = Math.round(d.demand * factor * (1 - cancel) * 10) / 10;
  if (unmet > 0) warnings.push(`La demanda supera la capacidad: ${unmet} lavados no podrían atenderse.`);

  const price = effectivePrice(p);
  const vcu = variableCostPerWash(p);
  const revenue = served * price;
  const variableCosts = served * vcu;
  const fixedCosts = fixedCostsForDays(p, days);
  const operatingCosts = variableCosts + fixedCosts;
  const operatingProfit = revenue - operatingCosts;
  const contribution = price - vcu;
  const investment = totalInvestment(p);
  const monthlyProfit = days > 0 ? (operatingProfit * 30) / days : 0;
  return {
    calendarDays: days, operatingDays, baseDemand, adjustedDemand, effectiveDemand, capacity, served, unmet,
    capacityWarning: unmet > 0, climateAdjPct, effectivePrice: price, variableCostPerWash: vcu,
    revenue, variableCosts, fixedCosts, operatingCosts, operatingProfit,
    marginPct: revenue > 0 ? (operatingProfit / revenue) * 100 : null,
    contributionPerWash: contribution,
    breakEvenWashes: contribution > 0 ? Math.ceil(fixedCosts / contribution - 1e-9) : null,
    investment,
    roiPct: investment > 0 ? (operatingProfit / investment) * 100 : null,
    monthlyProfit,
    paybackMonths: investment > 0 && monthlyProfit > 0 ? investment / monthlyProfit : null,
    daily, errors, warnings,
  };
}

// ---------- Escenarios ----------
export const DEFAULT_DELTAS = {
  pessimistic: { demandPct: -20, pricePct: 0, costPct: 10, cancellationPts: 5, climatePts: -5 } as ScenarioDelta,
  optimistic: { demandPct: 20, pricePct: 0, costPct: -5, cancellationPts: -3, climatePts: 5 } as ScenarioDelta,
};

export function applyDelta(p: SimulationParameters, d: ScenarioDelta): SimulationParameters {
  const k = 1 + d.costPct / 100;
  const pk = 1 + d.pricePct / 100;
  return {
    ...p,
    growthPct: ((1 + p.growthPct / 100) * (1 + d.demandPct / 100) - 1) * 100,
    avgPrice: p.avgPrice * pk,
    mix: p.mix.map((m) => ({ ...m, price: m.price * pk })),
    cancellationPct: clamp(p.cancellationPct + d.cancellationPts, 0, 100),
    variableCosts: Object.fromEntries(Object.entries(p.variableCosts).map(([key, v]) => [key, v * k])) as SimulationParameters["variableCosts"],
    fixedCosts: p.fixedCosts.map((f) => ({ ...f, amount: f.amount * k })),
    climate: { ...p.climate, adjSunnyPct: p.climate.adjSunnyPct + d.climatePts, adjCloudyPct: p.climate.adjCloudyPct + d.climatePts, adjRainyPct: p.climate.adjRainyPct + d.climatePts },
  };
}

/** Ordena las variables según cuánto cambia la utilidad entre pesimista y optimista cuando se aísla cada una. */
export function scenarioDrivers(p: SimulationParameters, deltas: typeof DEFAULT_DELTAS, h: HistoricalBaseline | null) {
  const zero: ScenarioDelta = { demandPct: 0, pricePct: 0, costPct: 0, cancellationPts: 0, climatePts: 0 };
  const labels: Record<keyof ScenarioDelta, string> = { demandPct: "Demanda", pricePct: "Precio", costPct: "Costos", cancellationPts: "Cancelaciones", climatePts: "Ajuste climático" };
  return (Object.keys(labels) as (keyof ScenarioDelta)[]).map((key) => {
    const lo = simulate(applyDelta(p, { ...zero, [key]: deltas.pessimistic[key] }), h).operatingProfit;
    const hi = simulate(applyDelta(p, { ...zero, [key]: deltas.optimistic[key] }), h).operatingProfit;
    return { key, label: labels[key], spread: hi - lo };
  }).sort((a, b) => Math.abs(b.spread) - Math.abs(a.spread));
}

// ---------- Sensibilidad ----------
export const SENS_LABEL: Record<SensitivityVariable, string> = {
  price: "Precio", demand: "Demanda", variableCost: "Costo variable", fixedCost: "Costos fijos", cancellation: "Cancelaciones (puntos)", climate: "Ajuste climático (puntos)",
};
export function applyChange(p: SimulationParameters, v: SensitivityVariable, pct: number): SimulationParameters {
  const z: ScenarioDelta = { demandPct: 0, pricePct: 0, costPct: 0, cancellationPts: 0, climatePts: 0 };
  if (v === "price") return applyDelta(p, { ...z, pricePct: pct });
  if (v === "demand") return applyDelta(p, { ...z, demandPct: pct });
  if (v === "cancellation") return applyDelta(p, { ...z, cancellationPts: pct });
  if (v === "climate") return applyDelta(p, { ...z, climatePts: pct });
  const k = 1 + pct / 100;
  if (v === "variableCost") return { ...p, variableCosts: Object.fromEntries(Object.entries(p.variableCosts).map(([key, x]) => [key, x * k])) as SimulationParameters["variableCosts"] };
  return { ...p, fixedCosts: p.fixedCosts.map((f) => ({ ...f, amount: f.amount * k })) };
}

export function sensitivity(p: SimulationParameters, v: SensitivityVariable, pct: number, h: HistoricalBaseline | null): SensitivityResult[] {
  const a = simulate(p, h), b = simulate(applyChange(p, v, pct), h);
  const metrics: [string, number | null, number | null][] = [
    ["lavados_atendidos", a.served, b.served], ["ingresos", a.revenue, b.revenue], ["costos_operativos", a.operatingCosts, b.operatingCosts],
    ["utilidad_operativa", a.operatingProfit, b.operatingProfit], ["margen_pct", a.marginPct, b.marginPct],
    ["punto_equilibrio_lavados", a.breakEvenWashes, b.breakEvenWashes], ["roi_pct", a.roiPct, b.roiPct],
  ];
  return metrics.map(([metric, base, modified]) => {
    const absDiff = base !== null && modified !== null ? modified - base : null;
    return { variable: v, changePct: pct, metric, base, modified, absDiff, pctDiff: absDiff !== null && base ? (absDiff / Math.abs(base)) * 100 : null };
  });
}

export function sensitivityCurve(p: SimulationParameters, h: HistoricalBaseline | null, steps = [-30, -20, -10, 0, 10, 20, 30]) {
  return steps.map((s) => ({
    cambio: `${s > 0 ? "+" : ""}${s}%`,
    precio: simulate(applyChange(p, "price", s), h).operatingProfit,
    demanda: simulate(applyChange(p, "demand", s), h).operatingProfit,
    costos: simulate(applyChange(applyChange(p, "variableCost", s), "fixedCost", s), h).operatingProfit,
  }));
}

/** Utilidad acumulada para varios horizontes, restando la inversión una sola vez. */
export function cumulative(p: SimulationParameters, h: HistoricalBaseline | null) {
  return [30, 90, 180, 365].map((d) => {
    const end = iso(new Date(parse(p.startDate).getTime() + (d - 1) * DAY));
    const r = simulate({ ...p, horizon: "custom", endDate: end }, h);
    return { horizonte: `${d} días`, utilidad: r.operatingProfit, neto: r.operatingProfit - r.investment };
  });
}
