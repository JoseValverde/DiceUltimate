# 🎲 DiceUltimate

Webapp de gestión de tiradas de dados para juegos de mesa y rol. Salas privadas,
dados personalizados, tiradas guardadas y sincronización en vivo.

**Stack:** Next.js 14 (App Router, TypeScript) · Supabase (Auth, Postgres + RLS, Realtime) · Tailwind · Vercel.

## Estado del proyecto

- [x] **Fase 0 — Arquitectura** (`docs/fase-0-arquitectura.md`)
- [x] **Fase 1 — MVP**: auth email/Google + roles, salas privadas con código de invitación, motor de tiradas numéricas en servidor (semilla verificable), tiradas guardadas e historial persistido
- [x] **Fase 2 — Tiempo real**: tiradas propagadas en vivo (Realtime + RLS), presencia de jugadores conectados, historial de sesión compartido
- [x] **Fase 3 — Dados personalizados**: editor de caras (números y símbolos: éxito, fallo, crítico, blanco, escudo, espada), dados compartibles en sala, tiradas compuestas mixtas y conteo agregado de símbolos
- [x] **Fase 4 — Biblioteca comunitaria**: publicar configuraciones (dados + tiradas), búsqueda por juego/etiquetas, clonado a cuenta propia y moderación admin (aprobar/destacar/rechazar)
- [ ] Fase 5 — Panel de administración

## Puesta en marcha

1. **Supabase**: crea un proyecto y ejecuta en orden los archivos de
   `supabase/migrations/` en el SQL Editor (o `supabase db push` con la CLI).
2. **Auth**: en *Authentication → Providers* activa **Email** y **Google**
   (crea credenciales OAuth en Google Cloud Console y añade la URL de callback
   que indica Supabase).
3. **Variables**: copia `.env.local.example` a `.env.local` y rellena la URL y
   la `anon key` (*Settings → API*).
4. ```bash
   npm install
   npm run dev
   ```

## Despliegue (gratis)

Importa el repo en [vercel.com](https://vercel.com), añade las dos variables de
entorno y despliega. En Supabase, añade el dominio de Vercel en
*Authentication → URL Configuration* (Site URL y Redirect URLs).

## Aleatoriedad verificable

Las tiradas se ejecutan **en el servidor** (RPC `roll_dice`). Cada tirada guarda
una semilla (`roll_history.seed`) y los valores se derivan de forma determinista
con `md5(seed:parte:dado)`, de modo que cualquiera puede recomputar y auditar
el resultado.
