// Perfil público de un usuario (Fase 6)
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const ETIQUETAS: Record<string, string> = {
  web: "🌐 Web",
  instagram: "📸 Instagram",
  x: "𝕏 X / Twitter",
  youtube: "▶️ YouTube",
  twitch: "🎮 Twitch",
};

export default async function PerfilPublico({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const [{ data: perfil }, { data: email }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, username, bio, socials, role, created_at")
      .eq("id", params.id)
      .single(),
    supabase.rpc("public_email", { p_user: params.id }),
  ]);
  if (!perfil) notFound();

  const socials = Object.entries((perfil.socials ?? {}) as Record<string, string>);

  return (
    <main className="mx-auto max-w-xl p-4 sm:p-8">
      <Link href="/dashboard" className="text-sm text-indigo-400 hover:underline">
        ← Dashboard
      </Link>
      <div className="card mt-3 space-y-4">
        <div>
          <h1 className="text-2xl font-bold">
            {perfil.username}
            {perfil.role === "admin" && (
              <span className="ml-2 rounded-full bg-indigo-900/60 px-2 py-0.5 text-xs text-indigo-300">
                admin
              </span>
            )}
          </h1>
          <p className="text-xs text-slate-500">
            En DiceUltimate desde {new Date(perfil.created_at).toLocaleDateString("es-ES")}
          </p>
        </div>

        {perfil.bio && <p className="whitespace-pre-wrap text-slate-300">{perfil.bio}</p>}

        {socials.length > 0 && (
          <ul className="space-y-1 text-sm">
            {socials.map(([k, url]) => (
              <li key={k}>
                <a href={url} target="_blank" rel="noopener noreferrer"
                  className="text-indigo-400 hover:underline">
                  {ETIQUETAS[k] ?? k}: {url}
                </a>
              </li>
            ))}
          </ul>
        )}

        {email && (
          <p className="text-sm text-slate-400">
            ✉️ Contacto:{" "}
            <a href={`mailto:${email}`} className="text-indigo-400 hover:underline">
              {email}
            </a>
          </p>
        )}
      </div>
    </main>
  );
}
