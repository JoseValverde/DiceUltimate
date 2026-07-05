"use server";

// Server Actions de sala: tirar dados (RPC), guardar/borrar tiradas
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ParteTirada =
  | { sides: number; count: number }              // dado numérico estándar
  | { die_id: string; count: number; nombre?: string }; // dado personalizado

export type DefinicionTirada = {
  parts: ParteTirada[];
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

// El anfitrión silencia o expulsa a un miembro (RLS: solo host)
export async function gestionarMiembro(
  roomId: string,
  userId: string,
  cambios: { muted?: boolean; banned?: boolean }
) {
  const supabase = createClient();
  const { error } = await supabase
    .from("room_members")
    .update(cambios)
    .match({ room_id: roomId, user_id: userId });
  revalidatePath(`/salas/${roomId}`);
  if (error) return { error: error.message };
  return { ok: true };
}

// El anfitrión cierra o reabre la sala
export async function cambiarEstadoSala(roomId: string, abrir: boolean) {
  const supabase = createClient();
  await supabase
    .from("rooms")
    .update({ status: abrir ? "open" : "closed" })
    .eq("id", roomId);
  revalidatePath(`/salas/${roomId}`);
}

// El anfitrión habilita/deshabilita un dado suyo para toda la sala
export async function toggleDadoSala(roomId: string, dieId: string, habilitar: boolean) {
  const supabase = createClient();
  if (habilitar) {
    await supabase.from("room_dice").insert({ room_id: roomId, die_id: dieId });
  } else {
    await supabase.from("room_dice").delete().match({ room_id: roomId, die_id: dieId });
  }
  revalidatePath(`/salas/${roomId}`);
}
