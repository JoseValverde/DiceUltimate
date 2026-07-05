// Sala: panel de tiradas + historial persistido (realtime llega en Fase 2)
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import RollPanel from "./roll-panel";

export default async function Sala({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: sala } = await supabase
    .from("rooms")
    .select("id, name, game, status, invite_code, host_id")
    .eq("id", params.id)
    .single();
  if (!sala) notFound();

  const [{ data: miembros }, { data: historial }, { data: guardadas }] =
    await Promise.all([
      supabase
        .from("room_members")
        .select("user_id, role, muted, profiles(username)")
        .eq("room_id", sala.id)
        .eq("banned", false),
      supabase
        .from("roll_history")
        .select("id, user_id, definition, results, total, created_at, profiles(username)")
        .eq("room_id", sala.id)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase.from("saved_rolls").select("id, name, definition").order("name"),
    ]);

  const soyHost = sala.host_id === user!.id;

  return (
    <main className="mx-auto max-w-4xl p-4 sm:p-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/dashboard" className="text-sm text-indigo-400 hover:underline">
            ← Dashboard
          </Link>
          <h1 className="text-2xl font-bold">{sala.name}</h1>
          <p className="text-sm text-slate-400">{sala.game || "Sin juego asociado"}</p>
        </div>
        {soyHost && (
          <div className="card !p-3 text-sm">
            <p className="text-slate-400">Código de invitación</p>
            <p className="font-mono text-lg tracking-wider text-indigo-300">
              {sala.invite_code}
            </p>
          </div>
        )}
      </header>

      <div className="mb-6 flex flex-wrap gap-2 text-sm">
        {miembros?.map((m: any) => (
          <span key={m.user_id} className="rounded-full bg-slate-800 px-3 py-1">
            {m.profiles?.username}
            {m.role === "host" && " 👑"}
            {m.muted && " 🔇"}
          </span>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <RollPanel
          roomId={sala.id}
          cerrada={sala.status === "closed"}
          guardadas={(guardadas as any) ?? []}
        />

        <section>
          <h2 className="mb-3 font-semibold">Historial</h2>
          <ul className="space-y-2">
            {!historial?.length && (
              <p className="text-sm text-slate-500">Todavía no hay tiradas.</p>
            )}
            {historial?.map((t: any) => (
              <li key={t.id} className="card !p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{t.profiles?.username}</span>
                  <span className="text-xs text-slate-500">
                    {new Date(t.created_at).toLocaleTimeString("es-ES")}
                  </span>
                </div>
                <p className="mt-1 text-slate-300">
                  {t.definition?.label && (
                    <span className="text-indigo-300">{t.definition.label}: </span>
                  )}
                  {t.results
                    ?.map((r: any) => `${r.die}→${r.value}`)
                    .join("  ")}
                  {t.definition?.modifier ? ` (${t.definition.modifier > 0 ? "+" : ""}${t.definition.modifier})` : ""}
                </p>
                <p className="text-lg font-bold text-emerald-300">Total: {t.total}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
