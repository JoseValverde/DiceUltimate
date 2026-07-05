// Editor de dados personalizados (Fase 3)
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import DiceEditor from "./dice-editor";

export default async function Dados() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: dados } = await supabase
    .from("dice")
    .select("id, name, faces")
    .eq("owner_id", user!.id)
    .order("created_at", { ascending: false });

  return (
    <main className="mx-auto max-w-4xl p-4 sm:p-8">
      <header className="mb-6">
        <Link href="/dashboard" className="text-sm text-indigo-400 hover:underline">
          ← Dashboard
        </Link>
        <h1 className="text-2xl font-bold">Mis dados personalizados</h1>
        <p className="text-sm text-slate-400">
          Define caras con números o símbolos y úsalos en tus salas.
        </p>
      </header>
      <DiceEditor dados={(dados as any) ?? []} />
    </main>
  );
}
