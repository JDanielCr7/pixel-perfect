import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Status = "PENDIENTE" | "CONFIRMADO" | "LAVADOR_ASIGNADO" | "EN_CAMINO" | "EN_PROCESO" | "FINALIZADO" | "CANCELADO";
export const STATUS_FLOW: Status[] = ["PENDIENTE", "CONFIRMADO", "LAVADOR_ASIGNADO", "EN_CAMINO", "EN_PROCESO", "FINALIZADO"];
export const STATUS_LABEL: Record<Status, string> = {
  PENDIENTE: "Pendiente", CONFIRMADO: "Confirmado", LAVADOR_ASIGNADO: "Lavador asignado",
  EN_CAMINO: "En camino", EN_PROCESO: "En proceso", FINALIZADO: "Finalizado", CANCELADO: "Cancelado",
};

export interface User { id: string; name: string; email: string; phone: string; password: string; }
export interface Moto { id: string; userId: string; brand: string; model: string; year: number; plate: string; color: string; cc: number; }
export interface Service { id: string; name: string; description: string; price: number; minutes: number; includes: string[]; }
export interface Payment { method: "TARJETA" | "PSE" | "EFECTIVO"; status: "PENDIENTE" | "APROBADO" | "RECHAZADO" | "CANCELADO"; reference: string; amount: number; date: string; }
export interface Booking {
  id: string; userId: string; motoId: string; serviceId: string; date: string; time: string;
  address: string; notes: string; lat?: number | undefined; lng?: number | undefined; status: Status; washer?: string | undefined;
  payment: Payment; rating?: number; comment?: string; createdAt: string;
}
export interface Notif { id: string; userId: string; text: string; date: string; read: boolean; }

export const SERVICES: Service[] = [
  { id: "basic", name: "Lavado básico", description: "Limpieza exterior completa para el día a día.", price: 25000, minutes: 40, includes: ["Lavado exterior", "Secado", "Limpieza de rines"] },
  { id: "premium", name: "Lavado premium", description: "Lavado profundo con desengrase y brillo.", price: 45000, minutes: 70, includes: ["Todo lo del básico", "Desengrase de motor", "Lubricación de cadena", "Cera y brillo"] },
  { id: "maint", name: "Lavado + mantenimiento visual", description: "Premium más revisión visual de tu moto.", price: 65000, minutes: 90, includes: ["Todo lo del premium", "Revisión de llantas", "Revisión de luces", "Reporte de estado"] },
];
const WASHERS = ["Carlos Pérez (DEMO)", "Andrea Gómez (DEMO)"];

interface DB { users: User[]; motos: Moto[]; bookings: Booking[]; notifs: Notif[]; session: string | null; }
const uid = () => Math.random().toString(36).slice(2, 10);
const today = (d = 0) => new Date(Date.now() + d * 864e5).toISOString().slice(0, 10);

function seed(): DB {
  const u: User = { id: "demo1", name: "Laura Cliente (DEMO)", email: "cliente@demo.com", phone: "3000000000", password: "demo1234" };
  const pay = (amount: number, status: Payment["status"]): Payment => ({ method: "TARJETA", status, reference: "DEMO-" + uid().toUpperCase(), amount, date: new Date().toISOString() });
  return {
    session: null,
    users: [u],
    motos: [
      { id: "m1", userId: u.id, brand: "Yamaha", model: "MT-03", year: 2022, plate: "ABC12D", color: "Azul", cc: 321 },
      { id: "m2", userId: u.id, brand: "Honda", model: "CB190R", year: 2020, plate: "XYZ34E", color: "Rojo", cc: 184 },
    ],
    bookings: [
      { id: "b1", userId: u.id, motoId: "m1", serviceId: "premium", date: today(-12), time: "10:00", address: "Cra 15 #93-20, Bogotá", notes: "", status: "FINALIZADO", washer: WASHERS[0]!, payment: pay(45000, "APROBADO"), rating: 5, comment: "Excelente", createdAt: new Date().toISOString() },
      { id: "b2", userId: u.id, motoId: "m2", serviceId: "basic", date: today(1), time: "08:00", address: "Calle 72 #10-34, Bogotá", notes: "Parqueadero sótano", status: "LAVADOR_ASIGNADO", washer: WASHERS[1]!, payment: pay(25000, "APROBADO"), createdAt: new Date().toISOString() },
    ],
    notifs: [{ id: "n1", userId: u.id, text: "Andrea fue asignada a tu lavado de mañana.", date: new Date().toISOString(), read: false }],
  };
}

