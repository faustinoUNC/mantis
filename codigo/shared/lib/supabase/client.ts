import { createBrowserClient } from '@supabase/ssr'

// Cliente de BROWSER — usar ÚNICAMENTE para supabase.auth.* y suscripciones Realtime.
// Los datos van siempre por server actions (features/{modulo}/service.ts).
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
