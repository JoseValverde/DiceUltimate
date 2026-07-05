// Biblioteca comunitaria: buscar, publicar, clonar, moderar (Fase 4)
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import PublishForm from "./publish-form";
import ItemCard, { type ItemBiblioteca } from "./item-card";

export default async function Biblioteca({
  searchParams,
}: {
  searchParams: { q?: string; tag?: string };
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: perfil } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user!.id)
    .single();
  const esAdmin = perfil?.role === "admin";

  // Públicas (aprobadas/destacadas) con búsqueda y filtro por etiqueta
  let query = supabase
    .from("library_items")
    .select("id, title, game, tags, status, clones, author_id, content, profiles(username)")
    .in("status", ["approved", "featured"])
    .order("status", { ascending: false }) // featured primero
    .order("clones", { ascending: false })
    .limit(60);
  if (searchParams.q)
    query = query.or(`title.ilike.%${searchParams.q}%,game.ilike.%${searchParams.q}%`);
  if (searchParams.tag) query = query.contains("tags", [searchParams.tag]);

  const [{ data: publicas }, { data: mias }, pendientes, { data: misDados }, { data: misTiradas }] =
    await Promise.all([
      query,
      supabase
        .from("library_items")
        .select("id, title, game, tags, status, clones, author_id, content, profiles(username)")
        .eq("author_id", user!.id)
        .order("created_at", { ascending: false }),
      esAdmin
        ? supabase
            .from("library_items")
            .select("id, title, game, tags, status, clones, author_id, content, profiles(username)")
            .eq("status", "pending")
            .order("created_at")
        : Promise.resolve({ data: [] as any[] }),
      supabase.from("dice").select("id, name").eq("owner_id", user!.id).order("name"),
      supabase.from("saved_rolls").select("id, name").order("name"),
    ]);

  const normaliza = (arr: any[] | null): ItemBiblioteca[] =>
    (arr ?? []).map((i: any) => ({ ...i, username: i.profiles?.username ?? "¿?" }));

  return (
    <main className="mx-auto max-w-4xl p-4 sm:p-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/dashboard" className="text-sm text-indigo-400 hover:underline">
            ← Dashboard
          </Link>
          <h1 className="text-2xl font-bold">📚 Biblioteca comunitaria</h1>
          <p className="text-sm text-slate-400">
            Usa configuraciones de otros jugadores o comparte las tuyas.
          </p>
        </div>
        <PublishForm misDados={misDados ?? []} misTiradas={misTiradas ?? []} />
      </header>

      <form className="mb-6 flex gap-2">
        <input
          className="input"
          name="q"
          placeholder="Buscar por título o juego…"
          defaultValue={searchParams.q ?? ""}
        />
        <input
          className="input !w-40"
          name="tag"
          placeholder="Etiqueta"
          defaultValue={searchParams.tag ?? ""}
        />
        <button className="btn">Buscar</button>
      </form>

      {esAdmin && normaliza(pendientes.data as any[]).length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 font-semibold text-amber-300">
            Pendientes de moderación ({(pendientes.data as any[]).length})
          </h2>
          <ul className="space-y-2">
            {normaliza(pendientes.data as any[]).map((i) => (
              <ItemCard key={i.id} item={i} esAdmin esMio={i.author_id === user!.id} />
            ))}
          </ul>
        </section>
      )}

      <section className="mb-8">
        <h2 className="mb-3 font-semibold">Configuraciones públicas</h2>
        {!publicas?.length && (
          <p className="text-sm text-slate-500">
            No hay resultados{searchParams.q ? " para esa búsqueda" : " todavía"}.
          </p>
        )}
        <ul className="space-y-2">
          {normaliza(publicas as any[]).map((i) => (
            <ItemCard key={i.id} item={i} esAdmin={esAdmin} esMio={i.author_id === user!.id} />
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-3 font-semibold">Mis publicaciones</h2>
        {!mias?.length && (
          <p className="text-sm text-slate-500">Aún no has publicado nada.</p>
        )}
        <ul className="space-y-2">
          {normaliza(mias as any[]).map((i) => (
            <ItemCard key={i.id} item={i} esAdmin={esAdmin} esMio />
          ))}
        </ul>
      </section>
    </main>
  );
}
