"use server";

// Server Actions de la biblioteca: publicar, clonar y moderar
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Empaqueta dados + tiradas seleccionados y los publica (estado: pending)
export async function publicarConfiguracion(input: {
  title: string;
  game: string;
  tags: string; // separadas por comas
  dieIds: string[];
  rollIds: string[];
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };
  if (!input.title.trim()) return { error: "Falta el título" };
  if (!input.dieIds.length && !input.rollIds.length)
    return { error: "Selecciona al menos un dado o una tirada" };

  // Tiradas seleccionadas
  const { data: rolls } = input.rollIds.length
    ? await supabase.from("saved_rolls").select("id, name, definition").in("id", input.rollIds)
    : { data: [] as any[] };

  // Dados necesarios: los seleccionados + los referenciados por las tiradas
  const idsNecesarios = new Set(input.dieIds);
  for (const r of rolls ?? []) {
    for (const p of r.definition?.parts ?? []) {
      if (p.die_id) idsNecesarios.add(p.die_id);
    }
  }
  const { data: dice } = idsNecesarios.size
    ? await supabase
        .from("dice")
        .select("id, name, faces")
        .in("id", Array.from(idsNecesarios))
        .eq("owner_id", user.id)
    : { data: [] as any[] };

  // Índice die_id → posición en el paquete
  const indice = new Map((dice ?? []).map((d, i) => [d.id, i]));
  for (const id of Array.from(idsNecesarios)) {
    if (!indice.has(id))
      return { error: "Una tirada referencia un dado que no es tuyo" };
  }

  const content = {
    dice: (dice ?? []).map((d) => ({ name: d.name, faces: d.faces })),
    rolls: (rolls ?? []).map((r) => ({
      name: r.name,
      definition: {
        ...r.definition,
        parts: (r.definition?.parts ?? []).map((p: any) =>
          p.die_id
            ? { die_ref: indice.get(p.die_id), count: p.count }
            : p
        ),
      },
    })),
  };

  const tags = input.tags
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);

  const { error } = await supabase.from("library_items").insert({
    author_id: user.id,
    title: input.title.trim(),
    game: input.game.trim() || null,
    tags,
    content,
  });
  revalidatePath("/biblioteca");
  if (error) return { error: error.message };
  return { ok: true };
}

export async function clonarConfiguracion(itemId: string) {
  const supabase = createClient();
  const { error } = await supabase.rpc("clone_library_item", { p_item: itemId });
  revalidatePath("/biblioteca");
  if (error) return { error: error.message };
  return { ok: true };
}

// Moderación (solo admin; RLS lo garantiza en servidor)
export async function moderarItem(
  itemId: string,
  status: "approved" | "featured" | "rejected"
) {
  const supabase = createClient();
  const { error } = await supabase
    .from("library_items")
    .update({ status })
    .eq("id", itemId);
  revalidatePath("/biblioteca");
  if (error) return { error: error.message };
  return { ok: true };
}

export async function borrarItem(itemId: string) {
  const supabase = createClient();
  await supabase.from("library_items").delete().eq("id", itemId);
  revalidatePath("/biblioteca");
}
