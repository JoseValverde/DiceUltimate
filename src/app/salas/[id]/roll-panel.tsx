"use client";

// Panel de tiradas: dados rápidos, dados personalizados, tirada compuesta y guardadas
import { useState, useTransition } from "react";
import Link from "next/link";
import {
  tirarDados,
  guardarTirada,
  borrarTirada,
  toggleDadoSala,
  type DefinicionTirada,
  type ParteTirada,
} from "./actions";

const DADOS_RAPIDOS = [4, 6, 8, 10, 12, 20, 100];

export type DadoPersonalizado = { id: string; name: string; faces: any[] };
type Guardada = { id: string; name: string; definition: DefinicionTirada };

export default function RollPanel({
  roomId,
  cerrada,
  soyHost,
  guardadas,
  misDados,
  dadosSala,
}: {
  roomId: string;
  cerrada: boolean;
  soyHost: boolean;
  guardadas: Guardada[];
  misDados: DadoPersonalizado[];
  dadosSala: DadoPersonalizado[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [partes, setPartes] = useState<ParteTirada[]>([]);
  const [modificador, setModificador] = useState(0);
  const [nombre, setNombre] = useState("");

  const idsSala = new Set(dadosSala.map((d) => d.id));
  // Dados personalizados que puedo usar aquí: los míos + los habilitados en la sala
  const usables = [
    ...misDados,
    ...dadosSala.filter((d) => !misDados.some((m) => m.id === d.id)),
  ];

  function tirar(def: DefinicionTirada, label?: string) {
    setError(null);
    startTransition(async () => {
      const res = await tirarDados(roomId, def, label);
      if (res?.error) setError(res.error);
    });
  }

  function agregarParte(parte: ParteTirada) {
    setPartes((prev) => {
      const clave = "die_id" in parte ? parte.die_id : `d${parte.sides}`;
      const i = prev.findIndex(
        (p) => ("die_id" in p ? p.die_id : `d${(p as any).sides}`) === clave
      );
      if (i >= 0) {
        const copia = [...prev];
        copia[i] = { ...copia[i], count: copia[i].count + 1 };
        return copia;
      }
      return [...prev, parte];
    });
  }

  const textoCompuesta =
    partes
      .map((p) =>
        "die_id" in p ? `${p.count}×${p.nombre ?? "dado"}` : `${p.count}d${p.sides}`
      )
      .join(" + ") +
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
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Dados personalizados</h2>
          <Link href="/dados" className="text-xs text-indigo-400 hover:underline">
            Editar mis dados →
          </Link>
        </div>
        {!usables.length && (
          <p className="text-sm text-slate-500">
            Crea dados con símbolos en{" "}
            <Link href="/dados" className="text-indigo-400 hover:underline">
              Mis dados
            </Link>
            .
          </p>
        )}
        <ul className="space-y-2">
          {usables.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-2">
              <span className="text-sm">
                {d.name}{" "}
                <span className="text-xs text-slate-500">({d.faces.length}c)</span>
                {idsSala.has(d.id) && (
                  <span className="ml-1 text-xs text-emerald-400">· en sala</span>
                )}
              </span>
              <div className="flex gap-2">
                <button
                  className="btn !px-3 !py-1"
                  disabled={pending || cerrada}
                  onClick={() =>
                    tirar(
                      { parts: [{ die_id: d.id, count: 1, nombre: d.name }] },
                      d.name
                    )
                  }
                >
                  Tirar
                </button>
                <button
                  className="btn-ghost !px-3 !py-1"
                  disabled={cerrada}
                  onClick={() =>
                    agregarParte({ die_id: d.id, count: 1, nombre: d.name })
                  }
                >
                  + compuesta
                </button>
                {soyHost && misDados.some((m) => m.id === d.id) && (
                  <button
                    className="btn-ghost !px-3 !py-1"
                    title={
                      idsSala.has(d.id)
                        ? "Quitar de la sala"
                        : "Compartir con la sala"
                    }
                    onClick={() =>
                      startTransition(() =>
                        toggleDadoSala(roomId, d.id, !idsSala.has(d.id))
                      )
                    }
                  >
                    {idsSala.has(d.id) ? "🔓" : "🔒"}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
        {soyHost && misDados.length > 0 && (
          <p className="mt-2 text-xs text-slate-500">
            🔒/🔓 comparte tus dados con todos los jugadores de la sala.
          </p>
        )}
      </div>

      <div className="card">
        <h2 className="mb-3 font-semibold">Tirada compuesta</h2>
        <div className="mb-3 flex flex-wrap gap-2">
          {DADOS_RAPIDOS.map((s) => (
            <button
              key={s}
              disabled={cerrada}
              onClick={() => agregarParte({ sides: s, count: 1 })}
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
              <button
                className="btn-ghost"
                onClick={() => {
                  setPartes([]);
                  setModificador(0);
                }}
              >
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
