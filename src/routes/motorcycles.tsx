import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Bike, Pencil, Plus, Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useStore, type Moto } from "@/lib/store";

export const Route = createFileRoute("/motorcycles")({
  head: () => ({ meta: [{ title: "Mis motos – MotoClean" }, { name: "description", content: "Registra y gestiona tus motocicletas." }, { property: "og:title", content: "Mis motos – MotoClean" }, { property: "og:description", content: "Gestiona tus motocicletas." }] }),
  component: () => <AppShell title="Mis motocicletas"><Motos /></AppShell>,
});

const empty = { brand: "", model: "", year: 2024, plate: "", color: "", cc: 150 };

function Motos() {
  const { db, user, saveMoto, deleteMoto } = useStore();
  const motos = db.motos.filter((m) => m.userId === user!.id);
  const [form, setForm] = useState<(typeof empty & { id?: string }) | null>(null);
  const [err, setErr] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault(); if (!form) return;
    const plate = form.plate.toUpperCase().replace(/\s/g, "");
    if (!/^[A-Z]{3}\d{2}[A-Z]?$/.test(plate)) return setErr("Placa inválida (ej: ABC12D)");
    if (form.year < 1970 || form.year > 2027) return setErr("Año inválido");
    if (db.motos.some((m) => m.plate === plate && m.id !== form.id)) return setErr("Esa placa ya está registrada");
    saveMoto({ ...form, plate }); setForm(null); setErr("");
  };
  const f = (k: keyof typeof empty, num = false) => ({
    value: form ? String(form[k]) : "",
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form!, [k]: num ? Number(e.target.value) : e.target.value }),
  });

  return (
    <div className="space-y-6">
      {!form && <button className="btn-primary" onClick={() => setForm(empty)}><Plus className="h-4 w-4" />Agregar moto</button>}
      {form && (
        <form onSubmit={submit} className="card grid gap-4 md:grid-cols-3">
          <div><label className="label">Marca</label><input required className="input" {...f("brand")} /></div>
          <div><label className="label">Modelo</label><input required className="input" {...f("model")} /></div>
          <div><label className="label">Año</label><input type="number" required className="input" {...f("year", true)} /></div>
          <div><label className="label">Placa</label><input required className="input uppercase" {...f("plate")} /></div>
          <div><label className="label">Color</label><input required className="input" {...f("color")} /></div>
          <div><label className="label">Cilindraje (cc)</label><input type="number" min={50} required className="input" {...f("cc", true)} /></div>
          {err && <p className="text-sm text-destructive md:col-span-3">{err}</p>}
          <div className="flex gap-2 md:col-span-3"><button className="btn-primary">Guardar</button><button type="button" className="btn-ghost" onClick={() => { setForm(null); setErr(""); }}>Cancelar</button></div>
        </form>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {motos.length === 0 && <p className="text-muted-foreground">Aún no registras motos.</p>}
        {motos.map((m: Moto) => (
          <div key={m.id} className="card flex items-center gap-4">
            <div className="grid h-12 w-12 place-items-center rounded-lg bg-primary/15"><Bike className="h-6 w-6 text-primary" /></div>
            <div className="flex-1">
              <p className="font-semibold">{m.brand} {m.model} <span className="text-muted-foreground">· {m.year}</span></p>
              <p className="text-sm text-muted-foreground">{m.plate} · {m.color} · {m.cc}cc</p>
            </div>
            <button aria-label="Editar" className="btn-ghost px-2.5" onClick={() => setForm(m)}><Pencil className="h-4 w-4" /></button>
            <button aria-label="Eliminar" className="btn-ghost px-2.5" onClick={() => confirm("¿Eliminar esta moto?") && deleteMoto(m.id)}><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
      </div>
    </div>
  );
}
