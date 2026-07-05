-- ============================================================
-- Fase 5 — Seguridad reforzada
-- Evita que un usuario se auto-promocione: solo un admin
-- puede cambiar el campo "role" de un perfil.
-- ============================================================

create or replace function protect_role_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role and not is_admin() then
    raise exception 'Solo un administrador puede cambiar roles';
  end if;
  return new;
end;
$$;

create trigger on_profile_role_change
  before update on profiles
  for each row execute function protect_role_change();
