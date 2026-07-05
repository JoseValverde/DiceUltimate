"use server";

// Server Actions del editor de dados
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Cara } from "@/lib/dice/catalog";

export async function crearDado(name: string, faces: Cara[]) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !name.trim() || faces.length < 2) return { error: "Datos incompletos" };

  const { error } = await supabase
    .from("dice")
    .insert({ owner_id: user.id, name: name.trim(), faces });
  revalidatePath("/dados");
  if (error) return { error: error.message };
  return { ok: true };
}

export async function borrarDado(dieId: string) {
  const supabase = createClient();
  await supabase.from("dice").delete().eq("id", dieId);
  revalidatePath("/dados");
}
