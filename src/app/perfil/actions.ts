"use server";

// Server Actions de perfil: editar datos y eliminar cuenta
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function guardarPerfil(input: {
  username: string;
  bio: string;
  socials: Record<string, string>;
  show_email: boolean;
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const username = input.username.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
  if (username.length < 3) return { error: "El nombre debe tener al menos 3 caracteres (a-z, 0-9, _)" };

  // Solo redes con valor
  const socials = Object.fromEntries(
    Object.entries(input.socials)
      .map(([k, v]) => [k, v.trim()])
      .filter(([, v]) => v)
  );

  const { error } = await supabase
    .from("profiles")
    .update({
      username,
      bio: input.bio.trim() || null,
      socials,
      show_email: input.show_email,
    })
    .eq("id", user.id);
  revalidatePath("/perfil");
  if (error)
    return {
      error: error.code === "23505" ? "Ese nombre de usuario ya está en uso" : error.message,
    };
  return { ok: true };
}

export async function eliminarCuenta() {
  const supabase = createClient();
  const { error } = await supabase.rpc("delete_my_account");
  if (error) return { error: error.message };
  await supabase.auth.signOut();
  redirect("/login");
}
