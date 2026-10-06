import { createFileRoute, Link } from "@tanstack/react-router";
import { Bell, Bike, CalendarPlus } from "lucide-react";
import { AppShell, StatusChip } from "@/components/AppShell";
import { SERVICES, useStore } from "@/lib/store";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Mi panel – MotoClean" }, { name: "description", content: "Tu panel de lavados MotoClean." }, { property: "og:title", content: "Mi panel – MotoClean" }, { property: "og:description", content: "Tu panel de lavados." }] }),
  component: Dashboard,
});

function Dashboard() {
  return <AppShell title="Hola 👋"><Body /></AppShell>;
}

function Body() {
  const { db, user } = useStore();
  const mine = db.bookings.filter((b) => b.userId === user!.id);
  const active = mine.filter((b) => b.status !== "FINALIZADO" && b.status !== "CANCELADO");
  const motos = db.motos.filter((m) => m.userId === user!.id);
  const last = mine.filter((b) => b.status === "FINALIZADO").sort((a, b) => b.date.localeCompare(a.date))[0];
  const days = last ? Math.floor((Date.now() - new Date(last.date).getTime()) / 864e5) : null;

  return (
    <div className="space-y-6">
      <p className="-mt-4 text-muted-foreground">{user!.name}</p>
      <div className="grid gap-4 md:grid-cols-3">
        <Link to="/book" className="card flex items-center gap-4 border-primary/40 bg-primary/10 hover:bg-primary/20">
          <CalendarPlus className="h-8 w-8 text-primary" /><div><p className="font-semibold">Agendar lavado</p><p className="text-sm text-muted-foreground">En menos de 1 minuto</p></div>
        </Link>
        <Link to="/motorcycles" className="card flex items-center gap-4 hover:bg-secondary">
          <Bike className="h-8 w-8 text-primary" /><div><p className="font-semibold">{motos.length} moto(s)</p><p className="text-sm text-muted-foreground">Gestionar</p></div>
        </Link>
        <div className="card flex items-center gap-4">
          <Bell className="h-8 w-8 text-accent" />
          <div><p className="font-semibold">Recordatorio</p><p className="text-sm text-muted-foreground">{days === null ? "Aún no tienes lavados finalizados" : days >= 14 ? `Han pasado ${days} días: ¡hora de lavar!` : `Último lavado hace ${days} días`}</p></div>
        </div>
      </div>
      <div>
        <h2 className="mb-3 text-xl font-semibold">Servicios activos</h2>
        {active.length === 0 && <div className="card text-sm text-muted-foreground">No tienes servicios activos.</div>}
        <div className="grid gap-3">
          {active.map((b) => {
            const s = SERVICES.find((x) => x.id === b.serviceId);
            const m = db.motos.find((x) => x.id === b.motoId);
            return (
              <Link key={b.id} to="/booking/$id" params={{ id: b.id }} className="card flex flex-wrap items-center justify-between gap-3 hover:bg-secondary">
                <div><p className="font-semibold">{s?.name} · {m ? `${m.brand} ${m.model}` : "Moto"}</p><p className="text-sm text-muted-foreground">{b.date} · {b.time} · {b.address}</p></div>
                <StatusChip s={b.status} />
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
