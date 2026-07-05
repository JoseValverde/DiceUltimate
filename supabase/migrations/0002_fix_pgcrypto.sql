-- ============================================================
-- Fix: en Supabase, pgcrypto vive en el esquema "extensions".
-- roll_dice usaba search_path = public y no encontraba gen_random_bytes.
-- ============================================================

alter function roll_dice(uuid, jsonb, text) set search_path = public, extensions;
