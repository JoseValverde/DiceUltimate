# Guía de despliegue (100% gratis)

## 1. Supabase (ya configurado)

Proyecto: `rezovdofifhlddjrpxtj`. Las migraciones están en `supabase/migrations/`
(el archivo `setup-completo.sql` las concatena todas para una instalación desde cero).

## 2. Desplegar en Vercel

1. Entra en [vercel.com](https://vercel.com) e inicia sesión con tu cuenta de GitHub.
2. **Add New → Project** e importa `JoseValverde/DiceUltimate`.
3. En **Environment Variables** añade:
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://rezovdofifhlddjrpxtj.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = (tu anon key)
4. **Deploy**. Obtendrás una URL tipo `https://dice-ultimate.vercel.app`.

## 3. Conectar Supabase Auth con el dominio de Vercel

En el dashboard de Supabase → **Authentication → URL Configuration**:

- **Site URL**: `https://<tu-app>.vercel.app`
- **Redirect URLs**: añade `https://<tu-app>.vercel.app/auth/callback`
  (y `http://localhost:3000/auth/callback` para desarrollo local).

Sin esto, los enlaces de confirmación de email y el OAuth redirigen a localhost.

## 4. Google OAuth (opcional)

1. En [console.cloud.google.com](https://console.cloud.google.com): crea un proyecto →
   **APIs & Services → Credentials → Create Credentials → OAuth client ID** (tipo Web).
2. En **Authorized redirect URIs** pega la URL que muestra Supabase en
   **Authentication → Providers → Google** (tipo `https://rezovdofifhlddjrpxtj.supabase.co/auth/v1/callback`).
3. Copia el **Client ID** y **Client Secret** en ese mismo panel de Supabase y activa el proveedor.

## 5. Límites del plan gratuito

| Servicio | Límite relevante |
|---|---|
| Supabase Free | 500 MB BD · 200 conexiones realtime simultáneas · 50k usuarios activos/mes · **se pausa tras 7 días sin uso** (reactivar en dashboard) |
| Vercel Hobby | 100 GB ancho de banda/mes · funciones con timeout 10 s · uso no comercial |

Con cada `git push` a `main`, Vercel redespliega automáticamente.

## 6. Mantenimiento

- Nuevas migraciones: añade archivos numerados a `supabase/migrations/` y pégalos en el SQL Editor.
- Para dar rol admin al primer usuario:
  `update profiles set role='admin' where id = (select id from auth.users where email='tu@email');`
  (los siguientes se gestionan desde `/admin`).
