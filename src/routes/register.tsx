import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Logo } from "@/components/AppShell";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/register")({
  head: () => ({ meta: [{ title: "Crear cuenta – MotoClean" }, { name: "description", content: "Regístrate y agenda tu primer lavado a domicilio." }, { property: "og:title", content: "Crear cuenta – MotoClean" }, { property: "og:description", content: "Regístrate en MotoClean." }] }),
  component: Register,
});

function Register() {
  const { register } = useStore();
  const nav = useNavigate();
  const [f, setF] = useState({ name: "", email: "", phone: "", password: "", confirm: "" });
  const [err, setErr] = useState("");
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (f.name.trim().length < 3) return setErr("Ingresa tu nombre completo");
    if (!/^\d{10}$/.test(f.phone)) return setErr("El teléfono debe tener 10 dígitos");
    if (f.password.length < 8) return setErr("La contraseña debe tener al menos 8 caracteres");
    if (f.password !== f.confirm) return setErr("Las contraseñas no coinciden");
    const r = register({ name: f.name.trim(), email: f.email.trim(), phone: f.phone, password: f.password });
    if (r) setErr(r); else nav({ to: "/dashboard" });
  };
  return (
    <div className="grid min-h-screen place-items-center px-4 py-10">
      <form onSubmit={submit} className="card w-full max-w-sm space-y-4">
        <Logo />
        <h1 className="text-2xl font-bold">Crear cuenta</h1>
        <div><label className="label" htmlFor="n">Nombre completo</label><input id="n" required className="input" value={f.name} onChange={set("name")} /></div>
        <div><label className="label" htmlFor="e">Correo</label><input id="e" type="email" required className="input" value={f.email} onChange={set("email")} /></div>
        <div><label className="label" htmlFor="t">Teléfono</label><input id="t" inputMode="numeric" required className="input" value={f.phone} onChange={set("phone")} /></div>
        <div><label className="label" htmlFor="p">Contraseña</label><input id="p" type="password" required className="input" value={f.password} onChange={set("password")} /></div>
        <div><label className="label" htmlFor="c">Confirmar contraseña</label><input id="c" type="password" required className="input" value={f.confirm} onChange={set("confirm")} /></div>
        {err && <p className="text-sm text-destructive">{err}</p>}
        <button className="btn-primary w-full">Registrarme</button>
        <p className="text-center text-sm text-muted-foreground">¿Ya tienes cuenta? <Link to="/login" className="text-primary">Ingresa</Link></p>
      </form>
    </div>
  );
}
