import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { LocateFixed } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { SERVICES, cop, useStore, type Payment } from "@/lib/store";

export const Route = createFileRoute("/book")({
  validateSearch: (s: Record<string, unknown>): { service?: string } => ({ service: typeof s.service === "string" ? s.service : undefined }),
  head: () => ({ meta: [{ title: "Agendar lavado – MotoClean" }, { name: "description", content: "Agenda tu lavado de moto a domicilio." }, { property: "og:title", content: "Agendar lavado – MotoClean" }, { property: "og:description", content: "Agenda tu lavado a domicilio." }] }),
  component: () => <AppShell title="Agendar lavado"><Book /></AppShell>,
});

const SLOTS = ["07:00", "08:00", "09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00", "17:00"];

function Book() {
  const { service } = Route.useSearch();
  const { db, user, createBooking } = useStore();
  const nav = useNavigate();
  const motos = db.motos.filter((m) => m.userId === user!.id);
  const minDate = new Date().toISOString().slice(0, 10);
  const [f, setF] = useState({ serviceId: service ?? "premium", motoId: motos[0]?.id ?? "", date: minDate, time: "", address: "", notes: "", method: "TARJETA" as Payment["method"], lat: undefined as number | undefined, lng: undefined as number | undefined });
  const [err, setErr] = useState("");
  const [geo, setGeo] = useState("");
  const svc = SERVICES.find((s) => s.id === f.serviceId)!;
  const taken = db.bookings.filter((b) => b.date === f.date && b.status !== "CANCELADO").map((b) => b.time);
  const nowH = new Date().getHours();

  const locate = () => {
    if (!navigator.geolocation) return setGeo("Tu navegador no soporta geolocalización");
    setGeo("Obteniendo ubicación…");
    navigator.geolocation.getCurrentPosition(
      (p) => { setF((x) => ({ ...x, lat: p.coords.latitude, lng: p.coords.longitude, address: x.address || `Ubicación actual (${p.coords.latitude.toFixed(5)}, ${p.coords.longitude.toFixed(5)})` })); setGeo("Ubicación capturada ✓"); },
      () => setGeo("No se pudo obtener la ubicación. Escribe tu dirección."),
    );
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!f.motoId) return setErr("Primero registra una moto");
    if (!f.time) return setErr("Selecciona una hora");
    if (f.address.trim().length < 6) return setErr("Ingresa una dirección válida");
    const b = createBooking({ ...f, address: f.address.trim() });
    nav({ to: "/booking/$id", params: { id: b.id } });
  };

  if (motos.length === 0) return <div className="card">Necesitas registrar una moto antes de agendar. <Link to="/motorcycles" className="text-primary">Registrar moto</Link></div>;

  return (
    <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <section className="card">
          <h2 className="mb-3 font-semibold">1. Servicio</h2>
          <div className="grid gap-3 md:grid-cols-3">
            {SERVICES.map((s) => (
              <button type="button" key={s.id} onClick={() => setF({ ...f, serviceId: s.id })} className={`rounded-lg border p-4 text-left transition ${f.serviceId === s.id ? "border-primary bg-primary/10" : "border-border hover:bg-secondary"}`}>
                <p className="font-semibold">{s.name}</p><p className="text-sm text-primary">{cop(s.price)}</p>
              </button>
            ))}
          </div>
        </section>
        <section className="card">
          <h2 className="mb-3 font-semibold">2. Moto</h2>
          <select className="input" value={f.motoId} onChange={(e) => setF({ ...f, motoId: e.target.value })}>
            {motos.map((m) => <option key={m.id} value={m.id}>{m.brand} {m.model} · {m.plate}</option>)}
          </select>
        </section>
        <section className="card">
          <h2 className="mb-3 font-semibold">3. Fecha y hora</h2>
          <input type="date" min={minDate} className="input max-w-xs" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value, time: "" })} />
          <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5">
            {SLOTS.map((t) => {
              const disabled = taken.includes(t) || (f.date === minDate && Number(t.slice(0, 2)) <= nowH);
              return <button type="button" key={t} disabled={disabled} onClick={() => setF({ ...f, time: t })} className={`rounded-lg border py-2 text-sm disabled:cursor-not-allowed disabled:opacity-30 ${f.time === t ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-secondary"}`}>{t}</button>;
            })}
          </div>
        </section>
        <section className="card space-y-3">
          <h2 className="font-semibold">4. Ubicación</h2>
          <button type="button" className="btn-ghost" onClick={locate}><LocateFixed className="h-4 w-4" />Usar mi ubicación actual</button>
          {geo && <p className="text-sm text-muted-foreground">{geo}</p>}
          <div><label className="label">Dirección</label><input className="input" placeholder="Cra 15 #93-20, Bogotá" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></div>
          <div><label className="label">Indicaciones (opcional)</label><textarea className="input" rows={2} placeholder="Torre, apto, parqueadero…" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
        </section>
        <section className="card space-y-3">
          <div className="flex items-center gap-2"><h2 className="font-semibold">5. Pago</h2><span className="demo-badge">MODO DEMO</span></div>
          <p className="text-sm text-muted-foreground">Pago simulado: no se solicitan ni almacenan datos de tarjeta.</p>
          <div className="grid grid-cols-3 gap-2">
            {(["TARJETA", "PSE", "EFECTIVO"] as const).map((m) => (
              <button type="button" key={m} onClick={() => setF({ ...f, method: m })} className={`rounded-lg border py-2 text-sm ${f.method === m ? "border-primary bg-primary/10" : "border-border"}`}>{m === "TARJETA" ? "Tarjeta" : m === "PSE" ? "PSE" : "Efectivo"}</button>
            ))}
          </div>
        </section>
      </div>
      <aside className="card h-fit space-y-3 lg:sticky lg:top-24">
        <h2 className="font-semibold">Resumen</h2>
        <div className="flex justify-between text-sm"><span>{svc.name}</span><span>{cop(svc.price)}</span></div>
        <div className="text-sm text-muted-foreground">{f.date} {f.time && `· ${f.time}`}</div>
        <div className="flex justify-between border-t border-border pt-3 font-display text-xl font-bold"><span>Total</span><span className="text-primary">{cop(svc.price)}</span></div>
        {err && <p className="text-sm text-destructive">{err}</p>}
        <button className="btn-primary w-full">Confirmar y pagar (DEMO)</button>
      </aside>
    </form>
  );
}
