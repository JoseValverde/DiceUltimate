// Dashboard: mis salas, crear sala y unirse por código
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { crearSala, unirseSala, cerrarSesion } from "./actions";

export default async function Dashboard({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: profile }, { data: salas }] = await Promise.all([
    supabase.from("profiles").select("username, role").eq("id", user!.id).single(),
    supabase
      .from("rooms")
      .select("id, name, game, status, invite_code, host_id, created_at")
      .order("created_at", { ascending: false }),
  ]);

  return (
    <main className="mx-auto max-w-3xl p-4 sm:p-8">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">🎲 DiceUltimate</h1>
          <p className="text-sm text-slate-400">
            Hola, <span className="text-slate-200">{profile?.username}</span>
            {profile?.role === "admin" && " · admin"}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/biblioteca" className="btn-ghost">
            📚 Biblioteca
          </Link>
          <Link href="/dados" className="btn-ghost">
            🎲 Mis dados
          </Link>
          <form action={cerrarSesion}>
            <button className="btn-ghost">Salir</button>
          </form>
        </div>
      </header>

      {searchParams.error && (
        <p className="mb-4 rounded-lg border border-red-800 bg-red-950/50 p-3 text-sm text-red-300">
          {searchParams.error}
        </p>
      )}

      <div className="mb-8 grid gap-4 sm:grid-cols-2">
        <form action={crearSala} className="card space-y-3">
          <h2 className="font-semibold">Crear sala privada</h2>
          <input className="input" name="name" placeholder="Nombre de la sala" required />
          <input className="input" name="game" placeholder="Juego (opcional)" />
          <button className="btn w-full">Crear</button>
        </form>

        <form action={unirseSala} className="card space-y-3">
          <h2 className="font-semibold">Unirse con código</h2>
          <input className="input" name="code" placeholder="Código de invitación" required />
          <button className="btn w-full">Unirme</button>
          <p className="text-xs text-slate-500">
            Pide el código al anfitrión de la partida.
          </p>
        </form>
      </div>

      <h2 className="mb-3 font-semibold">Mis salas</h2>
      {!salas?.length && (
        <p className="text-sm text-slate-500">Aún no participas en ninguna sala.</p>
      )}
      <ul className="space-y-2">
        {salas?.map((s) => (
          <li key={s.id}>
            <Link
              href={`/salas/${s.id}`}
              className="card flex items-center justify-between transition hover:border-indigo-600"
            >
              <div>
                <p className="font-medium">{s.name}</p>
                <p className="text-xs text-slate-500">
                  {s.game || "Sin juego"} ·{" "}
                  {s.host_id === user!.id ? "Anfitrión" : "Jugador"}
                </p>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  s.status === "open"
                    ? "bg-emerald-900/60 text-emerald-300"
                    : "bg-slate-800 text-slate-400"
                }`}
              >
                {s.status === "open" ? "Abierta" : "Cerrada"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
