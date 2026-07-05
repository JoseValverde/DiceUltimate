"use server";

// Server Actions de administración (RLS + trigger garantizan permisos en BD)
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function cambiarRol(userId: string, role: "user" | "admin") {
  const supabase = createClient();
  const { error } = await supabase.from("profiles").update({ role }).eq("id", userId);
  revalidatePath("/admin");
  if (error) return { error: error.message };
  return { ok: true };
}
