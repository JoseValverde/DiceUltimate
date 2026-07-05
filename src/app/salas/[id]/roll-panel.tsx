"use client";

// Panel de tiradas: dados rápidos, tirada compuesta y tiradas guardadas
import { useState, useTransition } from "react";
import {
  tirarDados,
  guardarTirada,
  borrarTirada,
  type DefinicionTirada,
} from "./actions";

const DADOS_RAPIDOS = [4, 6, 8, 10, 12, 20, 100];

type Guardada = { id: string; name: string; definition: DefinicionTirada };

export default function RollPanel({
  roomId,
  cerrada,
  guardadas,
}: {
  roomId: string;
  cerrada: boolean;
  guardadas: Guardada[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Constructor de tirada compuesta
  const [partes, setPartes] = useState<{ sides: number; count: number }[]>([]);
  const [modificador, setModificador] = useState(0);
  const [nombre, setNombre] = useState("");

  function tirar(def: DefinicionTirada, label?: string) {
    setError(null);
    startTransition(async () => {
      const res = await tirarDados(roomId, def, label);
      if (res?.error) setError(res.error);
    });
  }

  function agregarParte(sides: number) {
    setPartes((prev) => {
      const i = prev.findIndex((p) => p.sides === sides);
      if (i >= 0) {
        const copia = [...prev];
        copia[i] = { ...copia[i], count: copia[i].count + 1 };
        return copia;
      }
      return [...prev, { sides, count: 1 }];
    });
  }

  const textoCompuesta =
    partes.map((p) => `${p.count}d${p.sides}`).join(" + ") +
    (modificador ? ` ${modificador > 0 ? "+" : ""}${modificador}` : "");

  return (
    <section className="space-y-5">
      {cerrada && (
        <p className="rounded-lg border border-amber-800 bg-amber-950/50 p-3 text-sm text-amber-300">
          Esta sala está cerrada: no se pueden hacer tiradas.
        </p>
      )}
      {error && (
        <p className="rounded-lg border border-red-800 bg-red-950/50 p-3 text-sm text-red-300">
          {error}
        </p>
      )}

      <div className="card">
        <h2 className="mb-3 font-semibold">Tirada rápida</h2>
        <div className="flex flex-wrap gap-2">
          {DADOS_RAPIDOS.map((s) => (
            <button
              key={s}
              disabled={pending || cerrada}
              onClick={() => tirar({ parts: [{ sides: s, count: 1 }] })}
              className="btn !bg-slate-800 hover:!bg-indigo-600"
            >
              d{s}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <h2 className="mb-3 font-semibold">Tirada compuesta</h2>
        <div className="mb-3 flex flex-wrap gap-2">
          {DADOS_RAPIDOS.map((s) => (
            <button
              key={s}
              disabled={cerrada}
              onClick={() => agregarParte(s)}
              className="btn-ghost !px-3 !py-1"
            >
              +d{s}
            </button>
          ))}
          <label className="flex items-center gap-2 text-sm text-slate-400">
            Mod.
            <input
              type="number"
              className="input !w-20"
              value={modificador}
              onChange={(e) => setModificador(Number(e.target.value) || 0)}
            />
          </label>
        </div>

        {partes.length > 0 && (
          <>
            <p className="mb-3 font-mono text-indigo-300">{textoCompuesta}</p>
            <div className="flex flex-wrap gap-2">
              <button
                className="btn"
                disabled={pending || cerrada}
                onClick={() =>
                  tirar({ parts: partes, modifier: modificador }, textoCompuesta)
                }
              >
                Tirar
              </button>
              <button className="btn-ghost" onClick={() => { setPartes([]); setModificador(0); }}>
                Limpiar
              </button>
              <input
                className="input !w-40"
                placeholder="Nombre para guardar"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
              />
              <button
                className="btn-ghost"
                disabled={!nombre.trim()}
                onClick={() =>
                  startTransition(async () => {
                    await guardarTirada(roomId, nombre, {
                      parts: partes,
                      modifier: modificador,
                    });
                    setNombre("");
                  })
                }
              >
                Guardar
              </button>
            </div>
          </>
        )}
      </div>

      <div className="card">
        <h2 className="mb-3 font-semibold">Mis tiradas guardadas</h2>
        {!guardadas.length && (
          <p className="text-sm text-slate-500">
            Construye una tirada compuesta y guárdala para reutilizarla.
          </p>
        )}
        <ul className="space-y-2">
          {guardadas.map((g) => (
            <li key={g.id} className="flex items-center justify-between gap-2">
              <span className="text-sm">{g.name}</span>
              <div className="flex gap-2">
                <button
                  className="btn !px-3 !py-1"
                  disabled={pending || cerrada}
                  onClick={() => tirar(g.definition, g.name)}
                >
                  Tirar
                </button>
                <button
                  className="btn-ghost !px-3 !py-1"
                  onClick={() => startTransition(() => borrarTirada(roomId, g.id))}
                >
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
