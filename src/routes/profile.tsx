import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { AppShell } from "@/components/AppShell";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "Mi perfil – MotoClean" }, { name: "description", content: "Gestiona tus datos personales." }, { property: "og:title", content: "Mi perfil – MotoClean" }, { property: "og:description", content: "Tus datos personales." }] }),
  component: () => <AppShell title="Mi perfil"><Profile /></AppShell>,
});

function Profile() {
  const { user, updateUser } = useStore();
  const [f, setF] = useState({ name: user!.name, phone: user!.phone });
  const [msg, setMsg] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!/^\d{10}$/.test(f.phone)) return setMsg("El teléfono debe tener 10 dígitos");
    updateUser(f); setMsg("Datos guardados ✓");
  };
  return (
    <form onSubmit={submit} className="card max-w-md space-y-4">
      <div><label className="label">Correo</label><input className="input opacity-60" disabled value={user!.email} /></div>
      <div><label className="label">Nombre</label><input required className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
      <div><label className="label">Teléfono</label><input required className="input" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
      {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
      <button className="btn-primary">Guardar</button>
    </form>
  );
}
