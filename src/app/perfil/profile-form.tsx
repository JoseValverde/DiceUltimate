"use client";

// Formulario de perfil + zona de eliminación de cuenta
import { useState, useTransition } from "react";
import { guardarPerfil, eliminarCuenta } from "./actions";

const REDES: { clave: string; label: string; placeholder: string }[] = [
  { clave: "web", label: "🌐 Web", placeholder: "https://tuweb.com" },
  { clave: "instagram", label: "📸 Instagram", placeholder: "https://instagram.com/usuario" },
  { clave: "x", label: "𝕏 X / Twitter", placeholder: "https://x.com/usuario" },
  { clave: "youtube", label: "▶️ YouTube", placeholder: "https://youtube.com/@canal" },
  { clave: "twitch", label: "🎮 Twitch", placeholder: "https://twitch.tv/canal" },
];

export default function ProfileForm({
  perfil,
  email,
}: {
  perfil: {
    username: string;
    bio: string | null;
    socials: Record<string, string>;
    show_email: boolean;
  };
  email: string;
}) {
  const [pending, startTransition] = useTransition();
  const [username, setUsername] = useState(perfil.username);
  const [bio, setBio] = useState(perfil.bio ?? "");
  const [socials, setSocials] = useState<Record<string, string>>(perfil.socials ?? {});
  const [showEmail, setShowEmail] = useState(perfil.show_email);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState("");

  function guardar() {
    setMsg(null);
    setError(null);
    startTransition(async () => {
      const res = await guardarPerfil({ username, bio, socials, show_email: showEmail });
      if (res?.error) setError(res.error);
      else setMsg("Perfil guardado ✔");
    });
  }

  return (
    <div className="space-y-6">
      <section className="card space-y-3">
        <label className="block text-sm text-slate-400">
          Nombre de usuario
          <input className="input mt-1" value={username}
            onChange={(e) => setUsername(e.target.value)} />
        </label>
        <label className="block text-sm text-slate-400">
          Presentación
          <textarea className="input mt-1 min-h-24" maxLength={500}
            placeholder="Cuéntale a la comunidad quién eres…"
            value={bio} onChange={(e) => setBio(e.target.value)} />
        </label>

        <p className="text-sm font-medium text-slate-300">Redes sociales</p>
        {REDES.map((r) => (
          <label key={r.clave} className="block text-sm text-slate-400">
            {r.label}
            <input className="input mt-1" placeholder={r.placeholder}
              value={socials[r.clave] ?? ""}
              onChange={(e) => setSocials({ ...socials, [r.clave]: e.target.value })} />
          </label>
        ))}

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={showEmail}
            onChange={(e) => setShowEmail(e.target.checked)} />
          Mostrar mi email ({email}) en mi perfil público
        </label>

        {error && <p className="text-sm text-red-400">{error}</p>}
        {msg && <p className="text-sm text-emerald-400">{msg}</p>}
        <button className="btn w-full" disabled={pending} onClick={guardar}>
          Guardar perfil
        </button>
      </section>

      <section className="card space-y-3 !border-red-900">
        <h2 className="font-semibold text-red-400">Zona peligrosa</h2>
        <p className="text-sm text-slate-400">
          Eliminar tu cuenta borra <strong>todo</strong> sin dejar rastro: tus salas
          (con su historial completo), dados, tiradas, publicaciones y tu usuario.
          Esta acción no se puede deshacer.
        </p>
        <input className="input" placeholder={`Escribe "${perfil.username}" para confirmar`}
          value={confirmar} onChange={(e) => setConfirmar(e.target.value)} />
        <button
          className="btn w-full !bg-red-700 hover:!bg-red-600"
          disabled={pending || confirmar !== perfil.username}
          onClick={() => startTransition(async () => {
            const res = await eliminarCuenta();
            if (res?.error) setError(res.error);
          })}
        >
          Eliminar mi cuenta definitivamente
        </button>
      </section>
    </div>
  );
}
