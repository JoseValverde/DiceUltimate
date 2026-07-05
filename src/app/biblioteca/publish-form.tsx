"use client";

// Formulario de publicación: selecciona dados y tiradas propias y las empaqueta
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { publicarConfiguracion } from "./actions";

type Item = { id: string; name: string };

export default function PublishForm({
  misDados,
  misTiradas,
}: {
  misDados: Item[];
  misTiradas: Item[];
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [game, setGame] = useState("");
  const [tags, setTags] = useState("");
  const [dieIds, setDieIds] = useState<Set<string>>(new Set());
  const [rollIds, setRollIds] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState<string | null>(null);

  function toggle(set: Set<string>, id: string, setter: (s: Set<string>) => void) {
    const copia = new Set(set);
    copia.has(id) ? copia.delete(id) : copia.add(id);
    setter(copia);
  }

  function publicar() {
    setMsg(null);
    startTransition(async () => {
      const res = await publicarConfiguracion({
        title,
        game,
        tags,
        dieIds: Array.from(dieIds),
        rollIds: Array.from(rollIds),
      });
      if (res?.error) setMsg(res.error);
      else {
        setMsg("Enviado. Quedará visible cuando un administrador lo apruebe.");
        setTitle(""); setGame(""); setTags("");
        setDieIds(new Set()); setRollIds(new Set());
        router.refresh();
      }
    });
  }

  if (!abierto)
    return (
      <button className="btn" onClick={() => setAbierto(true)}>
        Publicar configuración
      </button>
    );

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Publicar configuración</h2>
        <button className="btn-ghost !px-2 !py-1" onClick={() => setAbierto(false)}>
          ✕
        </button>
      </div>
      <input className="input" placeholder="Título (ej. Set básico D&D 5e)"
        value={title} onChange={(e) => setTitle(e.target.value)} />
      <div className="grid grid-cols-2 gap-2">
        <input className="input" placeholder="Juego"
          value={game} onChange={(e) => setGame(e.target.value)} />
        <input className="input" placeholder="Etiquetas (coma)"
          value={tags} onChange={(e) => setTags(e.target.value)} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="mb-1 text-sm text-slate-400">Dados ({misDados.length})</p>
          {!misDados.length && <p className="text-xs text-slate-500">No tienes dados.</p>}
          <ul className="max-h-40 space-y-1 overflow-y-auto">
            {misDados.map((d) => (
              <li key={d.id}>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={dieIds.has(d.id)}
                    onChange={() => toggle(dieIds, d.id, setDieIds)} />
                  {d.name}
                </label>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-1 text-sm text-slate-400">Tiradas ({misTiradas.length})</p>
          {!misTiradas.length && <p className="text-xs text-slate-500">No tienes tiradas guardadas.</p>}
          <ul className="max-h-40 space-y-1 overflow-y-auto">
            {misTiradas.map((r) => (
              <li key={r.id}>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={rollIds.has(r.id)}
                    onChange={() => toggle(rollIds, r.id, setRollIds)} />
                  {r.name}
                </label>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {msg && <p className="text-sm text-amber-300">{msg}</p>}
      <button className="btn w-full" disabled={pending || !title.trim()} onClick={publicar}>
        Publicar (pendiente de moderación)
      </button>
    </div>
  );
}
