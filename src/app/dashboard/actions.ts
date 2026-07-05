"use server";

// Server Actions del dashboard: crear sala, unirse, cerrar sesión
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function crearSala(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const name = String(formData.get("name") ?? "").trim();
  const game = String(formData.get("game") ?? "").trim();
  if (!name) return;

  const { data, error } = await supabase
    .from("rooms")
    .insert({ name, game: game || null, host_id: user.id })
    .select("id")
    .single();
  if (error) throw new Error("No se pudo crear la sala");
  redirect(`/salas/${data.id}`);
}

export async function unirseSala(formData: FormData) {
  const supabase = createClient();
  const code = String(formData.get("code") ?? "").trim();
  if (!code) return;

  const { data, error } = await supabase.rpc("join_room", { p_code: code });
  if (error) redirect(`/dashboard?error=${encodeURIComponent(error.message)}`);
  redirect(`/salas/${data}`);
}

export async function cerrarSesion() {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function cerrarSala(roomId: string) {
  const supabase = createClient();
  await supabase.from("rooms").update({ status: "closed" }).eq("id", roomId);
  revalidatePath("/dashboard");
}
