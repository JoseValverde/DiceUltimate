"use client";

// Edición de la sala por el anfitrión: nombre, sistema de juego y descripción
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { editarSala } from "./actions";

export default function EditRoom({
  roomId,
  name,
  game,
  description,
}: {
  roomId: string;
  name: string;
  game: string | null;
  description: string | null;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [pending, startTransition] = useTransition();
  const [nombre, setNombre] = useState(name);
  const [sistema, setSistema] = useState(game ?? "");
  const [descripcion, setDescripcion] = useState(description ?? "");
  const [error, setError] = useState<string | null>(null);

  if (!abierto)
    return (
      <button className="btn-ghost !px-3 !py-1 text-sm" onClick={() => setAbierto(true)}>
        ✏️ Editar sala
      </button>
    );

  return (
    <div className="card w-full space-y-3 sm:max-w-md">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Editar sala</h2>
        <button className="btn-ghost !px-2 !py-1" onClick={() => setAbierto(false)}>
          ✕
        </button>
      </div>
      <label className="block text-sm text-slate-400">
        Nombre
        <input className="input mt-1" value={nombre}
          onChange={(e) => setNombre(e.target.value)} />
      </label>
      <label className="block text-sm text-slate-400">
        Sistema / juego
        <input className="input mt-1" placeholder="D&D 5e, Vampiro, propio…"
          value={sistema} onChange={(e) => setSistema(e.target.value)} />
      </label>
      <label className="block text-sm text-slate-400">
        Descripción breve
        <textarea className="input mt-1 min-h-20" maxLength={300}
          placeholder="De qué va la partida, horario, normas…"
          value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
      </label>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        className="btn w-full"
        disabled={pending || !nombre.trim()}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const res = await editarSala(roomId, {
              name: nombre,
              game: sistema,
              description: descripcion,
            });
            if (res?.error) setError(res.error);
            else {
              setAbierto(false);
              router.refresh();
            }
          });
        }}
      >
        Guardar cambios
      </button>
    </div>
  );
}
