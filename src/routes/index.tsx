import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarClock, MapPin, ShieldCheck, Sparkles, Star, Timer } from "lucide-react";
import hero from "@/assets/hero-moto.jpg";
import { Logo } from "@/components/AppShell";
import { SERVICES, cop } from "@/lib/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MotoClean – Lava tu moto sin moverla" },
      { name: "description", content: "Lavado de motocicletas a domicilio en Colombia. Agenda, paga y sigue a tu lavador en tiempo real." },
      { property: "og:title", content: "MotoClean – Lava tu moto sin moverla" },
      { property: "og:description", content: "Lavado de motos a domicilio: agenda en minutos y sigue tu servicio." },
    ],
  }),
  component: Home,
});

function Home() {
  return (
    <div>
      <header className="absolute inset-x-0 top-0 z-20">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Logo />
          <div className="flex gap-2">
            <Link to="/login" className="btn-ghost">Ingresar</Link>
            <Link to="/register" className="btn-primary">Crear cuenta</Link>
          </div>
        </div>
      </header>
      <section className="relative min-h-[88vh] overflow-hidden">
        <img src={hero} alt="Moto siendo lavada con espuma frente a una casa" width={1600} height={1008} className="absolute inset-0 h-full w-full object-cover" />
        <div className="hero-overlay absolute inset-0" />
        <div className="relative mx-auto flex min-h-[88vh] max-w-6xl flex-col justify-center px-4 pt-20">
          <span className="demo-badge mb-5 w-fit">Prototipo universitario · DEMO</span>
          <h1 className="max-w-2xl text-5xl font-bold leading-[1.05] md:text-7xl">Lava tu moto <span className="text-primary">sin moverla.</span></h1>
          <p className="mt-6 max-w-lg text-lg text-muted-foreground">Un lavador capacitado llega a tu casa u oficina. Tú eliges el servicio, la hora y sigues el estado en tiempo real.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/register" className="btn-primary px-6 py-3 text-base">Agendar mi lavado</Link>
            <Link to="/services" className="btn-ghost px-6 py-3 text-base">Ver servicios</Link>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-4 py-20">
        <h2 className="text-3xl font-bold">Así de fácil</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-4">
          {[
            [Sparkles, "Elige el servicio", "Básico, premium o con mantenimiento visual."],
            [CalendarClock, "Agenda", "Selecciona fecha y franja horaria."],
            [MapPin, "Indica ubicación", "Tu dirección o ubicación actual."],
            [Timer, "Sigue el estado", "Desde confirmado hasta finalizado."],
          ].map(([Icon, t, d], i) => {
            const I = Icon as typeof Sparkles;
            return (
              <div key={i} className="card">
                <I className="h-6 w-6 text-primary" />
                <h3 className="mt-4 font-semibold">{t as string}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{d as string}</p>
              </div>
            );
          })}
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-4 pb-20">
        <h2 className="text-3xl font-bold">Servicios</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {SERVICES.map((s) => (
            <div key={s.id} className="card flex flex-col">
              <h3 className="text-xl font-semibold">{s.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{s.description}</p>
              <p className="mt-4 font-display text-3xl font-bold text-primary">{cop(s.price)}</p>
              <p className="text-xs text-muted-foreground">~{s.minutes} min</p>
            </div>
          ))}
        </div>
      </section>
      <section className="border-t border-border">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-14 md:grid-cols-3">
          <div className="flex gap-3"><ShieldCheck className="h-6 w-6 text-success" /><p className="text-sm">Lavadores verificados y capacitados.</p></div>
          <div className="flex gap-3"><Star className="h-6 w-6 text-accent" /><p className="text-sm">Califica cada servicio.</p></div>
          <div className="flex gap-3"><Timer className="h-6 w-6 text-primary" /><p className="text-sm">Recordatorios para tu próximo lavado.</p></div>
        </div>
        <p className="pb-8 text-center text-xs text-muted-foreground">© 2026 MotoClean · Proyecto integrador universitario</p>
      </section>
    </div>
  );
}
