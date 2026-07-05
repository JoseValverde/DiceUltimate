"use client";

// Login y registro: email/contraseña + Google OAuth
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [modo, setModo] = useState<"login" | "registro">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setAviso(null);
    setCargando(true);
    if (modo === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError("Credenciales incorrectas");
      else { router.push("/dashboard"); router.refresh(); }
    } else {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setError(error.message);
      else setAviso("Revisa tu correo para confirmar la cuenta.");
    }
    setCargando(false);
  }

  async function conGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${location.origin}/auth/callback` },
    });
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="card w-full max-w-sm">
        <h1 className="mb-1 text-2xl font-bold">🎲 DiceUltimate</h1>
        <p className="mb-6 text-sm text-slate-400">
          {modo === "login" ? "Inicia sesión para jugar" : "Crea tu cuenta"}
        </p>

        <form onSubmit={onSubmit} className="space-y-3">
          <input className="input" type="email" placeholder="Email" required
            value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="input" type="password" placeholder="Contraseña (mín. 6)"
            required minLength={6}
            value={password} onChange={(e) => setPassword(e.target.value)} />
          {error && <p className="text-sm text-red-400">{error}</p>}
          {aviso && <p className="text-sm text-emerald-400">{aviso}</p>}
          <button className="btn w-full" disabled={cargando}>
            {modo === "login" ? "Entrar" : "Registrarme"}
          </button>
        </form>

        <button onClick={conGoogle} className="btn-ghost mt-3 w-full">
          Continuar con Google
        </button>

        <button
          onClick={() => setModo(modo === "login" ? "registro" : "login")}
          className="mt-4 w-full text-center text-sm text-indigo-400 hover:underline"
        >
          {modo === "login" ? "¿Sin cuenta? Regístrate" : "¿Ya tienes cuenta? Entra"}
        </button>
      </div>
    </main>
  );
}
