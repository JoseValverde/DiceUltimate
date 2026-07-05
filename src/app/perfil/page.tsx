// Mi perfil: edición de datos públicos y eliminación de cuenta (Fase 6)
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import ProfileForm from "./profile-form";

export default async function Perfil() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: perfil } = await supabase
    .from("profiles")
    .select("username, bio, socials, show_email")
    .eq("id", user!.id)
    .single();

  return (
    <main className="mx-auto max-w-xl p-4 sm:p-8">
      <header className="mb-6">
        <Link href="/dashboard" className="text-sm text-indigo-400 hover:underline">
          ← Dashboard
        </Link>
        <h1 className="text-2xl font-bold">👤 Mi perfil</h1>
        <p className="text-sm text-slate-400">
          <Link href={`/perfil/${user!.id}`} className="text-indigo-400 hover:underline">
            Ver cómo lo ven los demás →
          </Link>
        </p>
      </header>
      <ProfileForm perfil={perfil as any} email={user!.email ?? ""} />
    </main>
  );
}
