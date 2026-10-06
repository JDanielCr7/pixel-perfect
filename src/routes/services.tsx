import { createFileRoute, Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { Logo } from "@/components/AppShell";
import { SERVICES, cop } from "@/lib/store";

export const Route = createFileRoute("/services")({
  head: () => ({
    meta: [
      { title: "Servicios y precios – MotoClean" },
      { name: "description", content: "Lavado básico, premium y con mantenimiento visual a domicilio." },
      { property: "og:title", content: "Servicios y precios – MotoClean" },
      { property: "og:description", content: "Elige el lavado ideal para tu moto." },
    ],
  }),
  component: Services,
});

function Services() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="flex items-center justify-between"><Logo /><Link to="/login" className="btn-ghost">Ingresar</Link></div>
      <h1 className="mt-12 text-4xl font-bold">Servicios</h1>
      <p className="mt-2 text-muted-foreground">Precios en pesos colombianos, a domicilio.</p>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {SERVICES.map((s, i) => (
          <div key={s.id} className={`card flex flex-col ${i === 1 ? "border-primary" : ""}`}>
            {i === 1 && <span className="demo-badge mb-3 w-fit">Más pedido</span>}
            <h2 className="text-xl font-semibold">{s.name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{s.description}</p>
            <p className="mt-4 font-display text-3xl font-bold text-primary">{cop(s.price)}</p>
            <p className="text-xs text-muted-foreground">Duración aprox. {s.minutes} min</p>
            <ul className="mt-4 flex-1 space-y-2 text-sm">
              {s.includes.map((x) => <li key={x} className="flex gap-2"><Check className="h-4 w-4 text-success" />{x}</li>)}
            </ul>
            <Link to="/book" search={{ service: s.id }} className="btn-primary mt-6">Agendar</Link>
          </div>
        ))}
      </div>
    </div>
  );
}
