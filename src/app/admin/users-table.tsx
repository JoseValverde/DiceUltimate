"use client";

// Tabla de usuarios con cambio de rol
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cambiarRol } from "./actions";

type Usuario = { id: string; username: string; role: string; created_at: string };

export default function UsersTable({
  usuarios,
  miId,
}: {
  usuarios: Usuario[];
  miId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle(u: Usuario) {
    setError(null);
    startTransition(async () => {
      const res = await cambiarRol(u.id, u.role === "admin" ? "user" : "admin");
      if (res?.error) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="card !p-0">
      {error && <p className="p-3 text-sm text-red-400">{error}</p>}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-800 text-left text-slate-400">
            <th className="p-3">Usuario</th>
            <th className="p-3">Rol</th>
            <th className="p-3">Alta</th>
            <th className="p-3"></th>
          </tr>
        </thead>
        <tbody>
          {usuarios.map((u) => (
            <tr key={u.id} className="border-b border-slate-800/50">
              <td className="p-3 font-medium">
                {u.username}
                {u.id === miId && <span className="text-xs text-slate-500"> (tú)</span>}
              </td>
              <td className="p-3">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    u.role === "admin"
                      ? "bg-indigo-900/60 text-indigo-300"
                      : "bg-slate-800 text-slate-400"
                  }`}
                >
                  {u.role}
                </span>
              </td>
              <td className="p-3 text-slate-500">
                {new Date(u.created_at).toLocaleDateString("es-ES")}
              </td>
              <td className="p-3 text-right">
                {u.id !== miId && (
                  <button
                    className="btn-ghost !px-3 !py-1"
                    disabled={pending}
                    onClick={() => toggle(u)}
                  >
                    {u.role === "admin" ? "Quitar admin" : "Hacer admin"}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
