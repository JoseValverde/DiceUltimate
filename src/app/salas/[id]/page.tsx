// Sala en vivo: presencia, tiradas sincronizadas e historial compartido (Fase 2)
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import RollPanel from "./roll-panel";
import RoomLive, { type Miembro, type Tirada } from "./room-live";

export default async function Sala({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: sala } = await supabase
    .from("rooms")
    .select("id, name, game, status, invite_code, host_id")
    .eq("id", params.id)
    .single();
  if (!sala) notFound();

  const [{ data: perfil }, { data: miembros }, { data: historial }, { data: guardadas }] =
    await Promise.all([
      supabase.from("profiles").select("username").eq("id", user!.id).single(),
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

  // Normalizar datos anidados para los componentes cliente
  const listaMiembros: Miembro[] = (miembros ?? []).map((m: any) => ({
    user_id: m.user_id,
    role: m.role,
    muted: m.muted,
    username: m.profiles?.username ?? "¿?",
  }));
  const tiradasIniciales: Tirada[] = (historial ?? []).map((t: any) => ({
    id: t.id,
    user_id: t.user_id,
    definition: t.definition,
    results: t.results,
    total: t.total,
    created_at: t.created_at,
    username: t.profiles?.username ?? "¿?",
  }));

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

      <RoomLive
        roomId={sala.id}
        userId={user!.id}
        username={perfil?.username ?? "¿?"}
        miembros={listaMiembros}
        tiradasIniciales={tiradasIniciales}
      >
        <RollPanel
          roomId={sala.id}
          cerrada={sala.status === "closed"}
          guardadas={(guardadas as any) ?? []}
        />
      </RoomLive>
    </main>
  );
}
