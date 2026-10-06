import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Bike, CalendarDays, CheckCircle2, ChevronRight, Clock, MapPin, StickyNote, User as UserIcon } from "lucide-react";
import { Logo, StatusChip } from "@/components/AppShell";
import { useStore, WASHERS, SERVICES, STATUS_LABEL, cop, type Booking, type Status } from "@/lib/store";

export const Route = createFileRoute("/washer")({
  head: () => ({ meta: [{ title: "Panel del lavador – MotoClean" }, { name: "description", content: "Agenda y gestión de lavados asignados." }, { property: "og:title", content: "Panel del lavador – MotoClean" }, { property: "og:description", content: "Agenda y gestión de lavados asignados." }] }),
  component: WasherPanel,
});

const NEXT_ACTION: Partial<Record<Status, string>> = {
  LAVADOR_ASIGNADO: "Salir en camino",
  EN_CAMINO: "Iniciar lavado",
  EN_PROCESO: "Marcar finalizado",
};

function WasherPanel() {
  const { db, advanceBooking, ready } = useStore();
  const [washer, setWasher] = useState<string | null>(null);
  const [tab, setTab] = useState<"agenda" | "historial">("agenda");

  const mine = useMemo(() => db.bookings.filter((b) => b.washer === washer), [db.bookings, washer]);
  const active = mine.filter((b) => !["FINALIZADO", "CANCELADO"].includes(b.status)).sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  const done = mine.filter((b) => ["FINALIZADO", "CANCELADO"].includes(b.status)).sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`));
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayCount = active.filter((b) => b.date === todayStr).length;
  const earnings = done.filter((b) => b.status === "FINALIZADO").reduce((s, b) => s + b.payment.amount, 0);

  if (!ready) return <div className="min-h-screen" />;

  if (!washer) {
    return (
      <div className="grid min-h-screen place-items-center px-4">
        <div className="card w-full max-w-sm space-y-4">
          <Logo />
          <h1 className="text-2xl font-bold">Panel del lavador</h1>
          <p className="text-sm text-muted-foreground">Selecciona tu perfil para ver tu agenda.</p>
          {WASHERS.map((w) => (
            <button key={w} className="btn-ghost flex w-full items-center justify-between border border-border" onClick={() => setWasher(w)}>
              <span className="flex items-center gap-2"><UserIcon className="h-4 w-4 text-primary" />{w}</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          ))}
          <p className="text-center text-sm text-muted-foreground">¿Eres cliente? <Link to="/login" className="text-primary">Inicia sesión</Link></p>
        </div>
      </div>
    );
  }

  const list = tab === "agenda" ? active : done;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-3">
          <Logo />
          <div className="flex items-center gap-2">
            <span className="hidden text-sm text-muted-foreground sm:block">{washer}</span>
            <button className="btn-ghost px-3" onClick={() => setWasher(null)}>Cambiar perfil</button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="mb-6 text-3xl font-bold">Mi agenda</h1>

        <div className="mb-6 grid grid-cols-3 gap-3">
          <div className="card p-4"><p className="text-2xl font-bold">{todayCount}</p><p className="text-xs text-muted-foreground">Lavados hoy</p></div>
          <div className="card p-4"><p className="text-2xl font-bold">{active.length}</p><p className="text-xs text-muted-foreground">Pendientes</p></div>
          <div className="card p-4"><p className="text-2xl font-bold">{cop(earnings)}</p><p className="text-xs text-muted-foreground">Generado</p></div>
        </div>

        <div className="mb-4 flex gap-2">
          <button className={tab === "agenda" ? "btn-primary" : "btn-ghost border border-border"} onClick={() => setTab("agenda")}>Agenda ({active.length})</button>
          <button className={tab === "historial" ? "btn-primary" : "btn-ghost border border-border"} onClick={() => setTab("historial")}>Historial ({done.length})</button>
        </div>

        {list.length === 0 && (
          <div className="card grid place-items-center gap-2 p-10 text-center">
            <CalendarDays className="h-8 w-8 text-muted-foreground" />
            <p className="text-muted-foreground">{tab === "agenda" ? "No tienes lavados pendientes." : "Aún no tienes lavados en el historial."}</p>
          </div>
        )}

        <div className="space-y-3">
          {list.map((b) => <BookingCard key={b.id} b={b} onAdvance={() => advanceBooking(b.id)} />)}
        </div>
      </main>
    </div>
  );
}

function BookingCard({ b, onAdvance }: { b: Booking; onAdvance: () => void }) {
  const { db } = useStore();
  const moto = db.motos.find((m) => m.id === b.motoId);
  const client = db.users.find((u) => u.id === b.userId);
  const svc = SERVICES.find((s) => s.id === b.serviceId);
  const action = NEXT_ACTION[b.status];
  const dateLabel = new Date(`${b.date}T${b.time}`).toLocaleString("es-CO", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="card space-y-3 p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold">{svc?.name}</p>
          <p className="flex items-center gap-1 text-sm text-muted-foreground"><Clock className="h-3.5 w-3.5" />{dateLabel}</p>
        </div>
        <StatusChip s={b.status} />
      </div>
      <div className="grid gap-2 text-sm sm:grid-cols-2">
        <p className="flex items-center gap-2"><UserIcon className="h-4 w-4 text-muted-foreground" />{client?.name ?? "Cliente"} · {client?.phone}</p>
        <p className="flex items-center gap-2"><Bike className="h-4 w-4 text-muted-foreground" />{moto ? `${moto.brand} ${moto.model} · ${moto.plate}` : "Moto"}</p>
        <p className="flex items-center gap-2 sm:col-span-2"><MapPin className="h-4 w-4 text-muted-foreground" />{b.address}</p>
        {b.notes && <p className="flex items-center gap-2 sm:col-span-2"><StickyNote className="h-4 w-4 text-muted-foreground" />{b.notes}</p>}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
        <p className="font-semibold text-primary">{cop(b.payment.amount)} <span className="text-xs font-normal text-muted-foreground">· {b.payment.method === "EFECTIVO" ? "Efectivo" : "Pagado en línea"}</span></p>
        {action ? (
          <button className="btn-primary" onClick={onAdvance}>{action}</button>
        ) : b.status === "FINALIZADO" ? (
          <span className="flex items-center gap-1 text-sm text-success"><CheckCircle2 className="h-4 w-4" />{STATUS_LABEL[b.status]}{b.rating ? ` · ★${b.rating}` : ""}</span>
        ) : null}
      </div>
    </div>
  );
}
