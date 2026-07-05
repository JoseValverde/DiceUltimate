"use server";

// Server Actions de sala: tirar dados (RPC), guardar/borrar tiradas
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type DefinicionTirada = {
  parts: { sides: number; count: number }[];
  modifier?: number;
};

export async function tirarDados(
  roomId: string,
  definition: DefinicionTirada,
  label?: string
) {
  const supabase = createClient();
  const { error } = await supabase.rpc("roll_dice", {
    p_room: roomId,
    p_definition: definition,
    p_label: label ?? null,
  });
  revalidatePath(`/salas/${roomId}`);
  if (error) return { error: error.message };
  return { ok: true };
}

export async function guardarTirada(
  roomId: string,
  name: string,
  definition: DefinicionTirada
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !name.trim()) return;
  await supabase
    .from("saved_rolls")
    .insert({ owner_id: user.id, name: name.trim(), definition });
  revalidatePath(`/salas/${roomId}`);
}

export async function borrarTirada(roomId: string, savedRollId: string) {
  const supabase = createClient();
  await supabase.from("saved_rolls").delete().eq("id", savedRollId);
  revalidatePath(`/salas/${roomId}`);
}
