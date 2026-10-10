import { describe, expect, it } from "vitest";
import { applyDelta, simulate, validate } from "./simulationService";
import type { SimulationParameters } from "./types";

const base: SimulationParameters = {
  horizon: "7", startDate: "2026-10-12", endDate: "2026-10-18", demandSource: "manual", // lunes
  washesPerDay: 10, operatingDaysPerWeek: 6, washers: 2, capacityPerWasher: 5, cancellationPct: 10, growthPct: 0,
  avgPrice: 30000, discountPct: 0, useMix: false, mix: [],
  variableCosts: { supplies: 4000, transport: 3000, utilities: 1000, labor: 2000, other: 0 },
  fixedCosts: [{ key: "a", label: "Arriendo", amount: 300000, freq: "month" }],
  investment: { initial: 1000000, equipment: 0, tools: 0, workingCapital: 0, other: 0 },
  climate: { preset: "normal", sunnyPct: 40, cloudyPct: 40, rainyPct: 20, adjSunnyPct: 0, adjCloudyPct: 0, adjRainyPct: 0 },
};

describe("simulate", () => {
  it("calcula el caso de referencia a mano", () => {
    const r = simulate(base);
    expect(r.errors).toEqual([]);
    expect(r.operatingDays).toBe(6);
    expect(r.baseDemand).toBe(60);
    expect(r.effectiveDemand).toBe(54);
    expect(r.capacity).toBe(60);
    expect(r.served).toBe(54);
    expect(r.revenue).toBe(1620000);
    expect(r.variableCosts).toBe(540000);
    expect(r.fixedCosts).toBeCloseTo(70000);
    expect(r.operatingProfit).toBeCloseTo(1010000);
    expect(r.breakEvenWashes).toBe(4);
    expect(r.roiPct).toBeCloseTo(101);
    expect(r.paybackMonths).toBeCloseTo(1000000 / (1010000 * 30 / 7));
  });
  it("limita por capacidad y reporta demanda no atendida", () => {
    const r = simulate({ ...base, washers: 1 });
    expect(r.served).toBe(30);
    expect(r.unmet).toBe(24);
    expect(r.capacityWarning).toBe(true);
  });
  it("devuelve null cuando no aplica margen, equilibrio ni ROI", () => {
    const r = simulate({ ...base, avgPrice: 0, investment: { initial: 0, equipment: 0, tools: 0, workingCapital: 0, other: 0 } });
    expect(r.marginPct).toBeNull();
    expect(r.breakEvenWashes).toBeNull();
    expect(r.roiPct).toBeNull();
    expect(r.paybackMonths).toBeNull();
  });
  it("aplica descuento, crecimiento y clima", () => {
    const r = simulate({ ...base, discountPct: 10, growthPct: 10, climate: { ...base.climate, adjRainyPct: -50 } });
    expect(r.climateAdjPct).toBeCloseTo(-10);
    expect(r.adjustedDemand).toBe(Math.round(60 * 1.1 * 0.9));
    expect(r.effectivePrice).toBe(27000);
  });
  it("valida entradas inválidas", () => {
    expect(validate({ ...base, cancellationPct: 120, washesPerDay: -1 }).length).toBe(2);
    expect(validate({ ...base, useMix: true, mix: [{ serviceId: "x", name: "x", price: 1, pct: 50 }] }).length).toBe(1);
  });
  it("los escenarios no suman la inversión a los costos operativos", () => {
    const r = simulate(applyDelta(base, { demandPct: 0, pricePct: 0, costPct: 0, cancellationPts: 0, climatePts: 0 }));
    expect(r.operatingCosts).toBeCloseTo(610000);
  });
});
