-- ============================================================
-- Fase 2 — Tiempo real
-- Publica los INSERTs de roll_history por el canal Realtime.
-- RLS se respeta: cada cliente solo recibe tiradas de salas
-- donde es miembro (política roll_history_select).
-- ============================================================

alter publication supabase_realtime add table roll_history;