const KEY = "motoclean-db-v1";
interface Ctx {
  db: DB; ready: boolean; user: User | null;
  login(email: string, pw: string): string | null;
  register(d: Omit<User, "id">): string | null;
  logout(): void;
  updateUser(d: Partial<User>): void;
  saveMoto(m: Omit<Moto, "id" | "userId"> & { id?: string }): void;
  deleteMoto(id: string): void;
  createBooking(b: Omit<Booking, "id" | "userId" | "status" | "createdAt" | "payment"> & { method: Payment["method"] }): Booking;
  cancelBooking(id: string): void;
  advanceBooking(id: string): void;
  rateBooking(id: string, rating: number, comment: string): void;
  readNotifs(): void;
}
const C = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<DB>(() => ({ users: [], motos: [], bookings: [], notifs: [], session: null }));
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const raw = localStorage.getItem(KEY);
    setDb(raw ? JSON.parse(raw) : seed());
    setReady(true);
  }, []);
  useEffect(() => { if (ready) localStorage.setItem(KEY, JSON.stringify(db)); }, [db, ready]);

  const user = db.users.find((u) => u.id === db.session) ?? null;
  const notify = (d: DB, text: string): Notif[] => user ? [{ id: uid(), userId: user.id, text, date: new Date().toISOString(), read: false }, ...d.notifs] : d.notifs;

  const value: Ctx = {
    db, ready, user,
    login(email, pw) {
      const u = db.users.find((x) => x.email.toLowerCase() === email.toLowerCase().trim() && x.password === pw);
      if (!u) return "Correo o contraseña incorrectos";
      setDb({ ...db, session: u.id }); return null;
    },
    register(d) {
      if (db.users.some((x) => x.email.toLowerCase() === d.email.toLowerCase())) return "Ya existe una cuenta con ese correo";
      const u = { ...d, id: uid() };
      setDb({ ...db, users: [...db.users, u], session: u.id, notifs: [{ id: uid(), userId: u.id, text: "¡Bienvenido a MotoClean! Registra tu primera moto.", date: new Date().toISOString(), read: false }, ...db.notifs] });
      return null;
    },
    logout() { setDb({ ...db, session: null }); },
    updateUser(d) { setDb({ ...db, users: db.users.map((u) => (u.id === db.session ? { ...u, ...d } : u)) }); },
    saveMoto(m) {
      if (!user) return;
      if (m.id) setDb({ ...db, motos: db.motos.map((x) => (x.id === m.id ? { ...x, ...m } as Moto : x)) });
      else setDb({ ...db, motos: [...db.motos, { ...m, id: uid(), userId: user.id }] });
    },
    deleteMoto(id) { setDb({ ...db, motos: db.motos.filter((m) => m.id !== id) }); },
    createBooking({ method, ...b }) {
      const svc = SERVICES.find((s) => s.id === b.serviceId)!;
      const approved = method !== "EFECTIVO";
      const nb: Booking = {
        ...b, id: uid(), userId: user!.id, status: approved ? "CONFIRMADO" : "PENDIENTE", createdAt: new Date().toISOString(),
        payment: { method, status: approved ? "APROBADO" : "PENDIENTE", amount: svc.price, reference: "DEMO-" + uid().toUpperCase(), date: new Date().toISOString() },
      };
      setDb({ ...db, bookings: [nb, ...db.bookings], notifs: notify(db, `Reserva de ${svc.name} creada para el ${b.date} a las ${b.time}.`) });
      return nb;
    },
    cancelBooking(id) {
      setDb({ ...db, bookings: db.bookings.map((b) => (b.id === id ? { ...b, status: "CANCELADO", payment: { ...b.payment, status: "CANCELADO" } } : b)), notifs: notify(db, "Tu reserva fue cancelada.") });
    },
    advanceBooking(id) {
      const b = db.bookings.find((x) => x.id === id); if (!b) return;
      const i = STATUS_FLOW.indexOf(b.status); if (i < 0 || i >= STATUS_FLOW.length - 1) return;
      const next = STATUS_FLOW[i + 1]!;
      const washer = b.washer ?? (next === "LAVADOR_ASIGNADO" ? WASHERS[Math.floor(Math.random() * 2)]! : undefined);
      setDb({ ...db, bookings: db.bookings.map((x) => (x.id === id ? { ...x, status: next, washer, payment: { ...x.payment, status: next === "FINALIZADO" ? "APROBADO" : x.payment.status } } : x)), notifs: notify(db, `Tu servicio ahora está: ${STATUS_LABEL[next]}.`) });
    },
    rateBooking(id, rating, comment) { setDb({ ...db, bookings: db.bookings.map((b) => (b.id === id ? { ...b, rating, comment } : b)) }); },
    readNotifs() { setDb({ ...db, notifs: db.notifs.map((n) => (n.userId === db.session ? { ...n, read: true } : n)) }); },
  };
  return <C.Provider value={value}>{children}</C.Provider>;
}

export function useStore() { const c = useContext(C); if (!c) throw new Error("no store"); return c; }
export const cop = (n: number) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);
