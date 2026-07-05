"use client";

// Tarjeta de configuración de la biblioteca: clonar y (admin) moderar
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { clonarConfiguracion, moderarItem, borrarItem } from "./actions";

export type ItemBiblioteca = {
  id: string;
  title: string;
  game: string | null;
  tags: string[];
  status: string;
  clones: number;
  author_id: string;
  content: { dice?: any[]; rolls?: any[] };
  username: string;
};

export default function ItemCard({
  item,
  esAdmin,
  esMio,
}: {
  item: ItemBiblioteca;
  esAdmin: boolean;
  esMio: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function accion(fn: () => Promise<any>) {
    setMsg(null);
    startTransition(async () => {
      const res = await fn();
      if (res?.error) setMsg(res.error);
      else router.refresh();
      if (!res?.error && fn.name === "") setMsg(null);
    });
  }

  return (
    <li className="card !p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium">
            {item.status === "featured" && "⭐ "}
            {item.title}
          </p>
          <p className="text-xs text-slate-500">
            {item.game || "Genérico"} · por {item.username} ·{" "}
            {item.content?.dice?.length ?? 0} dados, {item.content?.rolls?.length ?? 0} tiradas
            {item.clones > 0 && ` · ${item.clones} clonados`}
          </p>
        </div>
        {item.status === "pending" && (
          <span className="rounded-full bg-amber-900/60 px-2 py-0.5 text-xs text-amber-300">
            Pendiente
          </span>
        )}
        {item.status === "rejected" && (
          <span className="rounded-full bg-red-900/60 px-2 py-0.5 text-xs text-red-300">
            Rechazado
          </span>
        )}
      </div>

      {item.tags?.length > 0 && (
        <p className="mt-1 flex flex-wrap gap-1">
          {item.tags.map((t) => (
            <span key={t} className="rounded bg-slate-800 px-1.5 py-0.5 text-xs text-slate-400">
              #{t}
            </span>
          ))}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {["approved", "featured"].includes(item.status) && (
          <button
            className="btn !px-3 !py-1"
            disabled={pending}
            onClick={() =>
              accion(async () => {
                const r = await clonarConfiguracion(item.id);
                if (r?.ok) setMsg("Clonado a tu cuenta ✔");
                return r;
              })
            }
          >
            Clonar
          </button>
        )}
        {esAdmin && item.status === "pending" && (
          <>
            <button className="btn-ghost !px-3 !py-1" disabled={pending}
              onClick={() => accion(() => moderarItem(item.id, "approved"))}>
              Aprobar
            </button>
            <button className="btn-ghost !px-3 !py-1" disabled={pending}
              onClick={() => accion(() => moderarItem(item.id, "rejected"))}>
              Rechazar
            </button>
          </>
        )}
        {esAdmin && item.status === "approved" && (
          <button className="btn-ghost !px-3 !py-1" disabled={pending}
            onClick={() => accion(() => moderarItem(item.id, "featured"))}>
            ⭐ Destacar
          </button>
        )}
        {(esMio || esAdmin) && (
          <button className="btn-ghost !px-3 !py-1" disabled={pending}
            onClick={() => accion(async () => borrarItem(item.id))}>
            Eliminar
          </button>
        )}
      </div>
      {msg && <p className="mt-2 text-sm text-emerald-300">{msg}</p>}
    </li>
  );
}
