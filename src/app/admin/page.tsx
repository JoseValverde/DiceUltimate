// Panel de administración (Fase 5): usuarios, roles y estadísticas
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import UsersTable from "./users-table";

export default async function Admin() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: perfil } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user!.id)
    .single();
  if (perfil?.role !== "admin") redirect("/dashboard");

  const [usuarios, salas, dados, tiradas, biblioteca, pendientes] = await Promise.all([
    supabase.from("profiles").select("id, username, role, created_at").order("created_at"),
    supabase.from("rooms").select("id", { count: "exact", head: true }),
    supabase.from("dice").select("id", { count: "exact", head: true }),
    supabase.from("roll_history").select("id", { count: "exact", head: true }),
    supabase.from("library_items").select("id", { count: "exact", head: true }),
    supabase
      .from("library_items")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
  ]);

  const stats = [
    { label: "Usuarios", valor: usuarios.data?.length ?? 0 },
    { label: "Salas", valor: salas.count ?? 0 },
    { label: "Dados", valor: dados.count ?? 0 },
    { label: "Tiradas", valor: tiradas.count ?? 0 },
    { label: "En biblioteca", valor: biblioteca.count ?? 0 },
    { label: "Pend. moderar", valor: pendientes.count ?? 0 },
  ];

  return (
    <main className="mx-auto max-w-4xl p-4 sm:p-8">
      <header className="mb-6">
        <Link href="/dashboard" className="text-sm text-indigo-400 hover:underline">
          ← Dashboard
        </Link>
        <h1 className="text-2xl font-bold">⚙️ Administración</h1>
      </header>

      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map((s) => (
          <div key={s.label} className="card !p-3 text-center">
            <p className="text-2xl font-bold text-indigo-300">{s.valor}</p>
            <p className="text-xs text-slate-400">{s.label}</p>
          </div>
        ))}
      </div>

      {(pendientes.count ?? 0) > 0 && (
        <p className="mb-6 rounded-lg border border-amber-800 bg-amber-950/50 p-3 text-sm text-amber-300">
          Hay {pendientes.count} configuraciones pendientes de moderación en la{" "}
          <Link href="/biblioteca" className="underline">
            biblioteca
          </Link>
          .
        </p>
      )}

      <h2 className="mb-3 font-semibold">Usuarios</h2>
      <UsersTable usuarios={(usuarios.data as any) ?? []} miId={user!.id} />
    </main>
  );
}
