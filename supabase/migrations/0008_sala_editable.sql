-- ============================================================
-- Mejoras: la sala admite descripción breve (el nombre y el
-- sistema/juego ya existían y ahora son editables por el host).
-- ============================================================

alter table rooms add column description text;
