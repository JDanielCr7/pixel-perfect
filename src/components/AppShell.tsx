import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Bell, Bike, CalendarPlus, History, LayoutDashboard, LineChart, LogOut, Sparkles, User } from "lucide-react";
import { useStore, STATUS_LABEL, type Status } from "@/lib/store";

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2 font-display text-lg font-bold">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground"><Sparkles className="h-4 w-4" /></span>
      Moto<span className="text-primary">Clean</span>
    </Link>
  );
}

const NAV = [
  { to: "/dashboard", label: "Inicio", icon: LayoutDashboard },
  { to: "/book", label: "Agendar", icon: CalendarPlus },
  { to: "/motorcycles", label: "Mis motos", icon: Bike },
  { to: "/history", label: "Historial", icon: History },
  { to: "/profile", label: "Perfil", icon: User },
] as const;
const NAV_GERENTE = [
  { to: "/simulator", label: "Simulador", icon: LineChart },
  { to: "/profile", label: "Perfil", icon: User },
] as const;

export function AppShell({ title, children, onlyGerente = false }: { title: string; children: ReactNode; onlyGerente?: boolean }) {
  const { user, role, ready, logout, db, readNotifs } = useStore();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const isGerente = role === "gerente";
  const blocked = ready && !!user && (onlyGerente ? !isGerente : isGerente && title !== "Mi perfil");
  useEffect(() => {
    if (ready && !user) nav({ to: "/login" });
    else if (blocked) nav({ to: isGerente ? "/simulator" : "/dashboard" });
  }, [ready, user, blocked, isGerente, nav]);
  if (!ready || !user || blocked) return <div className="min-h-screen" />;
  const items = isGerente ? NAV_GERENTE : NAV;
  const notifs = db.notifs.filter((n) => n.userId === user.id);
  const unread = notifs.filter((n) => !n.read).length;

  return (
    <div className="min-h-screen pb-20 md:pb-0">
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Logo />
          <nav className="hidden gap-1 md:flex">
            {items.map((n) => (
              <Link key={n.to} to={n.to} className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground" activeProps={{ className: "bg-secondary text-foreground" }}>{n.label}</Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <div className="relative">
              <button aria-label="Notificaciones" className="btn-ghost relative px-2.5" onClick={() => { setOpen(!open); if (!open) readNotifs(); }}>
                <Bell className="h-4 w-4" />
                {unread > 0 && <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-accent text-[10px] font-bold text-accent-foreground">{unread}</span>}
              </button>
              {open && (
                <div className="absolute right-0 mt-2 w-80 rounded-xl border border-border bg-popover p-2 shadow-2xl">
                  {notifs.length === 0 && <p className="p-3 text-sm text-muted-foreground">Sin notificaciones</p>}
                  {notifs.slice(0, 8).map((n) => (
                    <div key={n.id} className="rounded-lg p-3 text-sm hover:bg-secondary">
                      <p>{n.text}</p><p className="mt-1 text-xs text-muted-foreground">{new Date(n.date).toLocaleString("es-CO")}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button aria-label="Cerrar sesión" className="btn-ghost px-2.5" onClick={() => { logout(); nav({ to: "/" }); }}><LogOut className="h-4 w-4" /></button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="mb-6 text-3xl font-bold">{title}</h1>
        {children}
      </main>
      <nav style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }} className="fixed inset-x-0 bottom-0 z-30 grid border-t border-border bg-background/95 backdrop-blur md:hidden">
        {items.map((n) => (
          <Link key={n.to} to={n.to} className="flex flex-col items-center gap-1 py-2 text-[11px] text-muted-foreground" activeProps={{ className: "text-primary" }}>
            <n.icon className="h-5 w-5" />{n.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

export function StatusChip({ s }: { s: Status }) {
  const cls = s === "FINALIZADO" ? "bg-success/20 text-success" : s === "CANCELADO" ? "bg-destructive/20 text-destructive" : s === "PENDIENTE" ? "bg-warning/20 text-warning" : "bg-primary/20 text-primary";
  return <span className={`chip ${cls}`}>{STATUS_LABEL[s]}</span>;
}
