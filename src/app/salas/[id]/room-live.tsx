"use client";

// Fase 2 — Tiempo real: presencia de jugadores + historial en vivo.
// Un solo canal por sala: Presence (conectados) y postgres_changes (tiradas).
import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SIMBOLOS, iconoDeClave, type Simbolo } from "@/lib/dice/catalog";
import { gestionarMiembro, invitarMiembro } from "./actions";

export type Miembro = {
  user_id: string;
  role: string;
  muted: boolean;
  username: string;
};

export type Tirada = {
  id: string;
  user_id: string;
  definition: any;
  results: { die: string; value?: number; symbol?: string }[];
  total: number | null;
  symbols: Record<string, number> | null;
  created_at: string;
  username: string;
};

function textoResultado(r: {
  die: string;
  value?: number;
  symbol?: string;
  label?: string;
}) {
  let cara: string;
  if (r.value !== undefined) {
    cara = String(r.value);
  } else {
    const icono = SIMBOLOS[r.symbol as Simbolo]?.icon ?? r.symbol ?? "?";
    cara = r.label ? `${icono} ${r.label}` : icono;
  }
  return `${r.die}→${cara}`;
}

export default function RoomLive({
  roomId,
  userId,
  username,
  soyHost,
  miembros,
  tiradasIniciales,
  children,
}: {
  roomId: string;
  userId: string;
  username: string;
  soyHost: boolean;
  miembros: Miembro[];
  tiradasIniciales: Tirada[];
  children: React.ReactNode; // Panel de tiradas (columna izquierda)
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [tiradas, setTiradas] = useState<Tirada[]>(tiradasIniciales);
  const [conectados, setConectados] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [invitado, setInvitado] = useState("");
  const [msgInvitar, setMsgInvitar] = useState<string | null>(null);

  function moderar(targetId: string, cambios: { muted?: boolean; banned?: boolean }) {
    startTransition(async () => {
      await gestionarMiembro(roomId, targetId, cambios);
      router.refresh();
    });
  }

  function invitar() {
    if (!invitado.trim()) return;
    setMsgInvitar(null);
    startTransition(async () => {
      const res = await invitarMiembro(roomId, invitado.trim());
      if (res?.error) setMsgInvitar(res.error);
      else {
        setMsgInvitar(`${res.username} añadido a la sala ✔`);
        setInvitado("");
        router.refresh();
      }
    });
  }

  useEffect(() => {
    // Mapa user_id → username para resolver el autor de cada tirada
    const nombres = new Map(miembros.map((m) => [m.user_id, m.username]));

    const canal = supabase
      .channel(`room:${roomId}`, { config: { presence: { key: userId } } })
      // Presencia: quién está conectado ahora mismo
      .on("presence", { event: "sync" }, () => {
        setConectados(new Set(Object.keys(canal.presenceState())));
      })
      // Tiradas nuevas en vivo (INSERT en roll_history de esta sala)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "roll_history",
          filter: `room_id=eq.${roomId}`,
        },
        async (payload) => {
          const fila = payload.new as any;
          let autor: string = nombres.get(fila.user_id) ?? "";
          if (!autor) {
            // Miembro que entró después de cargar la página
            const { data } = await supabase
              .from("profiles")
              .select("username")
              .eq("id", fila.user_id)
              .single();
            autor = (data?.username as string) ?? "¿?";
            nombres.set(fila.user_id, autor);
          }
          setTiradas((prev) =>
            prev.some((t) => t.id === fila.id)
              ? prev
              : [{ ...fila, username: autor }, ...prev].slice(0, 100)
          );
        }
      )
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") await canal.track({ username });
      });

    return () => {
      supabase.removeChannel(canal);
    };
  }, [supabase, roomId, userId, username, miembros]);

  return (
    <>
      {/* Jugadores: punto verde = conectado ahora */}
      <div className="mb-6 flex flex-wrap gap-2 text-sm">
        {miembros.map((m) => (
          <span
            key={m.user_id}
            className="flex items-center gap-1.5 rounded-full bg-slate-800 px-3 py-1"
          >
            <span
              className={`h-2 w-2 rounded-full ${
                conectados.has(m.user_id) ? "bg-emerald-400" : "bg-slate-600"
              }`}
            />
            <Link href={`/perfil/${m.user_id}`} className="hover:text-indigo-300">
              {m.username}
            </Link>
            {m.role === "host" && " 👑"}
            {m.muted && " 🔇"}
            {soyHost && m.user_id !== userId && (
              <span className="ml-1 flex gap-1">
                <button
                  title={m.muted ? "Quitar silencio" : "Silenciar"}
                  disabled={pending}
                  className="text-xs opacity-60 transition hover:opacity-100"
                  onClick={() => moderar(m.user_id, { muted: !m.muted })}
                >
                  {m.muted ? "🔊" : "🔇"}
                </button>
                <button
                  title="Expulsar de la sala"
                  disabled={pending}
                  className="text-xs opacity-60 transition hover:opacity-100"
                  onClick={() => {
                    if (confirm(`¿Expulsar a ${m.username}? No podrá volver a entrar.`))
                      moderar(m.user_id, { banned: true });
                  }}
                >
                  ⛔
                </button>
              </span>
            )}
          </span>
        ))}
      </div>

      {/* Invitación directa (solo anfitrión) */}
      {soyHost && (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <input
            className="input !w-64"
            placeholder="Invitar por usuario o email…"
            value={invitado}
            onChange={(e) => setInvitado(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && invitar()}
          />
          <button className="btn" disabled={pending || !invitado.trim()} onClick={invitar}>
            Invitar
          </button>
          {msgInvitar && (
            <span
              className={`text-sm ${
                msgInvitar.includes("✔") ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {msgInvitar}
            </span>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {children}

        <section>
          <h2 className="mb-3 font-semibold">Historial en vivo</h2>
          <ul className="space-y-2">
            {!tiradas.length && (
              <p className="text-sm text-slate-500">Todavía no hay tiradas.</p>
            )}
            {tiradas.map((t) => (
              <li key={t.id} className="card !p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{t.username}</span>
                  <span className="text-xs text-slate-500">
                    {new Date(t.created_at).toLocaleTimeString("es-ES")}
                  </span>
                </div>
                <p className="mt-1 text-slate-300">
                  {t.definition?.label && (
                    <span className="text-indigo-300">{t.definition.label}: </span>
                  )}
                  {t.results?.map(textoResultado).join("  ")}
                  {t.definition?.modifier
                    ? ` (${t.definition.modifier > 0 ? "+" : ""}${t.definition.modifier})`
                    : ""}
                </p>
                {t.total !== null && (
                  <p className="text-lg font-bold text-emerald-300">Total: {t.total}</p>
                )}
                {t.symbols && (
                  <p className="text-sm font-medium text-amber-300">
                    {Object.entries(t.symbols)
                      .map(([clave, n]) => {
                        const icono = iconoDeClave(clave, t.results);
                        const nombre = SIMBOLOS[clave as Simbolo]?.label ?? clave;
                        return `${icono} ${nombre} ×${n}`;
                      })
                      .join(" · ")}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
