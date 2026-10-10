import type { Booking } from "@/lib/store";
import type { HistoricalBaseline } from "./types";

const DAY = 864e5;
const parse = (d: string) => new Date(d + "T00:00:00Z").getTime();

/** Construye la referencia histórica a partir de las reservas guardadas (estadística descriptiva, no ML). */
export function buildBaseline(bookings: Booking[], services: { id: string; name: string }[]): HistoricalBaseline {
  const valid = bookings.filter((b) => b.status !== "CANCELADO");
  const cancelled = bookings.length - valid.length;
  const dates = valid.map((b) => b.date).sort();
  const firstDate = dates[0] ?? null, lastDate = dates[dates.length - 1] ?? null;
  const spanDays = firstDate && lastDate ? Math.round((parse(lastDate) - parse(firstDate)) / DAY) + 1 : 0;
  const perDate = new Map<string, number>();
  valid.forEach((b) => perDate.set(b.date, (perDate.get(b.date) ?? 0) + 1));

  const weekdayCount = Array(7).fill(0), weekdayDays = Array(7).fill(0);
  for (let i = 0; i < spanDays; i++) weekdayDays[(new Date(parse(firstDate!) + i * DAY).getUTCDay() + 6) % 7]++;
  valid.forEach((b) => weekdayCount[(new Date(parse(b.date)).getUTCDay() + 6) % 7]++);

  const hours = new Map<string, number>();
  valid.forEach((b) => { const h = b.time.slice(0, 2) + ":00"; hours.set(h, (hours.get(h) ?? 0) + 1); });

  const priceByService = services.map((s) => {
    const list = valid.filter((b) => b.serviceId === s.id);
    return { serviceId: s.id, name: s.name, count: list.length, avg: list.length ? list.reduce((a, b) => a + b.payment.amount, 0) / list.length : 0 };
  }).filter((s) => s.count > 0);
  const revenue = valid.reduce((a, b) => a + b.payment.amount, 0);

  // Tendencia lineal (mínimos cuadrados) sobre la cantidad diaria. Los días sin registros se tratan como 0,
  // aunque no se sabe si fueron días confirmados sin lavados: por eso se exige un mínimo de datos.
  const distinctDays = perDate.size;
  let trend: HistoricalBaseline["trend"] = null;
  if (distinctDays >= 14 && spanDays >= 21) {
    let sx = 0, sy = 0, sxy = 0, sxx = 0;
    for (let t = 0; t < spanDays; t++) {
      const y = perDate.get(new Date(parse(firstDate!) + t * DAY).toISOString().slice(0, 10)) ?? 0;
      sx += t; sy += y; sxy += t * y; sxx += t * t;
    }
    const n = spanDays, den = n * sxx - sx * sx;
    const slope = den ? (n * sxy - sx * sy) / den : 0;
    trend = { slope, intercept: (sy - slope * sx) / n, n };
  }

  const warnings: string[] = [];
  if (valid.length < 30) warnings.push(`Solo hay ${valid.length} registros válidos: las estimaciones históricas son poco confiables.`);
  if (spanDays > distinctDays) warnings.push(`${spanDays - distinctDays} de ${spanDays} días no tienen registros; no se sabe si fueron días sin lavados o sin datos.`);
  if (!trend) warnings.push("La tendencia requiere al menos 14 días con registros en un rango de 21 días.");
  warnings.push("Los registros no incluyen clima ni costos: el análisis climático es preliminar y los costos deben ingresarse manualmente.");

  return {
    version: `${bookings.length}reg-${lastDate ?? "sin-datos"}`,
    computedAt: new Date().toISOString(),
    records: valid.length, cancelled, firstDate, lastDate, spanDays, distinctDays,
    avgPerDay: spanDays ? valid.length / spanDays : 0,
    avgDailyRevenue: spanDays ? revenue / spanDays : 0,
    cancellationPct: bookings.length ? (cancelled / bookings.length) * 100 : 0,
    byWeekday: weekdayCount.map((c, i) => (weekdayDays[i] ? c / weekdayDays[i] : 0)),
    byHour: [...hours.entries()].sort().map(([hour, count]) => ({ hour, count })),
    priceByService,
    avgPrice: valid.length ? revenue / valid.length : 0,
    costsRegistered: false,
    weatherRecords: 0,
    trend,
    warnings,
  };
}
