"use client";

// Editor de dados personalizados: caras numéricas o símbolos del catálogo
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SIMBOLOS, type Cara, type Simbolo, iconoDeCara } from "@/lib/dice/catalog";
import { crearDado, borrarDado } from "./actions";

type Dado = { id: string; name: string; faces: Cara[] };

function carasNumericas(n: number): Cara[] {
  return Array.from({ length: n }, (_, i) => ({ value: i + 1 }));
}

export default function DiceEditor({ dados }: { dados: Dado[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [nombre, setNombre] = useState("");
  const [caras, setCaras] = useState<Cara[]>(carasNumericas(6));
  const [error, setError] = useState<string | null>(null);

  function setNumCaras(n: number) {
    setCaras((prev) =>
      n > prev.length
        ? [...prev, ...carasNumericas(n).slice(prev.length)]
        : prev.slice(0, n)
    );
  }

  function setCara(i: number, valor: string) {
    setCaras((prev) => {
      const copia = [...prev];
      copia[i] =
        valor in SIMBOLOS
          ? { symbol: valor as Simbolo }
          : { value: Number(valor) || 0 };
      return copia;
    });
  }

  function guardar() {
    setError(null);
    startTransition(async () => {
      const res = await crearDado(nombre, caras);
      if (res?.error) setError(res.error);
      else {
        setNombre("");
        setCaras(carasNumericas(6));
        router.refresh();
      }
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* ---- Crear dado ---- */}
      <section className="card space-y-4">
        <h2 className="font-semibold">Nuevo dado</h2>
        <input
          className="input"
          placeholder="Nombre (ej. Dado de combate)"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />
        <label className="flex items-center gap-3 text-sm text-slate-400">
          Nº de caras
          <input
            type="number"
            className="input !w-24"
            min={2}
            max={30}
            value={caras.length}
            onChange={(e) =>
              setNumCaras(Math.min(30, Math.max(2, Number(e.target.value) || 2)))
            }
          />
        </label>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {caras.map((cara, i) => (
            <div key={i} className="rounded-lg border border-slate-800 p-2">
              <p className="mb-1 text-xs text-slate-500">Cara {i + 1}</p>
              <select
                className="input !py-1"
                value={"symbol" in cara ? cara.symbol : "num"}
                onChange={(e) =>
                  e.target.value === "num"
                    ? setCara(i, String(i + 1))
                    : setCara(i, e.target.value)
                }
              >
                <option value="num">Número</option>
                {Object.entries(SIMBOLOS).map(([k, s]) => (
                  <option key={k} value={k}>
                    {s.icon} {s.label}
                  </option>
                ))}
              </select>
              {"value" in cara && (
                <input
                  type="number"
                  className="input mt-1 !py-1"
                  value={cara.value}
                  onChange={(e) => setCara(i, e.target.value)}
                />
              )}
            </div>
          ))}
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          className="btn w-full"
          disabled={pending || !nombre.trim()}
          onClick={guardar}
        >
          Guardar dado
        </button>
      </section>

      {/* ---- Mis dados ---- */}
      <section>
        <h2 className="mb-3 font-semibold">Mis dados</h2>
        {!dados.length && (
          <p className="text-sm text-slate-500">Aún no has creado ningún dado.</p>
        )}
        <ul className="space-y-2">
          {dados.map((d) => (
            <li key={d.id} className="card !p-3">
              <div className="flex items-center justify-between">
                <p className="font-medium">
                  {d.name}{" "}
                  <span className="text-xs text-slate-500">({d.faces.length} caras)</span>
                </p>
                <button
                  className="btn-ghost !px-2 !py-1"
                  onClick={() =>
                    startTransition(async () => {
                      await borrarDado(d.id);
                      router.refresh();
                    })
                  }
                >
                  ✕
                </button>
              </div>
              <p className="mt-1 flex flex-wrap gap-1">
                {d.faces.map((c, i) => (
                  <span
                    key={i}
                    className="inline-flex h-7 min-w-7 items-center justify-center rounded bg-slate-800 px-1 text-xs"
                  >
                    {iconoDeCara(c)}
                  </span>
                ))}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
