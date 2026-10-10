// Tipos del simulador. Diseñados para poder serializarse y enviarse en el futuro a una API (Python/Pandas).
export type Freq = "day" | "week" | "month";
export type HorizonKind = "7" | "30" | "90" | "custom";
export type DemandSource = "manual" | "historical" | "trend";
export type ClimatePreset = "normal" | "sunny" | "cloudy" | "rainy" | "manual";

export interface MixItem { serviceId: string; name: string; price: number; pct: number }
export interface FixedCost { key: string; label: string; amount: number; freq: Freq }

export interface SimulationParameters {
  horizon: HorizonKind;
  startDate: string; // YYYY-MM-DD
  endDate: string; // solo para "custom"
  demandSource: DemandSource;
  washesPerDay: number;
  operatingDaysPerWeek: number;
  washers: number;
  capacityPerWasher: number;
  cancellationPct: number;
  growthPct: number;
  avgPrice: number;
  discountPct: number;
  useMix: boolean;
  mix: MixItem[];
  variableCosts: { supplies: number; transport: number; utilities: number; labor: number; other: number };
  fixedCosts: FixedCost[];
  investment: { initial: number; equipment: number; tools: number; workingCapital: number; other: number };
  climate: {
    preset: ClimatePreset;
    sunnyPct: number; cloudyPct: number; rainyPct: number;
    // Supuestos del usuario: variación de demanda (%) por condición. No son efectos demostrados.
    adjSunnyPct: number; adjCloudyPct: number; adjRainyPct: number;
  };
}

export interface DailyPoint { date: string; operating: boolean; demand: number; capacity: number }

export interface SimulationResults {
  calendarDays: number;
  operatingDays: number;
  baseDemand: number;
  adjustedDemand: number;
  effectiveDemand: number;
  capacity: number;
  served: number;
  unmet: number;
  capacityWarning: boolean;
  climateAdjPct: number;
  effectivePrice: number;
  variableCostPerWash: number;
  revenue: number;
  variableCosts: number;
  fixedCosts: number;
  operatingCosts: number;
  operatingProfit: number;
  marginPct: number | null;
  contributionPerWash: number;
  breakEvenWashes: number | null;
  investment: number;
  roiPct: number | null;
  monthlyProfit: number;
  paybackMonths: number | null;
  daily: DailyPoint[];
  errors: string[];
  warnings: string[];
}

export interface ScenarioDelta { demandPct: number; pricePct: number; costPct: number; cancellationPts: number; climatePts: number }

export interface HistoricalBaseline {
  version: string;
  computedAt: string;
  records: number;
  cancelled: number;
  firstDate: string | null;
  lastDate: string | null;
  spanDays: number;
  distinctDays: number;
  avgPerDay: number;
  avgDailyRevenue: number;
  cancellationPct: number;
  byWeekday: number[]; // promedio lun..dom
  byHour: { hour: string; count: number }[];
  priceByService: { serviceId: string; name: string; avg: number; count: number }[];
  avgPrice: number;
  costsRegistered: boolean;
  weatherRecords: number;
  trend: { intercept: number; slope: number; n: number } | null;
  warnings: string[];
}

export interface SimulationScenario {
  id: string;
  name: string;
  createdAt: string;
  horizonDays: number;
  params: SimulationParameters;
  deltas: { pessimistic: ScenarioDelta; optimistic: ScenarioDelta };
  results: SimulationResults;
  historicalVersion: string;
}

export type SensitivityVariable = "price" | "demand" | "variableCost" | "fixedCost" | "cancellation" | "climate";

export interface SensitivityResult {
  variable: SensitivityVariable;
  changePct: number;
  metric: string;
  base: number | null;
  modified: number | null;
  absDiff: number | null;
  pctDiff: number | null;
}
