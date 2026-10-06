import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell, StatusChip } from "@/components/AppShell";
import { SERVICES, STATUS_LABEL, cop, useStore, type Status } from "@/lib/store";

export const Route = createFileRoute("/history")({
  head: () => ({ meta: [{ title: "Historial – MotoClean" }, { name: "description", content: "Historial de tus lavados." }, { property: "og:title", content: "Historial – MotoClean" }, { property: "og:description", content: "Historial de tus lavados." }] }),
  component: () => <AppShell title="Historial"><History /></AppShell>,
});

function History() {
  const { db, user } = useStore();
  const [filter, setFilter] = useState<Status | "">("");
  const list = db.bookings.filter((b) => b.userId === user!.id && (!filter || b.status === filter)).sort((a, b) => b.date.localeCompare(a.date));
  return (
    <div className="space-y-4">
      <select className="input max-w-xs" value={filter} onChange={(e) => setFilter(e.target.value as Status | "")}>
        <option value="">Todos los estados</option>
        {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
      {list.length === 0 && <p className="text-muted-foreground">Sin servicios.</p>}
      <div className="grid gap-3">
        {list.map((b) => {
          const s = SERVICES.find((x) => x.id === b.serviceId);
          const m = db.motos.find((x) => x.id === b.motoId);
          return (
            <Link key={b.id} to="/booking/$id" params={{ id: b.id }} className="card flex flex-wrap items-center justify-between gap-3 hover:bg-secondary">
              <div><p className="font-semibold">{s?.name} · {m ? `${m.brand} ${m.model}` : "Moto eliminada"}</p><p className="text-sm text-muted-foreground">{b.date} · {b.time} · {cop(b.payment.amount)}{b.rating ? ` · ${b.rating}★` : ""}</p></div>
              <StatusChip s={b.status} />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
