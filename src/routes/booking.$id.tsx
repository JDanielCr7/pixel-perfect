import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Check, Star } from "lucide-react";
import { AppShell, StatusChip } from "@/components/AppShell";
import { SERVICES, STATUS_FLOW, STATUS_LABEL, cop, useStore } from "@/lib/store";

export const Route = createFileRoute("/booking/$id")({
  head: () => ({ meta: [{ title: "Seguimiento del servicio – MotoClean" }, { name: "description", content: "Sigue el estado de tu lavado." }, { property: "og:title", content: "Seguimiento – MotoClean" }, { property: "og:description", content: "Estado de tu lavado." }] }),
  component: () => <AppShell title="Seguimiento"><Detail /></AppShell>,
});

function Detail() {
  const { id } = Route.useParams();
  const { db, user, cancelBooking, advanceBooking, rateBooking } = useStore();
  const b = db.bookings.find((x) => x.id === id && x.userId === user!.id);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  if (!b) return <div className="card">Reserva no encontrada. <Link to="/history" className="text-primary">Ver historial</Link></div>;
  const s = SERVICES.find((x) => x.id === b.serviceId)!;
  const m = db.motos.find((x) => x.id === b.motoId);
  const idx = STATUS_FLOW.indexOf(b.status);
  const open = b.status !== "FINALIZADO" && b.status !== "CANCELADO";
  const canCancel = ["PENDIENTE", "CONFIRMADO", "LAVADOR_ASIGNADO"].includes(b.status);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="card">
        <div className="mb-6 flex items-center justify-between"><h2 className="text-xl font-semibold">{s.name}</h2><StatusChip s={b.status} /></div>
        {b.status === "CANCELADO" ? <p className="text-destructive">Este servicio fue cancelado.</p> : (
          <ol className="space-y-4">
            {STATUS_FLOW.map((st, i) => (
              <li key={st} className="flex items-center gap-3">
                <span className={`grid h-8 w-8 place-items-center rounded-full border text-sm ${i <= idx ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground"}`}>{i < idx ? <Check className="h-4 w-4" /> : i + 1}</span>
                <span className={i === idx ? "font-semibold" : i < idx ? "" : "text-muted-foreground"}>{STATUS_LABEL[st]}</span>
              </li>
            ))}
          </ol>
        )}
        {b.washer && <p className="mt-6 rounded-lg bg-secondary p-3 text-sm">Lavador: <b>{b.washer}</b>{b.status === "EN_CAMINO" && " · llegando a tu ubicación"}</p>}
        <div className="mt-6 flex flex-wrap gap-2">
          {open && <button className="btn-ghost" onClick={() => advanceBooking(b.id)}>Simular siguiente estado (DEMO)</button>}
          {canCancel && <button className="btn-danger" onClick={() => confirm("¿Cancelar este servicio?") && cancelBooking(b.id)}>Cancelar servicio</button>}
        </div>
        {b.status === "FINALIZADO" && (
          <div className="mt-8 border-t border-border pt-6">
            <h3 className="mb-3 font-semibold">Calificación</h3>
            {b.rating ? (
              <div><div className="flex">{Array.from({ length: 5 }).map((_, i) => <Star key={i} className={`h-5 w-5 ${i < b.rating! ? "fill-accent text-accent" : "text-muted-foreground"}`} />)}</div>{b.comment && <p className="mt-2 text-sm text-muted-foreground">“{b.comment}”</p>}</div>
            ) : (
              <div className="space-y-3">
                <div className="flex gap-1">{[1, 2, 3, 4, 5].map((n) => <button key={n} aria-label={`${n} estrellas`} onClick={() => setRating(n)}><Star className={`h-7 w-7 ${n <= rating ? "fill-accent text-accent" : "text-muted-foreground"}`} /></button>)}</div>
                <textarea className="input" rows={2} placeholder="Cuéntanos cómo te fue" value={comment} onChange={(e) => setComment(e.target.value)} />
                <button className="btn-primary" onClick={() => rateBooking(b.id, rating, comment.trim())}>Enviar calificación</button>
              </div>
            )}
          </div>
        )}
      </div>
      <aside className="card h-fit space-y-2 text-sm">
        <h3 className="mb-2 font-semibold">Detalles</h3>
        <p><span className="text-muted-foreground">Moto:</span> {m ? `${m.brand} ${m.model} (${m.plate})` : "—"}</p>
        <p><span className="text-muted-foreground">Fecha:</span> {b.date} · {b.time}</p>
        <p><span className="text-muted-foreground">Dirección:</span> {b.address}</p>
        {b.notes && <p><span className="text-muted-foreground">Indicaciones:</span> {b.notes}</p>}
        {b.lat && <a className="text-primary" target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${b.lat},${b.lng}`}>Ver en mapa</a>}
        <div className="mt-3 border-t border-border pt-3">
          <p className="flex items-center gap-2 font-semibold">Pago <span className="demo-badge">DEMO</span></p>
          <p>{cop(b.payment.amount)} · {b.payment.method} · {b.payment.status}</p>
          <p className="text-xs text-muted-foreground">Ref: {b.payment.reference}</p>
        </div>
      </aside>
    </div>
  );
}
