import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Logo } from "@/components/AppShell";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Iniciar sesión – MotoClean" }, { name: "description", content: "Ingresa a tu cuenta MotoClean." }, { property: "og:title", content: "Iniciar sesión – MotoClean" }, { property: "og:description", content: "Ingresa a tu cuenta MotoClean." }] }),
  component: Login,
});

function Login() {
  const { login } = useStore();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const r = login(email, pw);
    if (r) setErr(r); else nav({ to: "/dashboard" });
  };
  return (
    <div className="grid min-h-screen place-items-center px-4">
      <form onSubmit={submit} className="card w-full max-w-sm space-y-4">
        <Logo />
        <h1 className="text-2xl font-bold">Iniciar sesión</h1>
        <div><label className="label" htmlFor="e">Correo</label><input id="e" type="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div><label className="label" htmlFor="p">Contraseña</label><input id="p" type="password" required className="input" value={pw} onChange={(e) => setPw(e.target.value)} /></div>
        {err && <p className="text-sm text-destructive">{err}</p>}
        <button className="btn-primary w-full">Entrar</button>
        <button type="button" className="btn-ghost w-full" onClick={() => { setEmail("cliente@demo.com"); setPw("demo1234"); }}>Usar cuenta DEMO</button>
        <p className="text-center text-sm text-muted-foreground">¿Sin cuenta? <Link to="/register" className="text-primary">Regístrate</Link></p>
        <p className="text-center text-sm text-muted-foreground">¿Eres lavador? <Link to="/washer" className="text-primary">Entra al panel del lavador</Link></p>
      </form>
    </div>
  );
}
